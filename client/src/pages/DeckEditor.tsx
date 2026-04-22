import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeFormatDate } from '@/lib/dateUtils';
import { Slide, DeckPresentation, contentToSlides } from '@/types/deck';
import { ScaledSlide } from '@/components/deck-editor/ScaledSlide';
import { SlideRenderer } from '@/components/deck-editor/SlideRenderer';
import { SlideThumbnail } from '@/components/deck-editor/SlideThumbnail';
import { PresenterMode } from '@/components/deck-editor/PresenterMode';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Play, ArrowLeft, Save, Loader2, Plus, Trash2,
  MessageSquare, ChevronLeft, ChevronRight, Sparkles,
  PanelLeftClose, PanelLeftOpen, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DeckEditor = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deckId, setDeckId] = useState('');
  const [clientName, setClientName] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [brandPrimary, setBrandPrimary] = useState('#6366f1');
  const [brandSecondary, setBrandSecondary] = useState('#8b5cf6');
  const [clientLogo, setClientLogo] = useState<string | undefined>();

  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPresenting, setIsPresenting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

  // Fetch deck and convert to slides
  useEffect(() => {
    const fetchDeck = async () => {
      if (!slug) return;
      try {
        const { data, error } = await supabase
          .from('decks')
          .select('*')
          .eq('slug', slug)
          .single();

        if (error) throw error;

        let content: Record<string, any> = {};
        try {
          content = typeof data.content === 'string' ? JSON.parse(data.content) : data.content || {};
        } catch { content = {}; }
        let brandColors: Record<string, any> = {};
        try {
          brandColors = typeof data.brand_colors === 'string' ? JSON.parse(data.brand_colors) : data.brand_colors || {};
        } catch { brandColors = {}; }
        const screenshots = Array.isArray(data.screenshots) ? data.screenshots as string[] : [];

        setDeckId(data.id);
        setClientName(data.client_name);
        setBrandPrimary(brandColors.primary || '#6366f1');
        setBrandSecondary(brandColors.secondary || '#8b5cf6');
        setClientLogo(brandColors.logo);
        setDateRange(`${safeFormatDate(data.date_range_start, 'MMMM d')} - ${safeFormatDate(data.date_range_end, 'MMMM d, yyyy')}`);
        setOriginalContent(content);

        // Check if slides already exist in content (must be non-empty)
        if (content.slides && Array.isArray(content.slides) && content.slides.length > 0) {
          setSlides(content.slides);
        } else {
          // Convert legacy content to slides
          const newSlides = contentToSlides(content, {
            clientName: data.client_name,
            dateRange: `${safeFormatDate(data.date_range_start, 'MMMM d')} - ${safeFormatDate(data.date_range_end, 'MMMM d, yyyy')}`,
            brandPrimary: brandColors.primary || '#6366f1',
            brandSecondary: brandColors.secondary || '#8b5cf6',
            clientLogo: brandColors.logo,
            screenshots,
          });
          setSlides(newSlides);
        }
      } catch (err) {
        console.error('Error fetching deck:', err);
        toast({ title: 'Deck Not Found', variant: 'destructive' });
        navigate('/deck-builder');
      } finally {
        setLoading(false);
      }
    };
    fetchDeck();
  }, [slug, navigate, toast]);

  // Save slides to database (preserve original content, merge slides in)
  const [originalContent, setOriginalContent] = useState<Record<string, any>>({});

  const handleSave = async () => {
    setSaving(true);
    try {
      const mergedContent = { ...originalContent, slides };
      const { error } = await supabase
        .from('decks')
        .update({
          content: mergedContent as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deckId);

      if (error) throw error;
      toast({ title: 'Deck saved!' });
    } catch (err) {
      console.error('Save error:', err);
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragSourceIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragSourceIndex === null || dragSourceIndex === targetIndex) {
      setDragOverIndex(null);
      setDragSourceIndex(null);
      return;
    }

    const newSlides = [...slides];
    const [moved] = newSlides.splice(dragSourceIndex, 1);
    newSlides.splice(targetIndex, 0, moved);
    setSlides(newSlides);
    setActiveIndex(targetIndex);
    setDragOverIndex(null);
    setDragSourceIndex(null);
  };

  // Slide operations
  const toggleHidden = (index: number) => {
    setSlides(prev => prev.map((s, i) => i === index ? { ...s, hidden: !s.hidden } : s));
  };

  const deleteSlide = (index: number) => {
    setSlides(prev => prev.filter((_, i) => i !== index));
    if (activeIndex >= slides.length - 1) setActiveIndex(Math.max(0, slides.length - 2));
  };

  const addBlankSlide = () => {
    const newSlide: Slide = {
      id: `slide-${Date.now()}`,
      type: 'blank',
      title: 'New Slide',
      data: {},
    };
    const insertAt = activeIndex + 1;
    setSlides(prev => [...prev.slice(0, insertAt), newSlide, ...prev.slice(insertAt)]);
    setActiveIndex(insertAt);
  };

  const updateSlideNotes = (notes: string) => {
    setSlides(prev => prev.map((s, i) => i === activeIndex ? { ...s, notes } : s));
  };

  const updateSlideTitle = (title: string) => {
    setSlides(prev => prev.map((s, i) => i === activeIndex ? { ...s, title } : s));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (isPresenting) return;
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(i => Math.max(0, i - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(i => Math.min(slides.length - 1, i + 1));
          break;
        case 'F5':
          e.preventDefault();
          setIsPresenting(true);
          break;
        case 'Delete':
          if (slides.length > 1) deleteSlide(activeIndex);
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeIndex, slides.length, isPresenting]);

  const activeSlide = slides[activeIndex] || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading deck...</p>
        </div>
      </div>
    );
  }

  if (isPresenting) {
    return (
      <PresenterMode
        slides={slides}
        initialSlide={activeIndex}
        brandPrimary={brandPrimary}
        brandSecondary={brandSecondary}
        clientLogo={clientLogo}
        onExit={() => setIsPresenting(false)}
      />
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top toolbar */}
      <header className="h-14 border-b border-border/40 bg-card/80 backdrop-blur-xl flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(slug ? `/deck/${slug}` : '/decks')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">{clientName}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-muted-foreground text-xs">{dateRange}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(o => !o)} className="text-xs">
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setNotesOpen(o => !o)} className="text-xs gap-1.5">
            <MessageSquare className="w-4 h-4" />
            Notes
          </Button>
          <div className="h-5 w-px bg-border mx-1" />
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving} className="text-xs gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
          <Button onClick={() => setIsPresenting(true)} size="sm" className="gap-1.5 text-xs">
            <Play className="w-4 h-4" />
            Present
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Slide thumbnail sidebar */}
        {sidebarOpen && (
          <div className="w-52 border-r border-border/40 bg-card/30 flex flex-col overflow-hidden flex-shrink-0">
            <div className="p-2 border-b border-border/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">{slides.length} slides</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addBlankSlide}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-2 space-y-2">
              {slides.map((slide, i) => (
                <SlideThumbnail
                  key={slide.id}
                  slide={slide}
                  index={i}
                  isActive={i === activeIndex}
                  brandPrimary={brandPrimary}
                  brandSecondary={brandSecondary}
                  clientLogo={clientLogo}
                  onClick={() => setActiveIndex(i)}
                  onToggleHidden={() => toggleHidden(i)}
                  onDragStart={handleDragStart(i)}
                  onDragOver={handleDragOver(i)}
                  onDrop={handleDrop(i)}
                  isDragOver={dragOverIndex === i}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main canvas */}
        <div className="flex-1 flex flex-col bg-zinc-950/50 overflow-hidden">
          {/* Slide canvas */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="w-full max-w-5xl aspect-video rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              {activeSlide ? (
                <ScaledSlide className="w-full h-full" fillContainer>
                  <SlideRenderer
                    slide={activeSlide}
                    brandPrimary={brandPrimary}
                    brandSecondary={brandSecondary}
                    clientLogo={clientLogo}
                    animate
                  />
                </ScaledSlide>
              ) : (
                <div className="w-full h-full bg-[#0a0a14] flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <p className="text-white/30 text-lg">No slides yet</p>
                    <Button variant="outline" size="sm" onClick={addBlankSlide} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Add a slide
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom slide nav */}
          <div className="h-10 flex items-center justify-center gap-4 border-t border-border/20 bg-card/30 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveIndex(i => Math.max(0, i - 1))} disabled={activeIndex === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {activeIndex + 1} / {slides.length}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setActiveIndex(i => Math.min(slides.length - 1, i + 1))} disabled={activeIndex === slides.length - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right panel: Notes & Slide properties */}
        {notesOpen && (
          <div className="w-72 border-l border-border/40 bg-card/30 flex flex-col overflow-hidden flex-shrink-0">
            <div className="p-3 border-b border-border/20">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Slide Properties</h3>
            </div>
            <div className="p-3 space-y-4 overflow-auto flex-1">
              {/* Title */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={activeSlide?.title || ''}
                  onChange={(e) => updateSlideTitle(e.target.value)}
                  className="h-8 text-xs bg-background/50"
                />
              </div>

              {/* Type badge */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
                  {activeSlide?.type}
                </span>
              </div>

              {/* Speaker Notes */}
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Speaker Notes</label>
                <Textarea
                  value={activeSlide?.notes || ''}
                  onChange={(e) => updateSlideNotes(e.target.value)}
                  placeholder="Add notes for this slide..."
                  className="min-h-[200px] text-xs bg-background/50 resize-none"
                />
              </div>

              {/* Delete button */}
              {slides.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive text-xs gap-1.5"
                  onClick={() => deleteSlide(activeIndex)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Slide
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeckEditor;
