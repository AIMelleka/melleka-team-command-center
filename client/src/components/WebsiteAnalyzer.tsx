import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Globe, Palette, ImageIcon, MessageSquare, RefreshCw, Check, X, Camera } from "lucide-react";

interface Screenshot {
  url: string;
  screenshot: string | null;
  title: string;
}

interface ExtractedBranding {
  logo: string | null;
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    textPrimary?: string;
  };
  businessName: string;
  tagline: string;
  messaging: string[];
  screenshots?: Screenshot[];
}

interface WebsiteAnalyzerProps {
  onBrandingExtracted: (branding: ExtractedBranding) => void;
}

export function WebsiteAnalyzer({ onBrandingExtracted }: WebsiteAnalyzerProps) {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analyzeMessage, setAnalyzeMessage] = useState("");
  
  // Extracted data
  const [extractedData, setExtractedData] = useState<{
    logo: string | null;
    colors: Record<string, string>;
    businessName: string;
    tagline: string;
    messaging: string[];
    screenshots: Screenshot[];
  } | null>(null);
  
  // Editable states
  const [editedColors, setEditedColors] = useState<Record<string, string>>({});
  const [useLogo, setUseLogo] = useState(true);
  const [editedBusinessName, setEditedBusinessName] = useState("");
  const [editedTagline, setEditedTagline] = useState("");
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0);

  const handleAnalyze = async () => {
    if (!websiteUrl) {
      toast.error("Please enter a website URL");
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeProgress(10);
    setAnalyzeMessage("Connecting to website...");

    try {
      setAnalyzeProgress(20);
      setAnalyzeMessage("Mapping website pages...");

      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url: websiteUrl, maxScreenshots: 6 },
      });

      if (error) {
        throw new Error(error.message || "Failed to analyze website");
      }

      setAnalyzeProgress(50);
      setAnalyzeMessage("Capturing screenshots...");

      if (!data.success && !data.partial) {
        throw new Error(data.error || "Failed to extract branding");
      }

      setAnalyzeProgress(70);
      setAnalyzeMessage("Extracting brand colors...");

      // Extract branding data
      const branding = data.branding || {};
      const metadata = data.metadata || {};
      const content = data.content || "";
      const screenshots = (data.screenshots || []).filter((s: Screenshot) => s.screenshot);

      // Extract colors
      const colors = branding.colors || {};
      
      // Extract business name from metadata
      const businessName = metadata.title?.split("|")[0]?.split("-")[0]?.trim() || 
                          new URL(websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`).hostname.replace("www.", "").split(".")[0];
      
      // Extract key messaging from content
      const lines = content.split("\n").filter((line: string) => line.trim().length > 10 && line.trim().length < 150);
      const messaging = lines.slice(0, 5);
      
      // Try to extract tagline from meta description or first line
      const tagline = metadata.description?.slice(0, 100) || messaging[0] || "";

      setAnalyzeProgress(90);
      setAnalyzeMessage("Processing brand assets...");

      const extracted = {
        logo: branding.logo || null,
        colors,
        businessName: businessName.charAt(0).toUpperCase() + businessName.slice(1),
        tagline,
        messaging,
        screenshots,
      };

      setExtractedData(extracted);
      setEditedColors(colors);
      setEditedBusinessName(extracted.businessName);
      setEditedTagline(extracted.tagline);
      setUseLogo(!!extracted.logo);
      setSelectedScreenshotIndex(0);

      setAnalyzeProgress(100);
      setAnalyzeMessage("Analysis complete!");

      const screenshotCount = screenshots.length;
      toast.success(`Website analyzed! ${screenshotCount} screenshot${screenshotCount !== 1 ? 's' : ''} captured.`);

      // Automatically apply branding
      setTimeout(() => {
        applyBranding(extracted);
      }, 500);

    } catch (err: any) {
      console.error("Analysis error:", err);
      toast.error(err.message || "Failed to analyze website");
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalyzeProgress(0);
        setAnalyzeMessage("");
      }, 500);
    }
  };

  const applyBranding = (data?: typeof extractedData) => {
    const source = data || extractedData;
    if (!source) return;

    onBrandingExtracted({
      logo: useLogo ? source.logo : null,
      colors: {
        primary: editedColors.primary || source.colors.primary,
        secondary: editedColors.secondary || source.colors.secondary,
        accent: editedColors.accent || source.colors.accent,
        background: editedColors.background || source.colors.background,
        textPrimary: editedColors.textPrimary || source.colors.textPrimary,
      },
      businessName: editedBusinessName || source.businessName,
      tagline: editedTagline || source.tagline,
      messaging: source.messaging,
      screenshots: source.screenshots,
    });

    toast.success("Branding applied to generator!");
  };

  const updateColor = (key: string, value: string) => {
    setEditedColors(prev => ({ ...prev, [key]: value }));
  };

  const colorLabels: Record<string, string> = {
    primary: "Primary",
    secondary: "Secondary", 
    accent: "Accent",
    background: "Background",
    textPrimary: "Text",
  };

  return (
    <div className="space-y-4">
      {/* URL Input */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <Input
            type="url"
            placeholder="https://example.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="pl-10 bg-muted/30 border-border focus:border-primary/50 rounded-xl"
          />
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !websiteUrl}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border-0"
        >
          {isAnalyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Globe className="h-4 w-4 mr-2" />
              Analyze
            </>
          )}
        </Button>
      </div>

      {/* Progress */}
      {isAnalyzing && (
        <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border">
          <div className="relative h-2 rounded-full overflow-hidden bg-muted">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${analyzeProgress}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground">{analyzeMessage}</p>
        </div>
      )}

      {/* Extracted Data */}
      {extractedData && !isAnalyzing && (
        <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border">
          {/* Screenshots Section */}
          {extractedData.screenshots.length > 0 && (
            <div>
              <Label className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
                <Camera className="h-4 w-4" />
                Website Screenshots ({extractedData.screenshots.length})
              </Label>
              
              {/* Main screenshot display */}
              <div className="relative rounded-xl overflow-hidden border border-border mb-3">
                {extractedData.screenshots[selectedScreenshotIndex]?.screenshot && (
                  <img 
                    src={extractedData.screenshots[selectedScreenshotIndex].screenshot}
                    alt={extractedData.screenshots[selectedScreenshotIndex].title}
                    className="w-full h-40 object-cover object-top"
                  />
                )}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs text-white/80 truncate">
                    {extractedData.screenshots[selectedScreenshotIndex]?.title || 'Homepage'}
                  </p>
                </div>
              </div>
              
              {/* Screenshot thumbnails */}
              {extractedData.screenshots.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {extractedData.screenshots.map((screenshot, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedScreenshotIndex(index)}
                      className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                        selectedScreenshotIndex === index 
                          ? 'border-purple-400 ring-2 ring-purple-400/30' 
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      {screenshot.screenshot ? (
                        <img 
                          src={screenshot.screenshot} 
                          alt={screenshot.title}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted/30 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              <p className="text-xs text-muted-foreground/60 mt-1">
                Screenshots help AI understand your brand's visual style
              </p>
            </div>
          )}

          {/* Logo & Name Section */}
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              {extractedData.logo ? (
                <div className="relative">
                  <div className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${useLogo ? 'border-purple-400' : 'border-border opacity-50'} bg-muted flex items-center justify-center`}>
                    <img 
                      src={extractedData.logo} 
                      alt="Logo" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <button
                    onClick={() => setUseLogo(!useLogo)}
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      useLogo 
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                        : 'bg-white/20 text-white/50'
                    }`}
                  >
                    {useLogo ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Business Name</Label>
                <Input
                  value={editedBusinessName}
                  onChange={(e) => setEditedBusinessName(e.target.value)}
                  className="h-8 text-sm bg-muted/30 border-border focus:border-primary/50 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tagline</Label>
                <Input
                  value={editedTagline}
                  onChange={(e) => setEditedTagline(e.target.value)}
                  placeholder="Add a tagline..."
                  className="h-8 text-sm bg-muted/30 border-border focus:border-primary/50 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Colors Section */}
          <div>
            <Label className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <Palette className="h-4 w-4" />
              Brand Colors
            </Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(editedColors).length > 0 ? (
                Object.entries(editedColors).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/30 border border-border">
                    <div className="relative">
                      <input
                        type="color"
                        value={value || "#8B5CF6"}
                        onChange={(e) => updateColor(key, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div 
                        className="w-6 h-6 rounded cursor-pointer border border-border"
                        style={{ backgroundColor: value || "#8B5CF6" }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{colorLabels[key] || key}</span>
                    <span className="text-xs text-muted-foreground/60 font-mono">{value}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground/60">No colors detected. Add manually:</p>
              )}
              
              {/* Add color button if less than 5 colors */}
              {Object.keys(editedColors).length < 5 && (
                <button
                  onClick={() => {
                    const missingKeys = Object.keys(colorLabels).filter(k => !editedColors[k]);
                    if (missingKeys.length > 0) {
                      updateColor(missingKeys[0], "#8B5CF6");
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-purple-400/50 hover:text-purple-200 transition-all"
                >
                  + Add Color
                </button>
              )}
            </div>
          </div>

          {/* Messaging Preview */}
          {extractedData.messaging.length > 0 && (
            <div>
              <Label className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                Detected Messaging
              </Label>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {extractedData.messaging.slice(0, 3).map((msg, i) => (
                  <p key={i} className="text-xs text-muted-foreground truncate">
                    "{msg}"
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Apply Button */}
          <Button
            onClick={() => applyBranding()}
            className="w-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/30 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Apply Updated Branding
          </Button>
        </div>
      )}
    </div>
  );
}
