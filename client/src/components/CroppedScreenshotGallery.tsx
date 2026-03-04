import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, ZoomIn, Maximize2, Image, BarChart3, Table, TrendingUp, Hash } from 'lucide-react';

interface CropRegion {
  description: string;
  importance: 'high' | 'medium' | 'low';
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  type: 'kpi_card' | 'chart' | 'table' | 'metric' | 'trend' | 'other';
}

interface CroppedScreenshotGalleryProps {
  screenshots: string[];
  cropRegions?: CropRegion[];
  sectionColor?: string;
  title?: string;
  insights?: string[];
}

const getTypeIcon = (type: CropRegion['type']) => {
  switch (type) {
    case 'kpi_card':
      return Hash;
    case 'chart':
      return BarChart3;
    case 'table':
      return Table;
    case 'trend':
      return TrendingUp;
    default:
      return Image;
  }
};

const getImportanceStyle = (importance: CropRegion['importance']) => {
  switch (importance) {
    case 'high':
      return 'ring-2 ring-emerald-500/50 shadow-emerald-500/20';
    case 'medium':
      return 'ring-2 ring-amber-500/50 shadow-amber-500/20';
    case 'low':
      return 'ring-1 ring-white/20';
    default:
      return '';
  }
};

export const CroppedScreenshotGallery = ({
  screenshots,
  cropRegions = [],
  sectionColor = '#6366f1',
  title,
  insights = [],
}: CroppedScreenshotGalleryProps) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedCrop, setExpandedCrop] = useState<{ screenshot: string; region: CropRegion } | null>(null);
  const [viewMode, setViewMode] = useState<'crops' | 'full'>('crops');

  // Group crop regions by importance
  const highPriorityCrops = cropRegions.filter(r => r.importance === 'high');
  const mediumPriorityCrops = cropRegions.filter(r => r.importance === 'medium');
  const lowPriorityCrops = cropRegions.filter(r => r.importance === 'low');

  const allCrops = [...highPriorityCrops, ...mediumPriorityCrops, ...lowPriorityCrops];

  return (
    <div className="space-y-6">
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        {title && <h3 className="text-xl font-semibold text-white">{title}</h3>}
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('crops')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              viewMode === 'crops'
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            <ZoomIn className="h-4 w-4 inline mr-2" />
            Key Highlights ({allCrops.length})
          </button>
          <button
            onClick={() => setViewMode('full')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              viewMode === 'full'
                ? "bg-white/20 text-white"
                : "bg-white/5 text-white/60 hover:bg-white/10"
            )}
          >
            <Maximize2 className="h-4 w-4 inline mr-2" />
            Full Screenshots ({screenshots.length})
          </button>
        </div>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <div 
          className="rounded-xl p-4 border"
          style={{ 
            backgroundColor: `${sectionColor}10`,
            borderColor: `${sectionColor}30`
          }}
        >
          <h4 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: sectionColor }} />
            AI-Generated Insights
          </h4>
          <ul className="space-y-2">
            {insights.map((insight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-white/70">
                <span 
                  className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: sectionColor, color: 'white' }}
                >
                  {idx + 1}
                </span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {viewMode === 'crops' && allCrops.length > 0 ? (
        <div className="space-y-4">
          {/* High Priority Crops - Larger display */}
          {highPriorityCrops.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-emerald-400">Key Metrics</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {highPriorityCrops.map((region, idx) => (
                  <CroppedRegionCard
                    key={`high-${idx}`}
                    screenshot={screenshots[0] || ''}
                    region={region}
                    onClick={() => setExpandedCrop({ screenshot: screenshots[0], region })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Medium Priority Crops */}
          {mediumPriorityCrops.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-sm font-medium text-amber-400">Supporting Data</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {mediumPriorityCrops.map((region, idx) => (
                  <CroppedRegionCard
                    key={`medium-${idx}`}
                    screenshot={screenshots[0] || ''}
                    region={region}
                    compact
                    onClick={() => setExpandedCrop({ screenshot: screenshots[0], region })}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Low Priority Crops */}
          {lowPriorityCrops.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/40" />
                <span className="text-sm font-medium text-white/60">Additional Details</span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                {lowPriorityCrops.map((region, idx) => (
                  <CroppedRegionCard
                    key={`low-${idx}`}
                    screenshot={screenshots[0] || ''}
                    region={region}
                    compact
                    onClick={() => setExpandedCrop({ screenshot: screenshots[0], region })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Full Screenshots View
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {screenshots.map((screenshot, idx) => (
            <div
              key={idx}
              className="relative rounded-xl overflow-hidden shadow-xl border border-white/10 cursor-zoom-in hover:border-white/30 transition-all group"
              onClick={() => setExpandedImage(screenshot)}
            >
              <img
                src={screenshot}
                alt={`Screenshot ${idx + 1}`}
                className="w-full h-48 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="text-white text-sm">Screenshot {idx + 1}</span>
                  <ZoomIn className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No crops fallback */}
      {viewMode === 'crops' && allCrops.length === 0 && screenshots.length > 0 && (
        <div className="text-center py-8 bg-white/5 rounded-xl border border-white/10">
          <Image className="h-12 w-12 text-white/30 mx-auto mb-3" />
          <p className="text-white/60 text-sm">No specific regions identified.</p>
          <button
            onClick={() => setViewMode('full')}
            className="mt-3 text-sm text-white/80 underline hover:text-white"
          >
            View full screenshots instead
          </button>
        </div>
      )}

      {/* Expanded Image Lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded screenshot"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setExpandedImage(null)}
          >
            <X className="h-8 w-8" />
          </button>
        </div>
      )}

      {/* Expanded Crop Lightbox */}
      {expandedCrop && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setExpandedCrop(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-xl shadow-2xl">
            <div
              className="relative"
              style={{
                width: '100%',
                paddingBottom: `${(expandedCrop.region.bounds.height / expandedCrop.region.bounds.width) * 100}%`,
                maxHeight: '80vh',
              }}
            >
              <div
                className="absolute inset-0 bg-cover bg-no-repeat"
                style={{
                  backgroundImage: `url(${expandedCrop.screenshot})`,
                  backgroundPosition: `${expandedCrop.region.bounds.left}% ${expandedCrop.region.bounds.top}%`,
                  backgroundSize: `${100 / (expandedCrop.region.bounds.width / 100)}% ${100 / (expandedCrop.region.bounds.height / 100)}%`,
                }}
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p className="text-white font-medium">{expandedCrop.region.description}</p>
              <p className="text-white/60 text-sm capitalize mt-1">{expandedCrop.region.type.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setExpandedCrop(null)}
          >
            <X className="h-8 w-8" />
          </button>
        </div>
      )}
    </div>
  );
};

interface CroppedRegionCardProps {
  screenshot: string;
  region: CropRegion;
  compact?: boolean;
  onClick?: () => void;
}

const CroppedRegionCard = ({ screenshot, region, compact = false, onClick }: CroppedRegionCardProps) => {
  const Icon = getTypeIcon(region.type);
  const importanceStyle = getImportanceStyle(region.importance);

  // Calculate the background-position and background-size for CSS cropping
  const cropStyle = {
    backgroundImage: `url(${screenshot})`,
    backgroundPosition: `${region.bounds.left}% ${region.bounds.top}%`,
    backgroundSize: `${100 / (region.bounds.width / 100)}% auto`,
  };

  return (
    <div
      className={cn(
        "relative rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02] shadow-lg",
        importanceStyle
      )}
      onClick={onClick}
    >
      {/* Cropped Image Area */}
      <div
        className={cn(
          "bg-cover bg-no-repeat",
          compact ? "h-24" : "h-40"
        )}
        style={cropStyle}
      />

      {/* Overlay with description */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <div className="flex items-start gap-2">
            <Icon 
              className={cn(
                "flex-shrink-0 mt-0.5",
                compact ? "h-3 w-3" : "h-4 w-4"
              )} 
              style={{ color: region.importance === 'high' ? '#10b981' : region.importance === 'medium' ? '#f59e0b' : '#9ca3af' }}
            />
            <p className={cn(
              "text-white font-medium line-clamp-2",
              compact ? "text-xs" : "text-sm"
            )}>
              {region.description}
            </p>
          </div>
        </div>
      </div>

      {/* Zoom indicator */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ZoomIn className="h-4 w-4 text-white/80" />
      </div>
    </div>
  );
};

export default CroppedScreenshotGallery;
