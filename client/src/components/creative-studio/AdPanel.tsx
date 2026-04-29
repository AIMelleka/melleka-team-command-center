import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureFreshSession, extractEdgeFunctionError } from "@/lib/supabaseHelpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  Palette,
  Target,
  Building2,
  Megaphone,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdCreativeBrief } from "@/components/AdCreativeBrief";
import type { BrandContext, GalleryItem, AdPrefill } from "./types";

// ── Platform presets with dimensions ──
const PLATFORM_PRESETS = {
  "facebook-feed": { name: "Facebook Feed", width: 1200, height: 628, ratio: "1.91:1" },
  "facebook-square": { name: "Facebook Square", width: 1080, height: 1080, ratio: "1:1" },
  "facebook-story": { name: "Facebook/IG Story", width: 1080, height: 1920, ratio: "9:16" },
  "instagram-post": { name: "Instagram Post", width: 1080, height: 1080, ratio: "1:1" },
  "instagram-portrait": { name: "Instagram Portrait", width: 1080, height: 1350, ratio: "4:5" },
  "google-medium-rectangle": { name: "Google Medium Rectangle", width: 640, height: 480, ratio: "4:3" },
  "google-leaderboard": { name: "Google Leaderboard", width: 1456, height: 608, ratio: "2.39:1" },
  "google-large-rectangle": { name: "Google Large Rectangle", width: 672, height: 560, ratio: "1.2:1" },
  "tiktok-video": { name: "TikTok Ad", width: 1080, height: 1920, ratio: "9:16" },
  "linkedin-sponsored": { name: "LinkedIn Sponsored", width: 1200, height: 628, ratio: "1.91:1" },
  "linkedin-square": { name: "LinkedIn Square", width: 1080, height: 1080, ratio: "1:1" },
  "custom": { name: "Custom Size", width: 1024, height: 1024, ratio: "custom" },
};

// ── Industry templates ──
const INDUSTRY_TEMPLATES = [
  { id: "ecommerce", name: "E-Commerce", icon: "🛒", prompt: "product showcase, clean white background, professional product photography style" },
  { id: "realestate", name: "Real Estate", icon: "🏠", prompt: "luxury property, architectural photography, aspirational lifestyle" },
  { id: "restaurant", name: "Restaurant", icon: "🍽️", prompt: "appetizing food photography, warm lighting, rustic ambiance" },
  { id: "fitness", name: "Fitness", icon: "💪", prompt: "energetic, dynamic movement, motivational, high contrast" },
  { id: "tech", name: "Technology", icon: "💻", prompt: "sleek modern design, gradient backgrounds, futuristic elements" },
  { id: "beauty", name: "Beauty", icon: "💄", prompt: "soft lighting, elegant, luxurious textures, close-up detail" },
  { id: "automotive", name: "Automotive", icon: "🚗", prompt: "dramatic lighting, speed motion, premium finish" },
  { id: "travel", name: "Travel", icon: "✈️", prompt: "scenic destination, wanderlust, vibrant colors, adventure" },
  { id: "finance", name: "Finance", icon: "💰", prompt: "professional, trustworthy, clean corporate design" },
  { id: "healthcare", name: "Healthcare", icon: "🏥", prompt: "caring, professional, clean, trustworthy, calming colors" },
];

// ── Visual styles ──
const VISUAL_STYLES = [
  { id: "minimalist", name: "Minimalist", prompt: "clean, lots of white space, simple typography, minimal elements" },
  { id: "bold", name: "Bold & Vibrant", prompt: "bright saturated colors, bold typography, high contrast, eye-catching" },
  { id: "luxury", name: "Luxury", prompt: "elegant, gold accents, sophisticated, premium materials, refined" },
  { id: "playful", name: "Playful", prompt: "fun, colorful, cartoon elements, friendly, approachable" },
  { id: "corporate", name: "Corporate", prompt: "professional, business-like, clean lines, authoritative" },
  { id: "retro", name: "Retro/Vintage", prompt: "nostalgic, vintage colors, retro typography, aged textures" },
  { id: "modern", name: "Modern", prompt: "contemporary design, geometric shapes, gradient overlays" },
  { id: "natural", name: "Natural/Organic", prompt: "earthy tones, natural textures, eco-friendly aesthetic" },
];

