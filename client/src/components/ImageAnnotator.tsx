import { useState, useRef, useCallback, useEffect } from 'react';
import { 
  ArrowUpRight, 
  Circle, 
  Square, 
  MousePointer, 
  Undo2, 
  Trash2,
  Save,
  X,
  Move
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface Annotation {
  id: string;
  type: 'arrow' | 'circle' | 'highlight';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

interface ImageAnnotatorProps {
  imageUrl: string;
  annotations: Annotation[];
  onSave: (annotations: Annotation[]) => void;
  onClose: () => void;
  open: boolean;
}

const COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'White', value: '#ffffff' },
];

export const ImageAnnotator = ({ 
  imageUrl, 
  annotations: initialAnnotations, 
  onSave, 
  onClose,
  open 
}: ImageAnnotatorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations || []);
  const [currentTool, setCurrentTool] = useState<'arrow' | 'circle' | 'highlight' | 'select'>('arrow');
  const [currentColor, setCurrentColor] = useState('#ef4444');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  // Load and draw image
  useEffect(() => {
    if (!open || !imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [imageUrl, open]);

  // Redraw canvas whenever annotations change
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Set canvas size to match container
      const container = containerRef.current;
      if (!container) return;
      
      const maxWidth = container.clientWidth;
      const maxHeight = container.clientHeight - 60; // Leave room for toolbar
      
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw all annotations
      annotations.forEach(ann => drawAnnotation(ctx, ann, scale));
      
      // Draw current annotation being created
      if (currentAnnotation) {
        drawAnnotation(ctx, currentAnnotation, scale);
      }
    };
    img.src = imageUrl;
  }, [imageLoaded, annotations, currentAnnotation, imageUrl]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation, scale: number) => {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = 3;
    
    const sx = ann.startX * scale;
    const sy = ann.startY * scale;
    const ex = ann.endX * scale;
    const ey = ann.endY * scale;

    switch (ann.type) {
      case 'arrow':
        drawArrow(ctx, sx, sy, ex, ey);
        break;
      case 'circle':
        const radius = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'highlight':
        ctx.globalAlpha = 0.3;
        ctx.fillRect(
          Math.min(sx, ex),
          Math.min(sy, ey),
          Math.abs(ex - sx),
          Math.abs(ey - sy)
        );
        ctx.globalAlpha = 1;
        ctx.strokeRect(
          Math.min(sx, ex),
          Math.min(sy, ey),
          Math.abs(ex - sx),
          Math.abs(ey - sy)
        );
        break;
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number) => {
    const headLength = 15;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Convert to original image coordinates
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    
    const maxWidth = container.clientWidth;
    const maxHeight = container.clientHeight - 60;
    const scale = Math.min(maxWidth / imageDimensions.width, maxHeight / imageDimensions.height, 1);
    
    return {
      x: ((e.clientX - rect.left) * scaleX) / scale,
      y: ((e.clientY - rect.top) * scaleY) / scale,
    };
  };

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool === 'select') return;
    
    const coords = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPoint(coords);
    setCurrentAnnotation({
      id: `ann-${Date.now()}`,
      type: currentTool,
      startX: coords.x,
      startY: coords.y,
      endX: coords.x,
      endY: coords.y,
      color: currentColor,
    });
  }, [currentTool, currentColor]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !currentAnnotation) return;
    
    const coords = getCanvasCoordinates(e);
    setCurrentAnnotation({
      ...currentAnnotation,
      endX: coords.x,
      endY: coords.y,
    });
  }, [isDrawing, startPoint, currentAnnotation]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && currentAnnotation) {
      // Only add if the annotation has some size
      const dx = Math.abs(currentAnnotation.endX - currentAnnotation.startX);
      const dy = Math.abs(currentAnnotation.endY - currentAnnotation.startY);
      if (dx > 5 || dy > 5) {
        setAnnotations(prev => [...prev, currentAnnotation]);
      }
    }
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentAnnotation(null);
  }, [isDrawing, currentAnnotation]);

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAnnotations([]);
  };

  const handleSave = () => {
    onSave(annotations);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Move className="w-5 h-5" />
            Annotate Screenshot
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-muted/30">
          {/* Tools */}
          <div className="flex items-center gap-1 border-r border-border pr-4">
            <Button
              variant={currentTool === 'arrow' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentTool('arrow')}
              title="Arrow"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Button>
            <Button
              variant={currentTool === 'circle' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentTool('circle')}
              title="Circle"
            >
              <Circle className="w-4 h-4" />
            </Button>
            <Button
              variant={currentTool === 'highlight' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setCurrentTool('highlight')}
              title="Highlight"
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1 border-r border-border pr-4">
            {COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => setCurrentColor(color.value)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  currentColor === color.value ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={annotations.length === 0}
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={annotations.length === 0}
              title="Clear All"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* Save/Cancel */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              Save Annotations
            </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center p-4 bg-black/90 overflow-hidden"
        >
          {imageLoaded ? (
            <canvas
              ref={canvasRef}
              className="cursor-crosshair rounded-lg shadow-2xl"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          ) : (
            <div className="text-muted-foreground">Loading image...</div>
          )}
        </div>

        {/* Help text */}
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground text-center bg-muted/30">
          Click and drag to draw. {annotations.length} annotation{annotations.length !== 1 ? 's' : ''} added.
        </div>
      </DialogContent>
    </Dialog>
  );
};
