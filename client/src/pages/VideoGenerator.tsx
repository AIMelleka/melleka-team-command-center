import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Video, Sparkles, Download, Loader2, Clock, Image as ImageIcon, ScrollText, Palette, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WebsiteAnalyzer } from "@/components/WebsiteAnalyzer";

type VideoMode = "text-to-video" | "image-to-video";

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

// Video style templates
const VIDEO_STYLES = [
  { id: "cinematic", name: "Cinematic", prompt: "cinematic quality, dramatic lighting, film-like color grading, depth of field" },
  { id: "commercial", name: "Commercial", prompt: "professional advertising quality, polished, broadcast-ready, engaging" },
  { id: "social", name: "Social Media", prompt: "eye-catching, trendy, fast-paced, vibrant colors, shareable" },
  { id: "corporate", name: "Corporate", prompt: "professional, clean, business-appropriate, trustworthy" },
  { id: "dynamic", name: "Dynamic/Action", prompt: "energetic, fast motion, dynamic camera movements, high impact" },
  { id: "elegant", name: "Elegant/Luxury", prompt: "sophisticated, premium feel, smooth transitions, refined" },
];

// Motion styles
const MOTION_STYLES = [
  { id: "smooth", name: "Smooth Pan", prompt: "smooth camera pan, fluid motion, steady movement" },
  { id: "zoom", name: "Slow Zoom", prompt: "gradual zoom in, building focus, cinematic zoom" },
  { id: "tracking", name: "Tracking Shot", prompt: "following subject, tracking camera, movement alongside" },
  { id: "static", name: "Static/Minimal", prompt: "static camera, minimal movement, subtle motion" },
  { id: "reveal", name: "Dramatic Reveal", prompt: "reveal shot, unveiling, building anticipation" },
  { id: "aerial", name: "Aerial/Drone", prompt: "aerial perspective, drone-style, sweeping view" },
];

