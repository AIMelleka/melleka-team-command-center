import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CalendarCheck, Loader2, Settings, Send, Trash2, Eye, Pencil, X,
  Plus, Check, RefreshCw, Zap, Mail, MessageSquare, Clock, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { streamMessage, type SSEEvent } from '@/lib/chatApi';
import AdminHeader from '@/components/AdminHeader';

// ── API base ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api';

async function getFreshToken(): Promise<string> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || (session.expires_at && session.expires_at * 1000 - Date.now() < 60_000)) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session;
  }
  return session?.access_token || '';
}

async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = await getFreshToken();
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers as Record<string, string> ?? {}),
    },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface WUSettings {
  id?: string;
  master_prompt: string;
  slack_channel: string;
  email_recipients: string[];
  send_slack: boolean;
  send_email: boolean;
  auto_enabled: boolean;
}

interface WUClient {
  id: string;
  client_name: string;
  enabled: boolean;
  added_at: string;
}

interface WUReport {
  id: string;
  client_name: string;
  date_range_start: string;
  date_range_end: string;
  status: 'generating' | 'complete' | 'sent' | 'error';
  sent_via: string[];
  created_at: string;
  html_content?: string;
  plain_text?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const HTML_START_MARKER = '<!-- CLIENT_UPDATE_HTML_START -->';
const HTML_END_MARKER = '<!-- CLIENT_UPDATE_HTML_END -->';

function extractHtmlFromText(text: string): string | null {
  const endIdx = text.lastIndexOf(HTML_END_MARKER);
  if (endIdx !== -1) {
    const startIdx = text.lastIndexOf(HTML_START_MARKER, endIdx);
    if (startIdx !== -1) {
      return text.slice(startIdx + HTML_START_MARKER.length, endIdx).trim();
    }
  }
  const docTypeMatch = text.match(/<!DOCTYPE html[\s\S]*?<\/html>/i);
  if (docTypeMatch) return docTypeMatch[0].trim();
  const htmlTagMatch = text.match(/<html[\s\S]*?<\/html>/i);
  if (htmlTagMatch) return htmlTagMatch[0].trim();
  const codeBlock = text.match(/```html\s*\n([\s\S]*?)```/);
  if (codeBlock && codeBlock[1].includes('<html')) return codeBlock[1].trim();
  return null;
}

function getLastMonday(): string {
  const now = new Date();
  const monday = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

function getLastSunday(): string {
  const now = new Date();
  const monday = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
  const sunday = endOfWeek(monday, { weekStartsOn: 1 });
  return format(sunday, 'yyyy-MM-dd');
}

const STATUS_COLORS: Record<string, string> = {
  generating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  complete: 'bg-green-500/20 text-green-400 border-green-500/30',
  sent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  generating: 'Generating',
  complete: 'Ready',
  sent: 'Sent',
  error: 'Error',
  'not-run': 'Not Run',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyClientUpdates() {
  const { toast } = useToast();

  // Date range — defaults to last Mon-Sun
  const [startDate, setStartDate] = useState(getLastMonday);
  const [endDate, setEndDate] = useState(getLastSunday);

  // Settings
  const [settings, setSettings] = useState<WUSettings>({
    master_prompt: '',
    slack_channel: '',
    email_recipients: [],
    send_slack: false,
    send_email: false,
    auto_enabled: false,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [emailRecipientsInput, setEmailRecipientsInput] = useState('');

  // Tagged clients
  const [taggedClients, setTaggedClients] = useState<WUClient[]>([]);
  const [allClients, setAllClients] = useState<string[]>([]);
  const [addClientInput, setAddClientInput] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [addingClient, setAddingClient] = useState(false);

  // Reports
  const [reports, setReports] = useState<WUReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Generation state
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [generatingClients, setGeneratingClients] = useState<Set<string>>(new Set());
  const [streamTexts, setStreamTexts] = useState<Record<string, string>>({});

  // HTML editor state
  const [editingReport, setEditingReport] = useState<WUReport | null>(null);
  const [editHtml, setEditHtml] = useState('');
  const [editPlainText, setEditPlainText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [sendingReport, setSendingReport] = useState<string | null>(null);
  const [testingSlack, setTestingSlack] = useState(false);

  const abortRefs = useRef<Map<string, () => void>>(new Map());

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      const res = await apiFetch('/weekly-updates/settings');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.id) {
        setSettings({
          master_prompt: data.master_prompt ?? '',
          slack_channel: data.slack_channel ?? '',
          email_recipients: data.email_recipients ?? [],
          send_slack: data.send_slack ?? false,
          send_email: data.send_email ?? false,
          auto_enabled: data.auto_enabled ?? false,
        });
        setEmailRecipientsInput((data.email_recipients ?? []).join(', '));
      }
    } catch { /* noop */ } finally {
      setSettingsLoaded(true);
    }
  }, []);

  const loadTaggedClients = useCallback(async () => {
    try {
      const res = await apiFetch('/weekly-updates/clients');
      if (!res.ok) return;
      setTaggedClients(await res.json());
    } catch { /* noop */ }
  }, []);

  const loadAllClients = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('managed_clients')
        .select('client_name')
        .eq('is_active', true)
        .order('client_name');
      setAllClients((data ?? []).map((c: any) => c.client_name));
    } catch { /* noop */ }
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const res = await apiFetch(`/weekly-updates/reports?${params}`);
      if (!res.ok) return;
      setReports(await res.json());
    } catch { /* noop */ } finally {
      setLoadingReports(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    loadSettings();
    loadTaggedClients();
    loadAllClients();
  }, [loadSettings, loadTaggedClients, loadAllClients]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // ── Settings save ─────────────────────────────────────────────────────────

  const saveSettings = async (overrides?: Partial<WUSettings>) => {
    setSavingSettings(true);
    try {
      const payload = {
        ...settings,
        ...overrides,
        email_recipients: emailRecipientsInput
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
      };
      const res = await apiFetch('/weekly-updates/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save');
      }
      const data = await res.json();
      setSettings({
        master_prompt: data.master_prompt ?? '',
        slack_channel: data.slack_channel ?? '',
        email_recipients: data.email_recipients ?? [],
        send_slack: data.send_slack ?? false,
        send_email: data.send_email ?? false,
        auto_enabled: data.auto_enabled ?? false,
      });
      toast({ title: 'Settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Client management ─────────────────────────────────────────────────────

  const addClient = async (name: string) => {
    if (!name.trim()) return;
    setAddingClient(true);
    try {
      const res = await apiFetch('/weekly-updates/clients', {
        method: 'POST',
        body: JSON.stringify({ client_name: name.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add');
      }
      const client = await res.json();
      setTaggedClients((prev) => [...prev, client].sort((a, b) => a.client_name.localeCompare(b.client_name)));
      // Keep dropdown open and input cleared so user can keep picking more clients
      setAddClientInput('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingClient(false);
    }
  };

  const removeClient = async (id: string) => {
    try {
      const res = await apiFetch(`/weekly-updates/clients/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      setTaggedClients((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Generation ─────────────────────────────────────────────────────────────

  const generateForClient = useCallback(async (clientName: string) => {
    setGeneratingClients((prev) => new Set(prev).add(clientName));
    setStreamTexts((prev) => ({ ...prev, [clientName]: '' }));

    // Create a placeholder "generating" report row immediately
    let reportId: string | null = null;
    try {
      const res = await apiFetch('/weekly-updates/reports', {
        method: 'POST',
        body: JSON.stringify({
          client_name: clientName,
          date_range_start: startDate,
          date_range_end: endDate,
          status: 'generating',
        }),
      });
      if (res.ok) {
        const row = await res.json();
        reportId = row.id;
        setReports((prev) => [row, ...prev]);
      }
    } catch { /* proceed without placeholder */ }

    let accumulated = '';
    let extractedHtml: string | null = null;
    let plainText = '';

    const message = [
      `[CLIENT UPDATE REQUEST]`,
      `Generate a comprehensive client update for "${clientName}" covering ${startDate} to ${endDate}.`,
      ``,
      `Steps:`,
      `1. Call get_client_accounts with client_name="${clientName}" to find ALL linked accounts (ad accounts, social pages, GHL, Reddit Ads, etc.)`,
      `2. Call notion_query_tasks with client_name="${clientName}", start_date="${startDate}", end_date="${endDate}", status_filter="completed"`,
      `3. Pull Google Ads performance AND change history AND keyword performance for the date range`,
      `4. Pull Meta Ads performance AND change history/activities for the date range`,
      `5. Check social media posts (Facebook page and Instagram account via Meta API)`,
      `6. If client has Reddit Ads linked, pull Reddit Ads performance via reddit_ads_manage`,
      `7. If client has GHL linked, pull pipeline opportunities, new contacts, appointments, and messaging activity (SMS + email conversations) via ghl_pipeline, ghl_contacts, ghl_calendar, and ghl_admin raw_api (/conversations/search with date range)`,
      `8. Build a branded HTML update page and save it using write_file (do NOT deploy or call deploy_site — the system will save it automatically). Do NOT output the HTML code in the chat text.`,
      `9. Output the plain text summary in chat`,
      ``,
      `Follow the CLIENT UPDATE BOT rules from your system prompt exactly. Do not skip ANY data source.`,
      settings.master_prompt ? `\n[ADDITIONAL INSTRUCTIONS]\n${settings.master_prompt}` : '',
    ].filter(Boolean).join('\n');

    const abort = streamMessage(
      message,
      null,
      (event: SSEEvent) => {
        if (event.type === 'text' && event.delta) {
          accumulated += event.delta;
          setStreamTexts((prev) => ({ ...prev, [clientName]: accumulated }));
          // Try to extract HTML as it streams
          const h = extractHtmlFromText(accumulated);
          if (h) extractedHtml = h;
        }
        if (event.type === 'html_content' && event.content) {
          extractedHtml = event.content;
        }
        if (event.type === 'done') {
          // Final extraction attempt
          if (!extractedHtml) extractedHtml = extractHtmlFromText(accumulated);
          plainText = accumulated.replace(/<[^>]+>/g, '').trim();
        }
      },
      async () => {
        // Stream complete — save to DB
        abortRefs.current.delete(clientName);
        try {
          const updatePayload: Record<string, any> = {
            status: extractedHtml ? 'complete' : 'error',
            updated_at: new Date().toISOString(),
          };
          if (extractedHtml) updatePayload.html_content = extractedHtml;
          if (plainText) updatePayload.plain_text = plainText.slice(0, 10000);

          if (reportId) {
            const res = await apiFetch(`/weekly-updates/reports/${reportId}`, {
              method: 'PUT',
              body: JSON.stringify(updatePayload),
            });
            if (res.ok) {
              const updated = await res.json();
              setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, ...updated } : r)));
            }
          }
        } catch { /* noop */ } finally {
          setGeneratingClients((prev) => {
            const next = new Set(prev);
            next.delete(clientName);
            return next;
          });
          setStreamTexts((prev) => {
            const next = { ...prev };
            delete next[clientName];
            return next;
          });
        }
      },
    );

    abortRefs.current.set(clientName, abort);
  }, [startDate, endDate, settings.master_prompt]);

  const handleGenerateSelected = () => {
    if (selectedClients.size === 0) return;
    selectedClients.forEach((name) => generateForClient(name));
    setSelectedClients(new Set());
  };

  // ── HTML editor ───────────────────────────────────────────────────────────

  const openEditor = async (report: WUReport) => {
    // Fetch full report (html_content + plain_text) if not already loaded
    if (!report.html_content || !report.plain_text) {
      try {
        const res = await apiFetch(`/weekly-updates/reports/${report.id}`);
        if (res.ok) {
          const full = await res.json();
          setEditingReport(full);
          setEditHtml(full.html_content ?? '');
          setEditPlainText(full.plain_text ?? '');
          return;
        }
      } catch { /* use what we have */ }
    }
    setEditingReport(report);
    setEditHtml(report.html_content ?? '');
    setEditPlainText(report.plain_text ?? '');
  };

  const saveEdit = async () => {
    if (!editingReport) return;
    setSavingEdit(true);
    try {
      const res = await apiFetch(`/weekly-updates/reports/${editingReport.id}`, {
        method: 'PUT',
        body: JSON.stringify({ html_content: editHtml, plain_text: editPlainText }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const updated = await res.json();
      setReports((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      setEditingReport((prev) => (prev ? { ...prev, ...updated } : null));
      toast({ title: 'Report saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Send report ────────────────────────────────────────────────────────────

  const sendReport = async (reportId: string) => {
    setSendingReport(reportId);
    try {
      const res = await apiFetch(`/weekly-updates/reports/${reportId}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      toast({ title: `Sent via: ${data.sent_via.join(', ') || 'none'}` });
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status: 'sent', sent_via: data.sent_via } : r
        )
      );
      if (editingReport?.id === reportId) {
        setEditingReport((prev) => (prev ? { ...prev, status: 'sent' } : null));
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSendingReport(null);
    }
  };

  const deleteReport = async (id: string) => {
    try {
      await apiFetch(`/weekly-updates/reports/${id}`, { method: 'DELETE' });
      setReports((prev) => prev.filter((r) => r.id !== id));
      if (editingReport?.id === id) setEditingReport(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const testSlack = async () => {
    setTestingSlack(true);
    try {
      const res = await apiFetch('/weekly-updates/test-slack', {
        method: 'POST',
        body: JSON.stringify({ channel: settings.slack_channel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test failed');
      toast({ title: 'Test message sent to Slack!' });
    } catch (err: any) {
      toast({ title: 'Slack test failed', description: err.message, variant: 'destructive' });
    } finally {
      setTestingSlack(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRefs.current.forEach((abort) => abort());
    };
  }, []);

  // ── Report status helpers ─────────────────────────────────────────────────

  const getReportForClient = (clientName: string): WUReport | undefined =>
    reports
      .filter(
        (r) =>
          r.client_name === clientName &&
          r.date_range_start <= endDate &&
          r.date_range_end >= startDate
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  const filteredClients = allClients.filter(
    (name) =>
      !taggedClients.find((tc) => tc.client_name === name) &&
      name.toLowerCase().includes(addClientInput.toLowerCase())
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-4">
        {/* Page header + date range */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarCheck className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Weekly Client Updates</h1>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">From</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-36 text-sm"
            />
            <Label className="text-sm text-muted-foreground">To</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-36 text-sm"
            />
            <Button variant="outline" size="sm" onClick={loadReports} className="h-8">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
          </TabsList>

          {/* ── Tab: Reports ─────────────────────────────────────────────── */}
          <TabsContent value="reports" className="space-y-4 mt-4">
            {/* Batch controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedClients.size === taggedClients.length) {
                    setSelectedClients(new Set());
                  } else {
                    setSelectedClients(new Set(taggedClients.map((c) => c.client_name)));
                  }
                }}
              >
                {selectedClients.size === taggedClients.length && taggedClients.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
              <Button
                size="sm"
                disabled={selectedClients.size === 0 || generatingClients.size > 0}
                onClick={handleGenerateSelected}
              >
                {generatingClients.size > 0 ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Generating ({generatingClients.size})
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 mr-1.5" />
                    Generate Selected ({selectedClients.size})
                  </>
                )}
              </Button>
            </div>

            {taggedClients.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No clients tagged. Go to the Settings tab to add clients.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {taggedClients.map((client) => {
                  const report = getReportForClient(client.client_name);
                  const isGenerating = generatingClients.has(client.client_name);
                  const streamText = streamTexts[client.client_name];
                  const isSelected = selectedClients.has(client.client_name);
                  const status = isGenerating ? 'generating' : (report?.status ?? 'not-run');

                  return (
                    <Card
                      key={client.id}
                      className={`transition-colors cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      onClick={() => {
                        if (isGenerating) return;
                        setSelectedClients((prev) => {
                          const next = new Set(prev);
                          if (next.has(client.client_name)) next.delete(client.client_name);
                          else next.add(client.client_name);
                          return next;
                        });
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium leading-snug">
                            {client.client_name}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${STATUS_COLORS[status] ?? 'bg-muted/30 text-muted-foreground'}`}
                          >
                            {isGenerating ? (
                              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Generating</>
                            ) : (
                              STATUS_LABELS[status] ?? status
                            )}
                          </Badge>
                        </div>
                        {report && (
                          <p className="text-xs text-muted-foreground">
                            {report.date_range_start} to {report.date_range_end}
                          </p>
                        )}
                      </CardHeader>

                      <CardContent className="pt-0 space-y-2">
                        {isGenerating && streamText && (
                          <p className="text-xs text-muted-foreground line-clamp-3 font-mono">
                            {streamText.slice(-200)}
                          </p>
                        )}

                        {/* Action buttons */}
                        <div
                          className="flex gap-1.5 flex-wrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {!isGenerating && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => generateForClient(client.client_name)}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              {report ? 'Re-run' : 'Generate'}
                            </Button>
                          )}
                          {report && (report.status === 'complete' || report.status === 'sent') && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => openEditor(report)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={sendingReport === report.id}
                                onClick={() => sendReport(report.id)}
                              >
                                {sendingReport === report.id ? (
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                ) : (
                                  <Send className="h-3 w-3 mr-1" />
                                )}
                                Send
                              </Button>
                            </>
                          )}
                          {report && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => deleteReport(report.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* HTML Editor Panel */}
            {editingReport && (
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                  <span className="text-sm font-medium">
                    Editing: {editingReport.client_name} ({editingReport.date_range_start} to {editingReport.date_range_end})
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={savingEdit}
                      onClick={saveEdit}
                    >
                      {savingEdit ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={sendingReport === editingReport.id}
                      onClick={() => sendReport(editingReport.id)}
                    >
                      {sendingReport === editingReport.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Send Now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setEditingReport(null)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2" style={{ height: '820px' }}>
                  {/* Raw HTML editor */}
                  <div className="border-r flex flex-col">
                    <div className="px-3 py-1.5 bg-muted/30 border-b text-xs text-muted-foreground flex items-center gap-1">
                      <Pencil className="h-3 w-3" /> HTML Editor
                    </div>
                    <Textarea
                      className="flex-1 resize-none rounded-none border-0 font-mono text-xs p-3"
                      value={editHtml}
                      onChange={(e) => setEditHtml(e.target.value)}
                    />
                  </div>
                  {/* Right column: iframe preview + plain text */}
                  <div className="flex flex-col">
                    {/* iframe preview */}
                    <div className="px-3 py-1.5 bg-muted/30 border-b text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Preview
                    </div>
                    <iframe
                      srcDoc={editHtml || '<p style="color:#888;padding:16px">No HTML content yet</p>'}
                      className="w-full border-0"
                      style={{ height: '500px', flexShrink: 0 }}
                      sandbox="allow-same-origin"
                    />
                    {/* Plain text update */}
                    <div className="border-t flex flex-col flex-1 min-h-0">
                      <div className="px-3 py-1.5 bg-muted/30 border-b text-xs text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Plain Text Update (sent to clients)
                      </div>
                      <Textarea
                        className="flex-1 resize-none rounded-none border-0 text-xs p-3 font-sans"
                        placeholder="Plain text summary will appear here after generation..."
                        value={editPlainText}
                        onChange={(e) => setEditPlainText(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Tab: Settings ────────────────────────────────────────────── */}
          <TabsContent value="settings" className="space-y-6 mt-4">
            {!settingsLoaded ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {/* Master Prompt */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Master Prompt</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Additional instructions appended to every client update request. Leave empty to use the default workflow.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      rows={6}
                      placeholder="Add custom instructions here..."
                      value={settings.master_prompt}
                      onChange={(e) => setSettings((s) => ({ ...s, master_prompt: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      disabled={savingSettings}
                      onClick={() => saveSettings({ master_prompt: settings.master_prompt })}
                    >
                      {savingSettings ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                      Save Prompt
                    </Button>
                  </CardContent>
                </Card>

                {/* Tagged Clients */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tagged Clients</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Only tagged clients appear on the Reports tab and are included in Monday auto-runs.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Existing tagged clients */}
                    <div className="flex flex-wrap gap-2">
                      {taggedClients.length === 0 && (
                        <p className="text-sm text-muted-foreground">No clients tagged yet.</p>
                      )}
                      {taggedClients.map((client) => (
                        <div
                          key={client.id}
                          className="flex items-center gap-1 bg-muted/50 rounded-md px-2 py-1 text-sm"
                        >
                          {client.client_name}
                          <button
                            onClick={() => removeClient(client.id)}
                            className="text-muted-foreground hover:text-destructive ml-1 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add client */}
                    <div className="relative">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Search or type client name..."
                          value={addClientInput}
                          onChange={(e) => {
                            setAddClientInput(e.target.value);
                            setShowClientDropdown(true);
                          }}
                          onFocus={() => setShowClientDropdown(true)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && addClientInput.trim()) {
                              addClient(addClientInput.trim());
                            }
                            if (e.key === 'Escape') setShowClientDropdown(false);
                          }}
                          className="h-9"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!addClientInput.trim() || addingClient}
                          onClick={() => addClient(addClientInput.trim())}
                          className="h-9 shrink-0"
                        >
                          {addingClient ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                      {showClientDropdown && filteredClients.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {filteredClients.slice(0, 20).map((name) => (
                            <button
                              key={name}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                addClient(name);
                              }}
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {showClientDropdown && (
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowClientDropdown(false)}
                      />
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── Tab: Automation ──────────────────────────────────────────── */}
          <TabsContent value="automation" className="space-y-6 mt-4">
            {!settingsLoaded ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : (
              <>
                {/* Slack */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" /> Slack
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={settings.send_slack}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, send_slack: v }))}
                      />
                      <Label>Post updates to Slack</Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="#channel-name"
                        value={settings.slack_channel}
                        onChange={(e) => setSettings((s) => ({ ...s, slack_channel: e.target.value }))}
                        className="h-9"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!settings.slack_channel || testingSlack}
                        onClick={testSlack}
                        className="h-9 shrink-0"
                      >
                        {testingSlack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Test'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Email */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mail className="h-4 w-4" /> Email
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={settings.send_email}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, send_email: v }))}
                      />
                      <Label>Send email reports</Label>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Recipients (comma-separated)
                      </Label>
                      <Input
                        placeholder="team@company.com, manager@company.com"
                        value={emailRecipientsInput}
                        onChange={(e) => setEmailRecipientsInput(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Monday auto-run */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Monday Auto-Run
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate reports for all tagged clients every Monday at 9:00 AM PT.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={settings.auto_enabled}
                        onCheckedChange={(v) => setSettings((s) => ({ ...s, auto_enabled: v }))}
                      />
                      <Label>Enable Monday 9:00 AM auto-run</Label>
                    </div>
                    {settings.auto_enabled && (
                      <p className="text-sm text-green-400 flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5" />
                        Next run: Monday at 9:00 AM PT
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Button
                  disabled={savingSettings}
                  onClick={() => saveSettings()}
                >
                  {savingSettings ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save Automation Settings
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
