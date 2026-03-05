import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Users, Loader2, Copy, Check, Sparkles, Database, CheckCircle2, AlertCircle, Settings2, ChevronDown, ChevronUp, Save, Calendar, RefreshCw, Send, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import {
  streamMessage,
  ensureTeamMember,
  type SSEEvent,
} from '@/lib/chatApi';
import { ToolCallBlock } from '@/components/chat/ToolCallBlock';

// ── Types ────────────────────────────────────────────

interface MessagePart {
  type: 'text' | 'tool_start' | 'tool_result';
  content?: string;
  toolName?: string;
  toolOutput?: string;
}

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  streaming?: boolean;
}

// ── Helpers ──────────────────────────────────────────

function extractDatabaseId(input: string): string {
  if (!input) return "";
  const trimmed = input.trim();
  const uuidPattern = /^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i;
  if (uuidPattern.test(trimmed)) {
    const clean = trimmed.replace(/-/g, "");
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  const urlMatch = trimmed.match(/([a-f0-9]{32})(?:\?|$)/i);
  if (urlMatch) {
    const clean = urlMatch[1];
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  const dashedMatch = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (dashedMatch) return dashedMatch[1];
  return trimmed;
}

let nextMsgId = 0;
function uid() { return `cu-msg-${++nextMsgId}`; }

// Default Notion database ID
const LEGACY_NOTION_DATABASE_ID = 'bf762858-67b7-49ca-992d-fdfc8c43d7fa';
const DEFAULT_NOTION_DATABASE_ID = '9e7cd72f-e62c-4514-9456-5f51cbcfe981';

// Default master prompt
const DEFAULT_MASTER_PROMPT = `OBJECTIVE (NON-NEGOTIABLE)

Produce a COMPLETE, ACCURATE, ONE-TO-ONE list of all completed tasks for a single client within a specific date range.

Never summarize. Never merge. Never invent. Never omit.

If even one qualifying task is missing, the output is invalid.

FILTERING RULES (MANDATORY)
- Date field: Last edited time
- Date range: User-provided range
- Status: STATUS contains "Done"
- Hard exclusion: STATUS does NOT contain "NON-ESSENTIAL" or "NON ESSENTIAL"

CLIENT MATCHING (ERR ON INCLUSION)
Include a task if CLIENTS or Task name contains the client name, abbreviation, alias, shorthand, or common typo (case-insensitive). If unsure, include the task.

COMPLETION DEFINITION (STRICT)
A task is completed if STATUS contains "Done" or clearly implies completion. Ignore checkboxes entirely.

CATEGORIZATION (STRICT PLATFORM RULES)
Tasks must be categorized by the platform actually modified, not implied.

GOOGLE: Google Ads, Analytics/GA4, Tag Manager, Search Console, Business Profile, Sitelinks, conversions, ad groups
META: Facebook, Instagram, Meta Ads, Business Manager, Pixel
WEBSITE: Website banners, page edits, copy changes, UX/UI, videos added to site, link replacements
SEO: Keywords, metadata, rankings, on-page optimization, SEO-related structured snippets
EMAIL MARKETING: Campaigns, automations, templates, newsletters
CRM / AUTOMATIONS: HubSpot, Zapier, pipelines, integrations
CONTENT / CREATIVE: Copywriting, video creation, graphics, creative assets
REPORTING / ANALYTICS: Reports, dashboards, tracking verification

OUTPUT FORMAT (LOCKED)
- Bold platform headers
- Bullet list under each header
- 1 task = 1 bullet
- Past tense only
- Original task specificity preserved
- No summaries, no intro text, no client names, no interpretation
- NO URLs in task bullets (strip all links)

At the end, add:
Source
Database: IN HOUSE TO-DO
Client filter: [client name + aliases]
Date field: Last edited time
Date range: [exact range]
Status filter: STATUS contains "Done"
Hard exclusion: STATUS does NOT contain "NON-ESSENTIAL"

Reminder: Don't forget to include social media posts in the update.`;

// ── Component ────────────────────────────────────────

const ClientUpdate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  // Input state
  const [clientName, setClientName] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  // Settings state
  const [customAliases, setCustomAliases] = useState(() => {
    const saved = localStorage.getItem('client-update-custom-aliases');
    return saved || '';
  });
  const [aliasesSaved, setAliasesSaved] = useState(true);

  const [masterPrompt, setMasterPrompt] = useState(() => {
    const saved = localStorage.getItem('client-update-master-prompt');
    return saved || DEFAULT_MASTER_PROMPT;
  });
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [promptSaved, setPromptSaved] = useState(true);

  const [notionDatabaseId, setNotionDatabaseId] = useState(() => {
    const saved = localStorage.getItem('client-update-notion-db-id') || '';
    const normalized = extractDatabaseId(saved);
    if (saved && normalized && normalized !== saved) {
      localStorage.setItem('client-update-notion-db-id', normalized);
    }
    const candidate = normalized || DEFAULT_NOTION_DATABASE_ID;
    if (candidate === LEGACY_NOTION_DATABASE_ID) {
      localStorage.setItem('client-update-notion-db-id', DEFAULT_NOTION_DATABASE_ID);
      return DEFAULT_NOTION_DATABASE_ID;
    }
    return candidate;
  });

  const [isTestingNotion, setIsTestingNotion] = useState(false);
  const [notionTestResult, setNotionTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Chat/streaming state
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Settings handlers ──────────────────────────────

  const handlePromptChange = (value: string) => {
    setMasterPrompt(value);
    setPromptSaved(false);
  };

  const savePrompt = () => {
    localStorage.setItem('client-update-master-prompt', masterPrompt);
    setPromptSaved(true);
    toast({ title: 'Master prompt saved!' });
  };

  const resetPrompt = () => {
    setMasterPrompt(DEFAULT_MASTER_PROMPT);
    localStorage.setItem('client-update-master-prompt', DEFAULT_MASTER_PROMPT);
    setPromptSaved(true);
    toast({ title: 'Master prompt reset to default' });
  };

  const handleAliasesChange = (value: string) => {
    setCustomAliases(value);
    setAliasesSaved(false);
  };

  const saveAliases = () => {
    localStorage.setItem('client-update-custom-aliases', customAliases);
    setAliasesSaved(true);
    toast({ title: 'Aliases saved!' });
  };

  const handleNotionDbChange = (value: string) => {
    const extractedId = extractDatabaseId(value);
    setNotionDatabaseId(extractedId);
    localStorage.setItem('client-update-notion-db-id', extractedId);
    setNotionTestResult(null);
  };

  const testNotionConnection = async () => {
    setIsTestingNotion(true);
    setNotionTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-notion-tasks', {
        body: { databaseId: notionDatabaseId, testConnection: true },
      });
      if (error) throw error;
      setNotionTestResult({
        success: true,
        message: `Connected: ${data.databaseTitle || 'Database accessible'}`,
      });
    } catch (error) {
      const errorData = (error as any)?.context?.json;
      setNotionTestResult({
        success: false,
        message: errorData?.help || 'Could not connect to Notion database',
      });
    } finally {
      setIsTestingNotion(false);
    }
  };

  // ── SSE event handler ─────────────────────────────

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    setMessages(prev => {
      const msgs = [...prev];
      const last = msgs[msgs.length - 1];
      if (!last || last.role !== 'assistant') return msgs;

      const updated = { ...last, parts: [...last.parts] };

      switch (event.type) {
        case 'text': {
          const lastPart = updated.parts[updated.parts.length - 1];
          if (lastPart?.type === 'text') {
            updated.parts[updated.parts.length - 1] = {
              ...lastPart,
              content: (lastPart.content || '') + (event.delta || ''),
            };
          } else {
            updated.parts.push({ type: 'text', content: event.delta || '' });
          }
          break;
        }
        case 'tool_start':
          updated.parts.push({ type: 'tool_start', toolName: event.name });
          break;
        case 'tool_result': {
          const toolIdx = [...updated.parts].reverse().findIndex(p => p.type === 'tool_start' && p.toolName === event.name);
          if (toolIdx >= 0) {
            const actualIdx = updated.parts.length - 1 - toolIdx;
            updated.parts[actualIdx] = {
              type: 'tool_result',
              toolName: event.name,
              toolOutput: event.output,
            };
          } else {
            updated.parts.push({ type: 'tool_result', toolName: event.name, toolOutput: event.output });
          }
          break;
        }
        case 'done':
          updated.streaming = false;
          if (event.conversationId) setConversationId(event.conversationId);
          break;
        case 'error':
          updated.parts.push({ type: 'text', content: `\n\nError: ${event.message}` });
          updated.streaming = false;
          break;
      }

      msgs[msgs.length - 1] = updated;
      return msgs;
    });
  }, []);

  // ── Generate update ────────────────────────────────

  const handleGetUpdate = async () => {
    if (!clientName.trim()) {
      toast({ title: 'Client name required', variant: 'destructive' });
      return;
    }

    const aliasInfo = customAliases.trim()
      ? `\nClient aliases/abbreviations to also search for: ${customAliases.trim()}`
      : '';

    const dbOverride = notionDatabaseId !== DEFAULT_NOTION_DATABASE_ID
      ? `, database_id="${notionDatabaseId}"`
      : '';

    const message = [
      `[CLIENT UPDATE INSTRUCTIONS]`,
      masterPrompt,
      ``,
      `[TASK]`,
      `Generate a client update for "${clientName}" covering ${startDate} to ${endDate}.`,
      ``,
      `Steps:`,
      `1. Call notion_query_tasks with client_name="${clientName}", start_date="${startDate}", end_date="${endDate}", status_filter="completed"${dbOverride}`,
      `2. Review ALL returned tasks carefully - do not skip any`,
      `3. Format the update EXACTLY according to the instructions above`,
      aliasInfo,
      additionalContext ? `\nAdditional context from team: ${additionalContext}` : '',
    ].filter(Boolean).join('\n');

    // Reset for new generation
    setMessages([]);
    setConversationId(null);
    setIsStreaming(true);
    setCopied(false);

    const userMsg: UIMessage = {
      id: uid(),
      role: 'user',
      parts: [{ type: 'text', content: `Generate update for ${clientName} (${startDate} to ${endDate})` }],
    };

    const assistantMsg: UIMessage = {
      id: uid(),
      role: 'assistant',
      parts: [],
      streaming: true,
    };

    setMessages([userMsg, assistantMsg]);

    const abort = streamMessage(
      message,
      null, // new conversation each time
      handleSSEEvent,
      () => setIsStreaming(false),
    );
    abortRef.current = abort;
  };

  // ── Follow-up ──────────────────────────────────────

  const handleFollowUp = () => {
    if (!followUpInput.trim() || isStreaming || !conversationId) return;

    const text = followUpInput.trim();
    setFollowUpInput('');

    const userMsg: UIMessage = {
      id: uid(),
      role: 'user',
      parts: [{ type: 'text', content: text }],
    };

    const assistantMsg: UIMessage = {
      id: uid(),
      role: 'assistant',
      parts: [],
      streaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const abort = streamMessage(
      text,
      conversationId,
      handleSSEEvent,
      () => setIsStreaming(false),
    );
    abortRef.current = abort;
  };

  // ── New update ─────────────────────────────────────

  const handleNewUpdate = () => {
    if (isStreaming && abortRef.current) {
      abortRef.current();
    }
    setMessages([]);
    setConversationId(null);
    setIsStreaming(false);
    setCopied(false);
    setClientName('');
    inputRef.current?.focus();
  };

  // ── Copy output ────────────────────────────────────

  const handleCopy = async () => {
    const allText = messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.parts.filter(p => p.type === 'text').map(p => p.content || ''))
      .join('');
    if (!allText.trim()) return;
    await navigator.clipboard.writeText(allText);
    setCopied(true);
    toast({ title: 'Copied to clipboard!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isStreaming) {
      handleGetUpdate();
    }
  };

  const hasOutput = messages.some(m => m.role === 'assistant' && m.parts.some(p => p.type === 'text' && p.content));

  // ── Render ─────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 rounded-lg bg-genie-purple">
              <Users className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Client Update Bot</h1>
              <p className="text-muted-foreground">Powered by the superagent - reads Notion tasks and generates updates</p>
            </div>
          </div>
          {hasOutput && (
            <Button variant="outline" size="sm" onClick={handleNewUpdate}>
              <Plus className="h-4 w-4 mr-1" />
              New Update
            </Button>
          )}
        </div>

        {/* Settings Panel (collapsible) */}
        <Card className="mb-6 border-dashed">
          <CardHeader className="py-3 cursor-pointer" onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Settings</CardTitle>
                {(!promptSaved || !aliasesSaved) && (
                  <span className="text-xs text-primary">(unsaved changes)</span>
                )}
              </div>
              {isSettingsExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {isSettingsExpanded && (
            <CardContent className="pt-0 space-y-6">
              {/* Master Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Master Prompt (AI Instructions)</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={resetPrompt} className="h-7 text-xs">Reset</Button>
                    <Button variant="outline" size="sm" onClick={savePrompt} disabled={promptSaved} className="h-7 text-xs">
                      <Save className="h-3 w-3 mr-1" />Save
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={masterPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="Enter the master prompt for the AI..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              {/* Notion Database ID */}
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Notion Database ID or URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={notionDatabaseId}
                    onChange={(e) => handleNotionDbChange(e.target.value)}
                    placeholder="Paste Notion URL or Database ID..."
                    className="font-mono text-sm flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testNotionConnection}
                    disabled={isTestingNotion || !notionDatabaseId}
                    className="h-9 px-3"
                  >
                    {isTestingNotion ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    <span className="ml-1.5">Test</span>
                  </Button>
                </div>
                {notionTestResult && (
                  <div className={`flex items-center gap-1.5 mt-1.5 text-xs ${notionTestResult.success ? 'text-primary' : 'text-destructive'}`}>
                    {notionTestResult.success ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    <span>{notionTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Client Abbreviations */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Client Abbreviations</Label>
                  <Button variant="outline" size="sm" onClick={saveAliases} disabled={aliasesSaved} className="h-7 text-xs">
                    <Save className="h-3 w-3 mr-1" />Save
                  </Button>
                </div>
                <Textarea
                  value={customAliases}
                  onChange={(e) => handleAliasesChange(e.target.value)}
                  placeholder="SDPF, SD, San Diego, Parks Foundation&#10;ACME, Acme Corp, AC"
                  className="min-h-[60px] text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma or line separated. These get passed to the AI for better client matching.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Input Section */}
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Date Range */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label htmlFor="startDate" className="text-xs text-muted-foreground mb-1 block">
                    <Calendar className="h-3 w-3 inline mr-1" />Start Date
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-10"
                    disabled={isStreaming}
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="endDate" className="text-xs text-muted-foreground mb-1 block">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-10"
                    disabled={isStreaming}
                  />
                </div>
              </div>

              {/* Client Name + Generate */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    ref={inputRef}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter client name (e.g., Concord, SDPF, Global Guard)"
                    className="text-lg h-12"
                    disabled={isStreaming}
                  />
                </div>
                <Button
                  onClick={handleGetUpdate}
                  disabled={isStreaming || !clientName.trim()}
                  size="lg"
                  className="h-12 px-6"
                >
                  {isStreaming ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Working...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />Get Update</>
                  )}
                </Button>
              </div>

              {/* Additional Context */}
              <details className="group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  + Add context or notes (optional)
                </summary>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="e.g., Focus on Q1 campaign results, mention upcoming holiday promotion..."
                  rows={2}
                  className="mt-2"
                  disabled={isStreaming}
                />
              </details>
            </div>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card className="min-h-[500px]">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Generated Update
              </CardTitle>
              {conversationId && !isStreaming && (
                <CardDescription>Update complete - use follow-up below to refine</CardDescription>
              )}
            </div>
            {hasOutput && (
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <><Check className="mr-2 h-4 w-4" />Copied</>
                ) : (
                  <><Copy className="mr-2 h-4 w-4" />Copy</>
                )}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-80 text-center text-muted-foreground">
                <Users className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">Ready to generate client updates</p>
                <p className="text-sm max-w-md">
                  Enter a client name above and press Enter or click "Get Update".
                  The superagent will read your Notion tasks and generate the update
                  according to your master prompt.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.filter(m => m.role === 'assistant').map(msg => (
                  <div key={msg.id}>
                    {msg.parts.map((part, i) => {
                      if (part.type === 'text' && part.content) {
                        return (
                          <div key={i} className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{part.content}</ReactMarkdown>
                          </div>
                        );
                      }
                      if (part.type === 'tool_start') {
                        return (
                          <ToolCallBlock
                            key={i}
                            name={part.toolName || 'unknown'}
                            pending
                          />
                        );
                      }
                      if (part.type === 'tool_result') {
                        return (
                          <ToolCallBlock
                            key={i}
                            name={part.toolName || 'unknown'}
                            output={part.toolOutput}
                          />
                        );
                      }
                      return null;
                    })}
                    {msg.streaming && (
                      <div className="flex items-center gap-2 mt-2 text-muted-foreground text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Working...</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Follow-up input */}
            {conversationId && !isStreaming && hasOutput && (
              <div className="mt-6 pt-4 border-t flex gap-2">
                <Input
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleFollowUp(); }}
                  placeholder="Refine the update... (e.g., 'Add more detail on the SEO tasks' or 'Reformat as an email')"
                  className="flex-1"
                />
                <Button onClick={handleFollowUp} disabled={!followUpInput.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientUpdate;
