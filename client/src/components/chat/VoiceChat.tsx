import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com/api"
  : "/api";

// ── Types ──────────────────────────────────────────

interface UseVoiceChatOptions {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

interface UseVoiceChatReturn {
  voiceEnabled: boolean;
  toggleVoice: () => void;
  isListening: boolean;
  isTranscribing: boolean;
  isSpeaking: boolean;
  inConversation: boolean;
  interimTranscript: string;
  spokenText: string;
  startListening: () => void;
  stopListening: () => void;
  interruptAndListen: () => void;
  feedText: (delta: string) => void;
  finishSpeaking: () => void;
  stopSpeaking: () => void;
  stopEverything: () => void;
}

// ── Helpers ─────────────────────────────────────────

const cleanMarkdown = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]/g, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ");

const ABBREVS = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp|Ave|St|Dept|Est|approx|i\.e|e\.g)\./gi;
function extractSentence(buffer: string): { sentence: string; rest: string } | null {
  const masked = buffer.replace(ABBREVS, (m) => m.replace(/\./g, "\x00"));
  const match = masked.match(/[.!?]+[\s]+/);
  if (!match || match.index === undefined) return null;
  const splitAt = match.index + match[0].length;
  const sentence = buffer.slice(0, splitAt).trim();
  const rest = buffer.slice(splitAt);
  if (sentence.length < 3) return null;
  return { sentence, rest };
}

// Detect Web Speech API support
const SpeechRecognitionClass: typeof SpeechRecognition | null =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// ── Hook ───────────────────────────────────────────

