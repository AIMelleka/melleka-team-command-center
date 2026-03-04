import { useState, useRef, useCallback, useEffect } from 'react';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

type Alignment = 'left' | 'center' | 'right';

interface ResizableImageProps {
  src: string;
  alt: string;
  isEditMode: boolean;
  /** Persisted width percentage (10–100). Defaults to 100. */
  widthPct?: number;
  alignment?: Alignment;
  onResize?: (widthPct: number) => void;
  onAlign?: (alignment: Alignment) => void;
  onClick?: () => void;
  className?: string;
}

export const ResizableImage = ({
  src,
  alt,
  isEditMode,
  widthPct: controlledWidth,
  alignment: controlledAlign,
  onResize,
  onAlign,
  onClick,
  className = '',
}: ResizableImageProps) => {
  const [localWidth, setLocalWidth] = useState(controlledWidth ?? 100);
  const [localAlign, setLocalAlign] = useState<Alignment>(controlledAlign ?? 'center');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const latestWidth = useRef(localWidth);

  // Sync from parent
  useEffect(() => {
    if (controlledWidth !== undefined) {
      setLocalWidth(controlledWidth);
      latestWidth.current = controlledWidth;
    }
  }, [controlledWidth]);
  useEffect(() => {
    if (controlledAlign !== undefined) setLocalAlign(controlledAlign);
  }, [controlledAlign]);

  const widthPct = localWidth;
  const alignment = localAlign;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    setIsDragging(true);
    startX.current = e.clientX;
    startWidth.current = widthPct;
  }, [widthPct]);

  useEffect(() => {
    if (!isDragging) return;
    const containerEl = containerRef.current?.parentElement;
    if (!containerEl) return;

    const parentWidth = containerEl.getBoundingClientRect().width;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX.current;
      const dPct = (dx / parentWidth) * 200; // *2 because handle is on edge
      const next = Math.max(20, Math.min(100, startWidth.current + dPct));
      const rounded = Math.round(next);
      setLocalWidth(rounded);
      latestWidth.current = rounded;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // Use ref to get the latest width value, not stale closure
      onResize?.(latestWidth.current);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize]);

  const setAlignment = (a: Alignment) => {
    setLocalAlign(a);
    onAlign?.(a);
  };

  const justifyClass = alignment === 'left' ? 'justify-start' : alignment === 'right' ? 'justify-end' : 'justify-center';

  return (
    <div className={`flex ${justifyClass} w-full ${className}`}>
      <div
        ref={containerRef}
        className="relative group/resize"
        style={{ width: `${widthPct}%` }}
      >
        {/* Alignment toolbar - only in edit mode */}
        {isEditMode && (
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/80 backdrop-blur rounded-lg px-2 py-1 opacity-0 group-hover/resize:opacity-100 transition-opacity border border-white/20">
            <button
              onClick={(e) => { e.stopPropagation(); setAlignment('left'); }}
              className={`p-1 rounded ${alignment === 'left' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
              title="Align left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setAlignment('center'); }}
              className={`p-1 rounded ${alignment === 'center' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
              title="Align center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setAlignment('right'); }}
              className={`p-1 rounded ${alignment === 'right' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
              title="Align right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <span className="text-white/40 text-[10px] ml-1 tabular-nums">{widthPct}%</span>
          </div>
        )}

        {/* Image */}
        <div className={onClick && !isEditMode ? 'cursor-zoom-in' : ''} onClick={!isDragging ? onClick : undefined}>
          <img
            src={src}
            alt={alt}
            className="w-full object-contain rounded-lg"
            loading="lazy"
            draggable={false}
          />
        </div>

        {/* Resize handle - bottom right corner */}
        {isEditMode && (
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-20 opacity-0 group-hover/resize:opacity-100 transition-opacity"
            onMouseDown={handleMouseDown}
          >
            <svg viewBox="0 0 20 20" className="w-full h-full">
              <path d="M 14 20 L 20 14 M 10 20 L 20 10 M 6 20 L 20 6" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
            </svg>
          </div>
        )}

        {/* Visual border when dragging or hovering in edit mode */}
        {isEditMode && (
          <div className={`absolute inset-0 rounded-lg pointer-events-none border-2 transition-colors ${isDragging ? 'border-amber-400' : 'border-transparent group-hover/resize:border-white/20'}`} />
        )}
      </div>
    </div>
  );
};
