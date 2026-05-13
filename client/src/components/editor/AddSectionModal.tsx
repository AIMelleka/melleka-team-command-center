import { useState } from 'react';
import { useAdminEdit, CustomProposalSection } from './AdminEditContext';
import { X, FileText, BarChart3, List, MessageSquare, Megaphone, Sparkles, Loader2 } from 'lucide-react';
import { apiService } from '@/lib/apiService';
import { toast } from 'sonner';

interface AddSectionModalProps {
  open: boolean;
  onClose: () => void;
  primaryColor?: string;
  clientName?: string;
  proposalContext?: string;
}

const SECTION_TYPES: Array<{
  type: CustomProposalSection['type'];
  label: string;
  description: string;
  icon: typeof FileText;
  defaultContent: Record<string, unknown>;
}> = [
  {
    type: 'text-block',
    label: 'Text Block',
    description: 'A heading with body text',
    icon: FileText,
    defaultContent: {
      heading: 'New Section',
      body: 'Add your content here...'
    }
  },
  {
    type: 'stats',
    label: 'Stats Grid',
    description: '3-4 key metrics with labels',
    icon: BarChart3,
    defaultContent: {
      stats: [
        { value: '100+', label: 'Metric One' },
        { value: '50%', label: 'Metric Two' },
        { value: '24/7', label: 'Metric Three' }
      ]
    }
  },
  {
    type: 'feature-list',
    label: 'Feature List',
    description: 'Bulleted list of features or benefits',
    icon: List,
    defaultContent: {
      heading: 'Key Features',
      items: ['Feature one', 'Feature two', 'Feature three']
    }
  },
  {
    type: 'testimonial',
    label: 'Testimonial',
    description: 'Client quote with attribution',
    icon: MessageSquare,
    defaultContent: {
      quote: '"Add a client testimonial here..."',
      author: 'Client Name',
      company: 'Company Name'
    }
  },
  {
    type: 'cta-block',
    label: 'CTA Block',
    description: 'Call-to-action with headline and button',
    icon: Megaphone,
    defaultContent: {
      heading: 'Ready to Get Started?',
      body: 'Take the next step today.',
      buttonText: 'Contact Us',
      buttonUrl: '#'
    }
  }
];

export const AddSectionModal = ({ open, onClose, primaryColor = '#7c3aed', clientName, proposalContext }: AddSectionModalProps) => {
  const { addCustomSection } = useAdminEdit();
  const [selectedType, setSelectedType] = useState<CustomProposalSection['type'] | null>(null);
  const [title, setTitle] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!open) return null;

  const handleAdd = async () => {
    const sectionDef = SECTION_TYPES.find(s => s.type === selectedType);
    if (!sectionDef) return;

    let sectionContent = { ...sectionDef.defaultContent };
    let sectionTitle = title.trim() || sectionDef.defaultContent.heading as string || sectionDef.label;

    // If AI prompt provided, generate content
    if (aiPrompt.trim() && clientName) {
      setIsGenerating(true);
      try {
        const result = await apiService.generateSection({
          prompt: aiPrompt.trim(),
          sectionType: sectionDef.type,
          clientName,
          proposalContext,
        });
        if (result) {
          sectionContent = result.content;
          if (!title.trim() && result.title) {
            sectionTitle = result.title;
          }
        }
      } catch (err) {
        console.error('AI generation failed, using defaults:', err);
        toast.error('AI generation failed — using default content');
      } finally {
        setIsGenerating(false);
      }
    }

    const section: CustomProposalSection = {
      id: `custom-${Date.now()}`,
      type: sectionDef.type,
      title: sectionTitle,
      content: sectionContent
    };

    addCustomSection(section);
    setSelectedType(null);
    setTitle('');
    setAiPrompt('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Add Section</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {SECTION_TYPES.map((section) => {
            const Icon = section.icon;
            const isSelected = selectedType === section.type;
            return (
              <button
                key={section.type}
                onClick={() => setSelectedType(section.type)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: isSelected ? primaryColor : undefined,
                    background: isSelected ? undefined : `color-mix(in srgb, ${primaryColor} 10%, transparent)`
                  }}
                >
                  <Icon className="w-5 h-5" style={{ color: isSelected ? 'white' : primaryColor }} />
                </div>
                <div>
                  <p className="font-medium text-foreground">{section.label}</p>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {selectedType && (
          <>
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground mb-2 block">Section Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={SECTION_TYPES.find(s => s.type === selectedType)?.label}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>

            <div className="mb-6">
              <label className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: primaryColor }} />
                AI Content Prompt
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder={`Describe what content AI should generate for this ${SECTION_TYPES.find(s => s.type === selectedType)?.label.toLowerCase()}...`}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Leave empty for default placeholder content, or describe what you want and AI will write it.
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            disabled={isGenerating}
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedType || isGenerating}
            className="flex-1 px-4 py-2.5 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ backgroundColor: primaryColor }}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : aiPrompt.trim() ? (
              <>
                <Sparkles className="w-4 h-4" />
                Generate & Add
              </>
            ) : (
              'Add Section'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
