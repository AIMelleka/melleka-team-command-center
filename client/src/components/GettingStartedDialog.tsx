import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Link2, MessageSquare, FileText, Palette, Calendar, X, CheckCircle2,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────
const DEMO_VIDEO_ID = '-aV87WZyzJU';
const CALENDLY_URL = 'https://calendly.com/mellekamarketing/meeting';

interface GettingStartedDialogProps {
  onDismiss: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  agencyName?: string;
}

interface ChecklistItem {
  id: number;
  label: string;
  description: string;
  icon: React.ReactNode;
  action: 'video' | 'navigate' | 'focus-chat' | 'external';
  target?: string;
}

const GettingStartedDialog = ({ onDismiss, inputRef, agencyName }: GettingStartedDialogProps) => {
  const navigate = useNavigate();
  const [showVideo, setShowVideo] = useState(false);
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const items: ChecklistItem[] = [
    {
      id: 1,
      label: 'Watch the tutorial',
      description: '2-min walkthrough of the platform',
      icon: <Play className="w-5 h-5" />,
      action: 'video',
    },
    {
      id: 2,
      label: 'Connect your ad accounts',
      description: 'Link Google Ads, Meta Ads, and more',
      icon: <Link2 className="w-5 h-5" />,
      action: 'navigate',
      target: '/settings/integrations',
    },
    {
      id: 3,
      label: 'Chat with your AI agent',
      description: 'Ask anything — it has access to all your tools',
      icon: <MessageSquare className="w-5 h-5" />,
      action: 'focus-chat',
    },
    {
      id: 4,
      label: 'Try the SEO Writer',
      description: 'Create optimized blog posts and landing pages',
      icon: <FileText className="w-5 h-5" />,
      action: 'navigate',
      target: '/seo-writer',
    },
    {
      id: 5,
      label: 'Try Creative Studio',
      description: 'Generate ad creatives and visuals with AI',
      icon: <Palette className="w-5 h-5" />,
      action: 'navigate',
      target: '/creative-studio',
    },
    {
      id: 6,
      label: 'Schedule a call with us',
      description: 'Book a free onboarding session with our team',
      icon: <Calendar className="w-5 h-5" />,
      action: 'external',
      target: CALENDLY_URL,
    },
  ];

  const handleItemClick = (item: ChecklistItem) => {
    setCompleted(prev => new Set(prev).add(item.id));

    switch (item.action) {
      case 'video':
        setShowVideo(true);
        break;
      case 'navigate':
        onDismiss();
        navigate(item.target!);
        break;
      case 'focus-chat':
        onDismiss();
        setTimeout(() => inputRef.current?.focus(), 100);
        break;
      case 'external':
        window.open(item.target!, '_blank', 'noopener,noreferrer');
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl p-6 sm:p-8 relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 pr-10">
          Here's how to get the most out of {agencyName || 'your platform'}
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Complete these steps to get set up — click any item to get started.
        </p>

        {/* Video embed (inline, toggled) */}
        {showVideo && (
          <div className="mb-6 rounded-xl overflow-hidden border border-border aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${DEMO_VIDEO_ID}?autoplay=1&rel=0`}
              title="Platform Tutorial"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        )}

        {/* Checklist */}
        <div className="space-y-3">
          {items.map((item) => {
            const isCompleted = completed.has(item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group
                  ${isCompleted
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
              >
                {/* Number circle */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : item.id}
                </div>

                {/* Icon */}
                <div className={`flex-shrink-0 transition-colors ${isCompleted ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  {item.icon}
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className={`font-medium text-sm ${isCompleted ? 'text-primary' : 'text-foreground'}`}>
                    {item.label}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dismiss link */}
        <div className="mt-6 text-center">
          <button
            onClick={onDismiss}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
          >
            I'm good — let me explore on my own
          </button>
        </div>
      </div>
    </div>
  );
};

export default GettingStartedDialog;
