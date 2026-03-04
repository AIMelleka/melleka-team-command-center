import { ReactNode } from 'react';
import { useScrollAnimation } from '@/hooks/useScrollAnimation';
import { cn } from '@/lib/utils';
interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  delay?: number;
  animation?: 'fade-up' | 'fade-left' | 'fade-right' | 'scale' | 'fade';
}
export const AnimatedSection = ({
  children,
  className,
  id,
  delay = 0,
  animation = 'fade-up'
}: AnimatedSectionProps) => {
  const {
    ref,
    isVisible
  } = useScrollAnimation({
    threshold: 0.1
  });
  const animationClasses = {
    'fade-up': 'translate-y-8 opacity-0',
    'fade-left': '-translate-x-8 opacity-0',
    'fade-right': 'translate-x-8 opacity-0',
    'scale': 'scale-95 opacity-0',
    'fade': 'opacity-0'
  };
  const visibleClasses = 'translate-y-0 translate-x-0 scale-100 opacity-100';
  return (
    <div
      ref={ref}
      id={id}
      className={cn(
        'transition-all duration-700 ease-out',
        isVisible ? visibleClasses : animationClasses[animation],
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// For staggered children animations
interface AnimatedChildProps {
  children: ReactNode;
  index?: number;
  className?: string;
}
export const AnimatedChild = ({
  children,
  index = 0,
  className
}: AnimatedChildProps) => {
  const {
    ref,
    isVisible
  } = useScrollAnimation({
    threshold: 0.1
  });
  return <div ref={ref} className={cn('transition-all duration-500 ease-out', isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0', className)} style={{
    transitionDelay: `${index * 100}ms`
  }}>
      {children}
    </div>;
};