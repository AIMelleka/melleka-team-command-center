import React from 'react';

// Helper to determine if a color is light (needs dark icon) or dark (needs light icon)
export const isLightColor = (hex: string): boolean => {
  if (!hex || !hex.startsWith('#')) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
};

// Official platform logo SVG components with dynamic fill support
export const GoogleLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const MetaLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.001 2C6.47813 2 2.00098 6.47715 2.00098 12C2.00098 16.9913 5.65783 21.1283 10.4385 21.8785V14.8906H7.89941V12H10.4385V9.79688C10.4385 7.29063 11.9314 5.90625 14.2156 5.90625C15.3097 5.90625 16.4541 6.10156 16.4541 6.10156V8.5625H15.1931C13.9509 8.5625 13.5635 9.33334 13.5635 10.1242V12H16.3369L15.8936 14.8906H13.5635V21.8785C18.3441 21.1283 22.001 16.9913 22.001 12C22.001 6.47715 17.5238 2 12.001 2Z" fill="#1877F2"/>
  </svg>
);

export const InstagramLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FD5"/>
        <stop offset="10%" stopColor="#FD5"/>
        <stop offset="50%" stopColor="#FF543E"/>
        <stop offset="100%" stopColor="#C837AB"/>
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-grad)"/>
    <circle cx="12" cy="12" r="4" fill="none" stroke={iconFill} strokeWidth="2"/>
    <circle cx="18" cy="6" r="1.5" fill={iconFill}/>
  </svg>
);

export const YouTubeLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill={iconFill}/>
  </svg>
);

export const SemrushLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#FF6C00"/>
  </svg>
);

export const GoogleAnalyticsLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.84 2.9982V20.9982C22.84 22.1015 21.9433 22.9982 20.84 22.9982H18.84C17.7367 22.9982 16.84 22.1015 16.84 20.9982V2.9982C16.84 1.89491 17.7367 .998199 18.84 .998199H20.84C21.9433 .998199 22.84 1.89491 22.84 2.9982Z" fill="#F9AB00"/>
    <path d="M14.08 9.1982V20.9982C14.08 22.1015 13.1833 22.9982 12.08 22.9982H10.08C8.97671 22.9982 8.08 22.1015 8.08 20.9982V9.1982C8.08 8.09491 8.97671 7.1982 10.08 7.1982H12.08C13.1833 7.1982 14.08 8.09491 14.08 9.1982Z" fill="#E37400"/>
    <circle cx="4.08" cy="19.9982" r="3" fill="#E37400"/>
  </svg>
);

export const GoogleTagManagerLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.003 0L3 9.003l3.001 3L15 3.003 12.003 0z" fill="#8AB4F8"/>
    <path d="M21 12l-3-3-9 9 3 3 9-9z" fill="#4285F4"/>
    <path d="M3 15l3 3 6-6-3-3-6 6z" fill="#8AB4F8"/>
    <path d="M12 18a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" fill="#246FDB"/>
  </svg>
);

export const LookerStudioLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#4285F4"/>
    <rect x="5" y="10" width="3" height="6" fill={iconFill}/>
    <rect x="10" y="8" width="3" height="8" fill={iconFill}/>
    <rect x="15" y="6" width="3" height="10" fill={iconFill}/>
  </svg>
);

export const TikTokLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" fill={iconFill}/>
  </svg>
);

export const LinkedInLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill={iconFill}/>
  </svg>
);

export const XTwitterLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill={iconFill}/>
  </svg>
);

export const FacebookLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill={iconFill}/>
  </svg>
);

export const ThreadsLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.022.85-.704 2.005-1.108 3.346-1.17 1.1-.05 2.112.088 3.016.412.026-.56.01-1.093-.044-1.595-.2-1.78-1.156-2.707-2.843-2.755h-.09c-1.12.02-2.052.4-2.698 1.1l-1.333-1.534C9.178 4.88 10.5 4.288 12.164 4.252h.122c2.749.072 4.438 1.624 4.753 4.371.065.555.086 1.164.06 1.828.988.516 1.79 1.203 2.348 2.064.755 1.165 1.027 2.59.787 4.132-.3 1.922-1.258 3.53-2.77 4.653C15.726 22.56 13.658 23.15 12.186 24zm.09-9.9c-.804.036-1.452.235-1.873.576-.364.295-.543.654-.517 1.04.029.432.264.798.66 1.03.455.266 1.09.408 1.84.365 1.037-.056 1.82-.41 2.395-1.08.416-.487.694-1.14.833-1.96-.98-.293-2.073-.429-3.338-.37z" fill={iconFill}/>
  </svg>
);

export const HubSpotLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.235.838h-.067a2.198 2.198 0 00-2.196 2.196v.066c0 .873.518 1.623 1.262 1.97l.006.015v2.861a6.166 6.166 0 00-2.907 1.39l-7.68-5.978a2.65 2.65 0 00.1-.69 2.666 2.666 0 10-2.666 2.666c.483 0 .93-.135 1.32-.359l7.498 5.83a6.2 6.2 0 00-.623 2.717 6.201 6.201 0 006.193 6.193 6.196 6.196 0 004.42-1.84l2.732 1.57a1.56 1.56 0 001.561 1.509 1.569 1.569 0 001.569-1.569 1.57 1.57 0 00-1.569-1.57 1.558 1.558 0 00-.863.264l-2.58-1.481a6.2 6.2 0 00.826-3.076 6.156 6.156 0 00-1.657-4.199 6.144 6.144 0 00-2.312-1.559zm-.69 9.14a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" fill="#FF7A59"/>
  </svg>
);

