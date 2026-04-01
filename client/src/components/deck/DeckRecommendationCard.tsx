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

const priorityConfig: Record<Priority, { bg: string; text: string; border: string; label: string; refClass: string }> = {
  high: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    label: 'High Priority',
    refClass: 'deck-ref-priority-high',
  },
  medium: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    label: 'Medium Priority',
    refClass: 'deck-ref-priority-medium',
  },
  low: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    border: 'border-emerald-200',
    label: 'Low Priority',
    refClass: 'deck-ref-priority-low',
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
  brandPrimary = '#6C3FA0',
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
        "group relative bg-white rounded-2xl border border-[#e5e5e0] overflow-hidden transition-all duration-300",
        "hover:shadow-md",
        config.refClass,
      )}
    >
      <div className="p-5 pl-7">
        {/* Top row: Badges */}
        <div className="flex items-center flex-wrap gap-2 mb-3">
          <span className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold",
            config.bg, config.text
          )}>
            <AlertCircle className="h-3 w-3" />
            {config.label}
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-[#6b7280]">
            {categoryIcons[category]}
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </span>

          {isQuickWin && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-600">
              <Zap className="h-3 w-3" />
              Quick Win
            </span>
          )}

          {urgentDeadline && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
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
              className="text-base font-semibold text-[#1a1a1a]"
            />
          </div>
        ) : (
          <h4 className="text-base font-semibold text-[#1a1a1a] mb-2">
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
                className="text-[#6b7280] text-sm leading-relaxed"
              />
            </div>
          ) : (
            <p className="text-[#6b7280] text-sm leading-relaxed mb-4">
              {description}
            </p>
          )
        )}

        {/* Impact and Effort */}
        <div className="flex items-center gap-4 flex-wrap">
          {impact && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-sm text-emerald-600 font-medium">{impact}</span>
            </div>
          )}

          {effort && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#9ca3af]" />
              <span className="text-sm text-[#6b7280]">
                Est. effort: {effortLabels[effort]}
              </span>
            </div>
          )}
        </div>

        {/* Expand button */}
        {(description || expanded) && onToggle && (
          <button
            onClick={onToggle}
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium transition-colors"
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
    </div>
  );
};
