import { FC } from 'react';

interface GenieLampProps {
  className?: string;
  size?: number;
}

export const GenieLamp: FC<GenieLampProps> = ({ className = '', size = 40 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#F59E0B" />
        <stop offset="50%" stopColor="#FCD34D" />
        <stop offset="100%" stopColor="#F59E0B" />
      </linearGradient>
      <linearGradient id="smokeGradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#6366F1" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#A78BFA" stopOpacity="0.3" />
      </linearGradient>
    </defs>
    
    {/* Magical smoke */}
    <path
      d="M28 8C28 8 24 12 26 18C28 24 32 20 30 14C28 8 32 4 36 8C40 12 38 18 34 16"
      stroke="url(#smokeGradient)"
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      className="animate-pulse"
    />
    
    {/* Lamp body */}
    <ellipse cx="32" cy="48" rx="20" ry="8" fill="url(#goldGradient)" />
    <path
      d="M12 48C12 48 14 36 20 32C26 28 38 28 44 32C50 36 52 48 52 48"
      fill="url(#goldGradient)"
    />
    
    {/* Spout */}
    <path
      d="M44 40C44 40 52 36 56 32C58 30 58 28 56 28C54 28 48 30 44 34"
      fill="url(#goldGradient)"
    />
    
    {/* Handle */}
    <path
      d="M12 40C12 40 8 36 6 38C4 40 6 44 10 44C14 44 12 40 12 40"
      fill="url(#goldGradient)"
    />
    
    {/* Lid */}
    <ellipse cx="32" cy="28" rx="8" ry="3" fill="url(#goldGradient)" />
    <ellipse cx="32" cy="26" rx="4" ry="2" fill="url(#goldGradient)" />
    
    {/* Sparkle */}
    <circle cx="28" cy="12" r="1" fill="#FCD34D" className="animate-ping" />
    <circle cx="36" cy="6" r="0.5" fill="#FCD34D" className="animate-ping" style={{ animationDelay: '0.5s' }} />
  </svg>
);

export default GenieLamp;
