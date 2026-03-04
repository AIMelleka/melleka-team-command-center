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
    <div className="flex items-center justify-between flex-wrap gap-4 mb-8 md:mb-12">
      <div className="flex items-center gap-4">
        {/* Icon container with glow */}
        <div 
          className="relative p-4 rounded-2xl"
          style={{ 
            background: `linear-gradient(135deg, ${brandColor}30, ${brandColor}10)`,
            boxShadow: `0 0 40px ${brandColor}20`,
          }}
        >
          <IconComponent className="h-8 w-8" style={{ color: brandColor }} />
          
          {/* Subtle pulse effect */}
          <div 
            className="absolute inset-0 rounded-2xl animate-pulse opacity-20"
            style={{ backgroundColor: brandColor }}
          />
        </div>
        
        <div>
          <div className="flex items-center gap-3">
            {isEditMode && editKeyPrefix ? (
              <InlineEdit
                value={title}
                editKey={`${editKeyPrefix}.title`}
                as="h2"
                className="text-3xl md:text-4xl font-bold text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              />
            ) : (
              <h2 
                className="text-3xl md:text-4xl font-bold text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {title}
              </h2>
            )}
            
            {/* Badge */}
            {badge && (
              <span 
                className="px-3 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: `${brandColor}20`,
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
                className="text-white/50 mt-1"
              />
            ) : (
              subtitle && <p className="text-white/50 mt-1">{subtitle}</p>
            )
          )}
          
          {/* Gradient underline */}
          <div 
            className="h-1 w-24 mt-3 rounded-full"
            style={{ 
              background: `linear-gradient(90deg, ${brandColor}, ${brandColor}50)`,
            }}
          />
        </div>
      </div>

      {/* Right side content */}
      <div className="flex items-center gap-4">
        {children}
      </div>
    </div>
  );
};
