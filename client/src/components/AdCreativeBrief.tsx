import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ImageIcon, 
  Upload, 
  Globe, 
  Palette, 
  Type, 
  Target, 
  Sparkles, 
  X,
  Check,
  Eye,
  Layers
} from "lucide-react";
import { WebsiteAnalyzer } from "@/components/WebsiteAnalyzer";

interface AdCreativeBriefProps {
  // Website & Reference
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
  
  // Brand
  brandName: string;
  onBrandNameChange: (value: string) => void;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onAccentColorChange: (value: string) => void;
  
  // Text Content
  prompt: string;
  onPromptChange: (value: string) => void;
  productDescription: string;
  onProductDescriptionChange: (value: string) => void;
  headline: string;
  onHeadlineChange: (value: string) => void;
  cta: string;
  onCtaChange: (value: string) => void;
  
  // Reference Settings
  referenceMode: "embed_logo" | "preserve_subject" | "match_style" | "light_inspiration";
  onReferenceModeChange: (value: "embed_logo" | "preserve_subject" | "match_style" | "light_inspiration") => void;
  logoPlacement: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "auto";
  onLogoPlacementChange: (value: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "auto") => void;
  referenceStrength: number;
  onReferenceStrengthChange: (value: number) => void;
  
  // Styles
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
  // Get the active reference image
  const activeReference = useBrandLogo && extractedLogo ? extractedLogo : uploadedImage;
  const hasAnyVisuals = activeReference || extractedScreenshots.some(s => s.screenshot);
  const hasColors = primaryColor || secondaryColor || accentColor;
  const hasText = headline || cta || productDescription;
  const hasStyles = selectedIndustry || selectedStyle || selectedCampaign;

