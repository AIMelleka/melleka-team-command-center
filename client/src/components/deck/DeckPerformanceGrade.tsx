import { cn } from '@/lib/utils';

export interface DeckPerformanceGradeProps {
  grade: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const gradeConfig: Record<string, { bg: string; text: string; glow: string; label: string }> = {
  'A+': { 
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', 
    text: 'text-white', 
    glow: 'shadow-emerald-500/50',
    label: 'Exceptional'
  },
  'A': { 
    bg: 'bg-gradient-to-br from-emerald-500/90 to-emerald-600/90', 
    text: 'text-white', 
    glow: 'shadow-emerald-500/40',
    label: 'Excellent'
  },
  'A-': { 
    bg: 'bg-gradient-to-br from-emerald-400/90 to-emerald-500/90', 
    text: 'text-white', 
    glow: 'shadow-emerald-400/40',
    label: 'Great'
  },
  'B+': { 
    bg: 'bg-gradient-to-br from-blue-500 to-blue-600', 
    text: 'text-white', 
    glow: 'shadow-blue-500/40',
    label: 'Very Good'
  },
  'B': { 
    bg: 'bg-gradient-to-br from-blue-500/80 to-blue-600/80', 
    text: 'text-white', 
    glow: 'shadow-blue-500/30',
    label: 'Good'
  },
  'C+': { 
    bg: 'bg-gradient-to-br from-amber-500 to-amber-600', 
    text: 'text-white', 
    glow: 'shadow-amber-500/40',
    label: 'Above Average'
  },
  'C': { 
    bg: 'bg-gradient-to-br from-amber-500/80 to-amber-600/80', 
    text: 'text-white', 
    glow: 'shadow-amber-500/30',
    label: 'Average'
  },
  'D': { 
    bg: 'bg-gradient-to-br from-orange-500 to-orange-600', 
    text: 'text-white', 
    glow: 'shadow-orange-500/40',
    label: 'Below Average'
  },
  'F': { 
    bg: 'bg-gradient-to-br from-red-500 to-red-600', 
    text: 'text-white', 
    glow: 'shadow-red-500/40',
    label: 'Needs Work'
  },
};

const sizeClasses = {
  sm: 'w-10 h-10 text-lg',
  md: 'w-14 h-14 text-2xl',
  lg: 'w-20 h-20 text-4xl',
};

export const DeckPerformanceGrade = ({
  grade,
  color,
  size = 'md',
  showLabel = true,
}: DeckPerformanceGradeProps) => {
  const config = gradeConfig[grade] || gradeConfig['C'];

  return (
    <div className="flex items-center gap-3">
      {/* Grade circle */}
      <div 
        className={cn(
          "relative flex items-center justify-center rounded-full font-bold",
          sizeClasses[size],
          config.bg,
          config.text,
          "shadow-lg",
          config.glow
        )}
        style={color ? { 
          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
          boxShadow: `0 8px 32px ${color}40`,
        } : undefined}
      >
        {grade}
        
        {/* Animated ring for A+ */}
        {grade === 'A+' && (
          <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-emerald-400" />
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <div className="flex flex-col">
          <span className="text-white font-semibold text-sm">Performance</span>
          <span className="text-white/50 text-xs">{config.label}</span>
        </div>
      )}
    </div>
  );
};
