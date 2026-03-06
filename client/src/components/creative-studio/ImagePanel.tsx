import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  Wand2, Upload, Eraser, ZoomIn, Loader2,
  Palette,
  Monitor, Smartphone, Square, RectangleHorizontal,
  RectangleVertical, X, BookOpen, ChevronDown, ChevronUp,
  ShoppingBag, Quote, Users as UsersIcon, Megaphone, Globe, Star,
  Gift, Utensils, Building2, Shirt
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryItem, ImagePrefill } from './types';

// ── Internal type for generation results ──
interface GeneratedImage {
  imageUrl: string;
  generator: string;
  prompt: string;
  mode: string;
  timestamp: number;
  dbId?: string;
}

// ── Constants ──

const SIZE_PRESETS = {
  'Ad Creatives': [
    { label: 'Facebook Feed', w: 1200, h: 628, icon: RectangleHorizontal },
    { label: 'Instagram Post', w: 1080, h: 1080, icon: Square },
    { label: 'Instagram Story', w: 1080, h: 1920, icon: RectangleVertical },
    { label: 'Google Display', w: 1200, h: 628, icon: Monitor },
    { label: 'TikTok Ad', w: 1080, h: 1920, icon: Smartphone },
  ],
  'Social Media': [
    { label: 'Square Post', w: 1080, h: 1080, icon: Square },
    { label: 'Landscape', w: 1200, h: 675, icon: RectangleHorizontal },
    { label: 'Portrait', w: 1080, h: 1350, icon: RectangleVertical },
    { label: 'LinkedIn Banner', w: 1584, h: 396, icon: RectangleHorizontal },
    { label: 'Twitter Header', w: 1500, h: 500, icon: RectangleHorizontal },
  ],
  'Website Assets': [
    { label: 'Hero Banner', w: 1920, h: 1080, icon: Monitor },
    { label: 'OG Image', w: 1200, h: 630, icon: RectangleHorizontal },
    { label: 'Thumbnail', w: 640, h: 360, icon: RectangleHorizontal },
    { label: 'Icon', w: 512, h: 512, icon: Square },
    { label: 'Favicon', w: 256, h: 256, icon: Square },
  ],
  'Custom': [
    { label: '1024\u00d71024', w: 1024, h: 1024, icon: Square },
    { label: '1920\u00d71080', w: 1920, h: 1080, icon: Monitor },
    { label: '768\u00d71024', w: 768, h: 1024, icon: RectangleVertical },
  ],
};

const STYLES = [
  { value: 'none', label: 'Auto' },
  { value: 'photorealistic', label: 'Photorealistic' },
  { value: 'illustration', label: 'Illustration' },
  { value: '3d-render', label: '3D Render' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'flat-design', label: 'Flat Design' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'oil-painting', label: 'Oil Painting' },
  { value: 'pop-art', label: 'Pop Art' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'cyberpunk', label: 'Cyberpunk' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'anime', label: 'Anime' },
];

const MODES = [
  { id: 'generate', label: 'Generate', icon: Wand2, desc: 'Create from text' },
  { id: 'edit', label: 'Edit', icon: Palette, desc: 'Modify an image' },
  { id: 'background', label: 'Background', icon: Eraser, desc: 'Remove / swap BG' },
  { id: 'upscale', label: 'Upscale', icon: ZoomIn, desc: 'Enhance quality' },
];

const PROMPT_TEMPLATES = [
  { icon: ShoppingBag, label: 'Product Showcase', prompt: 'A premium product showcase photograph on a clean marble surface with soft studio lighting, subtle shadows, and a blurred lifestyle background. Professional e-commerce product photography style, ultra high resolution.' },
  { icon: Quote, label: 'Social Media Quote', prompt: 'An elegant social media quote card with a modern gradient background, featuring beautiful typography with an inspirational quote. Clean minimalist design with subtle geometric accents and ample negative space.' },
  { icon: UsersIcon, label: 'Team Photo Background', prompt: 'A professional modern office background for team photos, featuring a bright open workspace with natural light, contemporary furniture, plants, and warm tones. Shallow depth of field, bokeh effect.' },
  { icon: Megaphone, label: 'Ad Creative Banner', prompt: 'A bold eye-catching advertising banner with vibrant colors, dynamic composition, and strong visual hierarchy. Modern marketing creative with dramatic lighting and clean product placement area.' },
  { icon: Globe, label: 'Website Hero', prompt: 'A cinematic wide-angle hero image for a modern website landing page. Abstract flowing gradients with depth, light rays, and a sense of innovation and technology. Ultra wide 16:9 aspect ratio, high resolution.' },
  { icon: Star, label: 'Testimonial Card', prompt: 'A warm, inviting background for a customer testimonial card. Soft pastel gradient with subtle texture, gentle bokeh lights, and a premium feel. Space for text overlay on the left side.' },
  { icon: Gift, label: 'Sale / Promo', prompt: 'A vibrant promotional sale graphic background with confetti, ribbons, and celebratory elements. Bold colors with gold accents, energetic composition perfect for announcing discounts and special offers.' },
  { icon: Utensils, label: 'Food & Restaurant', prompt: 'A mouthwatering food photography scene with rustic wooden table, fresh ingredients, and dramatic overhead lighting. Warm color palette with rich textures, styled like a high-end cookbook photo.' },
  { icon: Building2, label: 'Real Estate', prompt: 'A stunning architectural exterior photograph of a modern luxury home at golden hour. Warm sunset light, manicured landscaping, dramatic sky, professional real estate photography style.' },
  { icon: Shirt, label: 'Fashion / Lifestyle', prompt: 'A stylish fashion lifestyle photograph with trendy urban backdrop, golden hour lighting, and editorial composition. Modern street style aesthetic with cinematic color grading and shallow depth of field.' },
];

