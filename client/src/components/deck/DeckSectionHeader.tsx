import { ReactNode, useContext } from 'react';
import { DeckPerformanceGrade } from './DeckPerformanceGrade';
import { LucideIcon } from 'lucide-react';
import { DeckEditContext } from './DeckEditContext';
import { InlineEdit } from './InlineEdit';

export interface DeckSectionHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  brandColor: string;
  grade?: string;
  badge?: string;
  children?: ReactNode;
  /** If provided, title + subtitle become inline-editable in Edit Mode */
  editKeyPrefix?: string;
}

export const DeckSectionHeader = ({
  title,
  subtitle,
  icon: IconComponent,
  brandColor,
  grade,
  badge,
  children,
  editKeyPrefix,
}: DeckSectionHeaderProps) => {
  const editCtx = useContext(DeckEditContext);
  const isEditMode = editCtx?.isEditMode ?? false;

  return (
    <div className="flex items-center justify-between flex-wrap gap-4 mb-8 md:mb-10">
      <div className="flex items-center gap-3">
        {/* Icon container */}
        <div
          className="p-3 rounded-xl"
          style={{
            background: `${brandColor}12`,
          }}
        >
          <IconComponent className="h-6 w-6" style={{ color: brandColor }} />
        </div>

        <div>
          <div className="flex items-center gap-3">
            {isEditMode && editKeyPrefix ? (
              <InlineEdit
                value={title}
                editKey={`${editKeyPrefix}.title`}
                as="h2"
                className="text-2xl md:text-3xl font-bold text-[#1a1a1a]"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              />
            ) : (
              <h2
                className="text-2xl md:text-3xl font-bold text-[#1a1a1a]"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                {title}
              </h2>
            )}

            {/* Badge */}
            {badge && (
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${brandColor}15`,
                  color: brandColor,
                }}
              >
                {badge}
              </span>
            )}
          </div>

          {(subtitle || (isEditMode && editKeyPrefix)) && (
            isEditMode && editKeyPrefix ? (
              <InlineEdit
                value={subtitle || ''}
                editKey={`${editKeyPrefix}.subtitle`}
                as="p"
                className="text-[#6b7280] mt-1 text-sm"
              />
            ) : (
              subtitle && <p className="text-[#6b7280] mt-1 text-sm">{subtitle}</p>
            )
          )}
        </div>
      </div>

      {/* Right side content */}
      <div className="flex items-center gap-4">
        {children}
      </div>
    </div>
  );
};
