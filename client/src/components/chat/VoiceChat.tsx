import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com/api"
  : "/api";

// ── Types ──────────────────────────────────────────

interface UseVoiceChatOptions {
  onTranscript: (text: string) => void;
}

interface UseVoiceChatReturn {
  voiceEnabled: boolean;
  toggleVoice: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  inConversation: boolean;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  interruptAndListen: () => void;
  feedText: (delta: string) => void;
  finishSpeaking: () => void;
  stopSpeaking: () => void;
}

// ── Hook ───────────────────────────────────────────

export function useVoiceChat({ onTranscript }: UseVoiceChatOptions): UseVoiceChatReturn {
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    return localStorage.getItem("voice-chat-enabled") === "true";
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [inConversation, setInConversation] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textBufferRef = useRef("");
  const audioQueueRef = useRef<Blob[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const doneReceivedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;
  const inConversationRef = useRef(inConversation);
  inConversationRef.current = inConversation;
  const startListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      currentAudioRef.current?.pause();
      currentAudioRef.current = null;
    };
  }, []);

  // Helper: kill all playing/queued audio
  const killAudio = useCallback(() => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    doneReceivedRef.current = false;
    textBufferRef.current = "";
    setIsSpeaking(false);
  }, []);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      localStorage.setItem("voice-chat-enabled", String(next));
      if (!next) {
        setInConversation(false);
        recognitionRef.current?.stop();
        recognitionRef.current = null;
        setIsListening(false);
        setInterimTranscript("");
        killAudio();
      }
      return next;
    });
  }, [killAudio]);

  // ── Speech Recognition (STT) ────────────────────

  const startListening = useCallback(() => {
    if (recognitionRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognition();
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
        // Stop mic while waiting for response + TTS
        recognition.stop();
        recognitionRef.current = null;
        setIsListening(false);
        setInterimTranscript("");
        setInConversation(true);
        onTranscriptRef.current(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error !== "aborted") {
        setIsListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // Auto-restart only if not playing audio (prevent echo)
      if (voiceEnabledRef.current && inConversationRef.current && !isPlayingRef.current) {
        setTimeout(() => {
          if (voiceEnabledRef.current && !isPlayingRef.current) {
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
  }, []);

  startListeningRef.current = startListening;

  // Manual interrupt: stop audio + start listening (user taps mic to interrupt)
  const interruptAndListen = useCallback(() => {
    killAudio();
    // Small delay to ensure audio is fully stopped before mic opens
    setTimeout(() => startListeningRef.current(), 150);
  }, [killAudio]);

  const stopListening = useCallback(() => {
    setInConversation(false);
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript("");
    killAudio();
  }, [killAudio]);

  // ── TTS Audio Queue ──────────────────────────────

  const playNext = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      // Audio done - restart mic if in conversation mode
      if (doneReceivedRef.current && voiceEnabledRef.current) {
        doneReceivedRef.current = false;
        setTimeout(() => {
          if (voiceEnabledRef.current && !isPlayingRef.current) {
            startListeningRef.current();
          }
        }, 400);
      }
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);

    const blob = audioQueueRef.current.shift()!;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudioRef.current = audio;

    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      playNext();
    };

    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      playNext();
    };

    try {
      await audio.play();
    } catch {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      playNext();
    }
  }, []);

  const queueTTS = useCallback(async (text: string) => {
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

      if (!res.ok) return;

      const blob = await res.blob();
      audioQueueRef.current.push(blob);

      if (!isPlayingRef.current) {
        playNext();
      }
    } catch {
      // TTS failed silently
    }
  }, [playNext]);

  // ── Feed streaming text for TTS ──────────────────

  const cleanMarkdown = (text: string) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/#{1,6}\s/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_~]/g, "");

  const feedText = useCallback((delta: string) => {
    if (!voiceEnabledRef.current) return;

    textBufferRef.current += delta;

    const sentenceEnd = /([.!?])\s+/;
    const buffer = textBufferRef.current;
    const match = buffer.match(sentenceEnd);

    if (match && match.index !== undefined) {
      const splitAt = match.index + match[0].length;
      const sentence = buffer.slice(0, splitAt).trim();
      textBufferRef.current = buffer.slice(splitAt);

      if (sentence.length > 2) {
        const clean = cleanMarkdown(sentence);
        if (clean.trim()) {
          queueTTS(clean.trim());
        }
      }
    }
  }, [queueTTS]);

  const finishSpeaking = useCallback(() => {
    const remaining = textBufferRef.current.trim();
    textBufferRef.current = "";
    doneReceivedRef.current = true;

    if (remaining.length > 2 && voiceEnabledRef.current) {
      const clean = cleanMarkdown(remaining);
      if (clean.trim()) {
        queueTTS(clean.trim());
        return;
      }
    }

    if (!isPlayingRef.current && audioQueueRef.current.length === 0 && voiceEnabledRef.current && !recognitionRef.current) {
      setTimeout(() => {
        if (voiceEnabledRef.current && !isPlayingRef.current) {
          startListeningRef.current();
        }
      }, 400);
    }
  }, [queueTTS]);

  const stopSpeaking = useCallback(() => {
    killAudio();
    setInConversation(false);
  }, [killAudio]);

  return {
    voiceEnabled,
    toggleVoice,
    isListening,
    isSpeaking,
    inConversation,
    interimTranscript,
    startListening,
    stopListening,
    interruptAndListen,
    feedText,
    finishSpeaking,
    stopSpeaking,
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
  // When assistant is speaking, mic button becomes an interrupt button
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