export function useVoiceChat({ onTranscript, onError }: UseVoiceChatOptions): UseVoiceChatReturn {
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem("voice-chat-enabled") === "true";
  });
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [inConversation, setInConversation] = useState(false);
  const [spokenText, setSpokenText] = useState("");

  // STT mode: 'native' (Web Speech API) or 'whisper' (MediaRecorder + server)
  const sttModeRef = useRef<"native" | "whisper">(SpeechRecognitionClass ? "native" : "whisper");
  const nativeErrorCountRef = useRef(0);
  const MAX_NATIVE_ERRORS = 3;

  // Native STT refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Whisper STT refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceCleanupRef = useRef<(() => void) | null>(null);
  // When true, onstop handler should NOT send audio for transcription
  const discardRecordingRef = useRef(false);

  // Shared refs
  const textBufferRef = useRef("");
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const playingLockRef = useRef(false);
  const doneReceivedRef = useRef(false);
  const pendingTTSRef = useRef(0);

  // TTS ordering: ensures audio plays in sentence order even if API responses arrive out of order
  const ttsSequenceRef = useRef(0);
  const ttsResultsRef = useRef<Map<number, ArrayBuffer>>(new Map());
  const ttsNextToPlayRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;
  const inConversationRef = useRef(inConversation);
  inConversationRef.current = inConversation;
  const startListeningRef = useRef<() => void>(() => {});

  // Web Audio API for reliable mobile playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      discardRecordingRef.current = true;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      silenceCleanupRef.current?.();
      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop(); } catch { /* noop */ }
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close();
      }
    };
  }, []);

  // ── Shared helpers ────────────────────────────────

  const isRecordingActive = useCallback(() => {
    return !!recognitionRef.current || !!mediaRecorderRef.current;
  }, []);

  const maybeRestartMic = useCallback(() => {
    if (
      doneReceivedRef.current &&
      !isPlayingRef.current &&
      audioQueueRef.current.length === 0 &&
      pendingTTSRef.current === 0 &&
      voiceEnabledRef.current &&
      !isRecordingActive()
    ) {
      doneReceivedRef.current = false;
      setTimeout(() => {
        if (voiceEnabledRef.current && !isPlayingRef.current && !isRecordingActive()) {
          startListeningRef.current();
        }
      }, 300);
    }
  }, [isRecordingActive]);

  const killAudio = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch { /* noop */ }
      currentSourceRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    playingLockRef.current = false;
    doneReceivedRef.current = false;
    pendingTTSRef.current = 0;
    textBufferRef.current = "";
    // Reset TTS ordering
    ttsSequenceRef.current = 0;
    ttsResultsRef.current.clear();
    ttsNextToPlayRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const stopAllRecording = useCallback(() => {
    // Stop native recognition
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    // Stop whisper recording - set discard flag so onstop won't send audio
    discardRecordingRef.current = true;
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop(); // onstop will fire but discard the audio
    }
    mediaRecorderRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsListening(false);
    setIsTranscribing(false);
    setInterimTranscript("");
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      localStorage.setItem("voice-chat-enabled", String(next));
      if (!next) {
        setInConversation(false);
        stopAllRecording();
        killAudio();
      }
      return next;
    });
  }, [killAudio, stopAllRecording]);

  // ── Native STT (Web Speech API) ──────────────────

  const startNativeListening = useCallback(() => {
    if (recognitionRef.current || !SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);

      if (final.trim()) {
        recognition.stop();
        recognitionRef.current = null;
        setIsListening(false);
        setInterimTranscript("");
        setInConversation(true);
        nativeErrorCountRef.current = 0;
        onTranscriptRef.current(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") return;

      // no-speech is not a real error - just silence. Don't count it.
      if (event.error === "no-speech") return;

      console.warn("[Voice] Native STT error:", event.error);
      nativeErrorCountRef.current++;

      if (nativeErrorCountRef.current >= MAX_NATIVE_ERRORS) {
        console.warn("[Voice] Too many native STT errors, switching to Whisper fallback");
        sttModeRef.current = "whisper";
        recognitionRef.current = null;
        setIsListening(false);
        setInterimTranscript("");
        if (voiceEnabledRef.current) {
          setTimeout(() => startListeningRef.current(), 300);
        }
        return;
      }

      recognitionRef.current = null;
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onend = () => {
      const wasActive = recognitionRef.current === recognition;
      recognitionRef.current = null;

      if (wasActive && voiceEnabledRef.current && !isPlayingRef.current) {
        // Recognition ended unexpectedly (timeout, no-speech, etc.) - restart
        setTimeout(() => {
          if (voiceEnabledRef.current && !isPlayingRef.current && !isRecordingActive()) {
            startListeningRef.current();
          }
        }, 100);
      } else {
        setIsListening(false);
        setInterimTranscript("");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setSpokenText("");
  }, [isRecordingActive]);

  // ── Whisper STT (fallback) ────────────────────────

  const sendAudioForTranscription = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1000) {
      if (voiceEnabledRef.current && inConversationRef.current) {
        setTimeout(() => startListeningRef.current(), 300);
      }
      return;
    }

    setIsTranscribing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const res = await fetch(`${API_BASE}/stt`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      if (!res.ok) {
        console.warn("[Voice] STT request failed:", res.status);
        onErrorRef.current?.("Transcription failed. Please try again.");
        if (voiceEnabledRef.current && inConversationRef.current) {
          setTimeout(() => startListeningRef.current(), 300);
        }
        return;
      }

      const { text } = await res.json() as { text: string };
      // Filter out Whisper hallucinations (very short transcripts from silence)
      if (text && text.trim().length > 2) {
        setInConversation(true);
        onTranscriptRef.current(text.trim());
      } else {
        if (voiceEnabledRef.current && inConversationRef.current) {
          setTimeout(() => startListeningRef.current(), 300);
        }
      }
    } catch (err) {
      console.warn("[Voice] STT error:", err);
      onErrorRef.current?.("Transcription failed. Check your connection.");
      if (voiceEnabledRef.current && inConversationRef.current) {
        setTimeout(() => startListeningRef.current(), 300);
      }
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const startWhisperListening = useCallback(async () => {
    if (mediaRecorderRef.current) return;
    discardRecordingRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        silenceCleanupRef.current?.();
        silenceCleanupRef.current = null;
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setIsListening(false);
        setInterimTranscript("");

        // If we were intentionally stopped (stopAllRecording), don't transcribe
        if (discardRecordingRef.current) {
          audioChunksRef.current = [];
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];
        sendAudioForTranscription(blob);
      };

      recorder.onerror = () => {
        console.warn("[Voice] MediaRecorder error");
        silenceCleanupRef.current?.();
        silenceCleanupRef.current = null;
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setIsListening(false);
      };

      // Silence detection: auto-stop after 2s of silence
      try {
        const sttCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = sttCtx.createMediaStreamSource(stream);
        const analyser = sttCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let silenceStart: number | null = null;

        const interval = setInterval(() => {
          analyser.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128;
            sum += val * val;
          }
          const rms = Math.sqrt(sum / dataArray.length) * 100;

          if (rms < 15) {
            if (!silenceStart) silenceStart = Date.now();
            if (Date.now() - silenceStart > 2000) {
              if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
              }
            }
          } else {
            silenceStart = null;
          }
        }, 100);

        silenceCleanupRef.current = () => {
          clearInterval(interval);
          source.disconnect();
          sttCtx.close().catch(() => {});
        };
      } catch {
        // Silence detection failed
      }

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsListening(true);
      setSpokenText("");
      setInterimTranscript("Recording...");
    } catch (err) {
      console.warn("[Voice] Microphone access denied:", err);
      onErrorRef.current?.("Microphone access denied. Please allow microphone permissions.");
    }
  }, [getAudioContext, sendAudioForTranscription]);

  // ── Unified start listening ───────────────────────

  const startListening = useCallback(() => {
    if (isRecordingActive()) return;
    getAudioContext();

    if (sttModeRef.current === "native") {
      startNativeListening();
    } else {
      startWhisperListening();
    }
  }, [getAudioContext, startNativeListening, startWhisperListening, isRecordingActive]);

  startListeningRef.current = startListening;

  const interruptAndListen = useCallback(() => {
    killAudio();
    setTimeout(() => startListeningRef.current(), 150);
  }, [killAudio]);

  const stopListening = useCallback(() => {
    setInConversation(false);
    stopAllRecording();
    killAudio();
  }, [killAudio, stopAllRecording]);

  const stopEverything = useCallback(() => {
    setInConversation(false);
    stopAllRecording();
    killAudio();
  }, [killAudio, stopAllRecording]);

  // ── TTS Audio Queue ───────────────────────────────

  const playNext = useCallback(async () => {
    if (playingLockRef.current) return;

    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      maybeRestartMic();
      return;
    }

    playingLockRef.current = true;
    isPlayingRef.current = true;
    setIsSpeaking(true);

    const arrayBuffer = audioQueueRef.current.shift()!;

    try {
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      currentSourceRef.current = source;

      source.onended = () => {
        currentSourceRef.current = null;
        playingLockRef.current = false;
        playNext();
      };

      source.start();
    } catch (err) {
      console.warn("[Voice] Audio playback failed:", err);
      currentSourceRef.current = null;
      playingLockRef.current = false;
      playNext();
    }
  }, [maybeRestartMic, getAudioContext]);

  const ttsErrorShownRef = useRef(false);

  // Flush any TTS results that are ready in sequence order
  const flushTTSResults = useCallback(() => {
    while (ttsResultsRef.current.has(ttsNextToPlayRef.current)) {
      const buf = ttsResultsRef.current.get(ttsNextToPlayRef.current)!;
      ttsResultsRef.current.delete(ttsNextToPlayRef.current);
      ttsNextToPlayRef.current++;
      audioQueueRef.current.push(buf);
    }
    if (audioQueueRef.current.length > 0 && !isPlayingRef.current) {
      playNext();
    }
  }, [playNext]);

  const queueTTS = useCallback(async (text: string) => {
    // Assign a sequence number so audio plays in order
    const seq = ttsSequenceRef.current++;
    pendingTTSRef.current++;

    const attemptTTS = async (retry: number): Promise<void> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${API_BASE}/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          if (retry < 1 && (res.status >= 500 || res.status === 429)) {
            await new Promise(r => setTimeout(r, 500));
            return attemptTTS(retry + 1);
          }
          if (!ttsErrorShownRef.current) {
            ttsErrorShownRef.current = true;
            onErrorRef.current?.("Voice output unavailable. Check ElevenLabs API key.");
          }
          // Skip this sequence slot so we don't block subsequent audio
          ttsNextToPlayRef.current = Math.max(ttsNextToPlayRef.current, seq + 1);
          flushTTSResults();
          return;
        }

        ttsErrorShownRef.current = false;
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > 0) {
          // Store result at its sequence position
          ttsResultsRef.current.set(seq, arrayBuffer);
          flushTTSResults();
        } else {
          // Empty buffer - skip this slot
          ttsNextToPlayRef.current = Math.max(ttsNextToPlayRef.current, seq + 1);
          flushTTSResults();
        }
      } catch (err) {
        if (retry < 1) {
          await new Promise(r => setTimeout(r, 500));
          return attemptTTS(retry + 1);
        }
        if (!ttsErrorShownRef.current) {
          ttsErrorShownRef.current = true;
          onErrorRef.current?.("Voice output failed. Check your connection.");
        }
        // Skip this sequence slot
        ttsNextToPlayRef.current = Math.max(ttsNextToPlayRef.current, seq + 1);
        flushTTSResults();
      }
    };

    try {
      await attemptTTS(0);
    } finally {
      pendingTTSRef.current--;
      maybeRestartMic();
    }
  }, [flushTTSResults, maybeRestartMic]);

  // ── Feed streaming text for TTS ──────────────────

  const feedText = useCallback((delta: string) => {
    if (!voiceEnabledRef.current) return;

    textBufferRef.current += delta;
    setSpokenText(prev => prev + delta);

    let result = extractSentence(textBufferRef.current);
    while (result) {
      const clean = cleanMarkdown(result.sentence);
      textBufferRef.current = result.rest;
      if (clean.length > 2) {
        queueTTS(clean);
      }
      result = extractSentence(textBufferRef.current);
    }
  }, [queueTTS]);

  const finishSpeaking = useCallback(() => {
    const remaining = textBufferRef.current.trim();
    textBufferRef.current = "";
    doneReceivedRef.current = true;

    if (remaining.length > 2 && voiceEnabledRef.current) {
      const clean = cleanMarkdown(remaining);
      if (clean.length > 2) {
        queueTTS(clean);
        return;
      }
    }

    maybeRestartMic();
  }, [queueTTS, maybeRestartMic]);

  const stopSpeaking = useCallback(() => {
    killAudio();
    setInConversation(false);
  }, [killAudio]);

  return {
    voiceEnabled,
    toggleVoice,
    isListening,
    isTranscribing,
    isSpeaking,
    inConversation,
    interimTranscript,
    spokenText,
    startListening,
    stopListening,
    interruptAndListen,
    feedText,
    finishSpeaking,
    stopSpeaking,
    stopEverything,
  };
}

