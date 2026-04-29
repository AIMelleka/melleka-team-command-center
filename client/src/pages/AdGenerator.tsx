import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Copy, Image as ImageIcon, Palette, Target, Building2, Megaphone, Wand2, Layers, Zap, ScrollText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import AdminHeader from "@/components/AdminHeader";
import { AdCreativeBrief } from "@/components/AdCreativeBrief";
// Platform presets with dimensions
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

// Industry templates
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

// Visual styles
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

// Campaign types
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

export default function AdGenerator() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
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
  
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#ec4899");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [brandColors, setBrandColors] = useState(""); // For backwards compatibility
  const [productDescription, setProductDescription] = useState("");
  const [headline, setHeadline] = useState("");
  const [cta, setCta] = useState("");
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedImageFile, setUploadedImageFile] = useState<File | null>(null);
  
  // Extracted branding from website
  const [extractedLogo, setExtractedLogo] = useState<string | null>(null);
  const [extractedScreenshots, setExtractedScreenshots] = useState<{ url: string; screenshot: string | null; title: string }[]>([]);
  const [useBrandLogo, setUseBrandLogo] = useState(false);
  const [referenceStrength, setReferenceStrength] = useState(0.7); // 0.3-0.9 range
  const [referenceMode, setReferenceMode] = useState<"embed_logo" | "preserve_subject" | "match_style" | "light_inspiration">("embed_logo");
  const [logoPlacement, setLogoPlacement] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right" | "auto">("top-left");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  // Collapsible state for master policy
  const [policyExpanded, setPolicyExpanded] = useState(false);

  // Handle branding extraction from website analyzer
  const handleBrandingExtracted = (branding: {
    logo: string | null;
    colors: { primary?: string; secondary?: string; accent?: string };
    businessName: string;
    tagline: string;
    messaging: string[];
    screenshots?: { url: string; screenshot: string | null; title: string }[];
  }) => {
    // Apply extracted branding to form
    setBrandName(branding.businessName);
    
    // Set individual colors from extracted colors
    if (branding.colors.primary) setPrimaryColor(branding.colors.primary);
    if (branding.colors.secondary) setSecondaryColor(branding.colors.secondary);
    if (branding.colors.accent) setAccentColor(branding.colors.accent);
    
    // Build color string for prompt (backwards compatibility)
    const colorParts = [];
    if (branding.colors.primary) colorParts.push(branding.colors.primary);
    if (branding.colors.secondary) colorParts.push(branding.colors.secondary);
    if (branding.colors.accent) colorParts.push(branding.colors.accent);
    setBrandColors(colorParts.join(", "));
    
    // Set tagline as product description if available
    if (branding.tagline) {
      setProductDescription(branding.tagline);
    }
    
    // Set logo if available
    if (branding.logo) {
      setExtractedLogo(branding.logo);
      setUseBrandLogo(true);
    }
    
    // Store screenshots for reference in image generation
    if (branding.screenshots && branding.screenshots.length > 0) {
      setExtractedScreenshots(branding.screenshots);
    }
    
    // Toast success message
    toast.success(`Extracted branding from ${branding.businessName}`);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

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

  const buildFullPrompt = () => {
    const parts: string[] = [];
    
    // MASTER PROMPT is prepended as the foundational policy for all designs
    if (masterPrompt.trim()) {
      parts.push(masterPrompt.trim());
    }
    
    // Then add the specific ad request
    parts.push("\n\n=== AD CREATIVE REQUEST ===");
    
    if (prompt) {
      parts.push(prompt);
    }
    
    if (brandName) {
      parts.push(`Brand: ${brandName}`);
    }
    
    // Use individual colors for better prompt
    const colorList = [primaryColor, secondaryColor, accentColor].filter(c => c && c !== "#000000");
    if (colorList.length > 0) {
      parts.push(`Using brand colors: Primary ${primaryColor}, Secondary ${secondaryColor}, Accent ${accentColor}`);
    }
    if (productDescription) {
      parts.push(`Product: ${productDescription}`);
    }
    if (headline) {
      parts.push(`With headline text: "${headline}"`);
    }
    if (cta) {
      parts.push(`Call to action: "${cta}"`);
    }
    
    if (selectedIndustry) {
      const industry = INDUSTRY_TEMPLATES.find(i => i.id === selectedIndustry);
      if (industry) {
        parts.push(`Style: ${industry.prompt}`);
      }
    }
    
    if (selectedStyle) {
      const style = VISUAL_STYLES.find(s => s.id === selectedStyle);
      if (style) {
        parts.push(`Visual approach: ${style.prompt}`);
      }
    }
    
    if (selectedCampaign) {
      const campaign = CAMPAIGN_TYPES.find(c => c.id === selectedCampaign);
      if (campaign) {
        parts.push(`Campaign style: ${campaign.prompt}`);
      }
    }
    
    const platformData = PLATFORM_PRESETS[platform as keyof typeof PLATFORM_PRESETS];
    parts.push(`Designed for ${platformData.name} ad format (${platformData.ratio} aspect ratio)`);
    
    parts.push("Ultra high resolution, professional advertising quality, ready for digital ads");
    
    return parts.join(". ");
  };

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
      
      // Log the full prompt for debugging
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

      // Determine reference image - prefer brand logo if enabled, otherwise use uploaded
      const referenceImageToUse = useBrandLogo && extractedLogo ? extractedLogo : uploadedImage;
      
      // Get website screenshots for brand reference (use first 2 that have screenshots)
      const websiteScreenshots = extractedScreenshots
        .filter(s => s.screenshot)
        .slice(0, 2)
        .map(s => s.screenshot as string);

      const { data, error } = await supabase.functions.invoke("generate-ad-image", {
        body: {
          prompt: fullPrompt,
          width: dimensions.width,
          height: dimensions.height,
          referenceImage: referenceImageToUse,
          websiteScreenshots: websiteScreenshots.length > 0 ? websiteScreenshots : undefined,
          referenceStrength: referenceStrength,
          referenceMode: referenceMode, // embed_logo, preserve_subject, match_style, light_inspiration
          logoPlacement: logoPlacement, // top-left, top-right, bottom-left, bottom-right, auto
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
        const errJson = (error as any)?.context?.json;
        const message = errJson?.help || errJson?.error || error.message || "Failed to generate image";
        console.error("generate-ad-image error:", errJson || error);
        throw new Error(message);
      }

      setProgress(80);
      setProgressMessage("Applying finishing touches...");

      if (data?.imageUrl) {
        // Extract QA results if available
        const qaResult: QAResult | undefined = data.qa ? {
          passed: data.qa.passed ?? true,
          issues: data.qa.issues || [],
          score: data.qa.score ?? 100,
          textQuality: data.qa.textQuality,
        } : undefined;

        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: data.imageUrl,
          prompt: fullPrompt,
          platform: PLATFORM_PRESETS[platform as keyof typeof PLATFORM_PRESETS].name,
          timestamp: new Date(),
          generator: data.generator,
          qa: qaResult,
          attempts: data.attempts,
          comparison: data.comparison,
        };
        setGeneratedImages(prev => [newImage, ...prev]);
        
        // Show appropriate toast based on comparison results
        const hasComparison = data.comparison?.nanoBanana?.imageUrl && data.comparison?.runware?.imageUrl;
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

  const handleDownload = async (imageUrl: string, imageName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${imageName}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded!");
    } catch (err) {
      toast.error("Failed to download image");
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Image URL copied!");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20">
              <Wand2 className="h-8 w-8 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl md:text-4xl font-bold">Ad Generator</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                AI-Powered Creative Studio
              </p>
            </div>
          </div>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[
              { icon: Layers, label: "Multi-Platform" },
              { icon: Sparkles, label: "AI-Powered" },
              { icon: Zap, label: "Instant Results" },
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-muted-foreground text-xs"
              >
                <feature.icon className="h-3.5 w-3.5" />
                {feature.label}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Master Design Policy - Collapsible Card at Top */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/50 to-orange-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <Card className="relative bg-card border-border rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5 cursor-pointer" onClick={() => setPolicyExpanded(!policyExpanded)}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                        <ScrollText className="h-5 w-5 text-amber-300" />
                      </div>
                      Master Design Policy
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-amber-300/60">{masterPrompt.length} chars</span>
                      <div className={`p-1 rounded-lg bg-muted/50 transition-transform ${policyExpanded ? "rotate-180" : ""}`}>
                        <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="text-amber-200/50 mt-1">
                    Foundational rules applied to every generation - quality standards, not what to design
                  </CardDescription>
                </CardHeader>
                {policyExpanded && (
                  <CardContent className="pt-4">
                    <Textarea
                      placeholder="Enter your design policies, quality standards, and exceptions..."
                      value={masterPrompt}
                      onChange={(e) => setMasterPrompt(e.target.value)}
                      className="min-h-[180px] bg-muted/50 border-amber-500/30 placeholder:text-muted-foreground/50 focus:border-amber-400/50 rounded-xl resize-none font-mono text-sm"
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
                        className="text-xs text-amber-300/60 hover:text-amber-300 transition-colors"
                      >
                        Reset to defaults
                      </button>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* Platform Selection - Glass Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/50 to-pink-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <Card className="relative bg-card border-border rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                      <Target className="h-5 w-5 text-purple-300" />
                    </div>
                    Platform & Size
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Object.entries(PLATFORM_PRESETS).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setPlatform(key)}
                        className={`
                          relative group/btn h-auto py-3 px-3 flex flex-col items-start justify-start text-left rounded-xl transition-all duration-300
                          ${platform === key 
                            ? "bg-gradient-to-br from-purple-500/30 to-pink-500/30 border-purple-400/50 shadow-lg shadow-purple-500/20" 
                            : "bg-muted/30 border-border hover:bg-muted/50 hover:border-primary/30"
                          }
                          border backdrop-blur-sm
                        `}
                      >
                        <span className={`font-medium text-xs ${platform === key ? "text-white" : "text-muted-foreground"}`}>
                          {value.name}
                        </span>
                        <span className={`text-xs ${platform === key ? "text-purple-200" : "text-purple-300/50"}`}>
                          {key === "custom" ? "Custom" : `${value.width}×${value.height}`}
                        </span>
                        {platform === key && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse" />
                        )}
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
                          className="bg-card border-border placeholder:text-muted-foreground/50 focus:border-purple-400/50"
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
                          className="bg-card border-border placeholder:text-muted-foreground/50 focus:border-purple-400/50"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

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

            {/* Style Presets - Glass Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-500/50 to-orange-500/50 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <Card className="relative bg-card border-border rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/20 to-orange-500/20">
                      <Palette className="h-5 w-5 text-pink-300" />
                    </div>
                    Style Presets
                  </CardTitle>
                  <CardDescription className="text-purple-300/50">
                    Select presets to enhance your ad
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
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
                          onClick={() => setSelectedIndustry(
                            selectedIndustry === industry.id ? null : industry.id
                          )}
                          className={`
                            px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                            ${selectedIndustry === industry.id
                              ? "bg-gradient-to-r from-purple-500/40 to-pink-500/40 text-white border border-purple-400/50 shadow-lg shadow-purple-500/20"
                              : "bg-muted/30 text-muted-foreground border border-border hover:bg-muted/50 hover:border-primary/30"
                            }
                          `}
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
                          onClick={() => setSelectedStyle(
                            selectedStyle === style.id ? null : style.id
                          )}
                          className={`
                            px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                            ${selectedStyle === style.id
                              ? "bg-gradient-to-r from-blue-500/40 to-purple-500/40 text-white border border-blue-400/50 shadow-lg shadow-blue-500/20"
                              : "bg-muted/30 text-muted-foreground border border-border hover:bg-muted/50 hover:border-primary/30"
                            }
                          `}
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
                          onClick={() => setSelectedCampaign(
                            selectedCampaign === campaign.id ? null : campaign.id
                          )}
                          className={`
                            px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300
                            ${selectedCampaign === campaign.id
                              ? "bg-gradient-to-r from-orange-500/40 to-pink-500/40 text-white border border-orange-400/50 shadow-lg shadow-orange-500/20"
                              : "bg-muted/30 text-muted-foreground border border-border hover:bg-muted/50 hover:border-primary/30"
                            }
                          `}
                        >
                          {campaign.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Generate Button - Premium CTA */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl blur-lg opacity-70 group-hover:opacity-100 transition duration-500 animate-pulse" />
              <Button
                size="lg"
                className="relative w-full h-16 text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border-0 rounded-xl shadow-2xl shadow-purple-500/30 transition-all duration-300 hover:scale-[1.02]"
                onClick={handleGenerate}
                disabled={isGenerating || (!prompt && !productDescription && !headline && !masterPrompt)}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                    Creating Magic...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-6 w-6 mr-3" />
                    Generate Ad Image
                  </>
                )}
              </Button>
            </div>

            {isGenerating && (
              <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="relative h-2 rounded-full overflow-hidden bg-muted">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  {progressMessage}
                </p>
              </div>
            )}
          </div>

          {/* Right Panel - Prompt Preview + Generated Images */}
          <div className="space-y-6">
            {/* Prompt Preview Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500/30 to-emerald-500/30 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <Card className="relative bg-card border-border rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/5 py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20">
                      <ScrollText className="h-4 w-4 text-green-300" />
                    </div>
                    Prompt Preview
                    <span className="text-xs text-green-300/60 ml-auto">
                      {buildFullPrompt().length} chars
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="text-xs text-muted-foreground bg-black/20 p-3 rounded-xl max-h-48 overflow-y-auto font-mono whitespace-pre-wrap border border-white/5">
                    {buildFullPrompt() || "Fill in the content above to see the full prompt..."}
                  </div>
                  <p className="text-xs text-purple-300/40 mt-2 text-center">
                    This is the complete prompt sent to the AI
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Generated Images Card */}
            <div className="group relative">
              <div className="absolute -inset-0.5 bg-gradient-to-b from-purple-500/30 to-pink-500/30 rounded-2xl blur opacity-30" />
              <Card className="relative bg-card border-border rounded-2xl overflow-hidden h-full">
                <CardHeader className="border-b border-white/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                      <ImageIcon className="h-5 w-5 text-purple-300" />
                    </div>
                    Generated Images
                  </CardTitle>
                  <CardDescription className="text-purple-300/50">
                    {generatedImages.length} image{generatedImages.length !== 1 ? "s" : ""} created
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {generatedImages.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 mb-4">
                        <ImageIcon className="h-10 w-10 text-purple-400/50" />
                      </div>
                      <p className="text-muted-foreground">No images generated yet</p>
                      <p className="text-sm text-purple-300/40 mt-1">Configure your ad and click Generate</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {generatedImages.map((image) => (
                        <div key={image.id} className="space-y-4">
                          {/* A/B Comparison Display */}
                          {image.comparison && (image.comparison.nanoBanana?.imageUrl || image.comparison.runware?.imageUrl) ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30">
                                <Sparkles className="h-4 w-4 text-purple-300" />
                                <span className="text-sm font-medium text-purple-200">A/B Comparison</span>
                                <span className="text-xs text-purple-300/60 ml-auto">{image.platform}</span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Nano Banana (Gemini) */}
                                <div className="group/img relative rounded-xl overflow-hidden border border-border hover:border-blue-400/50 transition-all duration-300">
                                  <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-lg bg-blue-500/80 backdrop-blur-sm text-xs font-medium text-white">
                                    🍌 Nano Banana
                                  </div>
                                  {image.comparison.nanoBanana?.imageUrl ? (
                                    <>
                                      <div className="relative aspect-square">
                                        <img
                                          src={image.comparison.nanoBanana.imageUrl}
                                          alt="Nano Banana generated"
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                                        />
                                      </div>
                                      <div className="p-3 bg-slate-900/80 backdrop-blur-sm">
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleDownload(image.comparison!.nanoBanana!.imageUrl!, `nanoBanana-${image.platform}`)}
                                            className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-400/30"
                                          >
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => handleCopyUrl(image.comparison!.nanoBanana!.imageUrl!)}
                                            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 border border-blue-400/30"
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="aspect-square flex items-center justify-center bg-slate-900/50">
                                      <div className="text-center p-4">
                                        <p className="text-red-400/80 text-sm">{image.comparison.nanoBanana?.error || "Failed"}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Runware (Flux) */}
                                <div className="group/img relative rounded-xl overflow-hidden border border-border hover:border-orange-400/50 transition-all duration-300">
                                  <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-lg bg-orange-500/80 backdrop-blur-sm text-xs font-medium text-white">
                                    ⚡ Runware
                                  </div>
                                  {image.comparison.runware?.imageUrl ? (
                                    <>
                                      <div className="relative aspect-square">
                                        <img
                                          src={image.comparison.runware.imageUrl}
                                          alt="Runware generated"
                                          className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
                                        />
                                      </div>
                                      <div className="p-3 bg-slate-900/80 backdrop-blur-sm">
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => handleDownload(image.comparison!.runware!.imageUrl!, `runware-${image.platform}`)}
                                            className="flex-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-400/30"
                                          >
                                            <Download className="h-3 w-3 mr-1" />
                                            Download
                                          </Button>
                                          <Button
                                            size="sm"
                                            onClick={() => handleCopyUrl(image.comparison!.runware!.imageUrl!)}
                                            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-400/30"
                                          >
                                            <Copy className="h-3 w-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="aspect-square flex items-center justify-center bg-slate-900/50">
                                      <div className="text-center p-4">
                                        <p className="text-red-400/80 text-sm">{image.comparison.runware?.error || "Failed"}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-xs text-purple-300/50 text-center">
                                Compare side-by-side and download your preferred version
                              </p>
                            </div>
                          ) : (
                            /* Single Image Display (fallback) */
                            <div 
                              className="group/img relative rounded-xl overflow-hidden border border-border hover:border-purple-400/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20"
                            >
                              <div className="relative">
                                <img
                                  src={image.url}
                                  alt="Generated ad"
                                  className="w-full transition-transform duration-500 group-hover/img:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-300" />
                              </div>
                              <div className="p-4 bg-gradient-to-t from-slate-900/90 to-slate-900/50 backdrop-blur-sm">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-200 border border-purple-400/30">
                                    {image.platform}
                                  </span>
                                  <span className="text-xs text-purple-300/50">
                                    {image.timestamp.toLocaleTimeString()}
                                  </span>
                                </div>
                                
                                {/* QA Score Badge */}
                                {image.qa && (
                                  <div className="mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                                        image.qa.score >= 90 
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                                          : image.qa.score >= 70 
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                                            : 'bg-red-500/20 text-red-300 border border-red-400/30'
                                      }`}>
                                        <span className={`w-2 h-2 rounded-full ${
                                          image.qa.score >= 90 ? 'bg-emerald-400' : 
                                          image.qa.score >= 70 ? 'bg-amber-400' : 'bg-red-400'
                                        }`} />
                                        QA: {image.qa.score}/100
                                      </div>
                                      {image.qa.passed ? (
                                        <span className="text-xs text-emerald-400/70">Passed</span>
                                      ) : (
                                        <span className="text-xs text-red-400/70">Needs Review</span>
                                      )}
                                    </div>
                                    {image.qa.issues.length > 0 && (
                                      <p className="text-xs text-purple-300/50 mt-1 truncate" title={image.qa.issues.join(", ")}>
                                        {image.qa.issues[0]}
                                      </p>
                                    )}
                                  </div>
                                )}
                                
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleDownload(image.url, image.platform)}
                                    className="flex-1 bg-muted hover:bg-muted/80 text-white border-0"
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCopyUrl(image.url)}
                                    className="bg-muted hover:bg-muted/80 text-white border-0"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Shimmer Animation Style */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
