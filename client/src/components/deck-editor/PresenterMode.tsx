import { useState, useEffect, useCallback, useRef } from 'react';
import { Slide } from '@/types/deck';
import { ScaledSlide } from './ScaledSlide';
import { SlideRenderer } from './SlideRenderer';
import { 
  ChevronLeft, ChevronRight, X, Clock, Maximize2, 
  MessageSquare, Grid3X3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PresenterModeProps {
  slides: Slide[];
  initialSlide?: number;
  brandPrimary?: string;
  brandSecondary?: string;
  clientLogo?: string;
  onExit: () => void;
}

export function PresenterMode({ slides, initialSlide = 0, brandPrimary, brandSecondary, clientLogo, onExit }: PresenterModeProps) {
  const visibleSlides = slides.filter(s => !s.hidden);
  const [currentIndex, setCurrentIndex] = useState(initialSlide);
  const [showNotes, setShowNotes] = useState(true);
  const [showGrid, setShowGrid] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [cursorHidden, setCursorHidden] = useState(false);
  const cursorTimeout = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          setCurrentIndex(i => Math.min(i + 1, visibleSlides.length - 1));
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          setCurrentIndex(i => Math.max(i - 1, 0));
          break;
        case 'Escape':
          onExit();
          break;
        case 'g':
          setShowGrid(g => !g);
          break;
        case 'n':
          setShowNotes(n => !n);
          break;
        case 'Home':
          setCurrentIndex(0);
          break;
        case 'End':
          setCurrentIndex(visibleSlides.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visibleSlides.length, onExit]);

  // Auto-hide cursor
  useEffect(() => {
    const handleMouseMove = () => {
      setCursorHidden(false);
      clearTimeout(cursorTimeout.current);
      cursorTimeout.current = setTimeout(() => setCursorHidden(true), 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(cursorTimeout.current);
    };
  }, []);

  // Fullscreen
  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentSlide = visibleSlides[currentIndex];
  const nextSlide = visibleSlides[currentIndex + 1];

  if (showGrid) {
    return (
      <div className="fixed inset-0 z-[200] bg-black overflow-auto p-8" style={{ cursor: cursorHidden ? 'none' : 'default' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white text-2xl font-semibold">Slide Overview</h2>
          <button onClick={() => setShowGrid(false)} className="text-white/60 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {visibleSlides.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => { setCurrentIndex(i); setShowGrid(false); }}
              className={cn(
                "rounded-xl overflow-hidden border-2 transition-all aspect-video",
                i === currentIndex ? "border-primary ring-2 ring-primary/40" : "border-white/10 hover:border-white/30"
              )}
            >
              <ScaledSlide className="w-full h-full" fillContainer>
                <SlideRenderer slide={slide} brandPrimary={brandPrimary} brandSecondary={brandSecondary} clientLogo={clientLogo} />
              </ScaledSlide>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
      style={{ cursor: cursorHidden ? 'none' : 'default' }}
    >
      {/* Main slide area */}
      <div className={cn("flex-1 flex", showNotes ? "gap-0" : "")}>
        {/* Current slide */}
        <div className={cn("flex-1 relative", showNotes ? "" : "")}>
          <ScaledSlide className="w-full h-full" fillContainer>
            <SlideRenderer 
              slide={currentSlide} 
              brandPrimary={brandPrimary} 
              brandSecondary={brandSecondary} 
              clientLogo={clientLogo}
              animate
              isPresenting
            />
          </ScaledSlide>

          {/* Click zones for navigation */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-1/4 cursor-w-resize opacity-0 hover:opacity-100 transition-opacity"
            onClick={() => setCurrentIndex(i => Math.max(i - 1, 0))}
          >
            <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 rounded-full p-3 backdrop-blur">
              <ChevronLeft className="w-8 h-8 text-white" />
            </div>
          </div>
          <div 
            className="absolute right-0 top-0 bottom-0 w-1/4 cursor-e-resize opacity-0 hover:opacity-100 transition-opacity"
            onClick={() => setCurrentIndex(i => Math.min(i + 1, visibleSlides.length - 1))}
          >
            <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 rounded-full p-3 backdrop-blur">
              <ChevronRight className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>

        {/* Speaker notes panel */}
        {showNotes && currentSlide.notes && (
          <div className="w-80 bg-zinc-900 border-l border-white/10 p-6 overflow-auto flex flex-col">
            <h3 className="text-white/60 text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Speaker Notes
            </h3>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap flex-1">
              {currentSlide.notes}
            </p>
            {/* Next slide preview */}
            {nextSlide && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-white/40 text-xs mb-2">NEXT SLIDE</p>
                <div className="rounded-lg overflow-hidden border border-white/10 aspect-video">
                  <ScaledSlide className="w-full h-full" fillContainer>
                    <SlideRenderer slide={nextSlide} brandPrimary={brandPrimary} brandSecondary={brandSecondary} clientLogo={clientLogo} />
                  </ScaledSlide>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom control bar */}
      <div className={cn(
        "h-14 bg-zinc-900/90 backdrop-blur border-t border-white/10 flex items-center justify-between px-6 transition-opacity",
        cursorHidden ? "opacity-0" : "opacity-100"
      )}>
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
          <button onClick={() => setShowGrid(true)} className="text-white/60 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
            <Grid3X3 className="w-5 h-5" />
          </button>
          <button onClick={() => setShowNotes(n => !n)} className={cn(
            "p-1.5 rounded-lg transition-colors",
            showNotes ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/10"
          )}>
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={() => setCurrentIndex(i => Math.max(i - 1, 0))}
            disabled={currentIndex === 0}
            className="text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <span className="text-white font-mono text-sm tabular-nums">
            {currentIndex + 1} / {visibleSlides.length}
          </span>
          <button 
            onClick={() => setCurrentIndex(i => Math.min(i + 1, visibleSlides.length - 1))}
            disabled={currentIndex === visibleSlides.length - 1}
            className="text-white/60 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-white/60 font-mono text-sm">
          <Clock className="w-4 h-4" />
          {formatTime(elapsedSeconds)}
        </div>
      </div>
    </div>
  );
}

export default PresenterMode;
