import { useEffect, useRef } from "react";
import { X, Mic, Volume2 } from "lucide-react";

interface VoiceConversationOverlayProps {
  isListening: boolean;
  isTranscribing?: boolean;
  isSpeaking: boolean;
  interimTranscript: string;
  spokenText: string;
  onInterrupt: () => void;
  onStop: () => void;
}

export function VoiceConversationOverlay({
  isListening,
  isTranscribing,
  isSpeaking,
  interimTranscript,
  spokenText,
  onInterrupt,
  onStop,
}: VoiceConversationOverlayProps) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  // Keep screen awake during voice conversation
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    (async () => {
      try {
        if ("wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
          wakeLockRef.current = lock;
        }
      } catch {
        // Wake Lock not supported or denied
      }
    })();
    return () => {
      lock?.release();
      wakeLockRef.current = null;
    };
  }, []);

  // Haptic feedback on state changes
  useEffect(() => {
    if (isListening && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, [isListening]);

  // Auto-scroll spoken text
  useEffect(() => {
    if (textRef.current) {
      textRef.current.scrollTop = textRef.current.scrollHeight;
    }
  }, [spokenText]);

  const handleTapArea = () => {
    if (isSpeaking) {
      onInterrupt();
    }
  };

  // Current status label
  const status = isListening
    ? "Listening..."
    : isTranscribing
    ? "Transcribing..."
    : isSpeaking
    ? "Speaking..."
    : "Processing...";

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-sm font-medium text-muted-foreground">Voice Conversation</span>
        <button
          onClick={onStop}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted/80 text-muted-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main area - tap to interrupt */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 gap-6 min-h-0"
        onClick={handleTapArea}
      >
        {/* Animated orb */}
        <div className="relative flex items-center justify-center">
          {/* Outer rings */}
          {isListening && (
            <>
              <div className="absolute w-40 h-40 rounded-full border-2 border-red-500/20 animate-ping" />
              <div className="absolute w-32 h-32 rounded-full border-2 border-red-500/30 animate-pulse" />
            </>
          )}
          {isSpeaking && (
            <>
              <div className="absolute w-40 h-40 rounded-full border-2 border-primary/20 voice-breathe" />
              <div className="absolute w-32 h-32 rounded-full border-2 border-primary/30 voice-breathe-delay" />
            </>
          )}
          {isTranscribing && !isListening && !isSpeaking && (
            <div className="absolute w-32 h-32 rounded-full border-2 border-yellow-500/30 animate-pulse" />
          )}
          {!isListening && !isSpeaking && !isTranscribing && (
            <div className="absolute w-32 h-32 rounded-full border-2 border-muted-foreground/20 animate-pulse" />
          )}

          {/* Center orb */}
          <div
            className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
              isListening
                ? "bg-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.3)]"
                : isSpeaking
                ? "bg-primary/20 shadow-[0_0_40px_rgba(99,102,241,0.3)]"
                : "bg-muted/50"
            }`}
          >
            {isListening ? (
              <Mic className="w-10 h-10 text-red-400" />
            ) : (
              <Volume2 className={`w-10 h-10 ${isSpeaking ? "text-primary" : "text-muted-foreground"}`} />
            )}
          </div>
        </div>

        {/* Status */}
        <p className="text-sm font-medium text-muted-foreground">{status}</p>

        {/* Transcript / Response text */}
        <div
          ref={textRef}
          className="w-full max-w-md max-h-[30vh] overflow-y-auto text-center px-4"
        >
          {isListening && interimTranscript && (
            <p className="text-lg text-foreground/80 italic">"{interimTranscript}"</p>
          )}
          {!isListening && spokenText && (
            <p className="text-base text-foreground/70 leading-relaxed">{spokenText}</p>
          )}
        </div>

        {/* Tap hint when speaking */}
        {isSpeaking && (
          <p className="text-xs text-muted-foreground/60">Tap to interrupt</p>
        )}
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 px-4 pb-6 pt-3 flex justify-center">
        <button
          onClick={onStop}
          className="px-6 py-3 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 text-sm font-medium transition-colors"
        >
          End Conversation
        </button>
      </div>

      {/* Scoped animations */}
      <style>{`
        @keyframes voice-breathe {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.08); opacity: 0.6; }
        }
        .voice-breathe {
          animation: voice-breathe 2s ease-in-out infinite;
        }
        .voice-breathe-delay {
          animation: voice-breathe 2s ease-in-out infinite 0.5s;
        }
      `}</style>
    </div>
  );
}
