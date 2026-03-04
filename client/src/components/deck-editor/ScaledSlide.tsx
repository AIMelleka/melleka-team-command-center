import { useRef, useEffect, useState, ReactNode } from 'react';

interface ScaledSlideProps {
  children: ReactNode;
  className?: string;
  /** If true, the slide fills the entire container (presenter mode) */
  fillContainer?: boolean;
}

const SLIDE_W = 1920;
const SLIDE_H = 1080;

/**
 * Scales a 1920x1080 slide to fit any container.
 * Uses ResizeObserver for responsive scaling.
 */
export function ScaledSlide({ children, className = '', fillContainer = false }: ScaledSlideProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const rect = container.getBoundingClientRect();
      const scaleX = rect.width / SLIDE_W;
      const scaleY = rect.height / SLIDE_H;
      setScale(Math.min(scaleX, scaleY));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`relative overflow-hidden ${className}`}
      style={fillContainer ? { width: '100%', height: '100%' } : undefined}
    >
      <div
        className="absolute"
        style={{
          width: SLIDE_W,
          height: SLIDE_H,
          left: '50%',
          top: '50%',
          marginLeft: -SLIDE_W / 2,
          marginTop: -SLIDE_H / 2,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default ScaledSlide;
