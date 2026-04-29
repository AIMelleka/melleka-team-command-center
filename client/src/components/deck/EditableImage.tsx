import { useRef, useState, useContext } from 'react';
import { Upload, ImagePlus, Loader2, X, RefreshCw, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DeckEditContext } from './DeckEditContext';
import { cn } from '@/lib/utils';

interface EditableImageProps {
  /** Override key used to persist the uploaded URL in the deck's overrides */
  editKey: string;
  /** Current image URL (from data or previous override) */
  src?: string;
  alt?: string;
  className?: string;
  /** Shown as a dashed placeholder when no image exists yet */
  placeholderLabel?: string;
  /** Extra wrapper classnames */
  wrapperClassName?: string;
  style?: React.CSSProperties;
  /** Called after a successful upload with the public URL */
  onUploaded?: (url: string) => void;
  /** Called when user wants to delete/remove the image entirely */
  onDelete?: () => void;
}

const BUCKET = 'deck-campaign-assets';

export const EditableImage = ({
  editKey,
  src,
  alt = '',
  className,
  placeholderLabel = 'Add Image',
  wrapperClassName,
  style,
  onUploaded,
  onDelete,
}: EditableImageProps) => {
  const editCtx = useContext(DeckEditContext);
  const isEditMode = editCtx?.isEditMode ?? false;
  const overrides = editCtx?.overrides ?? {};
  const updateOverride = editCtx?.updateOverride ?? (async () => {});
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hover, setHover] = useState(false);

  // Prefer override URL, then prop
  const displaySrc = overrides[editKey] || src;

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `deck-images/${editKey.replace(/\./g, '_')}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      await updateOverride(editKey, publicUrl);
      onUploaded?.(publicUrl);
      toast({ title: 'Image uploaded!' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  // Non-edit mode: just render the image (or nothing if no src)
  if (!isEditMode) {
    if (!displaySrc) return null;
    return <img src={displaySrc} alt={alt} className={className} style={style} crossOrigin="anonymous" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
  }

  return (
    <div
      className={cn('relative group', wrapperClassName)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Actual image or placeholder */}
      {displaySrc ? (
        <img src={displaySrc} alt={alt} className={className} style={style} crossOrigin="anonymous" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      ) : (
        <div
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 bg-white/5 text-white/40 cursor-pointer hover:border-yellow-400/50 hover:text-yellow-400/70 transition-all',
            className
          )}
          style={{ minHeight: 120, ...style }}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm font-medium">{placeholderLabel}</span>
          <span className="text-xs opacity-60">Click or drag & drop</span>
        </div>
      )}

      {/* Hover overlay with upload controls */}
      {displaySrc && (
        <div
          className={cn(
            'absolute inset-0 rounded-xl flex flex-col items-center justify-center gap-3 transition-all duration-200 bg-black/60 backdrop-blur-sm',
            hover ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Uploading…</span>
            </div>
          ) : (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-semibold hover:bg-yellow-300 transition-colors shadow-lg"
              >
                <RefreshCw className="h-4 w-4" />
                Replace Image
              </button>
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-400 transition-colors shadow-lg"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove Logo
                </button>
              )}
              <span className="text-white/50 text-xs">or drag & drop a new image</span>
            </>
          )}
        </div>
      )}

      {/* Upload button badge for non-image slots (no current image but edit mode) */}
      {!displaySrc && isUploading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      )}

      {/* Yellow upload badge — shown as top-right corner button for existing images */}
      {displaySrc && !isUploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-yellow-400 text-black text-xs font-bold shadow-lg transition-all duration-200',
            hover ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
          )}
          title="Upload new image"
        >
          <Upload className="h-3.5 w-3.5" />
          Replace
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};

/**
 * A standalone "Add Image" button — used to inject an image into a section
 * that doesn't currently have one (e.g. platform section banner).
 */
export const AddImageButton = ({
  editKey,
  label = 'Add Image',
  color = '#facc15',
}: {
  editKey: string;
  label?: string;
  color?: string;
}) => {
  const editCtx = useContext(DeckEditContext);
  const isEditMode = editCtx?.isEditMode ?? false;
  const overrides = editCtx?.overrides ?? {};

  if (!isEditMode) return null;
  // If already has an image override, don't show the add button
  if (overrides[editKey]) return null;

  return (
    <EditableImage
      editKey={editKey}
      placeholderLabel={label}
      wrapperClassName="w-full"
      className="w-full min-h-[160px]"
    />
  );
};
