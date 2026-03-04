import { useRef, useEffect } from 'react';
import { 
  ArrowRight, 
  AlertCircle, 
  Lightbulb, 
  X, 
  CheckCircle2,
  Eye,
  Zap
} from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { Annotation } from './ImageAnnotator';

export interface AdAnalysisItem {
  id: string;
  competitorName: string;
  transparencyUrl: string;
  screenshot: string | null;
  issues: string[];
  ourSolution: string;
  platform: 'google' | 'meta';
  annotations?: Annotation[];
}

// Component to render annotated screenshot
const AnnotatedScreenshot = ({ 
  imageUrl, 
  annotations,
  borderColor 
}: { 
  imageUrl: string; 
  annotations?: Annotation[];
  borderColor: string;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const maxWidth = container.clientWidth;
      const scale = maxWidth / img.width;
      
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Draw annotations
      if (annotations && annotations.length > 0) {
        annotations.forEach(ann => {
          ctx.strokeStyle = ann.color;
          ctx.fillStyle = ann.color;
          ctx.lineWidth = 3;
          
          const sx = ann.startX * scale;
          const sy = ann.startY * scale;
          const ex = ann.endX * scale;
          const ey = ann.endY * scale;

          switch (ann.type) {
            case 'arrow':
              // Draw line
              ctx.beginPath();
              ctx.moveTo(sx, sy);
              ctx.lineTo(ex, ey);
              ctx.stroke();
              
              // Draw arrowhead
              const headLength = 12;
              const angle = Math.atan2(ey - sy, ex - sx);
              ctx.beginPath();
              ctx.moveTo(ex, ey);
              ctx.lineTo(
                ex - headLength * Math.cos(angle - Math.PI / 6),
                ey - headLength * Math.sin(angle - Math.PI / 6)
              );
              ctx.lineTo(
                ex - headLength * Math.cos(angle + Math.PI / 6),
                ey - headLength * Math.sin(angle + Math.PI / 6)
              );
              ctx.closePath();
              ctx.fill();
              break;
            case 'circle':
              const radius = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
              ctx.beginPath();
              ctx.arc(sx, sy, radius, 0, 2 * Math.PI);
              ctx.stroke();
              break;
            case 'highlight':
              ctx.globalAlpha = 0.3;
              ctx.fillRect(
                Math.min(sx, ex),
                Math.min(sy, ey),
                Math.abs(ex - sx),
                Math.abs(ey - sy)
              );
              ctx.globalAlpha = 1;
              ctx.strokeRect(
                Math.min(sx, ex),
                Math.min(sy, ey),
                Math.abs(ex - sx),
                Math.abs(ey - sy)
              );
              break;
          }
        });
      }
    };
    img.src = imageUrl;
  }, [imageUrl, annotations]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full rounded-xl"
        style={{ border: `1px solid ${borderColor}` }}
      />
    </div>
  );
};

interface CompetitiveAdDisplayProps {
  items: AdAnalysisItem[];
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  clientName: string;
}

