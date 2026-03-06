import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ImageIcon,
  Upload,
  Globe,
  Palette,
  Type,
  Sparkles,
  X,
  Check,
  Eye,
  Layers,
} from "lucide-react";
import { WebsiteAnalyzer } from "@/components/WebsiteAnalyzer";
import { cn } from "@/lib/utils";

interface AdCreativeBriefProps {
  extractedLogo: string | null;
  extractedScreenshots: { url: string; screenshot: string | null; title: string }[];
  uploadedImage: string | null;
  useBrandLogo: boolean;
  onUseBrandLogoChange: (value: boolean) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveUploadedImage: () => void;
  onBrandingExtracted: (branding: {
    logo: string | null;
    colors: { primary?: string; secondary?: string; accent?: string };
    businessName: string;
    tagline: string;
    messaging: string[];
    screenshots?: { url: string; screenshot: string | null; title: string }[];
  }) => void;
  brandName: string;
  onBrandNameChange: (value: string) => void;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onAccentColorChange: (value: string) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  productDescription: string;
  onProductDescriptionChange: (value: string) => void;
  headline: string;
  onHeadlineChange: (value: string) => void;
  cta: string;
  onCtaChange: (value: string) => void;
  referenceMode: "embed_logo" | "preserve_subject" | "match_style" | "light_inspiration";
  onReferenceModeChange: (value: "embed_logo" | "preserve_subject" | "match_style" | "light_inspiration") => void;
  logoPlacement: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "auto";
  onLogoPlacementChange: (value: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "auto") => void;
  referenceStrength: number;
  onReferenceStrengthChange: (value: number) => void;
  selectedIndustry: string | null;
  selectedStyle: string | null;
  selectedCampaign: string | null;
}

const REFERENCE_MODES = [
  { id: "embed_logo", label: "Embed Logo", icon: "🎯", desc: "Place exact logo in ad" },
  { id: "preserve_subject", label: "Keep Subject", icon: "👤", desc: "Maintain identity" },
  { id: "match_style", label: "Match Style", icon: "🎨", desc: "Copy visual style" },
  { id: "light_inspiration", label: "Inspire", icon: "✨", desc: "Loose guide" },
] as const;

const LOGO_PLACEMENTS = [
  { id: "top-left", label: "↖", title: "Top Left" },
  { id: "top-right", label: "↗", title: "Top Right" },
  { id: "bottom-left", label: "↙", title: "Bottom Left" },
  { id: "bottom-right", label: "↘", title: "Bottom Right" },
  { id: "auto", label: "🎯", title: "Auto" },
] as const;

