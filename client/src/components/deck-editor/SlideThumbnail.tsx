import { Slide } from '@/types/deck';
import { ScaledSlide } from './ScaledSlide';
import { SlideRenderer } from './SlideRenderer';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlideThumbnailProps {
  slide: Slide;
  index: number;
  isActive: boolean;
  brandPrimary?: string;
  brandSecondary?: string;
  clientLogo?: string;
  onClick: () => void;
  onToggleHidden: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver?: boolean;
}

export function SlideThumbnail({
  slide, index, isActive, brandPrimary, brandSecondary, clientLogo,
  onClick, onToggleHidden, onDragStart, onDragOver, onDrop, isDragOver
}: SlideThumbnailProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
        isActive 
          ? "border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10" 
          : "border-white/10 hover:border-white/25",
        slide.hidden && "opacity-40",
        isDragOver && "border-primary/60 ring-2 ring-primary/20 scale-[1.02]"
      )}
      onClick={onClick}
    >
      {/* Slide number */}
      <div className="absolute top-1 left-1 z-10 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] text-white/70 font-mono">
        {index + 1}
      </div>

      {/* Drag handle */}
      <div className="absolute top-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black/60 backdrop-blur-sm rounded p-0.5 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-white/70" />
        </div>
      </div>

      {/* Hidden toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleHidden(); }}
        className="absolute bottom-1 right-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm rounded p-0.5"
      >
        {slide.hidden ? (
          <EyeOff className="w-3 h-3 text-white/50" />
        ) : (
          <Eye className="w-3 h-3 text-white/70" />
        )}
      </button>

      {/* Slide preview */}
      <div className="aspect-video pointer-events-none">
        <ScaledSlide className="w-full h-full" fillContainer>
          <SlideRenderer slide={slide} brandPrimary={brandPrimary} brandSecondary={brandSecondary} clientLogo={clientLogo} />
        </ScaledSlide>
      </div>

      {/* Slide title */}
      <div className="px-2 py-1.5 bg-zinc-900/80 border-t border-white/5">
        <p className="text-[10px] text-white/60 truncate">{slide.title}</p>
      </div>
    </div>
  );
}

export default SlideThumbnail;
