import { useEffect, useState } from 'react';
import { ArrowRight, Sparkles, Star, Zap, TrendingUp } from 'lucide-react';

// Animated arrow pointing to important content
interface AnnotationArrowProps {
  direction?: 'left' | 'right' | 'up' | 'down';
  color?: string;
  label?: string;
  className?: string;
  delay?: number;
}
export const AnnotationArrow = ({
  direction = 'right',
  color = '#ef4444',
  label,
  className = '',
  delay = 0
}: AnnotationArrowProps) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  const rotations = {
    right: 'rotate-0',
    left: 'rotate-180',
    up: '-rotate-90',
    down: 'rotate-90'
  };
  return <div className={`inline-flex items-center gap-2 transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'} ${className}`} style={{
    color
  }}>
      {label && <span className="text-sm font-semibold whitespace-nowrap px-2 py-1 rounded-full" style={{
      backgroundColor: `${color}20`
    }}>
          {label}
        </span>}
      <svg width="40" height="20" viewBox="0 0 40 20" className={`${rotations[direction]} animate-pulse`}>
        <path d="M0 10 L30 10 M25 5 L30 10 L25 15" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>;
};

// Spotlight/highlight effect for important stats
interface SpotlightStatProps {
  value: string;
  label: string;
  color?: string;
  icon?: 'sparkles' | 'star' | 'zap' | 'trending';
  className?: string;
}
export const SpotlightStat = ({
  value,
  label,
  color = '#22c55e',
  icon = 'sparkles',
  className = ''
}: SpotlightStatProps) => {
  const IconComponent = {
    sparkles: Sparkles,
    star: Star,
    zap: Zap,
    trending: TrendingUp
  }[icon];
  return <div className={`relative group ${className}`}>
      {/* Glow effect */}
      <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity" style={{
      backgroundColor: color
    }} />
      
      {/* Content */}
      <div className="relative p-6 rounded-2xl border-2 transition-all duration-300 group-hover:scale-105" style={{
      borderColor: color,
      background: `linear-gradient(135deg, ${color}10, ${color}05)`
    }}>
        {/* Corner badge */}
        <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center animate-bounce" style={{
        backgroundColor: color
      }}>
          <IconComponent className="w-4 h-4 text-white" />
        </div>

        <p className="text-4xl font-bold mb-1" style={{
        color
      }}>
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>;
};

// Callout badge for sections
interface CalloutBadgeProps {
  text: string;
  variant?: 'important' | 'new' | 'highlight' | 'key';
  className?: string;
}
export const CalloutBadge = ({
  text,
  variant = 'important',
  className = ''
}: CalloutBadgeProps) => {
  const styles = {
    important: {
      bg: '#ef4444',
      text: '#ffffff'
    },
    new: {
      bg: '#22c55e',
      text: '#ffffff'
    },
    highlight: {
      bg: '#eab308',
      text: '#000000'
    },
    key: {
      bg: '#3b82f6',
      text: '#ffffff'
    }
  };
  const style = styles[variant];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide ${className}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
      }}
    >
      {text}
    </span>
  );
};

// Highlight wrapper for text
interface TextHighlightProps {
  children: React.ReactNode;
  color?: string;
  animated?: boolean;
  className?: string;
}
export const TextHighlight = ({
  children,
  color = '#eab308',
  animated = true,
  className = ''
}: TextHighlightProps) => {
  return <span className={`relative inline-block ${className}`}>
      <span className={`absolute inset-0 -skew-x-3 rounded ${animated ? 'animate-pulse' : ''}`} style={{
      backgroundColor: `${color}30`,
      transform: 'skewX(-3deg)'
    }} />
      <span className="relative font-semibold" style={{
      color
    }}>
        {children}
      </span>
    </span>;
};

// Decorative bracket for emphasizing sections
interface EmphasisBracketProps {
  children: React.ReactNode;
  color?: string;
  label?: string;
  className?: string;
}
export const EmphasisBracket = ({
  children,
  color = '#9b87f5',
  label,
  className = ''
}: EmphasisBracketProps) => {
  return <div className={`relative ${className}`}>
      {/* Left bracket */}
      <div className="absolute -left-4 top-0 bottom-0 w-1 rounded-full" style={{
      backgroundColor: color
    }} />
      
      {/* Label */}
      {label && <div className="absolute -left-4 -top-3 px-2 py-0.5 rounded text-xs font-bold text-white whitespace-nowrap" style={{
      backgroundColor: color
    }}>
          {label}
        </div>}
      
      <div className="pl-4">
        {children}
      </div>
    </div>;
};

// Floating annotation that points to something
interface FloatingAnnotationProps {
  text: string;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  color?: string;
  className?: string;
}
export const FloatingAnnotation = ({
  text,
  position = 'top-right',
  color = '#ef4444',
  className = ''
}: FloatingAnnotationProps) => {
  const positions = {
    'top-left': '-top-8 -left-4',
    'top-right': '-top-8 -right-4',
    'bottom-left': '-bottom-8 -left-4',
    'bottom-right': '-bottom-8 -right-4'
  };
  const arrows = {
    'top-left': 'bottom-0 left-4 border-t-0 border-l-0',
    'top-right': 'bottom-0 right-4 border-t-0 border-r-0',
    'bottom-left': 'top-0 left-4 border-b-0 border-l-0 -translate-y-full',
    'bottom-right': 'top-0 right-4 border-b-0 border-r-0 -translate-y-full'
  };
  return <div className={`absolute ${positions[position]} z-10 ${className}`}>
      <div className="relative px-3 py-1.5 rounded-lg text-sm font-semibold text-white shadow-lg animate-bounce" style={{
      backgroundColor: color
    }}>
        {text}
        {/* Arrow pointer */}
        <div className={`absolute w-3 h-3 rotate-45 ${arrows[position]}`} style={{
        backgroundColor: color
      }} />
      </div>
    </div>;
};

// Animated underline for titles
interface AnimatedUnderlineProps {
  children: React.ReactNode;
  color?: string;
  thickness?: number;
  className?: string;
}
export const AnimatedUnderline = ({
  children,
  color = '#9b87f5',
  thickness = 4,
  className = ''
}: AnimatedUnderlineProps) => {
  return <span className={`relative inline-block group ${className}`}>
      {children}
      <span className="absolute bottom-0 left-0 w-0 group-hover:w-full transition-all duration-500 rounded-full" style={{
      height: thickness,
      backgroundColor: color
    }} />
    </span>;
};

// Pulsing dot indicator
interface PulsingIndicatorProps {
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
export const PulsingIndicator = ({
  color = '#22c55e',
  size = 'md',
  className = ''
}: PulsingIndicatorProps) => {
  const sizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };
  return <span className={`relative inline-flex ${className}`}>
      <span className={`${sizes[size]} rounded-full animate-ping absolute opacity-75`} style={{
      backgroundColor: color
    }} />
      <span className={`${sizes[size]} rounded-full`} style={{
      backgroundColor: color
    }} />
    </span>;
};