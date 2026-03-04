import { useState, useRef, useCallback, forwardRef } from 'react';
import { useDeckEdit } from './DeckEditContext';
import { Type, Image, BarChart2, Trash2, Upload, Loader2, Video, Quote, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { InlineEdit } from './InlineEdit';
import type { CustomSectionType } from './AddSectionModal';
import { cn } from '@/lib/utils';

interface CustomSection {
  id: string;
  type: CustomSectionType;
  title: string;
  content?: string;
  metricLabel?: string;
  metricValue?: string;
  metricTrend?: string;
  images?: string[];
  videoUrl?: string;
  quote?: string;
  author?: string;
  role?: string;
  subtitle?: string;
}

// ─── Text block ───────────────────────────────────────────────────────────────
const TextBlockSection = ({ section }: { section: CustomSection }) => (
  <div className="deck-glass-card p-8">
    <div className="mb-4">
      <InlineEdit value={section.title} editKey={`${section.id}.title`} as="h3" className="text-2xl font-bold text-white" />
    </div>
    <InlineEdit value={section.content || ''} editKey={`${section.id}.content`} as="p" multiline className="text-white/70 leading-relaxed" />
  </div>
);

// ─── Image gallery ────────────────────────────────────────────────────────────
const ImageGallerySection = ({ section }: { section: CustomSection }) => {
  const { isEditMode, updateOverride, overrides } = useDeckEdit();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const storedImages: string[] = JSON.parse(overrides[`${section.id}.images`] || JSON.stringify(section.images || []));

  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const ext = file.name.split('.').pop();
      const path = `deck-assets/custom/${section.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('proposal-assets').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('proposal-assets').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    if (urls.length) {
      await updateOverride(`${section.id}.images`, JSON.stringify([...storedImages, ...urls]));
      toast({ title: `${urls.length} image(s) uploaded` });
    }
    setUploading(false);
  }, [section.id, storedImages, updateOverride, toast]);

  return (
    <div className="deck-glass-card p-8">
      <div className="flex items-center justify-between mb-6">
        <InlineEdit value={section.title} editKey={`${section.id}.title`} as="h3" className="text-2xl font-bold text-white" />
        {isEditMode && (
          <>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-400/30 text-xs font-medium transition-colors"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? 'Uploading…' : 'Upload Images'}
            </button>
          </>
        )}
      </div>
      {storedImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {storedImages.map((url, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden aspect-video bg-white/5">
              <img src={url} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
              {isEditMode && (
                <button
                  onClick={async () => {
                    const updated = storedImages.filter((_, idx) => idx !== i);
                    await updateOverride(`${section.id}.images`, JSON.stringify(updated));
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-white/10 text-white/30">
          <Image className="h-10 w-10 mb-3" />
          <p className="text-sm">{isEditMode ? 'Click "Upload Images" to add photos' : 'No images yet'}</p>
        </div>
      )}
    </div>
  );
};

// ─── Metric card ──────────────────────────────────────────────────────────────
const MetricCardSection = ({ section }: { section: CustomSection }) => (
  <div className="deck-glass-card p-8 flex flex-col items-center text-center max-w-sm mx-auto">
    <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4">
      <BarChart2 className="h-7 w-7 text-purple-400" />
    </div>
    <div className="mb-2">
      <InlineEdit value={section.metricValue || '0'} editKey={`${section.id}.metricValue`} as="p" className="text-5xl font-black text-white" />
    </div>
    <InlineEdit value={section.metricLabel || 'Metric Label'} editKey={`${section.id}.metricLabel`} as="p" className="text-white/50 text-sm font-medium uppercase tracking-wider" />
    <div className="mt-3">
      <InlineEdit value={section.metricTrend || ''} editKey={`${section.id}.metricTrend`} as="p" className="text-emerald-400 text-sm" />
    </div>
  </div>
);

// ─── Video Embed ──────────────────────────────────────────────────────────────
const getEmbedUrl = (url: string): string | null => {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Already an embed URL
  if (url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/')) return url;
  return null;
};

const VideoEmbedSection = ({ section }: { section: CustomSection }) => {
  const { isEditMode, overrides, updateOverride } = useDeckEdit();
  const [urlDraft, setUrlDraft] = useState('');
  const [editing, setEditing] = useState(false);

  const storedUrl = overrides[`${section.id}.videoUrl`] || section.videoUrl || '';
  const embedUrl = getEmbedUrl(storedUrl);

  const saveUrl = async () => {
    if (urlDraft.trim()) {
      await updateOverride(`${section.id}.videoUrl`, urlDraft.trim());
    }
    setEditing(false);
  };

  return (
    <div className="deck-glass-card p-8">
      <div className="mb-6">
        <InlineEdit value={section.title} editKey={`${section.id}.title`} as="h3" className="text-2xl font-bold text-white" />
        {section.content && (
          <InlineEdit value={section.content} editKey={`${section.id}.content`} as="p" className="text-white/60 mt-2" />
        )}
      </div>

      {embedUrl ? (
        <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full rounded-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-red-400/20 text-white/30 bg-red-500/5">
          <Video className="h-10 w-10 mb-3 text-red-400/50" />
          <p className="text-sm text-center max-w-xs">
            {isEditMode ? 'Enter a YouTube or Vimeo URL below' : 'No video URL set'}
          </p>
        </div>
      )}

      {isEditMode && (
        <div className="mt-4">
          {editing ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveUrl(); if (e.key === 'Escape') setEditing(false); }}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                className="flex-1 bg-black/60 border border-yellow-400/80 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-yellow-400"
              />
              <button onClick={saveUrl} className="px-4 py-2 rounded-lg bg-yellow-400 text-black text-sm font-semibold">Save</button>
              <button onClick={() => setEditing(false)} className="px-3 py-2 rounded-lg bg-white/5 text-white/60 text-sm">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => { setUrlDraft(storedUrl); setEditing(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 text-xs font-medium transition-colors"
            >
              <Video className="h-3 w-3" />
              {storedUrl ? 'Change Video URL' : 'Set Video URL'}
            </button>
          )}
          {storedUrl && !getEmbedUrl(storedUrl) && (
            <p className="mt-2 text-xs text-red-400">⚠️ URL not recognized. Use a YouTube or Vimeo link.</p>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Testimonial ──────────────────────────────────────────────────────────────
const TestimonialSection = ({ section }: { section: CustomSection }) => (
  <div className="deck-glass-card p-8 md:p-12 relative overflow-hidden">
    {/* Decorative quote mark */}
    <div className="absolute top-4 left-6 text-8xl font-serif text-yellow-400/10 select-none leading-none">"</div>
    <div className="relative z-10">
      <div className="mb-6">
        <InlineEdit value={section.title} editKey={`${section.id}.title`} as="h3" className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-4" />
      </div>
      <blockquote className="mb-8">
        <InlineEdit
          value={section.quote || 'Click to add the client quote here…'}
          editKey={`${section.id}.quote`}
          as="p"
          multiline
          className="text-xl md:text-2xl text-white font-light leading-relaxed italic"
        />
      </blockquote>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-yellow-400/20 flex items-center justify-center flex-shrink-0">
          <Quote className="h-5 w-5 text-yellow-400" />
        </div>
        <div>
          <InlineEdit value={section.author || 'Client Name'} editKey={`${section.id}.author`} as="p" className="text-white font-semibold" />
          <InlineEdit value={section.role || 'Title / Company'} editKey={`${section.id}.role`} as="p" className="text-white/50 text-sm" />
        </div>
      </div>
    </div>
  </div>
);

// ─── Chapter Divider ──────────────────────────────────────────────────────────
const DividerSection = ({ section }: { section: CustomSection }) => (
  <div className="py-8 px-8">
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="text-center">
          <InlineEdit value={section.title} editKey={`${section.id}.title`} as="h2" className="text-3xl md:text-4xl font-bold text-white tracking-tight" />
          {(section.subtitle || section.content) && (
            <InlineEdit
              value={section.subtitle || section.content || ''}
              editKey={`${section.id}.subtitle`}
              as="p"
              className="text-white/50 mt-2 text-lg"
            />
          )}
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/20 to-transparent" />
      </div>
    </div>
  </div>
);

// ─── Icon map ─────────────────────────────────────────────────────────────────
const typeIcon: Record<CustomSectionType, React.ReactNode> = {
  'text': <Type className="h-4 w-4" />,
  'image-gallery': <Image className="h-4 w-4" />,
  'metric-card': <BarChart2 className="h-4 w-4" />,
  'video-embed': <Video className="h-4 w-4" />,
  'testimonial': <Quote className="h-4 w-4" />,
  'divider': <Minus className="h-4 w-4" />,
};
const typeLabel: Record<CustomSectionType, string> = {
  'text': 'Text Block',
  'image-gallery': 'Image Gallery',
  'metric-card': 'Metric Card',
  'video-embed': 'Video Embed',
  'testimonial': 'Testimonial',
  'divider': 'Chapter Divider',
};

// ─── Main renderer (forwardRef to support sectionRefs in DeckView) ─────────────
export const CustomSectionsRenderer = forwardRef<HTMLDivElement>((_, ref) => {
  const { isEditMode, overrides, updateOverride } = useDeckEdit();

  const sections: CustomSection[] = JSON.parse(overrides['deck.customSections'] || '[]');
  if (!sections.length) return null;

  const removeSection = async (id: string) => {
    const updated = sections.filter(s => s.id !== id);
    await updateOverride('deck.customSections', JSON.stringify(updated));
  };

  return (
    <div ref={ref} className="space-y-12 mt-12">
      {sections.map(section => (
        <section key={section.id} className="relative">
          {isEditMode && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border border-yellow-400/30 bg-black/70 backdrop-blur-xl text-xs text-yellow-300 font-medium">
              <span className="flex items-center gap-1.5 flex-1 text-yellow-200/80 font-semibold">
                {typeIcon[section.type]} Custom — {typeLabel[section.type]}
              </span>
              <button
                onClick={() => removeSection(section.id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-400/30 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            </div>
          )}
          {section.type === 'text' && <TextBlockSection section={section} />}
          {section.type === 'image-gallery' && <ImageGallerySection section={section} />}
          {section.type === 'metric-card' && <MetricCardSection section={section} />}
          {section.type === 'video-embed' && <VideoEmbedSection section={section} />}
          {section.type === 'testimonial' && <TestimonialSection section={section} />}
          {section.type === 'divider' && <DividerSection section={section} />}
        </section>
      ))}
    </div>
  );
});

CustomSectionsRenderer.displayName = 'CustomSectionsRenderer';