// ── Props ──

interface ImagePanelProps {
  onGenerated: (item: GalleryItem) => void;
  prefill?: ImagePrefill;
}

// ── Helper: convert internal GeneratedImage + DB row into a GalleryItem ──

function toGalleryItem(img: GeneratedImage, size: { w: number; h: number }, styleVal: string): GalleryItem {
  return {
    id: img.dbId ?? `img-${img.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    url: img.imageUrl,
    prompt: img.prompt,
    timestamp: img.timestamp,
    metadata: {
      generator: img.generator,
      mode: img.mode,
      dimensions: { width: size.w, height: size.h },
      style: styleVal !== 'none' ? styleVal : undefined,
    },
    dbId: img.dbId,
  };
}

// ── Component ──

export function ImagePanel({ onGenerated, prefill }: ImagePanelProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState('generate');
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('none');
  const [selectedSize, setSelectedSize] = useState({ w: 1024, h: 1024, label: '1024\u00d71024' });
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isDraggingRef, setIsDraggingRef] = useState(false);

  const needsReference = mode === 'edit' || mode === 'background' || mode === 'upscale';

  // ── Apply prefill from parent when it changes ──
  useEffect(() => {
    if (!prefill) return;
    if (prefill.prompt !== undefined) setPrompt(prefill.prompt);
    if (prefill.style !== undefined) setStyle(prefill.style);
    if (prefill.width !== undefined && prefill.height !== undefined) {
      setSelectedSize({
        w: prefill.width,
        h: prefill.height,
        label: `${prefill.width}\u00d7${prefill.height}`,
      });
    }
  }, [prefill]);

  // ── Reference image helpers ──

  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image', variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReferenceImage(result);
      setReferencePreview(result);
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
    e.target.value = '';
  }, [processImageFile]);

  const handleRefDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRef(true);
  }, []);

  const handleRefDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRef(false);
  }, []);

  const handleRefDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRef(false);
    const file = e.dataTransfer.files[0];
    if (file) processImageFile(file);
  }, [processImageFile]);

  // Paste from clipboard (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!needsReference) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processImageFile(file);
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [needsReference, processImageFile]);

  // ── Generation ──

  const handleGenerate = async () => {
    if (!prompt && mode === 'generate') {
      toast({ title: 'Enter a prompt', variant: 'destructive' });
      return;
    }
    if (needsReference && !referenceImage) {
      toast({ title: 'Upload a reference image', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('image-generator', {
        body: {
          prompt,
          mode,
          referenceImage,
          width: selectedSize.w,
          height: selectedSize.h,
          style,
          numberOfImages,
        },
      });

      if (error || !data?.success) {
        const contextJson = (error as any)?.context?.json;
        const errorData = contextJson || data;
        const reason = errorData?.reason;
        const rephrased = errorData?.rephrased;
        const isPolicyBlock = reason === "IMAGE_PROHIBITED_CONTENT" || reason === "IMAGE_SAFETY";

        let errorMsg = errorData?.error || error?.message || 'Generation failed';
        if (isPolicyBlock && rephrased) {
          errorMsg += `\n\nYour prompt was auto-rephrased to: "${rephrased}" but still triggered the filter. Try a different reference image or simpler instructions.`;
        }
        throw new Error(errorMsg);
      }

      const newImages: GeneratedImage[] = data.images.map((img: any) => ({
        imageUrl: img.imageUrl,
        generator: img.generator,
        prompt,
        mode,
        timestamp: Date.now(),
      }));

      // Save to database
      if (user) {
        const inserts = newImages.map(img => ({
          created_by: user.id,
          prompt: img.prompt,
          mode: img.mode,
          style: style !== 'none' ? style : null,
          width: selectedSize.w,
          height: selectedSize.h,
          image_url: img.imageUrl,
          generator: img.generator,
        }));
        const { data: saved } = await supabase.from('generated_images').insert(inserts).select();
        if (saved) {
          const withIds = newImages.map((img, i) => ({ ...img, dbId: saved[i]?.id }));
          withIds.forEach(img => {
            onGenerated(toGalleryItem(img, selectedSize, style));
          });
        } else {
          newImages.forEach(img => {
            onGenerated(toGalleryItem(img, selectedSize, style));
          });
        }
      } else {
        newImages.forEach(img => {
          onGenerated(toGalleryItem(img, selectedSize, style));
        });
      }

      toast({ title: `${newImages.length} image${newImages.length > 1 ? 's' : ''} generated!` });
    } catch (e: any) {
      const msg = e.message || 'Unknown error';
      const isPolicyBlock = msg.includes('content policy') || msg.includes('safety policy');
      toast({
        title: isPolicyBlock ? '\u26a0\ufe0f Content Policy Block' : 'Generation failed',
        description: msg.length > 200 ? msg.slice(0, 200) + '\u2026' : msg,
        variant: 'destructive',
        duration: isPolicyBlock ? 10000 : 5000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Render ──

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Mode Selector */}
      <Card>
        <CardContent className="p-5">
          <label className="text-xs font-medium text-muted-foreground mb-3 block">Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-sm",
                  mode === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
                )}
              >
                <m.icon className="h-5 w-5" />
                <span className="font-medium">{m.label}</span>
                <span className="text-[10px] opacity-70">{m.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Reference Image Upload (for edit/bg/upscale) */}
      {needsReference && (
        <Card>
          <CardContent className="p-5">
            <label className="text-xs font-medium text-muted-foreground mb-3 block">Reference Image</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            {referencePreview ? (
              <div className="relative group max-w-sm mx-auto">
                <img src={referencePreview} alt="Reference" className="w-full rounded-lg border border-border object-contain max-h-56" />
                <button
                  onClick={() => { setReferenceImage(null); setReferencePreview(null); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-destructive/80 text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleRefDragOver}
                onDragLeave={handleRefDragLeave}
                onDrop={handleRefDrop}
                className={cn(
                  "w-full h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors",
                  isDraggingRef
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-primary"
                )}
              >
                <Upload className="h-6 w-6" />
                <span className="text-sm font-medium">Drop, click, or paste (Ctrl+V)</span>
                <span className="text-[10px] opacity-60">PNG, JPG, WebP -- Max 10MB</span>
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prompt + Templates */}
      <Card>
        <CardContent className="p-5">
          <label className="text-xs font-medium text-muted-foreground mb-3 block">
            {mode === 'generate' ? 'Prompt' : mode === 'edit' ? 'Edit Instructions' : mode === 'background' ? 'New Background' : 'Enhancement Notes'}
          </label>
          <Textarea
            placeholder={
              mode === 'generate' ? 'Describe the image you want to create...'
              : mode === 'edit' ? 'Describe the edits to apply...'
              : mode === 'background' ? 'Describe the new background (or leave empty for white)...'
              : 'Optional: specific areas to enhance...'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="resize-none"
          />

          {/* Prompt Templates */}
          {mode === 'generate' && (
            <div className="mt-4">
              <button
                onClick={() => setShowTemplates(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Prompt Templates
                {showTemplates ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showTemplates && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {PROMPT_TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      onClick={() => { setPrompt(t.prompt); setShowTemplates(false); }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <t.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Style + Size */}
      <Card>
        <CardContent className="p-5 space-y-5">
          {/* Style Section */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-3 block">Style</label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STYLES.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Size Section */}
          {mode === 'generate' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-3 block">Size</label>
              <Tabs defaultValue="Ad Creatives" className="w-full">
                <TabsList className="w-full grid grid-cols-4 h-auto">
                  {Object.keys(SIZE_PRESETS).map(cat => (
                    <TabsTrigger key={cat} value={cat} className="text-[10px] px-1 py-1.5">
                      {cat.split(' ')[0]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {Object.entries(SIZE_PRESETS).map(([cat, sizes]) => (
                  <TabsContent key={cat} value={cat} className="mt-3">
                    <div className="flex flex-wrap gap-2">
                      {sizes.map(s => (
                        <button
                          key={s.label}
                          onClick={() => setSelectedSize(s)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all",
                            selectedSize.label === s.label
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          )}
                        >
                          <s.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-medium">{s.label}</span>
                          <span className="text-[10px] opacity-60">{s.w}\u00d7{s.h}</span>
                        </button>
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Number of Images + Generate */}
      <Card>
        <CardContent className="p-5 space-y-5">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-3 block">Number of Images</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setNumberOfImages(n)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all",
                    numberOfImages === n
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full h-14 text-lg font-semibold gap-3"
            size="lg"
          >
            {isGenerating ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="h-5 w-5" /> Generate {numberOfImages > 1 ? `${numberOfImages} Images` : 'Image'}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
