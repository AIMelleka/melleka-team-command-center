import React, { useEffect, useState, useRef, useCallback } from 'react';

interface AnimatedCounterProps {
  value: string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Parse a value string and extract the numeric part and format
const parseValue = (value: string): { 
  prefix: string; 
  number: number; 
  suffix: string; 
  decimals: number;
  hasK: boolean;
  hasM: boolean;
} => {
  // Handle common formats like "$50K", "340%", "2.3x", "1.2M", "$12,500", "45.5%"
  const cleaned = value.replace(/,/g, ''); // Remove commas
  
  // Find the numeric part (including decimals)
  const numMatch = cleaned.match(/[\d.]+/);
  if (!numMatch) {
    return { prefix: '', number: 0, suffix: value, decimals: 0, hasK: false, hasM: false };
  }
  
  const numStr = numMatch[0];
  const number = parseFloat(numStr);
  const decimals = numStr.includes('.') ? numStr.split('.')[1]?.length || 0 : 0;
  
  const numIndex = cleaned.indexOf(numStr);
  const prefix = cleaned.substring(0, numIndex);
  const suffix = cleaned.substring(numIndex + numStr.length);
  
  // Check for K or M multipliers
  const hasK = suffix.toUpperCase().startsWith('K');
  const hasM = suffix.toUpperCase().startsWith('M');
  
  return { prefix, number, suffix, decimals, hasK, hasM };
};

// Format number with commas
const formatNumber = (num: number, decimals: number): string => {
  if (decimals > 0) {
    return num.toFixed(decimals);
  }
  return Math.round(num).toLocaleString();
};

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 2000,
  className = '',
  style,
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const hasAnimatedRef = useRef(false);
  const prevValueRef = useRef(value);
  const elementRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<number | null>(null);

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);
  
  const startAnimation = useCallback((targetValue: string) => {
    const { prefix, number, suffix, decimals } = parseValue(targetValue);
    
    if (number === 0) {
      setDisplayValue(targetValue);
      return;
    }
    
    // Cancel any existing animation
    stopAnimation();
    
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentNumber = number * easeOut;
      const formatted = formatNumber(currentNumber, decimals);
      
      setDisplayValue(`${prefix}${formatted}${suffix}`);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure final value matches exactly
        setDisplayValue(targetValue);
      }
    };
    
    // Start from zero
    setDisplayValue(`${parseValue(targetValue).prefix}0${parseValue(targetValue).suffix}`);
    animationRef.current = requestAnimationFrame(animate);
  }, [duration, stopAnimation]);

  // Cleanup on unmount only
  useEffect(() => stopAnimation, [stopAnimation]);
  
  // Handle value changes: always sync display, and re-animate only after first reveal
  useEffect(() => {
    const prevValue = prevValueRef.current;
    prevValueRef.current = value;

    // Always keep display in sync if value changes and we haven't animated yet.
    // (This prevents getting stuck at a stale '0' if animations are interrupted.)
    if (!hasAnimatedRef.current && value !== prevValue) {
      setDisplayValue(value);
    }
    
    // If value changed and we've already animated once, re-animate to the new number
    if (hasAnimatedRef.current && value !== prevValue && value !== '0' && value !== '') {
      const { number } = parseValue(value);
      if (number > 0) {
        startAnimation(value);
      }
    }
  }, [value, startAnimation]);
  
  // Intersection observer for initial animation
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            const { number } = parseValue(value);
            if (number > 0) {
              hasAnimatedRef.current = true;
              startAnimation(value);
            } else {
              setDisplayValue(value);
            }
          }
        });
      },
      { threshold: 0.3 }
    );
    
    observer.observe(element);
    
    return () => {
      observer.disconnect();
    };
  }, [value, startAnimation]);
  
  return (
    <span ref={elementRef} className={className} style={style}>
      {displayValue}
    </span>
  );
};

// Wrapper component for stat items with animated values
interface AnimatedStatProps {
  value: string;
  label: string;
  valueClassName?: string;
  labelClassName?: string;
  valueStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  duration?: number;
}

export const AnimatedStat: React.FC<AnimatedStatProps> = ({
  value,
  label,
  valueClassName = '',
  labelClassName = '',
  valueStyle,
  labelStyle,
  duration = 2000,
}) => {
  return (
    <div className="text-center">
      <p className={valueClassName} style={valueStyle}>
        <AnimatedCounter value={value} duration={duration} />
      </p>
      <p className={labelClassName} style={labelStyle}>
        {label}
      </p>
    </div>
  );
};

export default AnimatedCounter;