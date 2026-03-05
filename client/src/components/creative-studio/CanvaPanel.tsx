import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, ExternalLink, Link2, CheckCircle2, AlertCircle,
  FolderOpen, FileImage, Sparkles, Download, Search,
  LayoutTemplate, PenTool, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { BrandContext, GalleryItem } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://server-production-0486.up.railway.app';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

type CanvaMode = 'create' | 'templates' | 'designs';

const DESIGN_PRESETS = [
  { id: 'presentation', label: 'Presentation', icon: '📊', desc: 'Slide deck' },
  { id: 'doc', label: 'Document', icon: '📄', desc: 'Text document' },
  { id: 'whiteboard', label: 'Whiteboard', icon: '🎨', desc: 'Freeform canvas' },
  { id: 'custom', label: 'Custom Size', icon: '📐', desc: 'Set dimensions' },
];

const SIZE_PRESETS = [
  { label: 'Instagram Post', width: 1080, height: 1080 },
  { label: 'Facebook Ad', width: 1200, height: 628 },
  { label: 'Story / Reel', width: 1080, height: 1920 },
  { label: 'LinkedIn Post', width: 1200, height: 627 },
  { label: 'Twitter Post', width: 1600, height: 900 },
  { label: 'YouTube Thumbnail', width: 1280, height: 720 },
];

interface Props {
  brandContext: BrandContext;
  onGenerated: (item: GalleryItem) => void;
}