// ── UI Components ──────────────────────────────────

export function VoiceModeToggle({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
        enabled
          ? "bg-primary/10 text-primary border border-primary/30"
          : "bg-muted/50 text-muted-foreground border border-border hover:text-foreground"
      }`}
      title={enabled ? "Voice mode on" : "Voice mode off"}
    >
      {enabled ? <Volume2 className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
      <span>Voice {enabled ? "On" : "Off"}</span>
    </button>
  );
}

export function MicButton({
  isListening,
  isSpeaking,
  disabled,
  onToggle,
  onInterrupt,
}: {
  isListening: boolean;
  isSpeaking?: boolean;
  disabled: boolean;
  onToggle: () => void;
  onInterrupt?: () => void;
}) {
  const handleClick = () => {
    if (isSpeaking && onInterrupt) {
      onInterrupt();
    } else {
      onToggle();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled && !isSpeaking}
      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
        isListening
          ? "bg-red-500/20 text-red-400 animate-pulse ring-2 ring-red-500/30"
          : isSpeaking
          ? "bg-orange-500/20 text-orange-400 hover:bg-red-500/20 hover:text-red-400"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
      title={isListening ? "Stop listening" : isSpeaking ? "Interrupt & speak" : "Start listening"}
    >
      {isSpeaking && !isListening ? <VolumeX className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
