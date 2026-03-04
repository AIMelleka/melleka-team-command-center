import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Image as ImageIcon, Loader2, CheckCircle, Sparkles, LayoutGrid, Target, BarChart3, Mail, MessageSquare, GripVertical, Wand2, Globe, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';

interface UploadedScreenshot {
  id: string;
  url: string;
  name: string;
  category?: 'overview' | 'google_ads' | 'meta_ads' | 'sms' | 'email' | 'other';
}

interface DeckScreenshotUploaderProps {
  clientName: string;
  onScreenshotsChange: (screenshots: UploadedScreenshot[]) => void;
  screenshots: UploadedScreenshot[];
  disabled?: boolean;
  lookerUrl?: string;
  dateStart?: Date;
  dateEnd?: Date;
}

const CATEGORY_CONFIG = {
  overview: { label: 'Overview', icon: LayoutGrid, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  google_ads: { label: 'Google Ads', icon: Target, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  meta_ads: { label: 'Meta Ads', icon: BarChart3, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  sms: { label: 'SMS', icon: MessageSquare, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  email: { label: 'Email', icon: Mail, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  other: { label: 'Other', icon: ImageIcon, color: 'bg-muted text-muted-foreground border-muted-foreground/30' },
};

const autoDetectCategory = (fileName: string): UploadedScreenshot['category'] => {
  const lower = fileName.toLowerCase();
  if (lower.includes('google') || lower.includes('gads') || lower.includes('search') || lower.includes('pmax')) return 'google_ads';
  if (lower.includes('meta') || lower.includes('facebook') || lower.includes('fb') || lower.includes('instagram')) return 'meta_ads';
  if (lower.includes('sms') || lower.includes('text') || lower.includes('message')) return 'sms';
  if (lower.includes('email') || lower.includes('mail') || lower.includes('newsletter')) return 'email';
  if (lower.includes('overview') || lower.includes('summary') || lower.includes('dashboard') || lower.includes('hero')) return 'overview';
  return 'other';
};

const DeckScreenshotUploader = ({ 
  clientName, 
  onScreenshotsChange, 
  screenshots,
  disabled = false,
  lookerUrl,
  dateStart,
  dateEnd,
}: DeckScreenshotUploaderProps) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [autoCaptureProgress, setAutoCaptureProgress] = useState('');
  const [autoCaptureError, setAutoCaptureError] = useState<string | null>(null);

  const parseImageSource = (raw: unknown): { type: 'url' | 'base64'; value: string } | null => {
    if (raw == null) return null;
    const str = String(raw).trim();
    if (!str) return null;

    // URL (Firecrawl often returns hosted URLs)
    if (/^https?:\/\//i.test(str)) return { type: 'url', value: str };

    // data URI
    if (str.startsWith('data:')) {
      const commaIndex = str.indexOf(',');
      if (commaIndex !== -1) {
        const meta = str.slice(0, commaIndex);
        const dataPart = str.slice(commaIndex + 1).trim();
        if (/;base64/i.test(meta) && dataPart) {
          return { type: 'base64', value: dataPart };
        }
      }
    }

    // Assume raw base64
    return { type: 'base64', value: str };
  };

  const base64ToPngBlob = (base64: string): Blob => {
    // Normalize base64 / base64url + padding
    let clean = base64.trim().replace(/\s/g, '');
    clean = clean.replace(/-/g, '+').replace(/_/g, '/');
    const pad = clean.length % 4;
    if (pad) clean += '='.repeat(4 - pad);

    const binaryStr = atob(clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    return new Blob([bytes], { type: 'image/png' });
  };

  // Calculate coverage score
  const coverageScore = (() => {
    const requiredCategories = ['overview', 'google_ads', 'meta_ads'] as const;
    const bonusCategories = ['sms', 'email'] as const;
    
    const hasCats = new Set(screenshots.map(s => s.category));
    let score = 0;
    
    // Required categories: 25% each
    requiredCategories.forEach(cat => {
      if (hasCats.has(cat)) score += 25;
    });
    
    // Bonus categories: 12.5% each
    bonusCategories.forEach(cat => {
      if (hasCats.has(cat)) score += 12.5;
    });
    
    // Extra screenshots bonus (up to 25%)
    const extraBonus = Math.min(25, (screenshots.length - 3) * 5);
    if (extraBonus > 0) score += extraBonus;
    
    return Math.min(100, Math.round(score));
  })();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      toast({
        title: 'Invalid files',
        description: 'Please upload image files only (PNG, JPG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    const newScreenshots: UploadedScreenshot[] = [];

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const timestamp = Date.now();
        const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const fileName = `${sanitizedClientName}/${timestamp}-${file.name}`;

        const { data, error } = await supabase.storage
          .from('deck-screenshots')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Upload error:', error);
          toast({
            title: 'Upload failed',
            description: `Failed to upload ${file.name}: ${error.message}`,
            variant: 'destructive',
          });
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('deck-screenshots')
          .getPublicUrl(data.path);

        newScreenshots.push({
          id: data.path,
          url: publicUrl,
          name: file.name,
          category: autoDetectCategory(file.name),
        });

        setUploadProgress(Math.round(((i + 1) / imageFiles.length) * 100));
      }

      if (newScreenshots.length > 0) {
        onScreenshotsChange([...screenshots, ...newScreenshots]);
        toast({
          title: 'Screenshots uploaded',
          description: `Successfully uploaded ${newScreenshots.length} screenshot(s) with auto-categorization`,
        });
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast({
        title: 'Upload failed',
        description: 'An error occurred while uploading screenshots',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [screenshots, clientName]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const updateCategory = (id: string, category: UploadedScreenshot['category']) => {
    onScreenshotsChange(screenshots.map(s => 
      s.id === id ? { ...s, category } : s
    ));
  };

  const removeScreenshot = async (id: string) => {
    try {
      await supabase.storage.from('deck-screenshots').remove([id]);
      onScreenshotsChange(screenshots.filter(s => s.id !== id));
      toast({
        title: 'Screenshot removed',
        description: 'Screenshot has been removed',
      });
    } catch (err) {
      console.error('Remove error:', err);
    }
  };

  // Auto-capture from Looker URL using checkpoint-based scraper
  const handleAutoCapture = async () => {
    if (!lookerUrl) {
      toast({
        title: 'No Looker URL',
        description: 'This client does not have a Looker Studio URL configured.',
        variant: 'destructive',
      });
      return;
    }

    setIsAutoCapturing(true);
    setAutoCaptureProgress('Initializing checkpoint capture...');
    setAutoCaptureError(null);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-looker', {
        body: {
          url: lookerUrl,
          startDate: dateStart ? format(dateStart, 'yyyy-MM-dd') : undefined,
          endDate: dateEnd ? format(dateEnd, 'yyyy-MM-dd') : undefined,
          clientName,
          captureMultiple: true,
          minScreenshots: 12,
          templateId: 'melleka-standard-v1',
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Auto-capture failed');
      }

      // Process captured screenshots
      const capturedScreenshots: UploadedScreenshot[] = [];
      const screenshotsData = data.screenshots || [];

      setAutoCaptureProgress(`Processing ${screenshotsData.length} captured screenshots...`);

      for (let i = 0; i < screenshotsData.length; i++) {
        const screenshot = screenshotsData[i];
        
        if (screenshot.image) {
          const timestamp = Date.now();
          const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          
          const parsed = parseImageSource(screenshot.image);
          if (!parsed) continue;

          // Lightweight debug to help diagnose format mismatches
          console.debug('[AutoCapture] screenshot.image format:', {
            index: i,
            type: parsed.type,
            sample: parsed.value.slice(0, 32),
            length: parsed.value.length,
          });

          if (parsed.type === 'url') {
            // It's already a URL from Firecrawl - download and re-upload to our storage
            try {
              const response = await fetch(parsed.value);
              if (!response.ok) throw new Error('Failed to fetch image');
              const blob = await response.blob();
              
              const fileName = `${sanitizedClientName}/auto-${timestamp}-${i}.png`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('deck-screenshots')
                .upload(fileName, blob, {
                  cacheControl: '3600',
                  upsert: false,
                });
              
              if (uploadError || !uploadData) throw uploadError || new Error('Upload failed');

              const { data: { publicUrl } } = supabase.storage
                .from('deck-screenshots')
                .getPublicUrl(uploadData.path);
              
              const category = mapSectionToCategory(screenshot.sectionId || screenshot.category);
              capturedScreenshots.push({
                id: uploadData.path,
                url: publicUrl,
                name: `${screenshot.section || 'Looker'} (Position ${screenshot.scrollPosition || 0}px)`,
                category,
              });
            } catch (fetchErr) {
              console.warn(`Failed to download screenshot ${i}:`, fetchErr);
              // Use original URL as fallback
              const category = mapSectionToCategory(screenshot.sectionId || screenshot.category);
              capturedScreenshots.push({
                id: `external-${timestamp}-${i}`,
                url: parsed.value,
                name: `${screenshot.section || 'Looker'} (Position ${screenshot.scrollPosition || 0}px)`,
                category,
              });
            }
          } else {
            // It's base64 data
            try {
              const blob = base64ToPngBlob(parsed.value);
              
              const fileName = `${sanitizedClientName}/auto-${timestamp}-${i}.png`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('deck-screenshots')
                .upload(fileName, blob, {
                  cacheControl: '3600',
                  upsert: false,
                });
              
              if (uploadError || !uploadData) throw uploadError || new Error('Upload failed');

              const { data: { publicUrl } } = supabase.storage
                .from('deck-screenshots')
                .getPublicUrl(uploadData.path);
              
              const category = mapSectionToCategory(screenshot.sectionId || screenshot.category);
              capturedScreenshots.push({
                id: uploadData.path,
                url: publicUrl,
                name: `${screenshot.section || 'Looker'} (Position ${screenshot.scrollPosition || 0}px)`,
                category,
              });
            } catch (b64Err) {
              console.warn(`Failed to decode base64 for screenshot ${i}:`, b64Err);
            }
          }
        }

        setAutoCaptureProgress(`Processed ${i + 1}/${screenshotsData.length} screenshots`);
      }

      if (capturedScreenshots.length > 0) {
        onScreenshotsChange([...screenshots, ...capturedScreenshots]);
        
        // Show coverage summary
        const coverage = data.coverageResult;
        toast({
          title: `Auto-capture complete!`,
          description: `Captured ${capturedScreenshots.length} screenshots. Coverage: ${coverage?.percentage || 'N/A'}%`,
        });
      } else {
        throw new Error('No screenshots were captured. The report may require authentication or the URL may be invalid.');
      }

    } catch (err) {
      console.error('Auto-capture error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to auto-capture screenshots';
      setAutoCaptureError(errorMessage);
      toast({
        title: 'Auto-capture failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsAutoCapturing(false);
      setAutoCaptureProgress('');
    }
  };

  // Helper to map section IDs to categories
  const mapSectionToCategory = (sectionId?: string): UploadedScreenshot['category'] => {
    if (!sectionId) return 'other';
    const lower = sectionId.toLowerCase();
    if (lower.includes('google') || lower.includes('keyword')) return 'google_ads';
    if (lower.includes('meta') || lower.includes('facebook')) return 'meta_ads';
    if (lower.includes('sms')) return 'sms';
    if (lower.includes('email')) return 'email';
    if (lower.includes('overview') || lower.includes('header')) return 'overview';
    return 'other';
  };

  // Group screenshots by category for display
  const groupedScreenshots = screenshots.reduce((acc, s) => {
    const cat = s.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {} as Record<string, UploadedScreenshot[]>);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <ImageIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <span>Looker Screenshots</span>
            <p className="text-sm font-normal text-muted-foreground mt-0.5">
              AI-powered analysis with auto-categorization
            </p>
          </div>
          {screenshots.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {screenshots.length} uploaded
              </Badge>
            </div>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Coverage Score */}
        {screenshots.length > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Coverage Score</span>
              </div>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                coverageScore >= 80 ? "text-emerald-500" :
                coverageScore >= 50 ? "text-amber-500" : "text-destructive"
              )}>
                {coverageScore}%
              </span>
            </div>
            <Progress value={coverageScore} className="h-2" />
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                const hasCategory = screenshots.some(s => s.category === key);
                return (
                  <Badge 
                    key={key} 
                    variant="outline" 
                    className={cn(
                      "text-xs transition-all",
                      hasCategory ? config.color : "opacity-40"
                    )}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {config.label}
                    {hasCategory && <CheckCircle className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Auto-Capture from Looker URL */}
        {lookerUrl && (
          <div className="p-4 rounded-xl border border-border bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wand2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    Auto-Capture from Looker
                    <Badge variant="secondary" className="text-xs">NEW</Badge>
                  </h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Automatically capture 12+ screenshots using checkpoint-based scrolling
                  </p>
                </div>
                
                {autoCaptureError && (
                  <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{autoCaptureError}</span>
                  </div>
                )}
                
                {isAutoCapturing ? (
                  <div className="flex items-center gap-3 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-muted-foreground">{autoCaptureProgress}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handleAutoCapture}
                      disabled={disabled || isAutoCapturing}
                      size="sm"
                      className="gap-2"
                    >
                      <Globe className="h-4 w-4" />
                      Capture from Looker URL
                    </Button>
                    <a 
                      href={lookerUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary underline"
                    >
                      View Report →
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        {lookerUrl && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex-1 border-t border-border" />
            <span>or upload manually</span>
            <div className="flex-1 border-t border-border" />
          </div>
        )}

        {/* Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center transition-all",
            dragActive 
              ? "border-primary bg-primary/10 scale-[1.02]" 
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5",
            disabled && "opacity-50 pointer-events-none"
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold">{uploadProgress}%</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Uploading & analyzing...</p>
              <Progress value={uploadProgress} className="w-48 h-2" />
            </div>
          ) : (
            <>
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <p className="text-base font-medium mb-1">
                Drop your Looker Studio screenshots here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse • PNG, JPG supported
              </p>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileInput}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={disabled || isUploading}
              />
              <Button variant="outline" size="sm" disabled={disabled || isUploading} className="pointer-events-none">
                <Upload className="h-4 w-4 mr-2" />
                Select Files
              </Button>
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground bg-muted/30 p-4 rounded-lg space-y-2">
          <p className="font-medium text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Pro Tips for Best Results:
          </p>
          <ul className="space-y-1 ml-5 list-disc">
            <li>Include <strong>Overview, Google Ads, and Meta Ads</strong> sections for 75% coverage</li>
            <li>Name files descriptively (e.g., "google-ads-performance.png")</li>
            <li>Screenshots are auto-categorized — click badges to adjust</li>
            <li>Aim for <strong>10+ screenshots</strong> for comprehensive AI analysis</li>
          </ul>
        </div>

        {/* Screenshot Grid by Category */}
        {Object.keys(groupedScreenshots).length > 0 && (
          <div className="space-y-4">
            {Object.entries(groupedScreenshots).map(([category, categoryScreenshots]) => {
              const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG] || CATEGORY_CONFIG.other;
              const Icon = config.icon;
              
              return (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-xs", config.color)}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {categoryScreenshots.length} screenshot{categoryScreenshots.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {categoryScreenshots.map((screenshot) => (
                      <div
                        key={screenshot.id}
                        className="relative group rounded-lg overflow-hidden border border-border bg-card aspect-video"
                      >
                        <img
                          src={screenshot.url}
                          alt={screenshot.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Category selector */}
                          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                              <button
                                key={key}
                                onClick={() => updateCategory(screenshot.id, key as UploadedScreenshot['category'])}
                                className={cn(
                                  "w-6 h-6 rounded-full flex items-center justify-center transition-all text-xs",
                                  screenshot.category === key 
                                    ? "bg-white text-black scale-110 ring-2 ring-primary" 
                                    : "bg-black/50 text-white/70 hover:bg-black/70"
                                )}
                                title={cfg.label}
                              >
                                {cfg.label[0]}
                              </button>
                            ))}
                          </div>
                          
                          {/* Delete button */}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={() => removeScreenshot(screenshot.id)}
                            disabled={disabled}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          
                          {/* Drag handle */}
                          <div className="absolute bottom-2 left-2 p-1 rounded bg-black/50">
                            <GripVertical className="h-3 w-3 text-white/70" />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pointer-events-none">
                          <p className="text-xs text-white truncate">{screenshot.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Messages */}
        {coverageScore >= 80 && (
          <div className="flex items-center gap-2 text-emerald-500 text-sm p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Excellent coverage! Ready for comprehensive AI analysis.</span>
          </div>
        )}
        {coverageScore >= 50 && coverageScore < 80 && (
          <div className="flex items-center gap-2 text-amber-500 text-sm p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Sparkles className="h-5 w-5" />
            <span>Good start! Add more sections to improve coverage score.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeckScreenshotUploader;