// ── Campaign types ──
const CAMPAIGN_TYPES = [
  { id: "sale", name: "Sale/Discount", prompt: "urgent, promotional, percentage off, limited time, call to action" },
  { id: "launch", name: "Product Launch", prompt: "new, exciting, reveal, anticipation, premium presentation" },
  { id: "awareness", name: "Brand Awareness", prompt: "logo prominent, brand colors, memorable, storytelling" },
  { id: "testimonial", name: "Testimonial", prompt: "social proof, quote, customer photo, trust building" },
  { id: "seasonal", name: "Seasonal", prompt: "holiday themed, seasonal colors, festive elements" },
  { id: "event", name: "Event Promotion", prompt: "date prominent, venue, excitement, RSVP call to action" },
  { id: "lead", name: "Lead Generation", prompt: "value proposition, form CTA, benefit-focused" },
  { id: "retargeting", name: "Retargeting", prompt: "reminder, urgency, special offer, personalized feel" },
];

// ── Internal types ──
interface QAResult {
  passed: boolean;
  issues: string[];
  score: number;
  textQuality?: string;
}

interface ComparisonImage {
  imageUrl: string | null;
  error: string | null;
  generator: string;
  seed?: number;
}

interface ImageComparison {
  nanoBanana: ComparisonImage | null;
  runware: ComparisonImage | null;
}

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  platform: string;
  timestamp: Date;
  generator?: string;
  qa?: QAResult;
  attempts?: { attempt: number; score: number; issues: string[] }[];
  comparison?: ImageComparison;
}

// ── Props ──
interface AdPanelProps {
  brandContext: BrandContext;
  onGenerated: (item: GalleryItem) => void;
  prefill?: AdPrefill;
}

