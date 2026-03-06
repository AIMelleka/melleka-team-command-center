import { useState, useEffect } from "react";
import {
  Video,
  Sparkles,
  Loader2,
  Clock,
  Image as ImageIcon,
  ScrollText,
  Palette,
  Film,
  Settings,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { BrandContext, GalleryItem, VideoPrefill } from "./types";

// ── Types ──

type VideoMode = "text-to-video" | "image-to-video";

// ── Constants ──

const aspectRatios = [
  { value: "16:9", label: "16:9 (Landscape)", description: "YouTube, TV" },
  { value: "9:16", label: "9:16 (Portrait)", description: "TikTok, Reels, Shorts" },
  { value: "1:1", label: "1:1 (Square)", description: "Instagram, Facebook" },
  { value: "4:3", label: "4:3 (Standard)", description: "Classic format" },
  { value: "3:4", label: "3:4 (Portrait)", description: "Mobile content" },
  { value: "21:9", label: "21:9 (Ultrawide)", description: "Cinematic" },
];

const durations = [
  { value: "5", label: "5 seconds", description: "Quick clip" },
  { value: "6", label: "6 seconds", description: "Standard" },
  { value: "8", label: "8 seconds", description: "Extended" },
];

const resolutions = [
  { value: "480p", label: "480p", description: "Faster generation" },
  { value: "1080p", label: "1080p", description: "Full HD quality" },
];

const VIDEO_STYLES = [
  { id: "cinematic", name: "Cinematic", prompt: "cinematic quality, dramatic lighting, film-like color grading, depth of field" },
  { id: "commercial", name: "Commercial", prompt: "professional advertising quality, polished, broadcast-ready, engaging" },
  { id: "social", name: "Social Media", prompt: "eye-catching, trendy, fast-paced, vibrant colors, shareable" },
  { id: "corporate", name: "Corporate", prompt: "professional, clean, business-appropriate, trustworthy" },
  { id: "dynamic", name: "Dynamic/Action", prompt: "energetic, fast motion, dynamic camera movements, high impact" },
  { id: "elegant", name: "Elegant/Luxury", prompt: "sophisticated, premium feel, smooth transitions, refined" },
];

const MOTION_STYLES = [
  { id: "smooth", name: "Smooth Pan", prompt: "smooth camera pan, fluid motion, steady movement" },
  { id: "zoom", name: "Slow Zoom", prompt: "gradual zoom in, building focus, cinematic zoom" },
  { id: "tracking", name: "Tracking Shot", prompt: "following subject, tracking camera, movement alongside" },
  { id: "static", name: "Static/Minimal", prompt: "static camera, minimal movement, subtle motion" },
  { id: "reveal", name: "Dramatic Reveal", prompt: "reveal shot, unveiling, building anticipation" },
  { id: "aerial", name: "Aerial/Drone", prompt: "aerial perspective, drone-style, sweeping view" },
];

const DEFAULT_MASTER_PROMPT = `VIDEO POLICY & GUIDELINES:
- Maintain professional advertising quality suitable for brands
- Ensure smooth, natural motion without jarring cuts
- Keep focus on the main subject throughout
- Avoid text overlays - focus on visual storytelling
- Ensure proper lighting and color consistency
- Match the brand's visual identity and tone`;

// ── Props ──

interface VideoPanelProps {
  brandContext: BrandContext;
  onGenerated: (item: GalleryItem) => void;
  prefill?: VideoPrefill;
}

// ── Component ──

export function VideoPanel({ brandContext, onGenerated, prefill }: VideoPanelProps) {
  // Mode
  const [mode, setMode] = useState<VideoMode>("text-to-video");

  // Prompt / content
  const [prompt, setPrompt] = useState("");
  const [headline, setHeadline] = useState(brandContext.headline || "");

  // Brand (initialized from props, user can override locally)
  const [brandName, setBrandName] = useState(brandContext.brandName || "");
  const [primaryColor, setPrimaryColor] = useState(brandContext.primaryColor || "#6366f1");
  const [secondaryColor, setSecondaryColor] = useState(brandContext.secondaryColor || "#ec4899");
  const [productDescription, setProductDescription] = useState(brandContext.productDescription || "");

  // Video settings
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("1080p");
  const [cameraFixed, setCameraFixed] = useState(false);

  // Style selections
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedMotion, setSelectedMotion] = useState<string | null>(null);

  // Image-to-video starting frame
  const [startingImage, setStartingImage] = useState<string | null>(null);
  const [startingImagePreview, setStartingImagePreview] = useState<string | null>(null);

  // Master prompt policy
  const [masterPrompt, setMasterPrompt] = useState(DEFAULT_MASTER_PROMPT);
  const [policyExpanded, setPolicyExpanded] = useState(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Sync brand context from parent when it changes ──
  useEffect(() => {
    if (brandContext.brandName) setBrandName(brandContext.brandName);
    if (brandContext.primaryColor) setPrimaryColor(brandContext.primaryColor);
    if (brandContext.secondaryColor) setSecondaryColor(brandContext.secondaryColor);
    if (brandContext.productDescription) setProductDescription(brandContext.productDescription);
    if (brandContext.headline) setHeadline(brandContext.headline);
  }, [
    brandContext.brandName,
    brandContext.primaryColor,
    brandContext.secondaryColor,
    brandContext.productDescription,
    brandContext.headline,
  ]);

  // ── Apply prefill from Smart Brief ──
  useEffect(() => {
    if (!prefill) return;
    if (prefill.prompt) setPrompt(prefill.prompt);
    if (prefill.style) {
      const match = VIDEO_STYLES.find(
        (s) => s.id === prefill.style || s.name.toLowerCase() === prefill.style?.toLowerCase()
      );
      if (match) setSelectedStyle(match.id);
    }
    if (prefill.motionStyle) {
      const match = MOTION_STYLES.find(
        (m) => m.id === prefill.motionStyle || m.name.toLowerCase() === prefill.motionStyle?.toLowerCase()
      );
      if (match) setSelectedMotion(match.id);
    }
    if (prefill.aspectRatio) setAspectRatio(prefill.aspectRatio);
    if (prefill.duration) setDuration(prefill.duration);
    if (prefill.resolution) setResolution(prefill.resolution);
  }, [prefill]);

  // ── Image upload for image-to-video ──
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setStartingImage(base64);
      setStartingImagePreview(base64);
      setMode("image-to-video");
    };
    reader.readAsDataURL(file);
  };

  const removeStartingImage = () => {
    setStartingImage(null);
    setStartingImagePreview(null);
    setMode("text-to-video");
  };

  // ── Build full prompt with all context ──
  const buildFullPrompt = () => {
    const parts: string[] = [];

    // Master prompt as foundational policy
    if (masterPrompt.trim()) {
      parts.push(masterPrompt.trim());
    }

    parts.push("\n\n=== VIDEO CREATIVE REQUEST ===");

    // Main description
    if (prompt) {
      parts.push(prompt);
    }

    // Brand context
    if (brandName) {
      parts.push(`Brand: ${brandName}`);
    }

    // Color context for mood/aesthetic
    if (primaryColor || secondaryColor) {
      parts.push(`Visual palette inspired by colors: ${primaryColor}, ${secondaryColor}`);
    }

    // Product/service context
    if (productDescription) {
      parts.push(`Showcasing: ${productDescription}`);
    }

    // Key message
    if (headline) {
      parts.push(`Key message/theme: "${headline}"`);
    }

    // Style template
    if (selectedStyle) {
      const style = VIDEO_STYLES.find((s) => s.id === selectedStyle);
      if (style) {
        parts.push(`Visual style: ${style.prompt}`);
      }
    }

    // Motion template
    if (selectedMotion) {
      const motion = MOTION_STYLES.find((m) => m.id === selectedMotion);
      if (motion) {
        parts.push(`Camera motion: ${motion.prompt}`);
      }
    }

    // Aspect ratio context
    const ratioLabel = aspectRatios.find((r) => r.value === aspectRatio)?.label || aspectRatio;
    parts.push(`Format: ${ratioLabel} video for advertising`);

    return parts.join(". ");
  };

  // ── Generate video ──
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a video description");
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();

    try {
      const fullPrompt = buildFullPrompt();
      console.log("Full video prompt:", fullPrompt.substring(0, 500) + "...");

      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          prompt: fullPrompt,
          aspectRatio,
          duration: parseInt(duration),
          resolution,
          cameraFixed,
          startingImage: mode === "image-to-video" ? startingImage : undefined,
        },
      });

      if (error) throw error;

      if (data?.videoUrl) {
        const videoUrl = data.videoUrl as string;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        toast.success("Video generated successfully!");

        // Notify parent with a GalleryItem
        onGenerated({
          id: crypto.randomUUID(),
          type: "video",
          url: videoUrl,
          prompt: prompt,
          timestamp: Date.now(),
          metadata: {
            platform: aspectRatios.find((r) => r.value === aspectRatio)?.description || aspectRatio,
            generator: "generate-video",
            mode,
            style: selectedStyle || undefined,
            duration: parseInt(duration),
            generationTime: elapsed,
          },
        });
      } else {
        throw new Error(data?.error || "Failed to generate video");
      }
    } catch (error: any) {
      console.error("Video generation error:", error);
      toast.error(error.message || "Failed to generate video");
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Render ──

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Generation Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Generation Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setMode("text-to-video");
                removeStartingImage();
              }}
              className={cn(
                "p-4 rounded-xl border-2 transition-all text-left",
                mode === "text-to-video"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Video className="h-5 w-5 mb-2 text-primary" />
              <div className="font-medium">Text to Video</div>
              <div className="text-xs text-muted-foreground">Create from a text description</div>
            </button>
            <button
              onClick={() => setMode("image-to-video")}
              className={cn(
                "p-4 rounded-xl border-2 transition-all text-left",
                mode === "image-to-video"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <ImageIcon className="h-5 w-5 mb-2 text-primary" />
              <div className="font-medium">Image to Video</div>
              <div className="text-xs text-muted-foreground">Animate a starting image</div>
            </button>
          </div>

          {/* Starting Image upload (shown inline when image-to-video is active) */}
          {mode === "image-to-video" && (
            <div className="mt-4">
              {startingImagePreview ? (
                <div className="relative">
                  <img
                    src={startingImagePreview}
                    alt="Starting frame"
                    className="w-full max-h-64 object-contain rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={removeStartingImage}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 transition-colors">
                  <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload starting image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Video Description
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Description *</Label>
            <Textarea
              placeholder={
                mode === "text-to-video"
                  ? "Describe the video... e.g., 'Product floating in space with particles, premium feel, slow rotation'"
                  : "Describe how to animate... e.g., 'Gentle zoom in, particles floating, subtle movement'"
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[100px] mt-1"
            />
          </div>
          <div>
            <Label>Key Message / Theme</Label>
            <Input
              placeholder="e.g., Innovation meets elegance"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Brand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            Brand Context
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Brand Name</Label>
              <Input
                placeholder="Acme Corp"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Product / Service</Label>
              <Input
                placeholder="Premium wireless headphones"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Brand Colors (for mood/aesthetic)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Primary</span>
                <div className="relative">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div
                    className="h-10 rounded-lg border-2 cursor-pointer flex items-center justify-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-white">
                      {primaryColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Secondary</span>
                <div className="relative">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div
                    className="h-10 rounded-lg border-2 cursor-pointer flex items-center justify-center"
                    style={{ backgroundColor: secondaryColor }}
                  >
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-white">
                      {secondaryColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Style + Motion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Style & Motion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 block">Visual Style</Label>
            <div className="flex flex-wrap gap-2">
              {VIDEO_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() =>
                    setSelectedStyle(selectedStyle === style.id ? null : style.id)
                  }
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                    selectedStyle === style.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {style.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-3 block">Camera Motion</Label>
            <div className="flex flex-wrap gap-2">
              {MOTION_STYLES.map((motion) => (
                <button
                  key={motion.id}
                  onClick={() =>
                    setSelectedMotion(selectedMotion === motion.id ? null : motion.id)
                  }
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                    selectedMotion === motion.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {motion.name}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Video Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "text-to-video" && (
            <div className="space-y-2">
              <Label>Aspect Ratio</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aspectRatios.map((ratio) => (
                    <SelectItem key={ratio.value} value={ratio.value}>
                      <div className="flex justify-between items-center gap-4">
                        <span>{ratio.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {ratio.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resolution</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="videoPanelCameraFixed"
              checked={cameraFixed}
              onChange={(e) => setCameraFixed(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="videoPanelCameraFixed" className="cursor-pointer">
              Stable camera (reduces motion)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Master Video Policy - Collapsible */}
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardHeader
          className="cursor-pointer"
          onClick={() => setPolicyExpanded(!policyExpanded)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-amber-500" />
              Master Video Policy
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {masterPrompt.length} chars
              </span>
              <div
                className={cn(
                  "transition-transform",
                  policyExpanded && "rotate-180"
                )}
              >
                <svg
                  className="w-4 h-4"
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
          <CardDescription>
            Foundational rules applied to every video - quality standards, not what to
            create
          </CardDescription>
        </CardHeader>
        {policyExpanded && (
          <CardContent>
            <Textarea
              placeholder="Enter your video policies, quality standards, and exceptions..."
              value={masterPrompt}
              onChange={(e) => setMasterPrompt(e.target.value)}
              className="min-h-[150px] font-mono text-sm"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMasterPrompt(DEFAULT_MASTER_PROMPT);
                }}
                className="text-xs text-amber-600 hover:text-amber-500"
              >
                Reset to defaults
              </button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full h-14 text-lg font-semibold gap-3"
        size="lg"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Generating Video...
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Generate Video
          </>
        )}
      </Button>

      {isGenerating && (
        <div className="text-center text-sm text-muted-foreground">
          <Clock className="inline h-4 w-4 mr-1" />
          Video generation typically takes 30-90 seconds
        </div>
      )}
    </div>
  );
}