export const KlaviyoLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 12l10 10 10-10L12 2z" fill="#12C4A0"/>
    <path d="M12 6l-6 6 6 6 6-6-6-6z" fill={iconFill}/>
  </svg>
);

export const GoogleMyBusinessLogo = ({ className = "w-6 h-6", iconFill = "white" }: { className?: string; iconFill?: string }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    {/* Official Google Business Profile star icon */}
    <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24z" fill={iconFill}/>
  </svg>
);

// Platform logo badge component
export type SocialPlatformKey = 'google' | 'meta' | 'instagram' | 'youtube' | 'tiktok' | 'threads' | 'semrush' | 'ga4' | 'gtm' | 'looker' | 'hubspot' | 'klaviyo' | 'linkedin' | 'twitter' | 'facebook' | 'gmb';

interface PlatformBadgeProps {
  platform: SocialPlatformKey;
  showLabel?: boolean;
  className?: string;
  iconFill?: string;
}

export const platformConfig: Record<SocialPlatformKey, { Logo: React.FC<{ className?: string; iconFill?: string }>; label: string; color: string; gradient: string }> = {
  google: { Logo: GoogleLogo, label: 'Google Ads', color: '#4285F4', gradient: 'linear-gradient(135deg, #4285F4, #34A853)' },
  meta: { Logo: MetaLogo, label: 'Meta', color: '#1877F2', gradient: 'linear-gradient(135deg, #1877F2, #0d65d9)' },
  instagram: { Logo: InstagramLogo, label: 'Instagram', color: '#E4405F', gradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' },
  youtube: { Logo: YouTubeLogo, label: 'YouTube', color: '#FF0000', gradient: 'linear-gradient(135deg, #FF0000, #cc0000)' },
  tiktok: { Logo: TikTokLogo, label: 'TikTok', color: '#00F2EA', gradient: 'linear-gradient(135deg, #00f2ea, #ff0050)' },
  threads: { Logo: ThreadsLogo, label: 'Threads', color: '#000000', gradient: 'linear-gradient(135deg, #000000, #333333)' },
  semrush: { Logo: SemrushLogo, label: 'Semrush', color: '#FF6C00', gradient: 'linear-gradient(135deg, #FF6C00, #e85d00)' },
  ga4: { Logo: GoogleAnalyticsLogo, label: 'GA4', color: '#E37400', gradient: 'linear-gradient(135deg, #F9AB00, #E37400)' },
  gtm: { Logo: GoogleTagManagerLogo, label: 'GTM', color: '#4285F4', gradient: 'linear-gradient(135deg, #8AB4F8, #4285F4)' },
  looker: { Logo: LookerStudioLogo, label: 'Looker Studio', color: '#4285F4', gradient: 'linear-gradient(135deg, #4285F4, #34A853)' },
  hubspot: { Logo: HubSpotLogo, label: 'HubSpot', color: '#FF7A59', gradient: 'linear-gradient(135deg, #FF7A59, #e85d00)' },
  klaviyo: { Logo: KlaviyoLogo, label: 'Klaviyo', color: '#12C4A0', gradient: 'linear-gradient(135deg, #12C4A0, #0d9a7d)' },
  linkedin: { Logo: LinkedInLogo, label: 'LinkedIn', color: '#0A66C2', gradient: 'linear-gradient(135deg, #0077B5, #005a87)' },
  twitter: { Logo: XTwitterLogo, label: 'X (Twitter)', color: '#1DA1F2', gradient: 'linear-gradient(135deg, #1da1f2, #0d8cd9)' },
  facebook: { Logo: FacebookLogo, label: 'Facebook', color: '#1877F2', gradient: 'linear-gradient(135deg, #1877F2, #0d65d9)' },
  gmb: { Logo: GoogleMyBusinessLogo, label: 'Google My Business', color: '#4285F4', gradient: 'linear-gradient(135deg, #4285F4, #34A853)' },
};

export const PlatformBadge = ({ platform, showLabel = true, className = '', iconFill }: PlatformBadgeProps) => {
  const config = platformConfig[platform];
  if (!config) return null;
  
  const { Logo, label, color } = config;
  // Determine icon fill based on background color luminance
  const computedIconFill = iconFill || (isLightColor(color) ? '#1a1a2e' : 'white');
  
  return (
    <div 
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${className}`}
      style={{ 
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`
      }}
    >
      <Logo className="w-4 h-4" iconFill={computedIconFill} />
      {showLabel && <span className="text-xs font-medium" style={{ color }}>{label}</span>}
    </div>
  );
};

// Multi-platform logo strip
interface PlatformLogoStripProps {
  platforms: Array<SocialPlatformKey>;
  className?: string;
  iconFill?: string;
}

export const PlatformLogoStrip = ({ platforms, className = '', iconFill }: PlatformLogoStripProps) => {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {platforms.map((platform) => (
        <PlatformBadge key={platform} platform={platform} iconFill={iconFill} />
      ))}
    </div>
  );
};