export function AdCreativeBrief({
  extractedLogo,
  extractedScreenshots,
  uploadedImage,
  useBrandLogo,
  onUseBrandLogoChange,
  onImageUpload,
  onRemoveUploadedImage,
  onBrandingExtracted,
  brandName,
  onBrandNameChange,
  primaryColor,
  secondaryColor,
  accentColor,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onAccentColorChange,
  prompt,
  onPromptChange,
  productDescription,
  onProductDescriptionChange,
  headline,
  onHeadlineChange,
  cta,
  onCtaChange,
  referenceMode,
  onReferenceModeChange,
  logoPlacement,
  onLogoPlacementChange,
  referenceStrength,
  onReferenceStrengthChange,
  selectedIndustry,
  selectedStyle,
  selectedCampaign,
}: AdCreativeBriefProps) {
  const activeReference = useBrandLogo && extractedLogo ? extractedLogo : uploadedImage;
  const hasAnyVisuals = activeReference || extractedScreenshots.some(s => s.screenshot);
  const hasColors = primaryColor || secondaryColor || accentColor;
  const hasText = headline || cta || productDescription;
  const hasStyles = selectedIndustry || selectedStyle || selectedCampaign;

  const usedItems: string[] = [];
  if (activeReference) usedItems.push("Reference Image");
  if (extractedScreenshots.filter(s => s.screenshot).length > 0) usedItems.push("Screenshots");
  if (hasColors) usedItems.push("Brand Colors");
  if (hasText) usedItems.push("Ad Copy");
  if (hasStyles) usedItems.push("Style Presets");
  if (prompt) usedItems.push("Custom Prompt");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            Creative Brief
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {usedItems.length} element{usedItems.length !== 1 ? 's' : ''} active
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mt-1">
          Everything here will be used to generate your ad
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Website Analyzer */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Website Analysis</span>
          </div>
          <WebsiteAnalyzer onBrandingExtracted={onBrandingExtracted} />
        </div>

        <div className="h-px bg-border" />

        {/* Visual References */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-pink-500" />
            <span className="text-sm font-medium">Visual References</span>
            {hasAnyVisuals && <Check className="h-4 w-4 text-emerald-500 ml-auto" />}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {extractedLogo && (
              <div
                onClick={() => onUseBrandLogoChange(!useBrandLogo)}
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all border-2",
                  useBrandLogo
                    ? "border-emerald-500 shadow-sm"
                    : "border-border opacity-50 hover:opacity-80"
                )}
              >
                <img src={extractedLogo} alt="Brand logo" className="w-full h-full object-contain bg-muted/50 p-2" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <span className="text-xs text-white">Logo</span>
                </div>
                <div className={cn(
                  "absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center",
                  useBrandLogo ? "bg-emerald-500" : "bg-muted"
                )}>
                  {useBrandLogo && <Check className="h-3 w-3 text-white" />}
                </div>
              </div>
            )}

            {extractedScreenshots.filter(s => s.screenshot).slice(0, 2).map((screenshot, idx) => (
              <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-blue-500/40">
                <img src={screenshot.screenshot!} alt={screenshot.title} className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <span className="text-xs text-white truncate block">Website {idx + 1}</span>
                </div>
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <Eye className="h-3 w-3 text-white" />
                </div>
              </div>
            ))}

            {uploadedImage && (
              <div className="relative aspect-square rounded-xl overflow-hidden border-2 border-primary/40">
                <img src={uploadedImage} alt="Uploaded reference" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <span className="text-xs text-white">Reference</span>
                </div>
                <button
                  onClick={onRemoveUploadedImage}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-destructive/80 hover:bg-destructive flex items-center justify-center transition-colors"
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              </div>
            )}

            <label className="relative aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground text-center px-2">Upload Image</span>
              <input type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
            </label>
          </div>

          {hasAnyVisuals && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2">
                {REFERENCE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => onReferenceModeChange(mode.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                      referenceMode === mode.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                    )}
                  >
                    <span>{mode.icon}</span>
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>

              {referenceMode === "embed_logo" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Place at:</span>
                  <div className="flex gap-1">
                    {LOGO_PLACEMENTS.map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => onLogoPlacementChange(pos.id)}
                        title={pos.title}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all border",
                          logoPlacement === pos.id
                            ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/40"
                            : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                        )}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Strength:</span>
                <input
                  type="range"
                  min="30"
                  max="90"
                  value={referenceStrength * 100}
                  onChange={(e) => onReferenceStrengthChange(Number(e.target.value) / 100)}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-muted
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary"
                />
                <span className="text-xs font-medium w-8 text-right">
                  {Math.round(referenceStrength * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="h-px bg-border" />

        {/* Brand Identity */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">Brand Identity</span>
            {hasColors && <Check className="h-4 w-4 text-emerald-500 ml-auto" />}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Brand name"
                value={brandName}
                onChange={(e) => onBrandNameChange(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              {[
                { color: primaryColor, onChange: onPrimaryColorChange, label: "Primary" },
                { color: secondaryColor, onChange: onSecondaryColorChange, label: "Secondary" },
                { color: accentColor, onChange: onAccentColorChange, label: "Accent" },
              ].map((item, idx) => (
                <div key={idx} className="relative group/color">
                  <input
                    type="color"
                    value={item.color}
                    onChange={(e) => item.onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-border hover:border-primary/50 transition-all cursor-pointer"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/color:opacity-100 transition-opacity">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Ad Copy */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-cyan-500" />
            <span className="text-sm font-medium">Ad Copy</span>
            {hasText && <Check className="h-4 w-4 text-emerald-500 ml-auto" />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Headline: 50% OFF Today!"
              value={headline}
              onChange={(e) => onHeadlineChange(e.target.value)}
            />
            <Input
              placeholder="CTA: Shop Now"
              value={cta}
              onChange={(e) => onCtaChange(e.target.value)}
            />
          </div>

          <Textarea
            placeholder="Product/service description..."
            value={productDescription}
            onChange={(e) => onProductDescriptionChange(e.target.value)}
            className="min-h-[60px] resize-none"
          />
        </div>

        <div className="h-px bg-border" />

        {/* Creative Direction */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Creative Direction</span>
          </div>

          <Textarea
            placeholder="Describe your vision... (e.g., 'Modern minimalist ad with the product centered, soft gradient background, premium feel')"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>

        {/* Active Styles Summary */}
        {hasStyles && (
          <>
            <div className="h-px bg-border" />
            <div className="flex flex-wrap gap-2">
              {selectedIndustry && (
                <Badge variant="secondary" className="text-xs">Industry: {selectedIndustry}</Badge>
              )}
              {selectedStyle && (
                <Badge variant="secondary" className="text-xs">Style: {selectedStyle}</Badge>
              )}
              {selectedCampaign && (
                <Badge variant="secondary" className="text-xs">Campaign: {selectedCampaign}</Badge>
              )}
            </div>
          </>
        )}

        {/* Summary Footer */}
        <div className="pt-4 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {usedItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600 dark:text-emerald-400">{item}</span>
              </div>
            ))}
            {usedItems.length === 0 && (
              <span className="text-xs text-muted-foreground">Add content above to include in generation</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
