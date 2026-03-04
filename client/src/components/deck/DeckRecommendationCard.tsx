import { ReactNode } from 'react';
import { 
  AlertCircle, 
  ArrowRight, 
  Zap, 
  Clock, 
  Target,
  TrendingUp,
  Megaphone,
  Search,
  Palette,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDeckEdit } from './DeckEditContext';
import { InlineEdit } from './InlineEdit';

type Priority = 'high' | 'medium' | 'low';
type Category = 'ads' | 'seo' | 'creative' | 'automation' | 'general';

interface DeckRecommendationCardProps {
  title: string;
  description?: string;
  priority: Priority;
  category?: Category;
  impact?: string;
  effort?: 'low' | 'medium' | 'high';
  isQuickWin?: boolean;
  urgentDeadline?: string;
  brandPrimary?: string;
  expanded?: boolean;
  onToggle?: () => void;
  /** Pass a unique key prefix (e.g. "next-steps.rec.0") to enable inline editing */
  editKeyPrefix?: string;
}

const priorityConfig: Record<Priority, { bg: string; text: string; border: string; label: string }> = {
  high: { 
    bg: 'bg-red-500/20', 
    text: 'text-red-400', 
    border: 'border-red-500/30',
    label: 'High Priority'
  },
  medium: { 
    bg: 'bg-amber-500/20', 
    text: 'text-amber-400', 
    border: 'border-amber-500/30',
    label: 'Medium Priority'
  },
  low: { 
    bg: 'bg-emerald-500/20', 
    text: 'text-emerald-400', 
    border: 'border-emerald-500/30',
    label: 'Low Priority'
  },
};

const categoryIcons: Record<Category, ReactNode> = {
  ads: <Megaphone className="h-4 w-4" />,
  seo: <Search className="h-4 w-4" />,
  creative: <Palette className="h-4 w-4" />,
  automation: <Settings className="h-4 w-4" />,
  general: <Target className="h-4 w-4" />,
};

const effortLabels: Record<string, string> = {
  low: '< 1 hour',
  medium: '1-4 hours',
  high: '1+ days',
};

export const DeckRecommendationCard = ({
  title,
  description,
  priority,
  category = 'general',
  impact,
  effort,
  isQuickWin = false,
  urgentDeadline,
  brandPrimary = '#6366f1',
  expanded = false,
  onToggle,
  editKeyPrefix,
}: DeckRecommendationCardProps) => {
  const config = priorityConfig[priority] || priorityConfig.medium;
  const { isEditMode } = useDeckEdit();

  const titleKey = editKeyPrefix ? `${editKeyPrefix}.title` : undefined;
  const descKey = editKeyPrefix ? `${editKeyPrefix}.description` : undefined;

  return (
    <div 
      className={cn(
        "group relative rounded-2xl border overflow-hidden transition-all duration-300",
        "hover:transform hover:scale-[1.01]",
        config.border,
        "bg-white/5 backdrop-blur-xl"
      )}
    >
      {/* Priority stripe */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          priority === 'high' && 'bg-gradient-to-b from-red-500 to-red-600',
          priority === 'medium' && 'bg-gradient-to-b from-amber-500 to-amber-600',
          priority === 'low' && 'bg-gradient-to-b from-emerald-500 to-emerald-600'
        )}
      />

      <div className="p-5 pl-6">
        {/* Top row: Badges */}
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <span className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
            config.bg, config.text
          )}>
            <AlertCircle className="h-3 w-3" />
            {config.label}
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white/10 text-white/70">
            {categoryIcons[category]}
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </span>

          {isQuickWin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-400">
              <Zap className="h-3 w-3" />
              Quick Win
            </span>
          )}

          {urgentDeadline && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
              <Clock className="h-3 w-3" />
              Due: {urgentDeadline}
            </span>
          )}
        </div>

        {/* Title */}
        {isEditMode && titleKey ? (
          <div className="mb-2">
            <InlineEdit
              value={title}
              editKey={titleKey}
              as="h4"
              className="text-lg font-semibold text-white"
            />
          </div>
        ) : (
          <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-white/90 transition-colors">
            {title}
          </h4>
        )}

        {/* Description */}
        {(description || (isEditMode && descKey)) && (
          isEditMode && descKey ? (
            <div className="mb-4">
              <InlineEdit
                value={description || ''}
                editKey={descKey}
                as="p"
                multiline
                className="text-white/60 text-sm leading-relaxed"
              />
            </div>
          ) : (
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              {description}
            </p>
          )
        )}

        {/* Impact and Effort */}
        <div className="flex items-center gap-4 flex-wrap">
          {impact && (
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">{impact}</span>
            </div>
          )}
          
          {effort && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/40" />
              <span className="text-sm text-white/50">
                Est. effort: {effortLabels[effort]}
              </span>
            </div>
          )}
        </div>

        {/* Expand button */}
        {(description || expanded) && onToggle && (
          <button 
            onClick={onToggle}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors"
            style={{ color: brandPrimary }}
          >
            {expanded ? 'Show less' : 'View details'}
            <ArrowRight className={cn(
              "h-4 w-4 transition-transform",
              expanded && "rotate-90"
            )} />
          </button>
        )}
      </div>

      {/* Hover glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 blur-2xl"
        style={{
          background: priority === 'high' 
            ? 'radial-gradient(circle at center, rgba(239, 68, 68, 0.1) 0%, transparent 70%)'
            : priority === 'medium'
            ? 'radial-gradient(circle at center, rgba(245, 158, 11, 0.1) 0%, transparent 70%)'
            : 'radial-gradient(circle at center, rgba(34, 197, 94, 0.1) 0%, transparent 70%)',
        }}
      />
    </div>
  );
};