export default function VideoGenerator() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<VideoMode>("text-to-video");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [duration, setDuration] = useState("5");
  const [resolution, setResolution] = useState("1080p");
  const [cameraFixed, setCameraFixed] = useState(false);
  const [startingImage, setStartingImage] = useState<string | null>(null);
  const [startingImagePreview, setStartingImagePreview] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);

  // Ad Content State - matching AdGenerator
  const [masterPrompt, setMasterPrompt] = useState(
    `VIDEO POLICY & GUIDELINES:
- Maintain professional advertising quality suitable for brands
- Ensure smooth, natural motion without jarring cuts
- Keep focus on the main subject throughout
- Avoid text overlays - focus on visual storytelling
- Ensure proper lighting and color consistency
- Match the brand's visual identity and tone`
  );
  const [policyExpanded, setPolicyExpanded] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#ec4899");
  const [productDescription, setProductDescription] = useState("");
  const [headline, setHeadline] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedMotion, setSelectedMotion] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("prompt");

  // Handle branding extraction from website analyzer
  const handleBrandingExtracted = (branding: {
    logo: string | null;
    colors: { primary?: string; secondary?: string; accent?: string };
    businessName: string;
    tagline: string;
    messaging: string[];
  }) => {
    setBrandName(branding.businessName);
    if (branding.colors.primary) setPrimaryColor(branding.colors.primary);
    if (branding.colors.secondary) setSecondaryColor(branding.colors.secondary);
    if (branding.tagline) setProductDescription(branding.tagline);
    setSelectedTab("prompt");
    toast.success("Brand info extracted! Now describe your video.");
  };

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

  // Build full prompt with all content
  const buildFullPrompt = () => {
    const parts: string[] = [];

    // MASTER PROMPT is prepended as the foundational policy
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
      const style = VIDEO_STYLES.find(s => s.id === selectedStyle);
      if (style) {
        parts.push(`Visual style: ${style.prompt}`);
      }
    }

    // Motion template
    if (selectedMotion) {
      const motion = MOTION_STYLES.find(m => m.id === selectedMotion);
      if (motion) {
        parts.push(`Camera motion: ${motion.prompt}`);
      }
    }

    // Add aspect ratio context
    const ratioLabel = aspectRatios.find(r => r.value === aspectRatio)?.label || aspectRatio;
    parts.push(`Format: ${ratioLabel} video for advertising`);

    return parts.join(". ");
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a video description");
      return;
    }

    setIsGenerating(true);
    setGeneratedVideo(null);
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
        setGeneratedVideo(data.videoUrl);
        setGenerationTime(Math.round((Date.now() - startTime) / 1000));
        toast.success("Video generated successfully!");
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

  const handleDownload = () => {
    if (!generatedVideo) return;
    
    const link = document.createElement("a");
    link.href = generatedVideo;
    link.download = `generated-video-${Date.now()}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Video className="h-8 w-8 text-primary" />
              Video Generator
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate AI ad videos from text prompts or animate images
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Master Design Policy - Collapsible Card at Top */}
            <Card className="border-amber-500/30 bg-amber-500/5">
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
                    <span className="text-xs text-muted-foreground">{masterPrompt.length} chars</span>
                    <div className={`transition-transform ${policyExpanded ? "rotate-180" : ""}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <CardDescription>
                  Foundational rules applied to every video - quality standards, not what to create
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
                        setMasterPrompt(`VIDEO POLICY & GUIDELINES:
- Maintain professional advertising quality suitable for brands
- Ensure smooth, natural motion without jarring cuts
- Keep focus on the main subject throughout
- Avoid text overlays - focus on visual storytelling
- Ensure proper lighting and color consistency
- Match the brand's visual identity and tone`);
                      }}
                      className="text-xs text-amber-600 hover:text-amber-500"
                    >
                      Reset to defaults
                    </button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Mode Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generation Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setMode("text-to-video");
                      removeStartingImage();
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      mode === "text-to-video"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Sparkles className="h-5 w-5 mb-2 text-primary" />
                    <div className="font-medium">Text to Video</div>
                    <div className="text-xs text-muted-foreground">Create from scratch</div>
                  </button>
                  <button
                    onClick={() => setMode("image-to-video")}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      mode === "image-to-video"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <ImageIcon className="h-5 w-5 mb-2 text-primary" />
                    <div className="font-medium">Image to Video</div>
                    <div className="text-xs text-muted-foreground">Animate an image</div>
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Starting Image (for image-to-video) */}
            {mode === "image-to-video" && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Starting Frame</CardTitle>
                </CardHeader>
                <CardContent>
                  {startingImagePreview ? (
                    <div className="relative">
                      <img
                        src={startingImagePreview}
                        alt="Starting frame"
                        className="w-full rounded-lg border"
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
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
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
                </CardContent>
              </Card>
            )}

            {/* Ad Content Tabs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Video Content</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="grid grid-cols-4 mb-4">
                    <TabsTrigger value="website">
                      <Globe className="h-3 w-3 mr-1" />
                      Website
                    </TabsTrigger>
                    <TabsTrigger value="prompt">Prompt</TabsTrigger>
                    <TabsTrigger value="brand">
                      <Palette className="h-3 w-3 mr-1" />
                      Brand
                    </TabsTrigger>
                    <TabsTrigger value="style">Style</TabsTrigger>
                  </TabsList>

                  <TabsContent value="website" className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Analyze Client Website</Label>
                      <p className="text-xs text-muted-foreground mb-4">
                        Extract brand colors and messaging automatically
                      </p>
                      <WebsiteAnalyzer onBrandingExtracted={handleBrandingExtracted} />
                    </div>
                  </TabsContent>

                  <TabsContent value="prompt" className="space-y-4">
                    <div>
                      <Label>Video Description *</Label>
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
                  </TabsContent>

                  <TabsContent value="brand" className="space-y-4">
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
                  </TabsContent>

                  <TabsContent value="style" className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Visual Style</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {VIDEO_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => setSelectedStyle(selectedStyle === style.id ? null : style.id)}
                            className={`p-3 rounded-lg border text-left transition-all text-sm ${
                              selectedStyle === style.id
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {style.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="mb-2 block">Camera Motion</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {MOTION_STYLES.map((motion) => (
                          <button
                            key={motion.id}
                            onClick={() => setSelectedMotion(selectedMotion === motion.id ? null : motion.id)}
                            className={`p-3 rounded-lg border text-left transition-all text-sm ${
                              selectedMotion === motion.id
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            {motion.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Video Settings</CardTitle>
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
                              <span className="text-xs text-muted-foreground">{ratio.description}</span>
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
                    id="cameraFixed"
                    checked={cameraFixed}
                    onChange={(e) => setCameraFixed(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <Label htmlFor="cameraFixed" className="cursor-pointer">
                    Stable camera (reduces motion)
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full h-12 text-lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
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

          {/* Right Panel - Preview */}
          <div className="space-y-6">
            <Card className="min-h-[400px]">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  Generated Video
                  {generationTime && (
                    <span className="text-sm font-normal text-muted-foreground">
                      Generated in {generationTime}s
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Loader2 className="h-12 w-12 animate-spin mb-4" />
                    <p>Creating your video...</p>
                    <p className="text-sm">This may take a minute</p>
                  </div>
                ) : generatedVideo ? (
                  <div className="space-y-4">
                    <video
                      src={generatedVideo}
                      controls
                      autoPlay
                      loop
                      className="w-full rounded-lg border bg-black"
                    />
                    <Button onClick={handleDownload} className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Download Video
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Video className="h-12 w-12 mb-4 opacity-50" />
                    <p>Your generated video will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Prompt Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Prompt Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg max-h-48 overflow-y-auto font-mono whitespace-pre-wrap">
                  {buildFullPrompt() || "Fill in the content to see the full prompt..."}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