  // Count what's being used
  const usedItems: string[] = [];
  if (activeReference) usedItems.push("Reference Image");
  if (extractedScreenshots.filter(s => s.screenshot).length > 0) usedItems.push("Website Screenshots");
  if (hasColors) usedItems.push("Brand Colors");
  if (hasText) usedItems.push("Ad Copy");
  if (hasStyles) usedItems.push("Style Presets");
  if (prompt) usedItems.push("Custom Prompt");

  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/50 via-purple-500/50 to-pink-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
      <Card className="relative bg-white/5 backdrop-blur-xl border-white/10 rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-white/5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20">
                <Layers className="h-5 w-5 text-purple-300" />
              </div>
              Creative Brief
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-purple-200/60 border-purple-400/30 text-xs">
                {usedItems.length} element{usedItems.length !== 1 ? 's' : ''} active
              </Badge>
            </div>
          </div>
          <p className="text-purple-300/50 text-sm mt-1">
            Everything here will be used to generate your ad
          </p>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          {/* Section 1: Website Analyzer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-purple-200/80">Website Analysis</span>
            </div>
            <WebsiteAnalyzer onBrandingExtracted={onBrandingExtracted} />
          </div>

          {/* Visual Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Section 2: Visual References Grid */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-pink-400" />
              <span className="text-sm font-medium text-purple-200/80">Visual References</span>
              {hasAnyVisuals && (
                <Check className="h-4 w-4 text-green-400 ml-auto" />
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Extracted Logo */}
              {extractedLogo && (
                <div 
                  onClick={() => onUseBrandLogoChange(!useBrandLogo)}
                  className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    useBrandLogo 
                      ? "ring-2 ring-green-400/60 shadow-lg shadow-green-500/20" 
                      : "ring-1 ring-white/10 opacity-50 hover:opacity-80"
                  }`}
                >
                  <img src={extractedLogo} alt="Brand logo" className="w-full h-full object-contain bg-white/5 p-2" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <span className="text-xs text-white/80">Logo</span>
                  </div>
                  <div className={`absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center ${
                    useBrandLogo ? "bg-green-500" : "bg-white/20"
                  }`}>
                    {useBrandLogo && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
              )}
              
              {/* Website Screenshots */}
              {extractedScreenshots.filter(s => s.screenshot).slice(0, 2).map((screenshot, idx) => (
                <div 
                  key={idx}
                  className="relative aspect-square rounded-xl overflow-hidden ring-2 ring-blue-400/40"
                >
                  <img src={screenshot.screenshot!} alt={screenshot.title} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <span className="text-xs text-white/80 truncate block">Website {idx + 1}</span>
                  </div>
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Eye className="h-3 w-3 text-white" />
                  </div>
                </div>
              ))}
              
              {/* Uploaded Reference */}
              {uploadedImage && (
                <div className="relative aspect-square rounded-xl overflow-hidden ring-2 ring-purple-400/60">
                  <img src={uploadedImage} alt="Uploaded reference" className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <span className="text-xs text-white/80">Reference</span>
                  </div>
                  <button
                    onClick={onRemoveUploadedImage}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center transition-colors"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              )}
              
              {/* Upload Button */}
              <label className="relative aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-purple-400/50 hover:bg-white/5 transition-all cursor-pointer flex flex-col items-center justify-center gap-2">
                <Upload className="h-6 w-6 text-purple-300/50" />
                <span className="text-xs text-purple-300/50 text-center px-2">Upload Image</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onImageUpload}
                />
              </label>
            </div>

            {/* Reference Mode & Settings - Show when we have any reference */}
            {hasAnyVisuals && (
              <div className="mt-4 space-y-4">
                {/* Reference Mode Pills */}
                <div className="flex flex-wrap gap-2">
                  {REFERENCE_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => onReferenceModeChange(mode.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        referenceMode === mode.id
                          ? "bg-gradient-to-r from-purple-500/40 to-pink-500/40 text-white border border-purple-400/50"
                          : "bg-white/5 text-purple-200/60 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <span>{mode.icon}</span>
                      <span>{mode.label}</span>
                    </button>
                  ))}
                </div>

                {/* Logo Placement - Only for embed_logo mode */}
                {referenceMode === "embed_logo" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-300/60">Place at:</span>
                    <div className="flex gap-1">
                      {LOGO_PLACEMENTS.map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => onLogoPlacementChange(pos.id)}
                          title={pos.title}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${
                            logoPlacement === pos.id
                              ? "bg-green-500/30 text-white border border-green-400/50"
                              : "bg-white/5 text-purple-200/60 border border-white/10 hover:bg-white/10"
                          }`}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strength Slider - Compact */}
                <div className="flex items-center gap-3">
                  <span className="text-xs text-purple-300/60 whitespace-nowrap">Strength:</span>
                  <input
                    type="range"
                    min="30"
                    max="90"
                    value={referenceStrength * 100}
                    onChange={(e) => onReferenceStrengthChange(Number(e.target.value) / 100)}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-white/10 
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gradient-to-r 
                      [&::-webkit-slider-thumb]:from-purple-400 [&::-webkit-slider-thumb]:to-pink-400"
                  />
                  <span className="text-xs font-medium text-purple-200 w-8 text-right">
                    {Math.round(referenceStrength * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Visual Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Section 3: Brand Colors */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-purple-200/80">Brand Identity</span>
              {hasColors && <Check className="h-4 w-4 text-green-400 ml-auto" />}
            </div>
            
            <div className="flex items-center gap-4">
              {/* Brand Name */}
              <div className="flex-1">
                <Input
                  placeholder="Brand name"
                  value={brandName}
                  onChange={(e) => onBrandNameChange(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-purple-300/30 h-10"
                />
              </div>
              
              {/* Color Pickers */}
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
                      className="w-10 h-10 rounded-lg border-2 border-white/20 hover:border-purple-400/50 transition-all cursor-pointer"
                      style={{ backgroundColor: item.color }}
                    />
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/color:opacity-100 transition-opacity">
                      <span className="text-[10px] text-purple-300/60 whitespace-nowrap">{item.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Visual Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Section 4: Ad Copy */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-purple-200/80">Ad Copy</span>
              {hasText && <Check className="h-4 w-4 text-green-400 ml-auto" />}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Headline: 50% OFF Today!"
                value={headline}
                onChange={(e) => onHeadlineChange(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
              />
              <Input
                placeholder="CTA: Shop Now"
                value={cta}
                onChange={(e) => onCtaChange(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-purple-300/30"
              />
            </div>
            
            <Textarea
              placeholder="Product/service description..."
              value={productDescription}
              onChange={(e) => onProductDescriptionChange(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-purple-300/30 min-h-[60px] resize-none"
            />
          </div>

          {/* Visual Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* Section 5: Creative Direction */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-medium text-purple-200/80">Creative Direction</span>
            </div>
            
            <Textarea
              placeholder="Describe your vision... (e.g., 'Modern minimalist ad with the product centered, soft gradient background, premium feel')"
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-purple-300/30 min-h-[80px] resize-none"
            />
          </div>

          {/* Active Styles Summary */}
          {hasStyles && (
            <>
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="flex flex-wrap gap-2">
                {selectedIndustry && (
                  <Badge className="bg-pink-500/20 text-pink-200 border-pink-400/30">
                    Industry: {selectedIndustry}
                  </Badge>
                )}
                {selectedStyle && (
                  <Badge className="bg-purple-500/20 text-purple-200 border-purple-400/30">
                    Style: {selectedStyle}
                  </Badge>
                )}
                {selectedCampaign && (
                  <Badge className="bg-orange-500/20 text-orange-200 border-orange-400/30">
                    Campaign: {selectedCampaign}
                  </Badge>
                )}
              </div>
            </>
          )}

          {/* Summary Footer */}
          <div className="pt-4 border-t border-white/5">
            <div className="flex flex-wrap gap-2">
              {usedItems.map((item, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs text-green-200/80">{item}</span>
                </div>
              ))}
              {usedItems.length === 0 && (
                <span className="text-xs text-purple-300/50">Add content above to include in generation</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
