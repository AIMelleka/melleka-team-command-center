import { format } from 'date-fns';
import { Sparkles, ExternalLink } from 'lucide-react';

interface DeckFooterProps {
  clientName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  brandPrimary: string;
  generatedAt?: string;
  agencyName?: string;
  agencyLogo?: string;
}

export const DeckFooter = ({
  clientName,
  dateRangeStart,
  dateRangeEnd,
  brandPrimary,
  generatedAt,
  agencyName = 'Melleka Marketing',
  agencyLogo,
}: DeckFooterProps) => {
  return (
    <footer className="relative mt-16 py-12 px-8 border-t border-white/5">
      {/* Gradient overlay at top */}
      <div 
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${brandPrimary}40, transparent)`,
        }}
      />

      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 items-center">
          {/* Left: Branding */}
          <div className="text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
              <Sparkles className="h-5 w-5" style={{ color: brandPrimary }} />
              <span className="text-white font-semibold">Powered by</span>
            </div>
            {agencyLogo ? (
              <img 
                src={agencyLogo} 
                alt={agencyName}
                className="h-8 w-auto object-contain mx-auto md:mx-0"
              />
            ) : (
              <p 
                className="text-xl font-bold"
                style={{ color: brandPrimary }}
              >
                {agencyName}
              </p>
            )}
          </div>

          {/* Center: Client & Period */}
          <div className="text-center">
            <p className="text-white/40 text-sm mb-1">Performance Report for</p>
            <p className="text-white font-semibold text-lg mb-1">{clientName}</p>
            <p className="text-white/50 text-sm">
              {format(new Date(dateRangeStart), 'MMMM d')} - {format(new Date(dateRangeEnd), 'MMMM d, yyyy')}
            </p>
          </div>

          {/* Right: Generated info */}
          <div className="text-center md:text-right">
            <p className="text-white/40 text-sm mb-2">
              Generated {generatedAt ? format(new Date(generatedAt), 'MMM d, yyyy \'at\' h:mm a') : 'recently'}
            </p>
            <div className="flex items-center gap-2 justify-center md:justify-end">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-white/5 text-white/60">
                Curated Insights
              </span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-white/30 text-xs max-w-2xl mx-auto">
            This report is auto-generated based on data from connected advertising platforms, 
            CRM systems, and analytics tools. Data accuracy depends on platform reporting and 
            may not reflect real-time changes.
          </p>
        </div>
      </div>

      {/* Decorative gradient at bottom */}
      <div 
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 blur-3xl opacity-20"
        style={{ backgroundColor: brandPrimary }}
      />
    </footer>
  );
};
