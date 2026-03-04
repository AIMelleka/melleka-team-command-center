import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, ExternalLink, ImageOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PageScreenshot {
  hint: string;
  url: string;
  screenshot: string | null;
  title: string;
  manualOverride?: string;
}

interface SeoPageScreenshotsProps {
  taskItems: string[];
  websiteUrl?: string;
  brandColor: string;
  onScreenshotClick?: (src: string) => void;
  /** Pre-captured screenshots from deck generation */
  initialPages?: PageScreenshot[];
}

export const SeoPageScreenshots = ({
  taskItems,
  websiteUrl,
  brandColor,
  onScreenshotClick,
  initialPages,
}: SeoPageScreenshotsProps) => {
  const { toast } = useToast();
  const [pages, setPages] = useState<PageScreenshot[]>(initialPages || []);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleFileUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPages(prev => prev.map((p, i) => 
        i === index ? { ...p, manualOverride: dataUrl } : p
      ));
      toast({ title: 'Screenshot replaced' });
    };
    reader.readAsDataURL(file);
  };

  const removeOverride = (index: number) => {
    setPages(prev => prev.map((p, i) => 
      i === index ? { ...p, manualOverride: undefined } : p
    ));
  };

  const getDisplayImage = (page: PageScreenshot): string | null => {
    return page.manualOverride || page.screenshot;
  };

  if (pages.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <Camera className="h-5 w-5 text-white/60" />
        <h3 className="text-lg font-semibold text-white">Page Screenshots</h3>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-white/40 text-sm">{pages.length} pages captured • Click to enlarge • Upload to replace</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pages.map((page, idx) => {
          const displayImage = getDisplayImage(page);
          return (
            <div key={idx} className="deck-glass-card p-4 group relative">
              <div 
                className="aspect-video bg-white/5 rounded-lg mb-3 overflow-hidden cursor-pointer relative"
                onClick={() => displayImage && onScreenshotClick?.(displayImage)}
              >
                {displayImage ? (
                  <img 
                    src={displayImage} 
                    alt={page.title}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white/30">
                    <ImageOff className="h-10 w-10 mb-2" />
                    <span className="text-sm">No screenshot available</span>
                  </div>
                )}

                {page.manualOverride && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className="bg-emerald-500/90 text-white text-xs px-2 py-1 rounded-full">
                      Custom
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeOverride(idx); }}
                      className="bg-red-500/90 text-white p-1 rounded-full hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{page.hint}</p>
                  <p className="text-white/40 text-xs truncate">{page.title}</p>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <input
                    ref={el => fileInputRefs.current[idx] = el}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(idx, file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white/40 hover:text-white"
                    onClick={() => fileInputRefs.current[idx]?.click()}
                    title="Upload replacement screenshot"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                    title="Open page"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
