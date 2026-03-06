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

/**
 * Voice states (strict state machine — no overlap between mic and audio):
 *   IDLE       → mic off, audio off, not in a conversation
 *   LISTENING  → mic on, audio off, waiting for user to speak
 *   PROCESSING → mic off, audio off, waiting for server response
 *   SPEAKING   → mic off, audio playing from TTS queue
 */
type VoiceState = "idle" | "listening" | "processing" | "speaking";

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
  stopEverything: () => void;
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

  // State machine ref — single source of truth
  const stateRef = useRef<VoiceState>("idle");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const textBufferRef = useRef("");
  const audioQueueRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const doneReceivedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;
  const startListeningRef = useRef<() => void>(() => {});

  // Sequential TTS queue: sentences wait in line, fetched one at a time in order
  const ttsTextQueueRef = useRef<string[]>([]);
  const ttsFetchingRef = useRef(false);

  useEffect(() => {
    return () => {
      hardStopMic();
      killAudioInternal();
    };
  }, []);

  // ── Internal helpers (no state machine transitions) ──

  /** Force-stop the mic immediately. */
  const hardStopMic = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript("");
  };

  /** Kill all audio playback and clear queues. */
  const killAudioInternal = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    ttsTextQueueRef.current = [];  // also clear pending text-to-fetch
    textBufferRef.current = "";
    doneReceivedRef.current = false;
    setIsSpeaking(false);
  };

  // ── State transitions ───────────────────────────

  const transitionTo = useCallback((newState: VoiceState) => {
    const prev = stateRef.current;
    if (prev === newState) return;
    stateRef.current = newState;

    switch (newState) {
      case "idle":
        hardStopMic();
        killAudioInternal();
        setInConversation(false);
        break;
      case "listening":
        // Mic on ONLY after audio is confirmed dead
        killAudioInternal();
        setInConversation(true);
        actuallyStartMic();
        break;
      case "processing":
        hardStopMic();
        setInConversation(true);
        break;
      case "speaking":
        hardStopMic(); // CRITICAL: mic must be off before any audio
        setInConversation(true);
        setIsSpeaking(true);
        break;
    }
  }, []);

  // ── Mic control ─────────────────────────────────

  const actuallyStartMic = () => {
    // Safety: never start mic if audio is playing or queued
    if (currentAudioRef.current || audioQueueRef.current.length > 0) {
      console.warn("[voice] Refusing to start mic — audio still active");
      return;
    }
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
      // If we're not in listening state, ignore results (stale events)
      if (stateRef.current !== "listening") return;

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
        // Got a final transcript — transition to processing
        transitionTo("processing");
        onTranscriptRef.current(final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.warn("Speech recognition error:", event.error);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        recognitionRef.current = null;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // Only auto-restart if we're still supposed to be listening
      if (stateRef.current === "listening" && voiceEnabledRef.current) {
        // Small delay then restart
        setTimeout(() => {
          if (stateRef.current === "listening" && voiceEnabledRef.current) {
            actuallyStartMic();
          } else {
            setIsListening(false);
          }
        }, 200);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  startListeningRef.current = () => {
    if (voiceEnabledRef.current) transitionTo("listening");
  };

  // ── Public API ──────────────────────────────────

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const next = !prev;
      localStorage.setItem("voice-chat-enabled", String(next));
      if (!next) {
        transitionTo("idle");
      }
      return next;
    });
  }, [transitionTo]);

  const startListening = useCallback(() => {
    transitionTo("listening");
  }, [transitionTo]);

  const stopListening = useCallback(() => {
    transitionTo("idle");
  }, [transitionTo]);

  const interruptAndListen = useCallback(() => {
    // Kill audio, then go to listening (with a brief delay for audio cleanup)
    killAudioInternal();
    hardStopMic();
    stateRef.current = "idle";
    setTimeout(() => {
      if (voiceEnabledRef.current) {
        transitionTo("listening");
      }
    }, 300);
  }, [transitionTo]);

  const stopSpeaking = useCallback(() => {
    transitionTo("idle");
  }, [transitionTo]);

  const stopEverything = useCallback(() => {
    transitionTo("idle");
  }, [transitionTo]);

  // ── TTS Audio Queue ────────────────────────────

  const playNext = useCallback(() => {
    if (audioQueueRef.current.length === 0) {
      // No more audio to play
      setIsSpeaking(false);

      if (doneReceivedRef.current && voiceEnabledRef.current) {
        // Response complete, all audio played — now safe to open mic
        doneReceivedRef.current = false;
        // Delay to let speaker output fully stop before mic opens
        setTimeout(() => {
          if (voiceEnabledRef.current && stateRef.current === "speaking") {
            transitionTo("listening");
          }
        }, 600);
      }
      return;
    }

    // Ensure mic is off before playing
    hardStopMic();
    stateRef.current = "speaking";
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

    audio.play().catch(() => {
      URL.revokeObjectURL(url);
      currentAudioRef.current = null;
      playNext();
    });
  }, [transitionTo]);

  // Process the TTS text queue sequentially — one fetch at a time, in order
  const processTTSQueue = useCallback(async () => {
    if (ttsFetchingRef.current) return; // already processing
    ttsFetchingRef.current = true;

    while (ttsTextQueueRef.current.length > 0) {
      if (stateRef.current === "idle") {
        // User hit stop — drain the queue without fetching
        ttsTextQueueRef.current = [];
        break;
      }

      const text = ttsTextQueueRef.current.shift()!;

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

        if (!res.ok) continue;
        if (stateRef.current === "idle") break;

        const blob = await res.blob();
        audioQueueRef.current.push(blob);

        // Start playback if not already playing
        if (!currentAudioRef.current) {
          transitionTo("speaking");
          playNext();
        }
      } catch {
        // TTS fetch failed — skip this sentence
      }
    }

    ttsFetchingRef.current = false;
  }, [playNext, transitionTo]);

  // Add text to the sequential TTS queue
  const queueTTS = useCallback((text: string) => {
    ttsTextQueueRef.current.push(text);
    processTTSQueue();
  }, [processTTSQueue]);

  // ── Feed streaming text for TTS ────────────────

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

  const feedText = useCallback((delta: string) => {
    if (!voiceEnabledRef.current) return;
    if (stateRef.current === "idle") return;

    textBufferRef.current += delta;

    const splitPattern = /([.!?:;])\s+|\n\n+/;
    let buffer = textBufferRef.current;
    let match = buffer.match(splitPattern);

    while (match && match.index !== undefined) {
      const splitAt = match.index + match[0].length;
      const sentence = buffer.slice(0, splitAt).trim();
      buffer = buffer.slice(splitAt);

      if (sentence.length > 2) {
        const clean = cleanMarkdown(sentence);
        if (clean.trim()) {
          queueTTS(clean.trim());
        }
      }
      match = buffer.match(splitPattern);
    }

    textBufferRef.current = buffer;

    // Safety flush for long buffers without sentence breaks
    if (textBufferRef.current.length > 200) {
      const clean = cleanMarkdown(textBufferRef.current.trim());
      textBufferRef.current = "";
      if (clean.trim() && clean.trim().length > 2) {
        queueTTS(clean.trim());
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
        return; // playNext will handle mic restart after queue drains
      }
    }

    // No remaining text — if nothing is playing, go to listening
    if (!currentAudioRef.current && audioQueueRef.current.length === 0 && voiceEnabledRef.current) {
      doneReceivedRef.current = false;
      setTimeout(() => {
        if (voiceEnabledRef.current && stateRef.current !== "idle") {
          transitionTo("listening");
        }
      }, 600);
    }
  }, [queueTTS, transitionTo]);

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