export const CompetitiveAdDisplay = ({
  items,
  primaryColor,
  secondaryColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  clientName,
}: CompetitiveAdDisplayProps) => {
  if (!items || items.length === 0) return null;

  return (
    <section className="py-24" style={{ background: `linear-gradient(180deg, ${cardBackground} 0%, transparent 100%)` }}>
      <div className="container max-w-6xl mx-auto px-4">
        <AnimatedSection>
          <div className="text-center mb-16">
            <p 
              className="font-medium uppercase tracking-widest text-sm mb-4"
              style={{ color: secondaryColor }}
            >
              Competitive Intelligence
            </p>
            <h2 
              className="text-3xl md:text-5xl font-display font-bold mb-6"
              style={{ color: textColor }}
            >
              What Your Competitors Are Doing Wrong
            </h2>
            <p 
              className="text-lg max-w-3xl mx-auto"
              style={{ color: textMutedColor }}
            >
              We analyzed the ad strategies of key competitors. Here's what we found, and how we'll help {clientName} stand out.
            </p>
          </div>
        </AnimatedSection>

        {/* Ad Analysis Cards */}
        <div className="space-y-16">
          {items.map((item, index) => (
            <AnimatedSection key={item.id} delay={index * 150}>
              <div 
                className="rounded-3xl overflow-hidden"
                style={{ 
                  background: cardBackground,
                  border: `1px solid ${borderColor}`
                }}
              >
                {/* Competitor Header */}
                <div 
                  className="px-8 py-6 border-b"
                  style={{ borderColor }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                      >
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 
                          className="text-2xl font-display font-bold"
                          style={{ color: textColor }}
                        >
                          {item.competitorName}
                        </h3>
                        <p style={{ color: textMutedColor }} className="text-sm">
                          {item.platform === 'google' ? 'Google Ads Analysis' : 'Meta Ads Analysis'}
                        </p>
                      </div>
                    </div>
                    <span 
                      className="px-4 py-2 rounded-full text-sm font-medium"
                      style={{ 
                        backgroundColor: `color-mix(in srgb, #ef4444 20%, transparent)`,
                        color: '#f87171'
                      }}
                    >
                      Competitor
                    </span>
                  </div>
                </div>

                {/* 3-Panel Flow */}
                <div className="grid grid-cols-1 lg:grid-cols-3">
                  {/* Panel 1: Their Ad */}
                  <div 
                    className="p-6 lg:border-r"
                    style={{ borderColor }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ 
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171'
                        }}
                      >
                        1
                      </div>
                      <span 
                        className="font-semibold"
                        style={{ color: textColor }}
                      >
                        Their Current Ad
                      </span>
                    </div>
                    
                    {item.screenshot ? (
                      <div className="relative">
                        <AnnotatedScreenshot 
                          imageUrl={item.screenshot}
                          annotations={item.annotations}
                          borderColor={borderColor}
                        />
                        {/* Red overlay indicators for unannotated images */}
                        {(!item.annotations || item.annotations.length === 0) && (
                          <div 
                            className="absolute inset-0 rounded-xl pointer-events-none"
                            style={{ 
                              boxShadow: 'inset 0 0 0 3px rgba(239, 68, 68, 0.5)',
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <div 
                        className="aspect-video rounded-xl flex items-center justify-center"
                        style={{ 
                          backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
                          border: `2px dashed ${borderColor}`
                        }}
                      >
                        <span style={{ color: textMutedColor }}>Ad screenshot</span>
                      </div>
                    )}
                  </div>

                  {/* Panel 2: Issues */}
                  <div 
                    className="p-6 lg:border-r"
                    style={{ 
                      borderColor,
                      background: 'rgba(251, 191, 36, 0.03)'
                    }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ 
                          backgroundColor: 'rgba(251, 191, 36, 0.2)',
                          color: '#fbbf24'
                        }}
                      >
                        2
                      </div>
                      <span 
                        className="font-semibold"
                        style={{ color: textColor }}
                      >
                        Issues We Identified
                      </span>
                      <AlertCircle className="w-4 h-4" style={{ color: '#fbbf24' }} />
                    </div>
                    
                    <div className="space-y-3">
                      {item.issues.filter(issue => issue.trim()).map((issue, i) => (
                        <div 
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg"
                          style={{ 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)'
                          }}
                        >
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                          >
                            <X className="w-3 h-3" style={{ color: '#f87171' }} />
                          </div>
                          <span 
                            className="text-sm"
                            style={{ color: textColor }}
                          >
                            {issue}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Arrow indicator */}
                    <div className="hidden lg:flex justify-end mt-6">
                      <ArrowRight 
                        className="w-8 h-8 animate-pulse"
                        style={{ color: primaryColor }}
                      />
                    </div>
                  </div>

                  {/* Panel 3: Our Solution */}
                  <div 
                    className="p-6"
                    style={{ 
                      background: `linear-gradient(135deg, color-mix(in srgb, ${primaryColor} 5%, transparent), color-mix(in srgb, ${secondaryColor} 5%, transparent))`
                    }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                        style={{ 
                          background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                          color: 'white'
                        }}
                      >
                        3
                      </div>
                      <span 
                        className="font-semibold"
                        style={{ color: textColor }}
                      >
                        Our Solution
                      </span>
                      <Lightbulb className="w-4 h-4" style={{ color: secondaryColor }} />
                    </div>
                    
                    <div 
                      className="p-4 rounded-xl mb-4"
                      style={{ 
                        backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, ${cardBackground})`,
                        border: `1px solid ${primaryColor}40`
                      }}
                    >
                      <p 
                        className="text-sm leading-relaxed"
                        style={{ color: textColor }}
                      >
                        {item.ourSolution}
                      </p>
                    </div>

                    {/* Result indicator */}
                    <div 
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{ 
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        border: '1px solid rgba(34, 197, 94, 0.2)'
                      }}
                    >
                      <CheckCircle2 className="w-5 h-5" style={{ color: '#22c55e' }} />
                      <span 
                        className="text-sm font-medium"
                        style={{ color: '#22c55e' }}
                      >
                        Higher engagement & conversions
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA */}
                <div 
                  className="px-8 py-4 border-t flex items-center justify-between"
                  style={{ 
                    borderColor,
                    background: `linear-gradient(90deg, color-mix(in srgb, ${primaryColor} 5%, transparent), transparent)`
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5" style={{ color: secondaryColor }} />
                    <span 
                      className="text-sm font-medium"
                      style={{ color: textMutedColor }}
                    >
                      We'll outperform this with data-driven creative strategies
                    </span>
                  </div>
                </div>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
};
