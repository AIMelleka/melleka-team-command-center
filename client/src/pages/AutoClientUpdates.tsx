import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Loader2, Trash2, Pencil, Plus, X, Clock, Lock, Unlock,
  Wand2, Play, RotateCcw, ExternalLink, Check, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import AdminHeader from '@/components/AdminHeader';

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

// ── Helpers ──────────────────────────────────────────────────────────────────
function cronToEnglish(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return expr;
  const [min, hour, dom, _mon, dow] = parts;
  let timeStr = '';
  if (hour !== '*' && min !== '*') {
    const h = parseInt(hour), m = parseInt(min);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    timeStr = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  }
  const dowNames: Record<string, string> = {
    '0': 'Sunday', '1': 'Monday', '2': 'Tuesday', '3': 'Wednesday',
    '4': 'Thursday', '5': 'Friday', '6': 'Saturday',
  };
  if (dow === '*' && dom === '*') return timeStr ? `Every day at ${timeStr}` : 'Every minute';
  if (dow === '1-5') return timeStr ? `Weekdays at ${timeStr}` : 'Every weekday';
  if (dow === '0,6') return timeStr ? `Weekends at ${timeStr}` : 'Every weekend';
  if (dow !== '*') {
    const days = dow.split(',').map((d) => dowNames[d] || d).join(', ');
    return timeStr ? `Every ${days} at ${timeStr}` : `Every ${days}`;
  }
  if (dom !== '*') {
    const s = dom === '1' ? 'st' : dom === '2' ? 'nd' : dom === '3' ? 'rd' : 'th';
    return timeStr ? `${dom}${s} of every month at ${timeStr}` : `${dom}${s} of every month`;
  }
  return expr;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface AutoClientUpdate {
  id: string;
  client_name: string;
  google_ads_account_id: string | null;
  email_recipients: string[];
  cron_expr: string;
  enabled: boolean;
  cron_job_id: string | null;
  cron_job_system_managed: boolean;
  last_sent_at: string | null;
  last_run: string | null;
  email_design: string | null;
  email_design_locked: boolean;
  email_send_mode: 'single_email' | 'separate_emails';
  template_notes: string | null;
  created_at: string;
}

const CRON_PRESETS = [
  { label: 'Daily at 8 AM', value: '0 8 * * *' },
  { label: 'Weekdays at 8 AM', value: '0 8 * * 1-5' },
  { label: 'Monday at 8 AM', value: '0 8 * * 1' },
  { label: 'Weekly Sunday 6 PM', value: '0 18 * * 0' },
  { label: 'Custom', value: 'custom' },
];

const DEFAULT_TEMPLATE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="background:#2d1b4e;padding:28px 32px;">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">[CLIENT_NAME] Performance Update</h1>
<p style="margin:6px 0 0;color:#c9b8e8;font-size:14px;">[YESTERDAY_DATE] | Prepared by Melleka AI Strategist</p>
</td></tr>
<tr><td style="padding:24px 32px;background:#f9f7ff;border-bottom:1px solid #ede9f8;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td><span style="font-size:13px;color:#6b6b6b;text-transform:uppercase;letter-spacing:0.5px;">Yesterday's Grade</span>
<br><span style="font-size:48px;font-weight:900;color:#2d1b4e;">[GRADE]</span></td>
<td align="right" style="vertical-align:bottom;padding-bottom:8px;">
<span style="background:[GRADE_COLOR];color:#fff;padding:6px 16px;border-radius:20px;font-size:14px;font-weight:600;">ROAS [YESTERDAY_ROAS]x</span>
</td></tr></table>
</td></tr>
<tr><td style="padding:24px 32px;">
<h2 style="margin:0 0 16px;color:#2d1b4e;font-size:16px;">Performance Summary</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
<tr style="background:#2d1b4e;color:#fff;">
<th style="padding:10px 14px;text-align:left;font-size:13px;">Period</th>
<th style="padding:10px 14px;text-align:right;font-size:13px;">Spend</th>
<th style="padding:10px 14px;text-align:right;font-size:13px;">Revenue</th>
<th style="padding:10px 14px;text-align:right;font-size:13px;">ROAS</th>
</tr>
[PERFORMANCE_TABLE_ROWS]
</table>
</td></tr>
<tr><td style="padding:0 32px 20px;">
<p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Grade Scale</p>
<table cellpadding="0" cellspacing="4"><tr>
<td style="background:#1a7f4b;color:#fff;padding:4px 8px;border-radius:3px;font-size:11px;font-weight:600;">A+ 5x+</td>
<td style="background:#1a7f4b;color:#fff;padding:4px 8px;border-radius:3px;font-size:11px;font-weight:600;">A 4-5x</td>
<td style="background:#5cb85c;color:#fff;padding:4px 8px;border-radius:3px;font-size:11px;font-weight:600;">B+ 3.5-4x</td>
<td style="background:#5cb85c;color:#fff;padding:4px 8px;border-radius:3px;font-size:11px;font-weight:600;">B 3-3.5x</td>
<td style="background:#f5a623;color:#fff;padding:4px 8px;border-radius:3px;font-size:11px;font-weight:600;">C 2.5-3x</td>
<td style="background:#f5a623;color:#fff;padding:4px 8px;border-radius:3px;font-size:11px;font-weight:600;">D 2-2.5x</td>
<td style="background:#e74c3c;color:#fff;padding:4px 8px;border-radius:3px;font-size:11px;font-weight:600;">F &lt;2x</td>
</tr></table>
</td></tr>
<tr><td style="padding:0 32px 28px;">
<div style="background:#f9f7ff;border-left:4px solid #2d1b4e;padding:16px 20px;border-radius:0 6px 6px 0;">
<p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;color:#2d1b4e;letter-spacing:0.5px;">Strategist Notes</p>
<p style="margin:0;font-size:14px;color:#333;line-height:1.6;">[STRATEGIST_NOTES]</p>
</div>
</td></tr>
<tr><td style="background:#2d1b4e;padding:16px 32px;text-align:center;">
<p style="margin:0;color:#c9b8e8;font-size:12px;">Generated by Melleka AI Strategist | Melleka Marketing</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

// ── Sample preview — replaces all known placeholder formats with demo data ──
function buildPreviewHtml(html: string): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const weekStart = new Date(yesterday);
  weekStart.setDate(yesterday.getDate() - 6);
  const weekStr = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const nextWeekStr = `${new Date(yesterday.getTime() + 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}\u201313`;

  const campaignRows = `
    <tr style="background:#fff;"><td style="padding:8px 10px;font-size:13px;">Branded Search</td><td style="padding:8px 10px;text-align:right;font-size:13px;">$3,200</td><td style="padding:8px 10px;text-align:right;font-size:13px;">$18,240</td><td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#1a7f4b;">5.7x</td><td style="padding:8px 10px;text-align:right;"><span style="background:#1a7f4b;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">A+</span></td></tr>
    <tr style="background:#fafaf9;"><td style="padding:8px 10px;font-size:13px;">Shopping</td><td style="padding:8px 10px;text-align:right;font-size:13px;">$2,800</td><td style="padding:8px 10px;text-align:right;font-size:13px;">$11,060</td><td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#5cb85c;">3.9x</td><td style="padding:8px 10px;text-align:right;"><span style="background:#5cb85c;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">B+</span></td></tr>
    <tr style="background:#fff;"><td style="padding:8px 10px;font-size:13px;">Prospecting</td><td style="padding:8px 10px;text-align:right;font-size:13px;">$2,650</td><td style="padding:8px 10px;text-align:right;font-size:13px;">$7,030</td><td style="padding:8px 10px;text-align:right;font-size:13px;font-weight:700;color:#f5a623;">2.7x</td><td style="padding:8px 10px;text-align:right;"><span style="background:#f5a623;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;">C</span></td></tr>`;

  const perfRows = `
    <tr style="background:#f9f7ff;"><td style="padding:10px 14px;font-size:13px;">Yesterday</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$1,240</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$5,208</td><td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#1a7f4b;">4.2x</td></tr>
    <tr style="background:#fff;"><td style="padding:10px 14px;font-size:13px;">7-Day</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$8,650</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$31,140</td><td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#1a7f4b;">3.6x</td></tr>
    <tr style="background:#f9f7ff;"><td style="padding:10px 14px;font-size:13px;">14-Day</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$17,300</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$59,820</td><td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#1a7f4b;">3.5x</td></tr>
    <tr style="background:#fff;"><td style="padding:10px 14px;font-size:13px;">30-Day</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$36,400</td><td style="padding:10px 14px;text-align:right;font-size:13px;">$116,480</td><td style="padding:10px 14px;text-align:right;font-size:13px;font-weight:700;color:#5cb85c;">3.2x</td></tr>`;

  return html
    // ── Standard bracket format ─────────────────────────────────────────────
    .replace(/\[CLIENT_NAME\]/g, 'Sample Client')
    .replace(/\[YESTERDAY_DATE\]/g, dateStr)
    .replace(/\[GRADE\]/g, 'A')
    .replace(/\[GRADE_COLOR\]/g, '#1a7f4b')
    .replace(/\[YESTERDAY_ROAS\]/g, '4.2')
    .replace(/\[STRATEGIST_NOTES\]/g, "Yesterday's ROAS hit 4.2x, driven by strong branded search performance. The 30-day trend shows consistent improvement — consider scaling budget on top campaigns.")
    .replace(/\[PERFORMANCE_TABLE_ROWS\]/g, perfRows)

    // ── Vegamour daily ROAS format ──────────────────────────────────────────
    .replace(/DATA_DATE_PLACEHOLDER/g, dateStr)
    .replace(/GRADE_BG_COLOR/g, '#2e9e62')
    .replace(/GRADE_LABEL_PLACEHOLDER/g, '4.2x ROAS \u2014 Exceeding Target')
    .replace(/GRADE_PLACEHOLDER/g, 'A')
    .replace(/YESTERDAY_COLOR/g, '#1a7f4b')
    .replace(/YESTERDAY_SPEND/g, '$1,240')
    .replace(/YESTERDAY_REV/g, '$5,208')
    .replace(/YESTERDAY_ROAS/g, '4.2x')
    .replace(/7D_COLOR/g, '#1a7f4b')
    .replace(/7D_SPEND/g, '$8,650')
    .replace(/7D_REV/g, '$31,140')
    .replace(/7D_ROAS/g, '3.6x')
    .replace(/14D_COLOR/g, '#1a7f4b')
    .replace(/14D_SPEND/g, '$17,300')
    .replace(/14D_REV/g, '$59,820')
    .replace(/14D_ROAS/g, '3.5x')
    .replace(/30D_COLOR/g, '#5cb85c')
    .replace(/30D_SPEND/g, '$36,400')
    .replace(/30D_REV/g, '$116,480')
    .replace(/30D_ROAS/g, '3.2x')
    .replace(/NOTES_PLACEHOLDER/g, "Strong daily performance with ROAS at 4.2x — above target. Branded campaigns continue to lead. Monitor prospecting efficiency over the next 7 days.")

    // ── Vegamour weekly rollup format ───────────────────────────────────────
    // Colors first (most specific, avoid partial replacements)
    .replace(/GRADE_COLOR_PLACEHOLDER/g, '#2e9e62')
    .replace(/THIS_WEEK_COLOR_PLACEHOLDER/g, '#1a7f4b')
    .replace(/PRIOR_WEEK_COLOR_PLACEHOLDER/g, '#5cb85c')
    .replace(/SPEND_CHANGE_COLOR_PLACEHOLDER/g, '#e74c3c')
    .replace(/REVENUE_CHANGE_COLOR_PLACEHOLDER/g, '#1a7f4b')
    .replace(/ROAS_CHANGE_COLOR_PLACEHOLDER/g, '#1a7f4b')
    .replace(/CONV_CHANGE_COLOR_PLACEHOLDER/g, '#1a7f4b')
    .replace(/CPA_CHANGE_COLOR_PLACEHOLDER/g, '#1a7f4b')
    // Progress bar: template uses `width:PROGRESS_PCT_PLACEHOLDERpx` — replace the whole token+unit
    .replace(/PROGRESS_PCT_PLACEHOLDERpx/g, '100%')
    .replace(/PROGRESS_PCT_PLACEHOLDER/g, '100')
    // Dates
    .replace(/WEEK_RANGE_PLACEHOLDER/g, weekStr)
    .replace(/NEXT_WEEK_RANGE_PLACEHOLDER/g, nextWeekStr)
    // Grade
    .replace(/GRADE_LABEL_PLACEHOLDER/g, 'Exceeding Target')
    .replace(/GRADE_PLACEHOLDER/g, 'A')
    // ROAS percentages (weekly uses %)
    .replace(/THIS_WEEK_ROAS_PLACEHOLDER/g, '420%')
    .replace(/PRIOR_WEEK_ROAS_PLACEHOLDER/g, '380%')
    // Spend/revenue
    .replace(/THIS_WEEK_SPEND_PLACEHOLDER/g, '8,650')
    .replace(/THIS_WEEK_REVENUE_PLACEHOLDER/g, '36,330')
    .replace(/PRIOR_WEEK_SPEND_PLACEHOLDER/g, '8,200')
    .replace(/PRIOR_WEEK_REVENUE_PLACEHOLDER/g, '31,160')
    // WoW changes
    .replace(/SPEND_CHANGE_PLACEHOLDER/g, '+$450')
    .replace(/REVENUE_CHANGE_PLACEHOLDER/g, '+$5,170')
    .replace(/ROAS_CHANGE_PLACEHOLDER/g, '+40%')
    .replace(/THIS_WEEK_CONV_PLACEHOLDER/g, '142')
    .replace(/PRIOR_WEEK_CONV_PLACEHOLDER/g, '128')
    .replace(/CONV_CHANGE_PLACEHOLDER/g, '+14')
    .replace(/THIS_WEEK_CPA_PLACEHOLDER/g, '60.92')
    .replace(/PRIOR_WEEK_CPA_PLACEHOLDER/g, '64.06')
    .replace(/CPA_CHANGE_PLACEHOLDER/g, '-$3.14')
    // Rich content blocks
    .replace(/EXEC_SUMMARY_PLACEHOLDER/g, 'A strong week with ROAS up 40% vs prior week, driven by improved branded search performance and a newly launched campaign structure. CPA dropped by $3.14 — efficiency is trending in the right direction.')
    .replace(/WINS_LIST_PLACEHOLDER/g, '\u2705 ROAS hit 420% \u2014 above the 300% target<br>\u2705 Branded search campaigns at all-time high ROAS<br>\u2705 New campaign structure launched successfully<br>\u2705 CPA decreased $3.14 vs prior week')
    .replace(/NOTION_TASKS_PLACEHOLDER/g, '\u2022 Launched new ad creative set for branded campaigns<br>\u2022 Updated negative keyword lists across all campaigns<br>\u2022 Implemented new bidding strategy on top performers<br>\u2022 Weekly performance review completed with client')
    .replace(/CAMPAIGN_ROWS_PLACEHOLDER/g, campaignRows)
    .replace(/BLOCKERS_LIST_PLACEHOLDER/g, '\uD83D\uDFE1 Remarketing audience sizes smaller than expected \u2014 monitoring<br>\u26AA No critical blockers this week')
    .replace(/NEXT_STEPS_LIST_PLACEHOLDER/g, '1. Scale budget on Branded Search by 15%<br>2. Launch A/B test on new ad copy for prospecting<br>3. Review and refresh negative keyword lists<br>4. Schedule mid-week check-in on new campaign structure')

    // ── Catch-all: any remaining ALL_CAPS_PLACEHOLDER → blank/sample ────────
    .replace(/[A-Z][A-Z0-9_]*_PLACEHOLDER/g, '(sample)');
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AutoClientUpdates() {
  const { toast } = useToast();
  const [clients, setClients] = useState<AutoClientUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');

  // Selected client for editing (null = new client)
  const [selected, setSelected] = useState<AutoClientUpdate | null>(null);

  // --- Settings tab state ---
  const [formClientName, setFormClientName] = useState('');
  const [formGoogleAdsId, setFormGoogleAdsId] = useState('');
  const [formCronPreset, setFormCronPreset] = useState('0 8 * * 1-5');
  const [formCustomCron, setFormCustomCron] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // --- Recipients tab state ---
  const [formSendMode, setFormSendMode] = useState<'single_email' | 'separate_emails'>('single_email');
  const [formRecipients, setFormRecipients] = useState<string[]>([]);
  const [formEmailInput, setFormEmailInput] = useState('');
  const [savingRecipients, setSavingRecipients] = useState(false);

  // --- Design tab state ---
  const [designHtml, setDesignHtml] = useState('');
  const [designLocked, setDesignLocked] = useState(false);
  const [templateNotes, setTemplateNotes] = useState('');
  const [showHtmlEditor, setShowHtmlEditor] = useState(false);
  const [aiInstructions, setAiInstructions] = useState('');
  const [applyingAi, setApplyingAi] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // --- Test tab state ---
  const [testRunning, setTestRunning] = useState(false);
  const [testTaskId, setTestTaskId] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    try {
      const res = await apiFetch('/auto-client-updates');
      if (res.ok) setClients(await res.json());
    } catch (err: any) {
      toast({ title: 'Error loading clients', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  // Update preview whenever designHtml changes
  useEffect(() => {
    setPreviewHtml(buildPreviewHtml(designHtml || DEFAULT_TEMPLATE_HTML));
  }, [designHtml]);

  function openSheet(client: AutoClientUpdate | null) {
    const c = client;
    setSelected(c);
    setActiveTab('settings');

    // Settings
    setFormClientName(c?.client_name ?? '');
    setFormGoogleAdsId(c?.google_ads_account_id ?? '');
    const preset = CRON_PRESETS.find((p) => p.value === c?.cron_expr && p.value !== 'custom');
    setFormCronPreset(preset ? (c?.cron_expr ?? '0 8 * * 1-5') : 'custom');
    setFormCustomCron(preset ? '' : (c?.cron_expr ?? ''));
    setFormEnabled(c?.enabled ?? true);

    // Recipients
    setFormSendMode(c?.email_send_mode ?? 'single_email');
    setFormRecipients(c?.email_recipients ?? []);
    setFormEmailInput('');

    // Design
    setDesignHtml(c?.email_design ?? '');
    setDesignLocked(c?.email_design_locked ?? false);
    setTemplateNotes(c?.template_notes ?? '');
    setShowHtmlEditor(false);
    setAiInstructions('');

    // Test
    setTestTaskId(null);

    setSheetOpen(true);
  }

  const effectiveCron = formCronPreset === 'custom' ? formCustomCron : formCronPreset;

  // ── Save settings ────────────────────────────────────────────────────────────
  async function saveSettings() {
    if (!formClientName.trim()) { toast({ title: 'Client name is required', variant: 'destructive' }); return; }
    setSavingSettings(true);
    try {
      const body = {
        client_name: formClientName.trim(),
        google_ads_account_id: formGoogleAdsId.trim() || null,
        cron_expr: effectiveCron || '0 8 * * 1-5',
        enabled: formEnabled,
      };
      const res = selected
        ? await apiFetch(`/auto-client-updates/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/auto-client-updates', { method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');
      const updated = await res.json();
      if (!selected) {
        setSelected(updated);
        setClients((prev) => [...prev, updated].sort((a, b) => a.client_name.localeCompare(b.client_name)));
      } else {
        setSelected(updated);
        setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      }
      toast({ title: 'Settings saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingSettings(false);
    }
  }

  // ── Save recipients ──────────────────────────────────────────────────────────
  async function saveRecipients() {
    if (!selected) { toast({ title: 'Save settings first', variant: 'destructive' }); return; }
    setSavingRecipients(true);
    try {
      const res = await apiFetch(`/auto-client-updates/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ email_recipients: formRecipients, email_send_mode: formSendMode }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const updated = await res.json();
      setSelected(updated);
      setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      toast({ title: 'Recipients saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingRecipients(false);
    }
  }

  // ── Apply AI design changes ──────────────────────────────────────────────────
  async function applyAiDesign() {
    if (!aiInstructions.trim()) { toast({ title: 'Describe what you want changed', variant: 'destructive' }); return; }
    if (!selected) { toast({ title: 'Save settings first', variant: 'destructive' }); return; }
    setApplyingAi(true);
    try {
      const res = await apiFetch(`/auto-client-updates/${selected.id}/ai-design`, {
        method: 'POST',
        body: JSON.stringify({
          instructions: aiInstructions,
          current_design: designHtml || DEFAULT_TEMPLATE_HTML,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'AI design failed');
      const { html } = await res.json();
      setDesignHtml(html);
      setAiInstructions('');
      toast({ title: 'Design updated by AI', description: 'Review the preview and save when ready.' });
    } catch (err: any) {
      toast({ title: 'AI Error', description: err.message, variant: 'destructive' });
    } finally {
      setApplyingAi(false);
    }
  }

  // ── Save design ──────────────────────────────────────────────────────────────
  async function saveDesign() {
    if (!selected) { toast({ title: 'Save settings first', variant: 'destructive' }); return; }
    setSavingDesign(true);
    try {
      const res = await apiFetch(`/auto-client-updates/${selected.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          email_design: designHtml || null,
          email_design_locked: designLocked,
          template_notes: templateNotes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      const updated = await res.json();
      setSelected(updated);
      setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      toast({ title: designLocked ? 'Design saved and locked' : 'Design saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingDesign(false);
    }
  }

  // ── Run test ─────────────────────────────────────────────────────────────────
  async function runTest() {
    if (!selected) { toast({ title: 'Save settings first', variant: 'destructive' }); return; }
    setTestRunning(true);
    setTestTaskId(null);
    try {
      const res = await apiFetch(`/auto-client-updates/${selected.id}/test`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Test failed');
      setTestTaskId('sent');
      toast({ title: 'Test email sent', description: body.message || 'Check your inbox.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTestRunning(false);
    }
  }

  // ── Delete client ────────────────────────────────────────────────────────────
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete auto updates for "${name}"? This also removes the linked cron job.`)) return;
    try {
      const res = await apiFetch(`/auto-client-updates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast({ title: `Deleted "${name}"` });
      setClients((prev) => prev.filter((c) => c.id !== id));
      if (selected?.id === id) setSheetOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  // ── Toggle enabled ────────────────────────────────────────────────────────────
  async function handleToggleEnabled(client: AutoClientUpdate) {
    try {
      const res = await apiFetch(`/auto-client-updates/${client.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !client.enabled }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setClients((prev) => prev.map((c) => c.id === updated.id ? updated : c));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  }

  function addRecipient() {
    const email = formEmailInput.trim().toLowerCase();
    if (!email || !email.includes('@') || formRecipients.includes(email)) return;
    setFormRecipients((prev) => [...prev, email]);
    setFormEmailInput('');
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              Auto Client Updates
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scheduled AI-generated performance email reports. Click a client to configure.
            </p>
          </div>
          <Button onClick={() => openSheet(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Client
          </Button>
        </div>

        {/* Client grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No clients configured yet.</p>
              <Button className="mt-4" onClick={() => openSheet(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first client
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Card
                key={client.id}
                className={`cursor-pointer hover:shadow-md transition-shadow ${!client.enabled ? 'opacity-60' : ''}`}
                onClick={() => openSheet(client)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base leading-tight truncate">{client.client_name}</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {client.email_design_locked && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <Lock className="h-3 w-3" /> Design locked
                        </span>
                      )}
                      {client.cron_job_id && !client.cron_job_system_managed && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          External cron
                        </span>
                      )}
                    </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openSheet(client)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(client.id, client.client_name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{cronToEnglish(client.cron_expr)}</span>
                  </div>

                  {client.email_recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {client.email_recipients.slice(0, 2).map((e) => (
                        <Badge key={e} variant="secondary" className="text-xs max-w-[150px] truncate">{e}</Badge>
                      ))}
                      {client.email_recipients.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{client.email_recipients.length - 2}</Badge>
                      )}
                    </div>
                  )}

                  {client.email_send_mode === 'separate_emails' && (
                    <p className="text-xs text-muted-foreground">Separate emails per recipient</p>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Last sent: {client.last_sent_at
                      ? formatDistanceToNow(new Date(client.last_sent_at), { addSuffix: true })
                      : 'Never'}
                  </div>

                  <div
                    className="flex items-center justify-between pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-muted-foreground">{client.enabled ? 'Enabled' : 'Disabled'}</span>
                    <Switch checked={client.enabled} onCheckedChange={() => handleToggleEnabled(client)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Client Detail Sheet ─────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:w-[680px] sm:max-w-[680px] p-0 flex flex-col overflow-hidden">
          <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">
                {selected ? selected.client_name : 'New Client'}
              </SheetTitle>
              {selected && (
                <div className="flex items-center gap-3 mr-6">
                  {selected.cron_job_id && !selected.cron_job_system_managed && (
                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                      External cron — task protected
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selected.enabled ? 'Enabled' : 'Disabled'}</span>
                    <Switch checked={selected.enabled} onCheckedChange={() => handleToggleEnabled(selected)} />
                  </div>
                </div>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <TabsList className="mx-6 mt-4 shrink-0 grid grid-cols-4 w-auto">
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="recipients">Recipients</TabsTrigger>
                <TabsTrigger value="design">Design</TabsTrigger>
                <TabsTrigger value="test">Test</TabsTrigger>
              </TabsList>

              {/* ── Settings Tab ─────────────────────────────────────────────── */}
              <TabsContent value="settings" className="flex-1 px-6 pb-6 space-y-5 mt-4">
                <div>
                  <Label htmlFor="client-name">Client Name</Label>
                  <Input
                    id="client-name"
                    value={formClientName}
                    onChange={(e) => setFormClientName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="gads-id">Google Ads Account ID (optional)</Label>
                  <Input
                    id="gads-id"
                    value={formGoogleAdsId}
                    onChange={(e) => setFormGoogleAdsId(e.target.value)}
                    placeholder="e.g. 7567846915"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    If blank, AI will search by client name
                  </p>
                </div>

                <div>
                  <Label>Schedule</Label>
                  <Select value={formCronPreset} onValueChange={setFormCronPreset}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formCronPreset === 'custom' && (
                    <Input
                      value={formCustomCron}
                      onChange={(e) => setFormCustomCron(e.target.value)}
                      placeholder="e.g. 0 9 * * 1"
                      className="mt-2"
                    />
                  )}
                  {effectiveCron && effectiveCron.split(' ').length >= 5 && (
                    <p className="text-xs text-muted-foreground mt-1">{cronToEnglish(effectiveCron)}</p>
                  )}
                </div>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <Label>Enabled</Label>
                    <p className="text-xs text-muted-foreground">Enable to activate the cron schedule</p>
                  </div>
                  <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
                </div>

                <Button onClick={saveSettings} disabled={savingSettings} className="w-full">
                  {savingSettings && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {selected ? 'Save Settings' : 'Create Client'}
                </Button>
              </TabsContent>

              {/* ── Recipients Tab ───────────────────────────────────────────── */}
              <TabsContent value="recipients" className="flex-1 px-6 pb-6 space-y-5 mt-4">
                {!selected && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Save settings first to configure recipients.
                  </div>
                )}

                <div>
                  <Label>Send Mode</Label>
                  <RadioGroup
                    value={formSendMode}
                    onValueChange={(v) => setFormSendMode(v as any)}
                    className="mt-2 space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="single_email" id="mode-single" className="mt-0.5" />
                      <label htmlFor="mode-single" className="cursor-pointer">
                        <p className="text-sm font-medium">One email (To + CC)</p>
                        <p className="text-xs text-muted-foreground">First recipient is To:, all others are CC'd on the same email</p>
                      </label>
                    </div>
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value="separate_emails" id="mode-separate" className="mt-0.5" />
                      <label htmlFor="mode-separate" className="cursor-pointer">
                        <p className="text-sm font-medium">Separate emails</p>
                        <p className="text-xs text-muted-foreground">Each recipient gets their own individual email (no CC)</p>
                      </label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div>
                  <Label>Email Recipients</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={formEmailInput}
                      onChange={(e) => setFormEmailInput(e.target.value)}
                      placeholder="email@example.com"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }}
                    />
                    <Button type="button" variant="secondary" onClick={addRecipient}>Add</Button>
                  </div>
                </div>

                {formRecipients.length > 0 && (
                  <div className="space-y-2">
                    {formRecipients.map((email, idx) => (
                      <div key={email} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6 shrink-0">
                          {formSendMode === 'single_email' ? (idx === 0 ? 'To' : 'CC') : '#' + (idx + 1)}
                        </span>
                        <Badge variant="secondary" className="flex-1 flex items-center justify-between pr-1.5">
                          <span className="text-xs truncate">{email}</span>
                          <button
                            type="button"
                            onClick={() => setFormRecipients((prev) => prev.filter((e) => e !== email))}
                            className="ml-2 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {formSendMode === 'single_email' && formRecipients.length > 1 && (
                  <p className="text-xs text-muted-foreground">
                    One email will be sent to {formRecipients[0]} with {formRecipients.length - 1} CC recipient{formRecipients.length > 2 ? 's' : ''}.
                  </p>
                )}
                {formSendMode === 'separate_emails' && formRecipients.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formRecipients.length} separate email{formRecipients.length > 1 ? 's' : ''} will be sent.
                  </p>
                )}

                <Button onClick={saveRecipients} disabled={savingRecipients || !selected} className="w-full">
                  {savingRecipients && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Recipients
                </Button>
              </TabsContent>

              {/* ── Design Tab ───────────────────────────────────────────────── */}
              <TabsContent value="design" className="flex-1 px-6 pb-6 space-y-4 mt-4">
                {!selected && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Save settings first to configure the design.
                  </div>
                )}
                {selected?.cron_job_id && !selected?.cron_job_system_managed && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      This client links to an externally managed cron job. The design shown here is read from the existing automation and is for reference only. Changes saved here update this record but do not rewrite the running cron job's prompt.
                    </span>
                  </div>
                )}

                {/* Lock toggle */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {designLocked ? (
                      <Lock className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Unlock className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{designLocked ? 'Design Locked' : 'Design Unlocked'}</p>
                      <p className="text-xs text-muted-foreground">
                        {designLocked
                          ? 'AI fills data into this exact template. No style changes.'
                          : 'AI uses default template with creative freedom.'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={designLocked} onCheckedChange={setDesignLocked} />
                </div>

                {/* Email preview */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Preview</Label>
                    <span className="text-xs text-muted-foreground">Sample data shown</span>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <iframe
                      ref={iframeRef}
                      srcDoc={previewHtml}
                      className="w-full"
                      style={{ height: '380px', border: 'none' }}
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>

                {/* AI assistant */}
                <div className="space-y-2">
                  <Label>Customize with AI</Label>
                  <Textarea
                    value={aiInstructions}
                    onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder='e.g. "Change the header to dark navy", "Add a CTR column", "Use our logo at the top: [url]", "Remove the grade scale section"'
                    className="min-h-[80px] text-sm"
                  />
                  <Button
                    onClick={applyAiDesign}
                    disabled={applyingAi || !selected}
                    variant="secondary"
                    className="w-full"
                  >
                    {applyingAi
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying...</>
                      : <><Wand2 className="h-4 w-4 mr-2" /> Apply AI Changes</>
                    }
                  </Button>
                </div>

                {/* HTML editor (collapsible) */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowHtmlEditor((v) => !v)}
                    className="text-sm text-primary hover:underline"
                  >
                    {showHtmlEditor ? 'Hide HTML editor' : 'Edit HTML directly'}
                  </button>
                  {showHtmlEditor && (
                    <Textarea
                      value={designHtml || DEFAULT_TEMPLATE_HTML}
                      onChange={(e) => setDesignHtml(e.target.value)}
                      className="font-mono text-xs min-h-[200px]"
                      placeholder="Paste or edit HTML here..."
                    />
                  )}
                </div>

                {/* Template notes */}
                <div className="space-y-2">
                  <Label>Strategist Notes Instructions (optional)</Label>
                  <Textarea
                    value={templateNotes}
                    onChange={(e) => setTemplateNotes(e.target.value)}
                    placeholder='e.g. "Keep notes to 2 sentences", "Focus on ROAS trend vs 7-day average", "Always mention top-performing campaign"'
                    className="min-h-[70px] text-sm"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => { setDesignHtml(''); toast({ title: 'Reset to default template' }); }}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                  <Button onClick={saveDesign} disabled={savingDesign || !selected} className="flex-1">
                    {savingDesign && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {designLocked ? <><Lock className="h-4 w-4 mr-2" /> Save & Lock</> : 'Save Design'}
                  </Button>
                </div>
              </TabsContent>

              {/* ── Test Tab ─────────────────────────────────────────────────── */}
              <TabsContent value="test" className="flex-1 px-6 pb-6 space-y-5 mt-4">
                {!selected && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Save settings first to run a test.
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-medium text-sm">Test Run</h3>
                  <p className="text-sm text-muted-foreground">
                    Pulls live Google Ads data for this client, generates the HTML email using the current design, and returns a preview — without sending anything.
                  </p>
                </div>

                {selected && (
                  <div className="p-3 border rounded-lg text-sm space-y-1.5">
                    <p><span className="text-muted-foreground">Client:</span> {selected.client_name}</p>
                    {selected.google_ads_account_id && (
                      <p><span className="text-muted-foreground">Account ID:</span> {selected.google_ads_account_id}</p>
                    )}
                    <p><span className="text-muted-foreground">Recipients:</span> {selected.email_recipients.length > 0 ? selected.email_recipients.join(', ') : 'None configured'}</p>
                    <p><span className="text-muted-foreground">Design:</span> {selected.email_design_locked ? 'Custom (locked)' : selected.email_design ? 'Custom (unlocked)' : 'Default template'}</p>
                  </div>
                )}

                <Button
                  onClick={runTest}
                  disabled={testRunning || !selected}
                  className="w-full"
                >
                  {testRunning
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting test...</>
                    : <><Play className="h-4 w-4 mr-2" /> Run Test</>
                  }
                </Button>

                {testTaskId && (
                  <div className="p-4 border rounded-lg bg-emerald-50 dark:bg-emerald-950/30 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <Check className="h-4 w-4" />
                      <span className="text-sm font-medium">Test triggered</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Live job triggered — pulling real data and sending now. Email arrives within ~60 seconds.
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
