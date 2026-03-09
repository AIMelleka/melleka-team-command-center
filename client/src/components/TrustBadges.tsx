// Trust badges with transparent background logos - updated
import { Star } from 'lucide-react';
import googlePartnerLogo from '@/assets/google-partner-logo.webp';
import metaPartnerLogo from '@/assets/meta-partner-logo.webp';
import tiktokPartnerLogo from '@/assets/tiktok-partner-logo.webp';
import clutchRating from '@/assets/clutch-rating.webp';
import bbbLogo from '@/assets/bbb-logo.webp';

interface TrustBadgesProps {
  className?: string;
  textColor?: string;
  textMutedColor?: string;
}

export const TrustBadges = ({ 
  className = '', 
  textColor = '#1a1a2e',
  textMutedColor = 'rgba(26, 26, 46, 0.7)'
}: TrustBadgesProps) => {
  return (
    <div className={`flex flex-col items-center gap-10 ${className}`}>
      <div className="text-center">
        <h2 
          className="text-2xl md:text-3xl font-display font-bold mb-3"
          style={{ color: textColor }}
        >
          Trusted by the Best
        </h2>
        <p 
          className="flex items-center justify-center gap-2 text-lg"
          style={{ color: textMutedColor }}
        >
          <span className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
            ))}
          </span>
          <span className="font-medium">Over 100+ 5 Star Reviews</span>
        </p>
      </div>
      
      <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10 py-8 px-6 rounded-2xl bg-white/80 backdrop-blur-sm border border-border/50 shadow-sm w-full max-w-6xl">
        {/* Google Partner */}
        <img
          src={googlePartnerLogo}
          alt="Google Partner"
          className="h-16 md:h-20 object-contain"
          loading="lazy"
        />

        {/* Meta Business Partner */}
        <img
          src={metaPartnerLogo}
          alt="Meta Business Partner"
          className="h-16 md:h-20 object-contain"
          loading="lazy"
        />

        {/* TikTok Marketing Partners */}
        <img
          src={tiktokPartnerLogo}
          alt="TikTok Marketing Partners"
          className="h-16 md:h-20 object-contain"
          loading="lazy"
        />

        {/* Clutch 5.0 Rating */}
        <img
          src={clutchRating}
          alt="Clutch 5.0 Rating"
          className="h-16 md:h-20 object-contain"
          loading="lazy"
        />

        {/* BBB A+ Rating */}
        <img
          src={bbbLogo}
          alt="BBB A+ Accredited Business"
          className="h-16 md:h-20 object-contain"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default TrustBadges;