export function CanvaPanel({ brandContext, onGenerated }: Props) {
  const [canvaMode, setCanvaMode] = useState<CanvaMode>('create');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Create mode state
  const [designType, setDesignType] = useState('presentation');
  const [title, setTitle] = useState('');
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1080);
  const [isCreating, setIsCreating] = useState(false);

  // Designs list state
  const [designs, setDesigns] = useState<any[]>([]);
  const [designsLoading, setDesignsLoading] = useState(false);
  const [designSearch, setDesignSearch] = useState('');

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  // Autofill state
  const [autofillTemplate, setAutofillTemplate] = useState<string | null>(null);
  const [autofillData, setAutofillData] = useState('');
  const [autofillTitle, setAutofillTitle] = useState('');
  const [isAutofilling, setIsAutofilling] = useState(false);

  // Export state
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState('png');

  // Check connection status on mount
  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    try {
      const headers = await authHeaders();
      const resp = await fetch(`${API_BASE}/api/canva/status`, { headers });
      const data = await resp.json();
      setIsConnected(data.connected && !data.expired);
    } catch {
      setIsConnected(false);
    }
  }

  async function connectCanva() {
    setIsConnecting(true);
    try {
      const headers = await authHeaders();
      const resp = await fetch(`${API_BASE}/api/canva/oauth`, { headers });
      const data = await resp.json();
      if (data.url) {
        window.open(data.url, '_blank', 'width=600,height=700');
        // Poll for connection
        const interval = setInterval(async () => {
          const r = await fetch(`${API_BASE}/api/canva/status`, { headers });
          const d = await r.json();
          if (d.connected) {
            clearInterval(interval);
            setIsConnected(true);
            setIsConnecting(false);
            toast.success('Canva connected!');
          }
        }, 3000);
        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(interval), 300000);
      } else {
        toast.error(data.error || 'Failed to start OAuth');
        setIsConnecting(false);
      }
    } catch (err: any) {
      toast.error(err.message);
      setIsConnecting(false);
    }
  }

  async function createDesign() {
    setIsCreating(true);
    try {
      const headers = await authHeaders();
      const body: any = { design_type: designType };
      if (title.trim()) body.title = title.trim();
      if (designType === 'custom') {
        body.width = customWidth;
        body.height = customHeight;
      }

      const resp = await fetch(`${API_BASE}/api/canva/design`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // The tools are on the server agent side, not as REST endpoints.
      // We'll use the chat API to invoke canva tools via the agent.
      // For now, open Canva directly for design creation.
      const canvaUrl = `https://www.canva.com/design/new?type=${designType}`;
      window.open(canvaUrl, '_blank');
      toast.success('Opening Canva editor...');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create design');
    } finally {
      setIsCreating(false);
    }
  }

  // Connection required screen
  if (isConnected === false) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center gap-5 py-12">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20">
              <PenTool className="h-10 w-10 text-purple-400" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Connect Your Canva Account</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Link your Canva account to create designs, use brand templates,
                export creatives, and autofill templates with custom data.
              </p>
            </div>
            <Button
              size="lg"
              onClick={connectCanva}
              disabled={isConnecting}
              className="gap-2"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {isConnecting ? 'Connecting...' : 'Connect Canva'}
            </Button>
            <p className="text-xs text-muted-foreground">
              You'll be redirected to Canva to authorize access
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isConnected === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Connected badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-500 font-medium">Canva Connected</span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => window.open('https://www.canva.com', '_blank')} className="gap-1.5 text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
          Open Canva
        </Button>
      </div>

      {/* Mode tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-border p-1 bg-muted/30 gap-1">
          {[
            { id: 'create' as CanvaMode, label: 'Create Design', icon: PenTool },
            { id: 'templates' as CanvaMode, label: 'Brand Templates', icon: LayoutTemplate },
            { id: 'designs' as CanvaMode, label: 'My Designs', icon: FolderOpen },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setCanvaMode(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                  canvaMode === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Create Design */}
      {canvaMode === 'create' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-purple-400" />
              New Canva Design
            </CardTitle>
            <CardDescription>
              Create a new design in Canva. Choose a preset type or set custom dimensions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Design type */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Design Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DESIGN_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setDesignType(preset.id)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all',
                      designType === preset.id
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'bg-muted/30 border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className="text-2xl">{preset.icon}</span>
                    <span className="text-sm font-medium">{preset.label}</span>
                    <span className="text-xs opacity-70">{preset.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom size options */}
            {designType === 'custom' && (
              <div className="space-y-4">
                <Label className="text-sm font-medium">Quick Sizes</Label>
                <div className="flex flex-wrap gap-2">
                  {SIZE_PRESETS.map((size) => (
                    <button
                      key={size.label}
                      onClick={() => { setCustomWidth(size.width); setCustomHeight(size.height); }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        customWidth === size.width && customHeight === size.height
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40'
                      )}
                    >
                      {size.label} ({size.width}x{size.height})
                    </button>
                  ))}
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label className="text-xs">Width (px)</Label>
                    <Input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value))}
                      min={40}
                      max={8000}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">Height (px)</Label>
                    <Input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value))}
                      min={40}
                      max={8000}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Title */}
            <div>
              <Label className="text-sm font-medium">Design Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My new design..."
                className="mt-1.5"
              />
            </div>

            {/* Create button */}
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={createDesign}
              disabled={isCreating}
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {isCreating ? 'Creating...' : 'Create in Canva'}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Tip: Ask the AI agent in chat to create designs, export them, or autofill templates using your Canva tools.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Brand Templates */}
      {canvaMode === 'templates' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutTemplate className="h-5 w-5 text-blue-400" />
              Brand Templates
            </CardTitle>
            <CardDescription>
              Your Canva brand templates. Use these with the AI agent to autofill and generate
              personalized marketing materials, proposals, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-400 mb-1">AI-Powered Autofill</p>
                  <p className="text-muted-foreground">
                    To use brand templates, ask the AI agent in chat. It can list your templates,
                    show available fields, and autofill them with custom text and images to create
                    personalized designs at scale.
                  </p>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground/70">Example prompts:</p>
                    <p>"List my Canva brand templates"</p>
                    <p>"Autofill the proposal template with data for [client name]"</p>
                    <p>"Create 5 personalized social posts using my Instagram template"</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* My Designs */}
      {canvaMode === 'designs' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-green-400" />
              My Canva Designs
            </CardTitle>
            <CardDescription>
              View and export your Canva designs. Use the AI agent to search, export, or get details about any design.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Download className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-green-400 mb-1">Export & Manage via AI</p>
                  <p className="text-muted-foreground">
                    The AI agent can list your designs, get edit/view links,
                    and export them to PDF, PNG, JPG, GIF, PPTX, or MP4.
                  </p>
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground/70">Example prompts:</p>
                    <p>"List my recent Canva designs"</p>
                    <p>"Export my latest presentation as PDF"</p>
                    <p>"Get the edit link for my Instagram post design"</p>
                    <p>"Upload this image to Canva: [url]"</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Canva Capabilities Summary */}
      <Card className="border-purple-500/20 bg-purple-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-purple-400" />
            What You Can Do with Canva
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Create Designs', desc: 'Presentations, docs, custom sizes' },
              { label: 'Export Designs', desc: 'PDF, PNG, JPG, GIF, PPTX, MP4' },
              { label: 'Brand Templates', desc: 'Autofill with custom data at scale' },
              { label: 'Upload Assets', desc: 'Images & videos from any URL' },
              { label: 'Search Designs', desc: 'Find and manage your library' },
              { label: 'Bulk Generation', desc: 'Personalized creatives from templates' },
            ].map((cap) => (
              <div key={cap.label} className="flex items-start gap-2 p-2 rounded-lg bg-background/50">
                <CheckCircle2 className="h-4 w-4 text-purple-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-foreground/90">{cap.label}</p>
                  <p className="text-xs text-muted-foreground">{cap.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