export function AdPanel({ brandContext, onGenerated, prefill }: AdPanelProps) {
  // ── Local state (prompt / config) ──
  const [prompt, setPrompt] = useState("");
  const [masterPrompt, setMasterPrompt] = useState(
    `DESIGN POLICY & GUIDELINES:
- NO spelling errors or typos in any text
- ALL text must be in perfect, grammatically correct English
- Maintain professional advertising quality suitable for luxury brands
- Ensure proper contrast between text and background for readability
- Do NOT include placeholder text like "Lorem ipsum" or "[Text here]"
- Keep designs clean and uncluttered - less is more
- Avoid generic stock photo aesthetics
- Ensure brand colors are prominently featured but not overwhelming`
  );
  const [platform, setPlatform] = useState("facebook-feed");
  const [customWidth, setCustomWidth] = useState(1024);
  const [customHeight, setCustomHeight] = useState(1024);

  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  // ── Local brand overrides (initialized from brandContext, can be edited here) ──
  const [brandName, setBrandName] = useState(brandContext.brandName);
  const [primaryColor, setPrimaryColor] = useState(brandContext.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(brandContext.secondaryColor);
  const [accentColor, setAccentColor] = useState(brandContext.accentColor);
  const [productDescription, setProductDescription] = useState(brandContext.productDescription);
  const [headline, setHeadline] = useState(brandContext.headline);
  const [cta, setCta] = useState(brandContext.cta);
  const [extractedLogo, setExtractedLogo] = useState<string | null>(brandContext.extractedLogo);
  const [extractedScreenshots, setExtractedScreenshots] = useState(brandContext.extractedScreenshots);

  // ── Reference image state ──
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  const [useBrandLogo, setUseBrandLogo] = useState(!!brandContext.extractedLogo);
  const [referenceStrength, setReferenceStrength] = useState(0.7);
  const [referenceMode, setReferenceMode] = useState<
    "embed_logo" | "preserve_subject" | "match_style" | "light_inspiration"
  >("embed_logo");
  const [logoPlacement, setLogoPlacement] = useState<
    "top-left" | "top-right" | "bottom-left" | "bottom-right" | "auto"
  >("top-left");

  // ── Generation state ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  // ── Collapsible master policy ──
  const [policyExpanded, setPolicyExpanded] = useState(false);

  // ── Sync from brandContext when it changes ──
  useEffect(() => {
    setBrandName(brandContext.brandName);
    setPrimaryColor(brandContext.primaryColor);
    setSecondaryColor(brandContext.secondaryColor);
    setAccentColor(brandContext.accentColor);
    setProductDescription(brandContext.productDescription);
    setHeadline(brandContext.headline);
    setCta(brandContext.cta);
    setExtractedLogo(brandContext.extractedLogo);
    setExtractedScreenshots(brandContext.extractedScreenshots);
    if (brandContext.extractedLogo) setUseBrandLogo(true);
  }, [brandContext]);

  // ── Apply prefill from Smart Brief ──
  useEffect(() => {
    if (!prefill) return;
    if (prefill.prompt) setPrompt(prefill.prompt);
    if (prefill.platform) setPlatform(prefill.platform);
    if (prefill.industry) setSelectedIndustry(prefill.industry);
    if (prefill.style) setSelectedStyle(prefill.style);
    if (prefill.campaignType) setSelectedCampaign(prefill.campaignType);
    if (prefill.headline) setHeadline(prefill.headline);
    if (prefill.cta) setCta(prefill.cta);
  }, [prefill]);

  // ── Handle branding extraction from website analyzer ──
  const handleBrandingExtracted = (branding: {
    logo: string | null;
    colors: { primary?: string; secondary?: string; accent?: string };
    businessName: string;
    tagline: string;
    messaging: string[];
    screenshots?: { url: string; screenshot: string | null; title: string }[];
  }) => {
    setBrandName(branding.businessName);
    if (branding.colors.primary) setPrimaryColor(branding.colors.primary);
    if (branding.colors.secondary) setSecondaryColor(branding.colors.secondary);
    if (branding.colors.accent) setAccentColor(branding.colors.accent);
    if (branding.tagline) setProductDescription(branding.tagline);
    if (branding.logo) {
      setExtractedLogo(branding.logo);
      setUseBrandLogo(true);
    }
    if (branding.screenshots && branding.screenshots.length > 0) {
      setExtractedScreenshots(branding.screenshots);
    }
    toast.success(`Extracted branding from ${branding.businessName}`);
  };

  // ── Handle image upload ──
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // ── Build the full prompt ──
  const buildFullPrompt = () => {
    const parts: string[] = [];

    if (masterPrompt.trim()) {
      parts.push(masterPrompt.trim());
    }

    parts.push("\n\n=== AD CREATIVE REQUEST ===");

    if (prompt) parts.push(prompt);
    if (brandName) parts.push(`Brand: ${brandName}`);

    const colorList = [primaryColor, secondaryColor, accentColor].filter(
      (c) => c && c !== "#000000"
    );
    if (colorList.length > 0) {
      parts.push(
        `Using brand colors: Primary ${primaryColor}, Secondary ${secondaryColor}, Accent ${accentColor}`
      );
    }
    if (productDescription) parts.push(`Product: ${productDescription}`);
    if (headline) parts.push(`With headline text: "${headline}"`);
    if (cta) parts.push(`Call to action: "${cta}"`);

    if (selectedIndustry) {
      const industry = INDUSTRY_TEMPLATES.find((i) => i.id === selectedIndustry);
      if (industry) parts.push(`Style: ${industry.prompt}`);
    }
    if (selectedStyle) {
      const style = VISUAL_STYLES.find((s) => s.id === selectedStyle);
      if (style) parts.push(`Visual approach: ${style.prompt}`);
    }
    if (selectedCampaign) {
      const campaign = CAMPAIGN_TYPES.find((c) => c.id === selectedCampaign);
      if (campaign) parts.push(`Campaign style: ${campaign.prompt}`);
    }

    const platformData = PLATFORM_PRESETS[platform as keyof typeof PLATFORM_PRESETS];
    parts.push(`Designed for ${platformData.name} ad format (${platformData.ratio} aspect ratio)`);
    parts.push("Ultra high resolution, professional advertising quality, ready for digital ads");

    return parts.join(". ");
  };

  // ── Get clamped dimensions ──
  const getDimensions = () => {
    if (platform === "custom") {
      const clampedWidth = Math.min(1920, Math.max(512, Math.round(customWidth / 32) * 32));
      const clampedHeight = Math.min(1920, Math.max(512, Math.round(customHeight / 32) * 32));
      return { width: clampedWidth, height: clampedHeight };
    }
    const preset = PLATFORM_PRESETS[platform as keyof typeof PLATFORM_PRESETS];
    const clampedWidth = Math.min(1920, Math.max(512, Math.round(preset.width / 32) * 32));
    const clampedHeight = Math.min(1920, Math.max(512, Math.round(preset.height / 32) * 32));
    return { width: clampedWidth, height: clampedHeight };
  };

  // ── Generate handler ──
  const handleGenerate = async () => {
    if (!prompt && !productDescription && !headline && !masterPrompt) {
      toast.error("Please provide a prompt, product description, or headline");
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setProgressMessage("Initializing AI engine...");

    try {
      const fullPrompt = buildFullPrompt();
      const dimensions = getDimensions();

      console.log("=== AD GENERATION REQUEST ===");
      console.log("Full prompt length:", fullPrompt.length, "characters");
      console.log("Full prompt preview:", fullPrompt.substring(0, 500) + "...");
      console.log("Dimensions:", dimensions);
      console.log("Brand:", brandName);
      console.log("Colors:", primaryColor, secondaryColor, accentColor);
      console.log("Product:", productDescription);
      console.log("Headline:", headline);
      console.log("CTA:", cta);
      console.log("Industry:", selectedIndustry);
      console.log("Style:", selectedStyle);
      console.log("Campaign:", selectedCampaign);

      setProgress(20);
      setProgressMessage("Crafting your masterpiece...");

      const referenceImageToUse =
        useBrandLogo && extractedLogo ? extractedLogo : uploadedImage;

      const websiteScreenshots = extractedScreenshots
        .filter((s) => s.screenshot)
        .slice(0, 2)
        .map((s) => s.screenshot as string);

      await ensureFreshSession();
      const { data, error } = await supabase.functions.invoke("generate-ad-image", {
        body: {
          prompt: fullPrompt,
          width: dimensions.width,
          height: dimensions.height,
          referenceImage: referenceImageToUse,
          websiteScreenshots: websiteScreenshots.length > 0 ? websiteScreenshots : undefined,
          referenceStrength,
          referenceMode,
          logoPlacement,
          brandName: brandName || undefined,
          primaryColor: primaryColor || undefined,
          secondaryColor: secondaryColor || undefined,
          accentColor: accentColor || undefined,
          productDescription: productDescription || undefined,
          headline: headline || undefined,
          cta: cta || undefined,
          industry: selectedIndustry || undefined,
          style: selectedStyle || undefined,
          campaign: selectedCampaign || undefined,
        },
      });

      if (error) {
        const errMsg = await extractEdgeFunctionError(error, 'Failed to generate image');
        console.error("generate-ad-image error:", errMsg);
        throw new Error(errMsg);
      }

      setProgress(80);
      setProgressMessage("Applying finishing touches...");

      if (data?.imageUrl) {
        const qaResult: QAResult | undefined = data.qa
          ? {
              passed: data.qa.passed ?? true,
              issues: data.qa.issues || [],
              score: data.qa.score ?? 100,
              textQuality: data.qa.textQuality,
            }
          : undefined;

        const platformName = PLATFORM_PRESETS[platform as keyof typeof PLATFORM_PRESETS].name;

        // Build GalleryItem and notify parent
        const galleryItem: GalleryItem = {
          id: crypto.randomUUID(),
          type: "ad",
          url: data.imageUrl,
          prompt: fullPrompt,
          timestamp: Date.now(),
          metadata: {
            platform: platformName,
            dimensions: getDimensions(),
            generator: data.generator,
            mode: "manual",
            style: selectedStyle || undefined,
            qa: qaResult,
            comparison: data.comparison
              ? {
                  nanoBanana: data.comparison.nanoBanana || null,
                  runware: data.comparison.runware || null,
                }
              : undefined,
            generationTime: data.generationTime,
          },
        };
        onGenerated(galleryItem);

        // Show appropriate toast
        const hasComparison =
          data.comparison?.nanoBanana?.imageUrl && data.comparison?.runware?.imageUrl;
        if (hasComparison) {
          toast.success("A/B comparison ready! Both Nano Banana and Runware images generated.");
        } else if (data.generator === "nano-banana") {
          toast.success("Image generated with Nano Banana (Gemini)!");
        } else if (data.generator === "runware") {
          toast.success("Image generated with Runware (Flux)!");
        } else {
          toast.success("Ad image generated successfully!");
        }
      } else {
        throw new Error("No image returned from generator");
      }

      setProgress(100);
      setProgressMessage("Complete!");
    } catch (err: any) {
      console.error("Generation error:", err);
      toast.error(err.message || "Failed to generate image");
    } finally {
      setTimeout(() => {
        setIsGenerating(false);
        setProgress(0);
        setProgressMessage("");
      }, 500);
    }
  };

  // ════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Master Design Policy - Collapsible */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setPolicyExpanded(!policyExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-amber-500" />
              Master Design Policy
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-500">{masterPrompt.length} chars</span>
              <div
                className={cn(
                  "p-1 rounded-lg transition-transform",
                  policyExpanded ? "rotate-180" : ""
                )}
              >
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>
          <CardDescription className="text-muted-foreground mt-1">
            Foundational rules applied to every generation - quality standards, not what to
            design
          </CardDescription>
        </CardHeader>
        {policyExpanded && (
          <CardContent className="pt-4">
            <Textarea
              placeholder="Enter your design policies, quality standards, and exceptions..."
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              className="min-h-[180px] border-amber-500/30 focus:border-amber-400/50 rounded-xl resize-none font-mono text-sm"
            />
            <div className="flex items-center justify-end mt-3">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMasterPrompt(`DESIGN POLICY & GUIDELINES:
- NO spelling errors or typos in any text
- ALL text must be in perfect, grammatically correct English
- Maintain professional advertising quality suitable for luxury brands
- Ensure proper contrast between text and background for readability
- Do NOT include placeholder text like "Lorem ipsum" or "[Text here]"
- Keep designs clean and uncluttered - less is more
- Avoid generic stock photo aesthetics
- Ensure brand colors are prominently featured but not overwhelming`);
                }}
                className="text-xs text-amber-500 hover:text-amber-600 transition-colors"
              >
                Reset to defaults
              </button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" />
            Platform & Size
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(PLATFORM_PRESETS).map(([key, value]) => (
              <button
                key={key}
                onClick={() => setPlatform(key)}
                className={cn(
                  "h-auto py-3 px-3 flex flex-col items-start justify-start text-left rounded-xl transition-all duration-200 border",
                  platform === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                )}
              >
                <span className="font-medium text-xs">
                  {value.name}
                </span>
                <span className="text-xs opacity-70">
                  {key === "custom" ? "Custom" : `${value.width}×${value.height}`}
                </span>
              </button>
            ))}
          </div>

          {platform === "custom" && (
            <div className="mt-4 flex gap-4">
              <div className="flex-1">
                <Label className="text-muted-foreground">Width (512-1920)</Label>
                <Input
                  type="number"
                  min={512}
                  max={1920}
                  step={32}
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                />
              </div>
              <div className="flex-1">
                <Label className="text-muted-foreground">Height (512-1920)</Label>
                <Input
                  type="number"
                  min={512}
                  max={1920}
                  step={32}
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unified Creative Brief */}
      <AdCreativeBrief
        extractedLogo={extractedLogo}
        extractedScreenshots={extractedScreenshots}
        uploadedImage={uploadedImage}
        useBrandLogo={useBrandLogo}
        onUseBrandLogoChange={setUseBrandLogo}
        onImageUpload={handleImageUpload}
        onRemoveUploadedImage={() => {
          setUploadedImage(null);
          setUploadedImageFile(null);
        }}
        onBrandingExtracted={handleBrandingExtracted}
        brandName={brandName}
        onBrandNameChange={setBrandName}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        accentColor={accentColor}
        onPrimaryColorChange={setPrimaryColor}
        onSecondaryColorChange={setSecondaryColor}
        onAccentColorChange={setAccentColor}
        prompt={prompt}
        onPromptChange={setPrompt}
        productDescription={productDescription}
        onProductDescriptionChange={setProductDescription}
        headline={headline}
        onHeadlineChange={setHeadline}
        cta={cta}
        onCtaChange={setCta}
        referenceMode={referenceMode}
        onReferenceModeChange={setReferenceMode}
        logoPlacement={logoPlacement}
        onLogoPlacementChange={setLogoPlacement}
        referenceStrength={referenceStrength}
        onReferenceStrengthChange={setReferenceStrength}
        selectedIndustry={selectedIndustry}
        selectedStyle={selectedStyle}
        selectedCampaign={selectedCampaign}
      />

      {/* Style Presets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Style Presets
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Select presets to enhance your ad
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 space-y-6">
          {/* Industry Templates */}
          <div>
            <Label className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Industry
            </Label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRY_TEMPLATES.map((industry) => (
                <button
                  key={industry.id}
                  onClick={() =>
                    setSelectedIndustry(
                      selectedIndustry === industry.id ? null : industry.id
                    )
                  }
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border",
                    selectedIndustry === industry.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {industry.icon} {industry.name}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Styles */}
          <div>
            <Label className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Palette className="h-4 w-4" />
              Visual Style
            </Label>
            <div className="flex flex-wrap gap-2">
              {VISUAL_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() =>
                    setSelectedStyle(selectedStyle === style.id ? null : style.id)
                  }
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border",
                    selectedStyle === style.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>

          {/* Campaign Types */}
          <div>
            <Label className="flex items-center gap-2 mb-3 text-muted-foreground">
              <Megaphone className="h-4 w-4" />
              Campaign Type
            </Label>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_TYPES.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() =>
                    setSelectedCampaign(
                      selectedCampaign === campaign.id ? null : campaign.id
                    )
                  }
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border",
                    selectedCampaign === campaign.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {campaign.name}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Preview */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-emerald-500" />
            Prompt Preview
            <span className="text-xs text-muted-foreground ml-auto">
              {buildFullPrompt().length} chars
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap">
            {buildFullPrompt() || "Fill in the content above to see the full prompt..."}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            This is the complete prompt sent to the AI
          </p>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Button
        size="lg"
        className="w-full h-14 text-lg font-semibold gap-3"
        onClick={handleGenerate}
        disabled={isGenerating || (!prompt && !productDescription && !headline && !masterPrompt)}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin" />
            Creating Magic...
          </>
        ) : (
          <>
            <Sparkles className="h-6 w-6" />
            Generate Ad Image
          </>
        )}
      </Button>

      {/* Progress bar */}
      {isGenerating && (
        <div className="space-y-3 p-4 rounded-xl bg-muted/50 border border-border">
          <div className="relative h-2 rounded-full overflow-hidden bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-center text-muted-foreground">{progressMessage}</p>
        </div>
      )}
    </div>
  );
}
