import { useState } from 'react';
import { X, Type, Image, BarChart2, Check, Video, Quote, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeckEdit } from './DeckEditContext';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';

export type CustomSectionType = 'text' | 'image-gallery' | 'metric-card' | 'video-embed' | 'testimonial' | 'divider';

interface SectionOption {
  type: CustomSectionType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const SECTION_OPTIONS: SectionOption[] = [
  {
    type: 'text',
    label: 'Text Block',
    description: 'Rich text section with a headline and paragraph — great for context, summaries, or notes.',
    icon: <Type className="h-5 w-5" />,
    color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  },
  {
    type: 'image-gallery',
    label: 'Image Gallery',
    description: 'Upload screenshots, creative assets, or supporting visuals in a clean grid layout.',
    icon: <Image className="h-5 w-5" />,
    color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-400',
  },
  {
    type: 'metric-card',
    label: 'Metric Card',
    description: 'Highlight a single KPI — label, value, and optional trend — as a standalone callout.',
    icon: <BarChart2 className="h-5 w-5" />,
    color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400',
  },
  {
    type: 'video-embed',
    label: 'Video Embed',
    description: 'Embed a YouTube or Vimeo video directly into the deck — great for campaign videos or ads.',
    icon: <Video className="h-5 w-5" />,
    color: 'from-red-500/20 to-red-600/10 border-red-500/30 text-red-400',
  },
  {
    type: 'testimonial',
    label: 'Testimonial',
    description: 'Feature a client quote or review in a styled pull-quote block with attribution.',
    icon: <Quote className="h-5 w-5" />,
    color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30 text-yellow-400',
  },
  {
    type: 'divider',
    label: 'Chapter Divider',
    description: 'A full-width section separator with a custom headline — use it to break chapters in the deck.',
    icon: <Minus className="h-5 w-5" />,
    color: 'from-gray-500/20 to-gray-600/10 border-gray-500/30 text-gray-400',
  },
];

interface AddSectionModalProps {
  onClose: () => void;
  /** Where in the deck to insert — sections are appended to this key list */
  insertAfterSectionId?: string;
}

export const AddSectionModal = ({ onClose, insertAfterSectionId }: AddSectionModalProps) => {
  const { updateOverride, overrides } = useDeckEdit();
  const { toast } = useToast();
  const [selected, setSelected] = useState<CustomSectionType | null>(null);
  const [saving, setSaving] = useState(false);

  const handleInsert = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const id = `custom-${nanoid(8)}`;
      const existing: string[] = JSON.parse(overrides['deck.customSections'] || '[]');
      const opt = SECTION_OPTIONS.find(o => o.type === selected)!;

      const newSection: Record<string, any> = {
        id,
        type: selected,
        insertAfter: insertAfterSectionId || null,
        title: opt.label,
        content: selected === 'text' ? 'Click to add content…' : '',
      };

      if (selected === 'metric-card') {
        newSection.metricLabel = 'Metric Label';
        newSection.metricValue = '0';
        newSection.metricTrend = '';
      }
      if (selected === 'image-gallery') {
        newSection.images = [];
      }
      if (selected === 'video-embed') {
        newSection.videoUrl = '';
        newSection.title = 'Campaign Video';
      }
      if (selected === 'testimonial') {
        newSection.quote = 'Click to add the client quote here…';
        newSection.author = 'Client Name';
        newSection.role = 'Title / Company';
        newSection.title = 'Client Testimonial';
      }
      if (selected === 'divider') {
        newSection.title = 'New Chapter';
        newSection.subtitle = 'Chapter subtitle or description';
      }

      await updateOverride('deck.customSections', JSON.stringify([...existing, newSection]));
      toast({ title: '✅ Section added!', description: `A new ${opt.label} has been inserted.` });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0a0a14] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div>
            <h2 className="text-lg font-semibold text-white">Add a Section</h2>
            <p className="text-xs text-white/40 mt-0.5">Choose a section type to insert into the deck</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options — 2 column grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTION_OPTIONS.map(opt => (
            <button
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className={cn(
                'w-full flex items-start gap-3 p-4 rounded-xl border bg-gradient-to-br text-left transition-all duration-200',
                opt.color,
                selected === opt.type
                  ? 'ring-2 ring-yellow-400/70 scale-[1.01]'
                  : 'hover:scale-[1.005] opacity-80 hover:opacity-100'
              )}
            >
              <div className="flex-shrink-0 mt-0.5">{opt.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm">{opt.label}</p>
                <p className="text-white/50 text-xs mt-0.5 leading-relaxed">{opt.description}</p>
              </div>
              {selected === opt.type && (
                <Check className="flex-shrink-0 h-4 w-4 text-yellow-400 mt-0.5" />
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={!selected || saving}
            className="px-5 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Inserting…' : 'Insert Section'}
          </button>
        </div>
      </div>
    </div>
  );
};
