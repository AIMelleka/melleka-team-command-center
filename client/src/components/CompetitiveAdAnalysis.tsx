import { useState } from 'react';
import { 
  Search, 
  Loader2, 
  Plus, 
  Trash2, 
  ArrowRight, 
  AlertCircle, 
  Lightbulb,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  Sparkles,
  Wand2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ImageAnnotator, Annotation } from './ImageAnnotator';

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

interface CompetitiveAdAnalysisProps {
  items: AdAnalysisItem[];
  onChange: (items: AdAnalysisItem[]) => void;
}

export const CompetitiveAdAnalysis = ({ items, onChange }: CompetitiveAdAnalysisProps) => {
  const [isCapturing, setIsCapturing] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [annotatingItem, setAnnotatingItem] = useState<AdAnalysisItem | null>(null);

  const handleCaptureAd = async (url: string, competitorName: string) => {
    if (!url && !competitorName) {
      toast.error('Please enter a URL or competitor name');
      return null;
    }

    setIsCapturing('new');
    try {
      const { data, error } = await supabase.functions.invoke('scrape-ad-transparency', {
        body: { url, advertiserName: competitorName },
      });

      if (error) throw error;

      if (data.success && data.screenshot) {
        return data.screenshot;
      } else {
        throw new Error(data.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Error capturing ad:', error);
      toast.error('Failed to capture ad screenshot. You can upload one manually.');
      return null;
    } finally {
      setIsCapturing(null);
    }
  };

  const addNewAnalysis = async () => {
    const screenshot = await handleCaptureAd(newUrl, newCompetitor);
    
    const newItem: AdAnalysisItem = {
      id: `ad-${Date.now()}`,
      competitorName: newCompetitor || 'Competitor',
      transparencyUrl: newUrl,
      screenshot,
      issues: [''],
      ourSolution: '',
      platform: newUrl.includes('facebook') || newUrl.includes('meta') ? 'meta' : 'google',
    };

    onChange([...items, newItem]);
    setNewUrl('');
    setNewCompetitor('');
    toast.success('Ad analysis added! Add issues and your solution.');
  };

  const updateItem = (id: string, updates: Partial<AdAnalysisItem>) => {
    onChange(items.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
    toast.success('Ad analysis removed');
  };

  const addIssue = (id: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      updateItem(id, { issues: [...item.issues, ''] });
    }
  };

  const updateIssue = (id: string, issueIndex: number, value: string) => {
    const item = items.find(i => i.id === id);
    if (item) {
      const newIssues = [...item.issues];
      newIssues[issueIndex] = value;
      updateItem(id, { issues: newIssues });
    }
  };

  const removeIssue = (id: string, issueIndex: number) => {
    const item = items.find(i => i.id === id);
    if (item && item.issues.length > 1) {
      const newIssues = item.issues.filter((_, i) => i !== issueIndex);
      updateItem(id, { issues: newIssues });
    }
  };

  const handleImageUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateItem(id, { screenshot: event.target?.result as string });
        toast.success('Screenshot uploaded');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAnnotations = (annotations: Annotation[]) => {
    if (annotatingItem) {
      updateItem(annotatingItem.id, { annotations });
      toast.success(`${annotations.length} annotation${annotations.length !== 1 ? 's' : ''} saved`);
    }
  };

  // AI-powered ad analysis
  const handleAIAnalysis = async (item: AdAnalysisItem) => {
    if (!item.screenshot) {
      toast.error('Please add a screenshot first');
      return;
    }

    setIsAnalyzing(item.id);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-ad', {
        body: { 
          imageUrl: item.screenshot, 
          competitorName: item.competitorName,
          platform: item.platform 
        },
      });

      if (error) throw error;

      if (data.success && data.analysis) {
        const { issues, ourSolution, quickWins } = data.analysis;
        
        // Update the item with AI-generated content
        updateItem(item.id, { 
          issues: issues || [''],
          ourSolution: ourSolution || ''
        });
        
        toast.success('AI analysis complete! Review and customize the suggestions.');
      } else {
        throw new Error(data.error || 'Failed to analyze ad');
      }
    } catch (error) {
      console.error('Error analyzing ad:', error);
      toast.error('Failed to analyze ad. Please try again or add issues manually.');
    } finally {
      setIsAnalyzing(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Eye className="w-5 h-5 text-genie-gold" />
            Competitive Ad Analysis
          </h3>
          <p className="text-sm text-muted-foreground">
            Capture competitor ads and show how you'll improve them
          </p>
        </div>
      </div>

      {/* Add New Analysis */}
      <div className="p-4 rounded-xl bg-background border border-border space-y-4">
        <p className="text-sm font-medium text-foreground">Add Competitor Ad</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Competitor Name</label>
            <Input
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              placeholder="e.g., Nike, Adidas"
              className="bg-card"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Google Transparency URL (optional)</label>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://adstransparency.google.com/..."
              className="bg-card"
            />
          </div>
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={addNewAnalysis}
            disabled={isCapturing === 'new' || (!newUrl && !newCompetitor)}
            variant="outline"
            className="flex-1 min-w-[200px]"
          >
            {isCapturing === 'new' ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Capturing Screenshot...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Auto-Capture Ad
              </>
            )}
          </Button>
          
          {newCompetitor && (
            <a
              href={`https://adstransparency.google.com/advertiser/${encodeURIComponent(newCompetitor)}?region=US&hl=en`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 min-w-[200px]"
            >
              <Button variant="secondary" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Google Transparency
              </Button>
            </a>
          )}
        </div>
        
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            <strong>💡 Pro tip:</strong> For best results:
          </p>
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
            <li>Click "Open in Google Transparency" to view their ads</li>
            <li>Take a screenshot of the ad you want to analyze</li>
            <li>Click "Add Competitor Analysis" then upload your screenshot</li>
          </ol>
        </div>
      </div>

      {/* Existing Analyses */}
      {items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <div 
              key={item.id} 
              className="border border-border rounded-xl overflow-hidden bg-card"
            >
              {/* Header */}
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
              >
                <div className="flex items-center gap-3">
                  {item.screenshot ? (
                    <img 
                      src={item.screenshot} 
                      alt={item.competitorName}
                      className="w-16 h-12 object-cover rounded border border-border"
                    />
                  ) : (
                    <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                      <Search className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-foreground">{item.competitorName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.issues.filter(i => i).length} issues identified • {item.platform === 'google' ? 'Google Ads' : 'Meta Ads'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(item.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                  {expandedItem === item.id ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {expandedItem === item.id && (
                <div className="p-4 pt-0 space-y-6 border-t border-border">
                  {/* 3-Panel Flow Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    {/* Panel 1: Competitor Ad */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold">1</div>
                        Competitor Ad
                      </div>
                      <div className="relative group">
                        {item.screenshot ? (
                          <>
                            <img 
                              src={item.screenshot} 
                              alt={item.competitorName}
                              className="w-full aspect-video object-cover rounded-lg border border-border cursor-pointer"
                              onClick={() => setPreviewImage(item.screenshot)}
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2 p-2">
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="secondary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewImage(item.screenshot);
                                  }}
                                >
                                  <Eye className="w-4 h-4 mr-1" /> View
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAnnotatingItem(item);
                                  }}
                                >
                                  <Pencil className="w-4 h-4 mr-1" /> Annotate
                                </Button>
                              </div>
                              <Button 
                                size="sm" 
                                className="bg-gradient-to-r from-genie-purple to-genie-gold text-white hover:opacity-90 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAIAnalysis(item);
                                }}
                                disabled={isAnalyzing === item.id}
                              >
                                {isAnalyzing === item.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Analyzing...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-1" /> AI Analyze
                                  </>
                                )}
                              </Button>
                            </div>
                            {/* Annotation indicator */}
                            {item.annotations && item.annotations.length > 0 && (
                              <div className="absolute top-2 right-2 px-2 py-1 bg-genie-purple text-white text-xs rounded-full font-medium">
                                {item.annotations.length} annotation{item.annotations.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </>
                        ) : (
                          <label className="w-full aspect-video bg-muted rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                            <Plus className="w-8 h-8 text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">Upload Screenshot</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(item.id, e)}
                            />
                          </label>
                        )}
                      </div>
                      <Input
                        value={item.competitorName}
                        onChange={(e) => updateItem(item.id, { competitorName: e.target.value })}
                        placeholder="Competitor name"
                        className="bg-background"
                      />
                    </div>

                    {/* Panel 2: Issues Found */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <div className="w-6 h-6 rounded-full bg-destructive/20 text-destructive flex items-center justify-center text-xs font-bold">2</div>
                          Issues We Found
                          <AlertCircle className="w-4 h-4 text-genie-gold" />
                        </div>
                        {item.screenshot && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 px-2"
                            onClick={() => handleAIAnalysis(item)}
                            disabled={isAnalyzing === item.id}
                          >
                            {isAnalyzing === item.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <Wand2 className="w-3 h-3 mr-1" />
                                Auto-fill
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {item.issues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center flex-shrink-0 mt-1">
                              <X className="w-3 h-3" />
                            </div>
                            <Input
                              value={issue}
                              onChange={(e) => updateIssue(item.id, i, e.target.value)}
                              placeholder={`Issue ${i + 1}: e.g., Weak CTA, cluttered design...`}
                              className="bg-background flex-1"
                            />
                            {item.issues.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0"
                                onClick={() => removeIssue(item.id, i)}
                              >
                                <Trash2 className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addIssue(item.id)}
                          className="w-full text-muted-foreground"
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Issue
                        </Button>
                      </div>
                    </div>

                    {/* Panel 3: Our Solution */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <div className="w-6 h-6 rounded-full bg-genie-purple/20 text-genie-purple-light flex items-center justify-center text-xs font-bold">3</div>
                        Our Solution
                        <Lightbulb className="w-4 h-4 text-genie-gold" />
                      </div>
                      <Textarea
                        value={item.ourSolution}
                        onChange={(e) => updateItem(item.id, { ourSolution: e.target.value })}
                        placeholder="Describe how you'll create better ads: stronger CTAs, cleaner design, better targeting..."
                        className="bg-background min-h-[160px]"
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="w-4 h-4 text-genie-purple" />
                        This will appear in the proposal
                      </div>
                    </div>
                  </div>

                  {/* URL Reference */}
                  {item.transparencyUrl && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
                      <ExternalLink className="w-3 h-3" />
                      <a 
                        href={item.transparencyUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors truncate"
                      >
                        {item.transparencyUrl}
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ad Screenshot</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img 
              src={previewImage} 
              alt="Ad preview" 
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Image Annotator */}
      {annotatingItem && annotatingItem.screenshot && (
        <ImageAnnotator
          open={!!annotatingItem}
          imageUrl={annotatingItem.screenshot}
          annotations={annotatingItem.annotations || []}
          onSave={handleSaveAnnotations}
          onClose={() => setAnnotatingItem(null)}
        />
      )}
    </div>
  );
};
