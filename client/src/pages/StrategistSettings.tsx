import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminHeader from '@/components/AdminHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import {
  Brain, Save, Trash2, Plus, Search, RefreshCw, Rocket, Pencil,
  CheckCircle, XCircle, Clock, Shield, Zap, BarChart3,
  AlertTriangle, Filter, ChevronDown, ChevronUp,
  FileUp, FileText, BookOpen, Eye, Loader2, Database, Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ApiWebhooksTab from '@/components/ApiWebhooksTab';

// ─── Training Tab ─────────────────────────────────────────────────────────────

function TrainingTab() {
  const queryClient = useQueryClient();
  const [instructions, setInstructions] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['strategist-config', 'custom_instructions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategist_config')
        .select('*')
        .eq('config_key', 'custom_instructions')
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setInstructions(config.config_value || '');
      setDirty(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase
        .from('strategist_config')
        .update({ config_value: value, updated_at: new Date().toISOString() })
        .eq('config_key', 'custom_instructions');
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategist-config'] });
      setDirty(false);
      toast({ title: 'Saved', description: 'Custom instructions updated. They will be used on the next Strategist run.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Custom Training Instructions
          </CardTitle>
          <CardDescription>
            These instructions are injected into every Strategist run (manual and fleet). Use them to teach the AI your agency's preferences, client-specific rules, and optimization philosophy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={instructions}
            onChange={(e) => { setInstructions(e.target.value); setDirty(true); }}
            placeholder={`Examples:\n- For dental clients, always prioritize call conversions over form fills\n- Never recommend lowering bids below $2 for legal keywords\n- When ROAS is below 3x for e-commerce, flag as high priority\n- Always check impression share before recommending bid increases`}
            className="min-h-[300px] font-mono text-sm"
            disabled={isLoading}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {instructions.length} characters • Last updated: {config?.updated_at ? format(new Date(config.updated_at), 'MMM d, yyyy h:mm a') : 'Never'}
            </p>
            <Button
              onClick={() => saveMutation.mutate(instructions)}
              disabled={!dirty || saveMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Instructions'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            {[
              { step: '1', title: 'Write', desc: 'Add your rules and preferences above' },
              { step: '2', title: 'Save', desc: 'Instructions are stored securely' },
              { step: '3', title: 'Inject', desc: 'Appended to AI prompt on every run' },
              { step: '4', title: 'Improve', desc: 'Monitor results, refine over time' },
            ].map((s) => (
              <div key={s.step} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Research Sources */}
      <ResearchSourcesSection />
    </div>
  );
}

// ─── Research Sources Section ──────────────────────────────────────────────────

function ResearchSourcesSection() {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState('');
  const [domains, setDomains] = useState('');
  const [names, setNames] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['managed-clients-list'],
    queryFn: async () => {
      const { data } = await supabase
        .from('managed_clients')
        .select('client_name')
        .order('client_name');
      return (data || []).map((c: any) => c.client_name);
    },
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ppc-client-settings', selectedClient],
    enabled: !!selectedClient,
    queryFn: async () => {
      const { data } = await supabase
        .from('ppc_client_settings')
        .select('competitor_domains, competitor_names')
        .eq('client_name', selectedClient)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setDomains((settings.competitor_domains || []).join(', '));
      setNames((settings.competitor_names || []).join(', '));
      setDirty(false);
    } else if (selectedClient) {
      setDomains('');
      setNames('');
      setDirty(false);
    }
  }, [settings, selectedClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const competitorDomains = domains.split(',').map(d => d.trim()).filter(Boolean);
      const competitorNames = names.split(',').map(n => n.trim()).filter(Boolean);

      const { data: existing } = await supabase
        .from('ppc_client_settings')
        .select('id')
        .eq('client_name', selectedClient)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('ppc_client_settings')
          .update({ competitor_domains: competitorDomains, competitor_names: competitorNames })
          .eq('client_name', selectedClient);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ppc_client_settings')
          .insert({ client_name: selectedClient, competitor_domains: competitorDomains, competitor_names: competitorNames });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ppc-client-settings'] });
      setDirty(false);
      toast({ title: 'Saved', description: 'Competitor research sources updated. Research runs on Mondays during fleet runs.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Competitor Research Sources
        </CardTitle>
        <CardDescription>
          Set competitor domains and company names per client. The Strategist will research these competitors every Monday during fleet runs and use the insights to inform PPC strategy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select a client..." /></SelectTrigger>
          <SelectContent>
            {clients.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {selectedClient && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Competitor Domains (comma-separated)</label>
              <Input
                value={domains}
                onChange={(e) => { setDomains(e.target.value); setDirty(true); }}
                placeholder="competitor1.com, competitor2.com"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Used for SEO keyword and traffic analysis</p>
            </div>
            <div>
              <label className="text-sm font-medium">Competitor Company Names (comma-separated)</label>
              <Input
                value={names}
                onChange={(e) => { setNames(e.target.value); setDirty(true); }}
                placeholder="Competitor Inc, Rival LLC"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Used for ad transparency and creative analysis</p>
            </div>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              size="sm"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Research Sources'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Knowledge Base Tab ───────────────────────────────────────────────────────

function KnowledgeBaseTab() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ['strategist-knowledge-docs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('strategist_knowledge_docs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: { id: string; file_url: string }) => {
      // Extract storage path from URL
      const urlParts = doc.file_url.split('/strategist-knowledge/');
      if (urlParts[1]) {
        await supabase.storage.from('strategist-knowledge').remove([decodeURIComponent(urlParts[1])]);
      }
      const { error } = await supabase.from('strategist_knowledge_docs').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strategist-knowledge-docs'] });
      toast({ title: 'Document deleted' });
    },
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const allowed = ['pdf', 'txt', 'csv', 'md', 'doc', 'docx', 'xls', 'xlsx'];
        if (!allowed.includes(ext || '')) {
          toast({ title: 'Unsupported file', description: `${file.name} — only PDF, TXT, CSV, MD, DOC, XLS supported`, variant: 'destructive' });
          continue;
        }

        if (file.size > 20 * 1024 * 1024) {
          toast({ title: 'File too large', description: `${file.name} exceeds 20MB limit`, variant: 'destructive' });
          continue;
        }

        // Upload to storage
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadErr } = await supabase.storage
          .from('strategist-knowledge')
          .upload(path, file);

        if (uploadErr) {
          toast({ title: 'Upload failed', description: uploadErr.message, variant: 'destructive' });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('strategist-knowledge')
          .getPublicUrl(path);

        // Create DB record
        const { data: docRow, error: dbErr } = await supabase
          .from('strategist_knowledge_docs')
          .insert({
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            category: 'processing',
          })
          .select()
          .single();

        if (dbErr) {
          toast({ title: 'DB error', description: dbErr.message, variant: 'destructive' });
          continue;
        }

        // Trigger parsing
        supabase.functions.invoke('parse-knowledge-doc', {
          body: { docId: docRow.id, fileUrl: urlData.publicUrl, fileName: file.name },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['strategist-knowledge-docs'] });
        }).catch((e) => {
          console.error('Parse error:', e);
        });

        toast({ title: 'Uploaded', description: `${file.name} is being processed by AI...` });
      }

      queryClient.invalidateQueries({ queryKey: ['strategist-knowledge-docs'] });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const categoryColors: Record<string, string> = {
    performance_report: 'bg-blue-500/10 text-blue-600 border-blue-200',
    strategy_doc: 'bg-purple-500/10 text-purple-600 border-purple-200',
    benchmark_data: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    client_brief: 'bg-amber-500/10 text-amber-600 border-amber-200',
    training_material: 'bg-pink-500/10 text-pink-600 border-pink-200',
    processing: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    general: 'bg-muted text-muted-foreground',
    other: 'bg-muted text-muted-foreground',
  };

  const totalKnowledge = docs.reduce((sum, d) => sum + (d.parsed_content?.length || 0), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge Base
          </CardTitle>
          <CardDescription>
            Upload PDFs, reports, and strategy documents. The AI will parse and extract key insights to reference during every Strategist analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload zone */}
          <div
            className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleUpload(e.dataTransfer.files); }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.csv,.md,.doc,.docx,.xls,.xlsx"
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Uploading & parsing...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground">PDF, TXT, CSV, MD, DOC, XLS • Max 20MB each</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Database className="h-3.5 w-3.5" /> {docs.length} documents</span>
            <span>•</span>
            <span>{(totalKnowledge / 1000).toFixed(0)}K characters of knowledge</span>
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      {docs.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead className="w-[120px]">Category</TableHead>
                    <TableHead className="w-[100px]">Size</TableHead>
                    <TableHead className="w-[120px]">Uploaded</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc) => {
                    const isParsed = doc.parsed_content && doc.parsed_content.length > 50;
                    const isProcessing = doc.category === 'processing';
                    return (
                      <TableRow
                        key={doc.id}
                        className="group cursor-pointer"
                        onClick={() => setExpandedDoc(expandedDoc === doc.id ? null : doc.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-sm font-medium truncate max-w-[300px]">{doc.file_name}</p>
                              {doc.summary && doc.summary !== `Uploaded: ${doc.file_name}` && (
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">{doc.summary}</p>
                              )}
                            </div>
                          </div>
                          {expandedDoc === doc.id && doc.parsed_content && (
                            <div className="mt-3 p-3 bg-muted/50 rounded-md max-h-[300px] overflow-auto">
                              <pre className="text-xs whitespace-pre-wrap font-mono">{doc.parsed_content.slice(0, 3000)}</pre>
                              {doc.parsed_content.length > 3000 && (
                                <p className="text-xs text-muted-foreground mt-2">...{(doc.parsed_content.length - 3000).toLocaleString()} more characters</p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${categoryColors[doc.category || 'general'] || ''}`}>
                            {(doc.category || 'general').replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)}KB` : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(doc.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                          ) : isParsed ? (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Delete "${doc.file_name}"?`)) {
                                deleteMutation.mutate({ id: doc.id, file_url: doc.file_url });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How Knowledge Docs Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              { icon: FileUp, title: 'Upload', desc: 'Drop PDFs, reports, or spreadsheets with performance data and strategy notes' },
              { icon: Brain, title: 'AI Parses', desc: 'Extracts metrics, strategies, rules, and benchmarks from your documents' },
              { icon: Zap, title: 'Injected', desc: 'Key insights are included in every Strategist run as reference material' },
            ].map((s) => (
              <div key={s.title} className="flex gap-3 items-start">
                <s.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Memory Tab ───────────────────────────────────────────────────────────────

function MemoryTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newMemory, setNewMemory] = useState({ client_name: '', content: '', memory_type: 'recommendation' });
  const [showAdd, setShowAdd] = useState(false);

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ['ai-memories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_ai_memory')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: memoryCapConfig } = useQuery({
    queryKey: ['strategist-config', 'memory_cap_per_client'],
    queryFn: async () => {
      const { data } = await supabase
        .from('strategist_config')
        .select('config_value')
        .eq('config_key', 'memory_cap_per_client')
        .single();
      return data?.config_value ? parseInt(data.config_value) : 40;
    },
  });

  const memoryCap = memoryCapConfig || 40;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_ai_memory').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] });
      toast({ title: 'Memory deleted' });
    },
  });

  const clearClientMutation = useMutation({
    mutationFn: async (clientName: string) => {
      const { error } = await supabase.from('client_ai_memory').delete().eq('client_name', clientName);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] });
      toast({ title: 'All memories cleared for client' });
    },
  });

  const [editingMemory, setEditingMemory] = useState<{ id: string; content: string } | null>(null);

  const editMemoryMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase.from('client_ai_memory').update({ content }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] });
      setEditingMemory(null);
      toast({ title: 'Memory updated' });
    },
  });

  const addMemoryMutation = useMutation({
    mutationFn: async (mem: { client_name: string; content: string; memory_type: string }) => {
      const { error } = await supabase.from('client_ai_memory').insert({
        client_name: mem.client_name,
        content: mem.content,
        memory_type: mem.memory_type,
        source: 'manual',
        relevance_score: 1.0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-memories'] });
      setNewMemory({ client_name: '', content: '', memory_type: 'recommendation' });
      setShowAdd(false);
      toast({ title: 'Memory added' });
    },
  });

  const clients = [...new Set(memories.map((m) => m.client_name))].sort();
  const types = [...new Set(memories.map((m) => m.memory_type))].sort();

  const filtered = memories.filter((m) => {
    if (clientFilter !== 'all' && m.client_name !== clientFilter) return false;
    if (typeFilter !== 'all' && m.memory_type !== typeFilter) return false;
    if (search && !m.content.toLowerCase().includes(search.toLowerCase()) && !m.client_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const clientCounts = clients.map((c) => ({
    name: c,
    count: memories.filter((m) => m.client_name === c).length,
  })).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Clients" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients ({memories.length})</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c} value={c}>{c} ({memories.filter((m) => m.client_name === c).length})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Memory
        </Button>
        {clientFilter !== 'all' && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Clear ALL memories for ${clientFilter}? This cannot be undone.`)) {
                clearClientMutation.mutate(clientFilter);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Clear Client
          </Button>
        )}
      </div>

      {/* Add Memory Form */}
      {showAdd && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={newMemory.client_name || ''} onValueChange={(v) => setNewMemory({ ...newMemory, client_name: v })}>
                <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newMemory.memory_type} onValueChange={(v) => setNewMemory({ ...newMemory, memory_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommendation">💡 Recommendation</SelectItem>
                  <SelectItem value="observation">📊 Observation</SelectItem>
                  <SelectItem value="win">✅ Win</SelectItem>
                  <SelectItem value="concern">⚠️ Concern</SelectItem>
                  <SelectItem value="metric_snapshot">📈 Metric Snapshot</SelectItem>
                  <SelectItem value="strategy_note">🧠 Strategy Note</SelectItem>
                  <SelectItem value="benchmark">📏 Benchmark</SelectItem>
                  <SelectItem value="strategist_learning">🎓 Strategist Learning</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => addMemoryMutation.mutate(newMemory)}
                disabled={!newMemory.client_name || !newMemory.content || addMemoryMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                {addMemoryMutation.isPending ? 'Adding...' : 'Add'}
              </Button>
            </div>
            <Textarea
              value={newMemory.content}
              onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
              placeholder="Enter memory content... e.g. 'Client prefers aggressive bidding on brand terms' or 'ROAS target is 4x for all campaigns'"
              className="min-h-[80px] text-sm"
            />
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 flex-wrap">
        {clientCounts.slice(0, 10).map((c) => (
          <Badge
            key={c.name}
            variant={c.count >= memoryCap - 5 ? 'destructive' : c.count >= memoryCap - 15 ? 'secondary' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setClientFilter(c.name)}
          >
            {c.name}: {c.count}/{memoryCap}
          </Badge>
        ))}
        {clientCounts.length > 10 && <Badge variant="outline">+{clientCounts.length - 10} more</Badge>}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Client</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead className="w-[80px]">Score</TableHead>
                  <TableHead className="w-[70px]">Source</TableHead>
                  <TableHead className="w-[100px]">Updated</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No memories found</TableCell></TableRow>
                ) : (
                  filtered.slice(0, 100).map((m) => (
                    <TableRow key={m.id} className="group cursor-pointer" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}>
                      <TableCell className="font-medium text-xs">{m.client_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {m.memory_type === 'win' ? '✅' : m.memory_type === 'concern' ? '⚠️' : m.memory_type === 'recommendation' ? '💡' : m.memory_type === 'strategy_note' ? '🧠' : m.memory_type === 'benchmark' ? '📏' : m.memory_type === 'strategist_learning' ? '🎓' : m.memory_type === 'competitive_research' ? '🔍' : '📊'} {m.memory_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[400px]">
                        {editingMemory?.id === m.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Textarea
                              value={editingMemory.content}
                              onChange={(e) => setEditingMemory({ ...editingMemory, content: e.target.value })}
                              className="min-h-[60px] text-xs"
                            />
                            <div className="flex flex-col gap-1">
                              <Button size="sm" className="h-6 px-2 text-[10px]" onClick={() => editMemoryMutation.mutate({ id: m.id, content: editingMemory.content })} disabled={editMemoryMutation.isPending}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setEditingMemory(null)}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          expandedId === m.id ? m.content : m.content.slice(0, 120) + (m.content.length > 120 ? '...' : '')
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{Number(m.relevance_score).toFixed(1)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{m.source || '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(m.updated_at), 'MMM d')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); setEditingMemory({ id: m.id, content: m.content }); }}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(m.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Showing {Math.min(filtered.length, 100)} of {filtered.length} memories • Cap: {memoryCap}/client</p>
    </div>
  );
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

function PerformanceTab() {
  const { data: sessions = [] } = useQuery({
    queryKey: ['strategist-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ppc_optimization_sessions')
        .select('id, client_name, platform, status, created_at, auto_mode')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: changes = [] } = useQuery({
    queryKey: ['strategist-changes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ppc_proposed_changes')
        .select('id, change_type, confidence, approval_status, executed_at, client_name, priority')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ['strategist-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ppc_change_results')
        .select('change_id, outcome')
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  const totalSessions = sessions.length;
  const totalChanges = changes.length;
  const approved = changes.filter((c) => c.approval_status === 'approved').length;
  const executed = changes.filter((c) => c.executed_at).length;
  const approvalRate = totalChanges > 0 ? ((approved / totalChanges) * 100).toFixed(0) : '0';
  const executionRate = approved > 0 ? ((executed / approved) * 100).toFixed(0) : '0';

  const improved = results.filter((r) => r.outcome === 'improved' || r.outcome === 'positive').length;
  const declined = results.filter((r) => r.outcome === 'declined' || r.outcome === 'negative').length;
  const noChange = results.filter((r) => r.outcome === 'no_change').length;
  const winRate = (improved + declined) > 0 ? ((improved / (improved + declined)) * 100).toFixed(0) : 'N/A';

  const outcomeData = [
    { name: 'Improved', value: improved, color: 'hsl(var(--chart-2))' },
    { name: 'Declined', value: declined, color: 'hsl(var(--destructive))' },
    { name: 'No Change', value: noChange, color: 'hsl(var(--muted-foreground))' },
  ].filter((d) => d.value > 0);

  const changeTypeBreakdown = Object.entries(
    changes.reduce<Record<string, number>>((acc, c) => {
      acc[c.change_type] = (acc[c.change_type] || 0) + 1;
      return acc;
    }, {})
  ).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);

  const clientBreakdown = Object.entries(
    changes.reduce<Record<string, { total: number; executed: number }>>((acc, c) => {
      if (!acc[c.client_name]) acc[c.client_name] = { total: 0, executed: 0 };
      acc[c.client_name].total++;
      if (c.executed_at) acc[c.client_name].executed++;
      return acc;
    }, {})
  ).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Sessions', value: totalSessions, icon: BarChart3 },
          { label: 'Changes Proposed', value: totalChanges, icon: Zap },
          { label: 'Approval Rate', value: `${approvalRate}%`, icon: CheckCircle },
          { label: 'Execution Rate', value: `${executionRate}%`, icon: Rocket },
          { label: 'Win Rate', value: winRate === 'N/A' ? winRate : `${winRate}%`, icon: Brain },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <stat.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Outcome Distribution</CardTitle></CardHeader>
          <CardContent>
            {outcomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={outcomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`}>
                    {outcomeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No outcome data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Changes by Type</CardTitle></CardHeader>
          <CardContent>
            {changeTypeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={changeTypeBreakdown} layout="vertical">
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="type" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No changes yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success rate over time (last 30 days) */}
      {(() => {
        // Group results by week to show success rate trend
        const resultsByChangeId = new Map(results.map(r => [r.change_id, r.outcome]));
        const executedChanges = changes.filter(c => c.executed_at).map(c => ({
          date: c.executed_at!.split('T')[0],
          outcome: resultsByChangeId.get(c.id) || 'pending',
        }));

        // Group by week
        const weekMap = new Map<string, { improved: number; total: number }>();
        for (const ec of executedChanges) {
          const d = new Date(ec.date);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          const key = weekStart.toISOString().split('T')[0];
          if (!weekMap.has(key)) weekMap.set(key, { improved: 0, total: 0 });
          const entry = weekMap.get(key)!;
          entry.total++;
          if (ec.outcome === 'improved' || ec.outcome === 'positive') entry.improved++;
        }

        const chartData = [...weekMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-8)
          .map(([week, data]) => ({
            week: week.slice(5), // MM-DD
            'Win Rate': data.total > 0 ? Math.round((data.improved / data.total) * 100) : 0,
            'Total Changes': data.total,
          }));

        if (chartData.length < 2) return null;

        return (
          <Card>
            <CardHeader><CardTitle className="text-sm">Success Rate Over Time</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="Win Rate" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      <Card>
        <CardHeader><CardTitle className="text-sm">Per-Client Breakdown</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Proposed</TableHead>
                  <TableHead className="text-right">Executed</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientBreakdown.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-right">{c.total}</TableCell>
                    <TableCell className="text-right">{c.executed}</TableCell>
                    <TableCell className="text-right">{c.total > 0 ? ((c.executed / c.total) * 100).toFixed(0) : 0}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Safety Tab ───────────────────────────────────────────────────────────────

function SafetyTab() {
  const blockedTypes = [
    'reallocate_budget', 'budget_adjustment', 'pause_campaign',
    'pause_ad', 'pause_ad_set', 'pause_keyword', 'status_change', 'enable_campaign',
  ];
  const budgetKeys = [
    'daily_budget', 'budget', 'lifetime_budget', 'campaign_budget',
    'approx_daily_budget', 'total_budget', 'monthly_budget',
  ];
  const allowedTypes = [
    'adjust_bid', 'add_negative_keyword', 'change_match_type',
    'flag_creative_issue', 'flag_keyword_opportunity',
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            Blocked Change Types
          </CardTitle>
          <CardDescription>These change types are automatically stripped from AI output before storage. The AI is also instructed never to propose them.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {blockedTypes.map((t) => (
              <Badge key={t} variant="destructive" className="font-mono text-xs">{t}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-accent-foreground" />
            Blocked Budget Keys
          </CardTitle>
          <CardDescription>Any after_value containing these keys will be rejected.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {budgetKeys.map((k) => (
              <Badge key={k} variant="secondary" className="font-mono text-xs">{k}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Allowed Change Types
          </CardTitle>
          <CardDescription>Only these change types are permitted through the safety filter.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {allowedTypes.map((t) => (
              <Badge key={t} variant="outline" className="font-mono text-xs border-primary/30 text-primary">{t}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Fleet Tab ────────────────────────────────────────────────────────────────

function FleetTab() {
  const queryClient = useQueryClient();
  const [triggering, setTriggering] = useState(false);

  const { data: fleetJobs = [], isLoading } = useQuery({
    queryKey: ['fleet-jobs-strategist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_run_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  const triggerFleet = useCallback(async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.functions.invoke('run-full-fleet', {
        body: { mode: 'orchestrator' },
      });
      if (error) throw error;
      toast({ title: 'Fleet run started', description: `Job ID: ${data?.jobId?.slice(0, 8)}...` });
      queryClient.invalidateQueries({ queryKey: ['fleet-jobs-strategist'] });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally {
      setTriggering(false);
    }
  }, [queryClient]);

  const cronQuery = useQuery({
    queryKey: ['cron-status-strategist'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cron_status');
      if (error) throw error;
      return data as any[];
    },
  });

  const strategistCron = (cronQuery.data || []).find((j: any) => j.jobname?.includes('strategist') || j.jobname?.includes('fleet'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Fleet Runs</h3>
          <p className="text-sm text-muted-foreground">
            {strategistCron
              ? `Cron: ${strategistCron.schedule} • Last: ${strategistCron.last_status || 'N/A'}`
              : 'No cron schedule detected'}
          </p>
        </div>
        <Button onClick={triggerFleet} disabled={triggering}>
          <Rocket className="h-4 w-4 mr-2" />
          {triggering ? 'Starting...' : 'Run Full Fleet Now'}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : fleetJobs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No fleet runs yet</TableCell></TableRow>
                ) : (
                  fleetJobs.map((job) => {
                    const results = Array.isArray(job.results) ? job.results : [];
                    const successes = results.filter((r: any) => r.status === 'success').length;
                    const errors = results.filter((r: any) => r.status === 'error').length;
                    const skipped = results.filter((r: any) => r.status === 'skipped').length;
                    const duration = job.completed_at
                      ? `${Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)}s`
                      : 'Running...';

                    return (
                      <TableRow key={job.id}>
                        <TableCell className="text-xs">{format(new Date(job.created_at), 'MMM d, h:mm a')}</TableCell>
                        <TableCell>
                          <Badge variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : 'secondary'}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{job.progress}/{job.total_clients}</TableCell>
                        <TableCell className="text-sm">{duration}</TableCell>
                        <TableCell className="text-xs">
                          {successes > 0 && <span className="text-primary mr-2">✓{successes}</span>}
                          {errors > 0 && <span className="text-destructive mr-2">✗{errors}</span>}
                          {skipped > 0 && <span className="text-muted-foreground">⊘{skipped}</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StrategistSettings() {
  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            The Strategist — Control Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage, train, and monitor the AI PPC Strategy Bot
          </p>
        </div>

        <Tabs defaultValue="training" className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full max-w-[840px]">
            <TabsTrigger value="training" className="text-xs"><Brain className="h-3.5 w-3.5 mr-1" />Training</TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs"><BookOpen className="h-3.5 w-3.5 mr-1" />Knowledge</TabsTrigger>
            <TabsTrigger value="memory" className="text-xs"><Database className="h-3.5 w-3.5 mr-1" />Memory</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs"><BarChart3 className="h-3.5 w-3.5 mr-1" />Performance</TabsTrigger>
            <TabsTrigger value="safety" className="text-xs"><Shield className="h-3.5 w-3.5 mr-1" />Safety</TabsTrigger>
            <TabsTrigger value="fleet" className="text-xs"><Rocket className="h-3.5 w-3.5 mr-1" />Fleet</TabsTrigger>
            <TabsTrigger value="api" className="text-xs"><Globe className="h-3.5 w-3.5 mr-1" />API & Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="training"><TrainingTab /></TabsContent>
          <TabsContent value="knowledge"><KnowledgeBaseTab /></TabsContent>
          <TabsContent value="memory"><MemoryTab /></TabsContent>
          <TabsContent value="performance"><PerformanceTab /></TabsContent>
          <TabsContent value="safety"><SafetyTab /></TabsContent>
          <TabsContent value="fleet"><FleetTab /></TabsContent>
          <TabsContent value="api"><ApiWebhooksTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
