import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Users, Loader2, Copy, Check, Sparkles, Database, CheckCircle2, AlertCircle, Settings2, ChevronDown, ChevronUp, Save, Calendar, RefreshCw, Send, Plus, Eye, Pencil, Globe, ExternalLink } from 'lucide-react';
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
  publishClientUpdate,
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

const HTML_START_MARKER = '<!-- CLIENT_UPDATE_HTML_START -->';
const HTML_END_MARKER = '<!-- CLIENT_UPDATE_HTML_END -->';

function extractHtmlFromMessages(msgs: UIMessage[]): string | null {
  const allText = msgs
    .filter(m => m.role === 'assistant')
    .flatMap(m => m.parts.filter(p => p.type === 'text').map(p => p.content || ''))
    .join('');

  // Method 1: Look for explicit markers
  const endIdx = allText.lastIndexOf(HTML_END_MARKER);
  if (endIdx !== -1) {
    const startIdx = allText.lastIndexOf(HTML_START_MARKER, endIdx);
    if (startIdx !== -1) {
      return allText.slice(startIdx + HTML_START_MARKER.length, endIdx).trim();
    }
  }

  // Method 2: Look for a raw HTML document in the text (non-greedy to avoid over-matching)
  const docTypeMatch = allText.match(/<!DOCTYPE html[\s\S]*?<\/html>/i);
  if (docTypeMatch) return docTypeMatch[0].trim();

  const htmlTagMatch = allText.match(/<html[\s\S]*?<\/html>/i);
  if (htmlTagMatch) return htmlTagMatch[0].trim();

  // Method 3: Check code blocks — AI might wrap HTML in ```html ... ```
  const codeBlockMatch = allText.match(/```html\s*\n([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1].includes('<html')) {
    return codeBlockMatch[1].trim();
  }

  return null;
}

function stripHtmlBlock(text: string): string {
  let result = text;
  // Strip explicit markers
  let sIdx = result.indexOf(HTML_START_MARKER);
  while (sIdx !== -1) {
    const eIdx = result.indexOf(HTML_END_MARKER, sIdx);
    if (eIdx !== -1) {
      result = result.slice(0, sIdx) + result.slice(eIdx + HTML_END_MARKER.length);
    } else {
      result = result.slice(0, sIdx);
      break;
    }
    sIdx = result.indexOf(HTML_START_MARKER);
  }
  // Strip complete raw HTML documents (non-greedy)
  result = result.replace(/<!DOCTYPE html[\s\S]*?<\/html>/gi, '');
  result = result.replace(/<html[\s\S]*?<\/html>/gi, '');
  // Strip partial HTML during streaming (no closing </html> yet)
  result = result.replace(/<!DOCTYPE html[\s\S]*$/gi, '');
  result = result.replace(/<html[\s>][\s\S]*$/gi, '');
  // Strip complete ```html code blocks containing full HTML
  result = result.replace(/```html\s*\n[\s\S]*?```/g, '');
  // Strip partial ```html code blocks during streaming (no closing ``` yet)
  result = result.replace(/```html\s*\n[\s\S]*$/g, '');
  return result;
}

// Default Notion database ID
const LEGACY_NOTION_DATABASE_ID = 'bf762858-67b7-49ca-992d-fdfc8c43d7fa';
const DEFAULT_NOTION_DATABASE_ID = '9e7cd72f-e62c-4514-9456-5f51cbcfe981';

// Default master prompt — empty because the server system prompt is the single source of truth.
// Users can add custom instructions here that get appended as overrides.
const DEFAULT_MASTER_PROMPT = '';

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
  const [reconnecting, setReconnecting] = useState(false);

  // HTML preview/edit/publish state
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string | null>(null);
  const iframeDirtyRef = useRef(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const retryCountRef = useRef(0);
  const lastMessageRef = useRef('');
  const lastConvIdRef = useRef<string | null>(null);
  const MAX_RETRIES = 3;

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Extract HTML from messages when streaming completes
  // Only auto-extract if there's no existing htmlContent (don't overwrite user edits)
  useEffect(() => {
    if (isStreaming) return;
    if (htmlContent) return; // user already has content (extracted or edited) — don't overwrite
    const extracted = extractHtmlFromMessages(messages);
    if (extracted) {
      setHtmlContent(extracted);
      setIframeSrcDoc(extracted);
      iframeDirtyRef.current = false;
    }
  }, [isStreaming, messages, htmlContent]);

  // ── Settings handlers ──────────────────────────────

  const handlePromptChange = (value: string) => {
    setMasterPrompt(value);
    setPromptSaved(false);
  };

  const savePrompt = () => {
    localStorage.setItem('client-update-master-prompt', masterPrompt);
    setPromptSaved(true);
    toast({ title: 'Custom instructions saved!' });
  };

  const resetPrompt = () => {
    setMasterPrompt('');
    localStorage.setItem('client-update-master-prompt', '');
    setPromptSaved(true);
    toast({ title: 'Custom instructions cleared' });
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
    // Capture HTML content from write_file tool calls (server sends this when AI writes an .html file)
    if (event.type === 'html_content' && event.content) {
      setHtmlContent(event.content);
      setIframeSrcDoc(event.content);
      iframeDirtyRef.current = false;
      return;
    }

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
          retryCountRef.current = 0; // reset retries on success
          if (event.conversationId) {
            setConversationId(event.conversationId);
            lastConvIdRef.current = event.conversationId;
          }
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

  // ── Auto-reconnect on disconnect ───────────────────

  const handleDisconnect = useCallback(() => {
    // Don't retry if we've hit the max or user manually aborted
    if (retryCountRef.current >= MAX_RETRIES) {
      setIsStreaming(false);
      setReconnecting(false);
      toast({ title: 'Connection lost after multiple retries', variant: 'destructive' });
      return;
    }

    retryCountRef.current += 1;
    setReconnecting(true);

    // Wait a moment then reconnect
    const delay = Math.min(2000 * retryCountRef.current, 6000);
    setTimeout(() => {
      const convId = lastConvIdRef.current;
      if (!convId) {
        // No conversation yet - restart with original message
        setReconnecting(false);
        if (lastMessageRef.current) {
          startStream(lastMessageRef.current, null);
        } else {
          setIsStreaming(false);
        }
        return;
      }

      // We have a conversation - send "continue" to resume
      const continueMsg: UIMessage = {
        id: uid(),
        role: 'assistant',
        parts: [],
        streaming: true,
      };
      setMessages(prev => [...prev, continueMsg]);

      const abort = streamMessage(
        'Continue from where you left off. Do not repeat what was already generated.',
        convId,
        handleSSEEvent,
        () => { setIsStreaming(false); setReconnecting(false); },
        undefined,
        undefined,
        handleDisconnect,
      );
      abortRef.current = abort;
      setReconnecting(false);
    }, delay);
  }, [handleSSEEvent, toast]);

  // ── Start stream helper ────────────────────────────

  const startStream = useCallback((message: string, convId: string | null) => {
    setIsStreaming(true);
    const abort = streamMessage(
      message,
      convId,
      handleSSEEvent,
      () => { setIsStreaming(false); setReconnecting(false); },
      undefined,
      undefined,
      handleDisconnect,
    );
    abortRef.current = abort;
  }, [handleSSEEvent, handleDisconnect]);

  // ── Page Visibility: keep connection alive in background ───

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isStreaming && !reconnecting) {
        // Tab came back to foreground - the stale timer in chatApi will handle
        // detection. Nothing extra needed here since we have auto-reconnect.
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isStreaming, reconnecting]);

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

    const masterOverride = masterPrompt.trim()
      ? `\n[ADDITIONAL INSTRUCTIONS]\n${masterPrompt.trim()}`
      : '';

    const message = [
      `[CLIENT UPDATE REQUEST]`,
      `Generate a comprehensive client update for "${clientName}" covering ${startDate} to ${endDate}.`,
      ``,
      `Steps:`,
      `1. Call get_client_accounts with client_name="${clientName}" to find ALL linked accounts (ad accounts, social pages, etc.)`,
      `2. Call notion_query_tasks with client_name="${clientName}", start_date="${startDate}", end_date="${endDate}", status_filter="completed"${dbOverride}`,
      `3. Pull Google Ads performance AND change history for the date range`,
      `4. Pull Meta Ads performance AND change history/activities for the date range`,
      `5. Check social media posts (Facebook page and/or Ayrshare profile)`,
      `6. Build a branded HTML update page and save it using write_file (do NOT deploy or call deploy_site — the user will review and publish from the UI). Do NOT output the HTML code in the chat text.`,
      `7. Output the plain text summary in chat`,
      ``,
      `Follow the CLIENT UPDATE BOT rules from your system prompt exactly. Do not skip ANY data source.`,
      aliasInfo,
      additionalContext ? `\nAdditional context from team: ${additionalContext}` : '',
      masterOverride,
    ].filter(Boolean).join('\n');

    // Reset for new generation
    setMessages([]);
    setConversationId(null);
    lastConvIdRef.current = null;
    retryCountRef.current = 0;
    lastMessageRef.current = message;
    setCopied(false);
    setReconnecting(false);
    setHtmlContent(null);
    setIframeSrcDoc(null);
    iframeDirtyRef.current = false;
    setIsEditing(false);
    setPublishedUrl(null);
    setIsPublishing(false);

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
    startStream(message, null);
  };

  // ── Follow-up ──────────────────────────────────────

  const handleFollowUp = () => {
    if (!followUpInput.trim() || isStreaming || !conversationId) return;

    const text = followUpInput.trim();
    setFollowUpInput('');
    lastMessageRef.current = text;
    retryCountRef.current = 0;
    // Reset publish state so new HTML from follow-up doesn't show stale URL
    setPublishedUrl(null);

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
    startStream(text, conversationId);
  };

  // ── Editable iframe helpers ─────────────────────────

  /** Read the current (possibly edited) HTML from the iframe.
   *  Uses cloneNode so the live DOM (with editing UI) stays intact. */
  const getIframeHtml = useCallback((): string | null => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc?.documentElement) return null;
    // Clone the DOM to strip editing artifacts without affecting the live editor
    const clone = doc.documentElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.cu-delete-btn').forEach(el => el.remove());
    const editStyle = clone.querySelector('#cu-edit-styles');
    if (editStyle) editStyle.remove();
    const body = clone.querySelector('body');
    if (body) {
      body.removeAttribute('contenteditable');
      body.style.removeProperty('cursor');
    }
    return '<!DOCTYPE html>\n' + clone.outerHTML;
  }, []);

  /** Sync iframe edits back into htmlContent state */
  const syncIframeToState = useCallback(() => {
    const edited = getIframeHtml();
    if (edited) {
      setHtmlContent(edited);
      // Don't update iframeSrcDoc here — that would reload the iframe and lose designMode
    }
  }, [getIframeHtml]);

  /** Toggle between visual editor and source view */
  const handleToggleSource = useCallback(() => {
    if (!isEditing) {
      // Switching TO source view — save iframe edits first
      syncIframeToState();
    } else {
      // Switching FROM source back to visual — push source edits to iframe
      setIframeSrcDoc(htmlContent);
      iframeDirtyRef.current = false;
    }
    setIsEditing(prev => !prev);
  }, [isEditing, syncIframeToState, htmlContent]);

  // ── Publish to live link ────────────────────────────

  const handlePublish = async () => {
    if (!clientName.trim()) return;
    // Read latest HTML: from iframe if in visual mode, from state if in source mode
    let finalHtml: string | null;
    if (isEditing) {
      finalHtml = htmlContent;
    } else {
      finalHtml = getIframeHtml() || htmlContent;
    }
    if (!finalHtml) {
      toast({ title: 'No HTML content to publish', variant: 'destructive' });
      return;
    }
    setIsPublishing(true);
    try {
      const slug = clientName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      const result = await publishClientUpdate(finalHtml, slug);
      setPublishedUrl(result.url);
      setHtmlContent(finalHtml); // sync state with what was published
      iframeDirtyRef.current = false;
      toast({ title: 'Published successfully!' });
    } catch (err: any) {
      toast({ title: err.message || 'Publish failed', variant: 'destructive' });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!publishedUrl) return;
    await navigator.clipboard.writeText(publishedUrl);
    setUrlCopied(true);
    toast({ title: 'URL copied to clipboard!' });
    setTimeout(() => setUrlCopied(false), 2000);
  };

  // ── New update ─────────────────────────────────────

  const handleNewUpdate = () => {
    if (isStreaming && abortRef.current) {
      abortRef.current();
    }
    setMessages([]);
    setConversationId(null);
    lastConvIdRef.current = null;
    setIsStreaming(false);
    setCopied(false);
    setHtmlContent(null);
    setIframeSrcDoc(null);
    iframeDirtyRef.current = false;
    setIsEditing(false);
    setPublishedUrl(null);
    setIsPublishing(false);
    setClientName('');
    inputRef.current?.focus();
  };

  // ── Copy output ────────────────────────────────────

  const handleCopy = async () => {
    const allText = messages
      .filter(m => m.role === 'assistant')
      .flatMap(m => m.parts.filter(p => p.type === 'text').map(p => p.content || ''))
      .join('');
    const cleanText = stripHtmlBlock(allText);
    if (!cleanText.trim()) return;
    await navigator.clipboard.writeText(cleanText);
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
                  <Label className="text-xs font-medium text-muted-foreground">Custom Instructions (optional, appended to system rules)</Label>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={resetPrompt} className="h-7 text-xs">Clear</Button>
                    <Button variant="outline" size="sm" onClick={savePrompt} disabled={promptSaved} className="h-7 text-xs">
                      <Save className="h-3 w-3 mr-1" />Save
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={masterPrompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="Optional: Add custom instructions that will be appended to the system prompt. Leave blank to use default behavior (recommended)."
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
                        // Strip out any HTML update block from markdown rendering
                        const displayContent = stripHtmlBlock(part.content);
                        if (!displayContent.trim()) return null;
                        return (
                          <div key={i} className="prose prose-sm max-w-none dark:prose-invert">
                            <ReactMarkdown>{displayContent}</ReactMarkdown>
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
                        <span>{reconnecting ? `Reconnecting (attempt ${retryCountRef.current}/${MAX_RETRIES})...` : 'Working...'}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Publish panel — visible whenever there's output (stays during streaming) */}
            {hasOutput && (
              <div className="mt-6 pt-4 border-t space-y-4">
                {/* Published URL banner */}
                {publishedUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Globe className="h-5 w-5 text-primary shrink-0" />
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline truncate flex-1"
                    >
                      {publishedUrl}
                    </a>
                    <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                      {urlCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  {htmlContent !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleSource}
                    >
                      {isEditing ? (
                        <><Eye className="mr-1 h-4 w-4" />Visual Editor</>
                      ) : (
                        <><Pencil className="mr-1 h-4 w-4" />View Source</>
                      )}
                    </Button>
                  )}
                  {htmlContent === null && !publishedUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setHtmlContent(''); setIsEditing(true); }}
                    >
                      <Pencil className="mr-1 h-4 w-4" />Paste HTML
                    </Button>
                  )}
                  <Button
                    onClick={handlePublish}
                    disabled={isPublishing || !htmlContent || isStreaming}
                    size="sm"
                    className="bg-primary"
                  >
                    {isPublishing ? (
                      <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Publishing...</>
                    ) : publishedUrl ? (
                      <><Globe className="mr-1 h-4 w-4" />Re-publish</>
                    ) : (
                      <><Globe className="mr-1 h-4 w-4" />Publish to Live Link</>
                    )}
                  </Button>
                </div>

                {htmlContent && !isEditing && (
                  <p className="text-xs text-muted-foreground">
                    Click directly on the page below to edit text, delete sections, or make changes. Then click "Publish to Live Link".
                  </p>
                )}

                {/* Source editor (raw HTML) */}
                {htmlContent !== null && isEditing ? (
                  <Textarea
                    value={htmlContent}
                    onChange={(e) => setHtmlContent(e.target.value)}
                    placeholder="Paste your HTML here..."
                    className="font-mono text-xs min-h-[400px]"
                  />
                ) : htmlContent ? (
                  /* Visual editor: editable iframe — NO sandbox so designMode works */
                  <div
                    className="border-2 border-dashed border-primary/30 rounded-lg overflow-hidden bg-white"
                    onClick={() => {
                      // Clicking the container focuses the iframe for editing
                      const iframe = iframeRef.current;
                      if (iframe?.contentWindow) {
                        iframe.contentWindow.focus();
                      }
                      if (iframe?.contentDocument?.body) {
                        iframe.contentDocument.body.focus();
                      }
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      srcDoc={iframeSrcDoc || htmlContent}
                      className="w-full border-0"
                      style={{ minHeight: '600px' }}
                      title="Client Update Preview"
                      onLoad={() => {
                        const iframe = iframeRef.current;
                        if (!iframe?.contentDocument) return;
                        const doc = iframe.contentDocument;

                        // Auto-resize
                        const height = doc.body?.scrollHeight || 600;
                        iframe.style.height = `${Math.max(600, height + 32)}px`;

                        // Enable editing — use BOTH designMode and contentEditable for
                        // maximum browser compatibility. Some browsers ignore one or the other.
                        const enableEditing = () => {
                          try { doc.designMode = 'on'; } catch (_) { /* some browsers throw */ }
                          if (doc.body) {
                            doc.body.contentEditable = 'true';
                            doc.body.style.cursor = 'text';
                          }
                        };

                        // Set immediately + retry after delays (some browsers need settling time)
                        enableEditing();
                        setTimeout(enableEditing, 50);
                        setTimeout(enableEditing, 200);
                        setTimeout(enableEditing, 500);

                        // -- Inject delete buttons so users can remove elements --
                        if (!doc.getElementById('cu-edit-styles')) {
                          const editStyle = doc.createElement('style');
                          editStyle.id = 'cu-edit-styles';
                          editStyle.textContent = `
                            li, .section, .stat-card { position: relative !important; }
                            .cu-delete-btn {
                              position: absolute;
                              right: 6px;
                              top: 50%;
                              transform: translateY(-50%);
                              width: 22px;
                              height: 22px;
                              border-radius: 50%;
                              background: rgba(233, 69, 96, 0.9);
                              color: white;
                              display: none;
                              align-items: center;
                              justify-content: center;
                              cursor: pointer;
                              font-size: 15px;
                              font-weight: bold;
                              line-height: 22px;
                              text-align: center;
                              user-select: none;
                              -webkit-user-select: none;
                              z-index: 999;
                              box-shadow: 0 1px 4px rgba(0,0,0,0.18);
                            }
                            .cu-delete-btn:hover {
                              background: #c0392b;
                              transform: translateY(-50%) scale(1.15);
                            }
                            .section > .cu-delete-btn {
                              top: 14px;
                              right: 14px;
                              transform: none;
                              width: 26px;
                              height: 26px;
                              font-size: 17px;
                              line-height: 26px;
                              opacity: 0.35;
                              transition: opacity 0.15s;
                            }
                            .section > .cu-delete-btn:hover {
                              opacity: 1;
                              transform: scale(1.15);
                            }
                            .section:hover > .cu-delete-btn { display: flex; }
                            .stat-card > .cu-delete-btn {
                              top: 6px;
                              right: 6px;
                              transform: none;
                              width: 18px;
                              height: 18px;
                              font-size: 12px;
                              line-height: 18px;
                              opacity: 0.35;
                              transition: opacity 0.15s;
                            }
                            .stat-card > .cu-delete-btn:hover {
                              opacity: 1;
                              transform: scale(1.15);
                            }
                            .stat-card:hover > .cu-delete-btn { display: flex; }
                            li:hover > .cu-delete-btn { display: flex; }
                          `;
                          doc.head.appendChild(editStyle);
                        }

                        const addDeleteBtn = (el: Element) => {
                          if (el.querySelector(':scope > .cu-delete-btn')) return;
                          const btn = doc.createElement('span');
                          btn.className = 'cu-delete-btn';
                          btn.textContent = '\u00d7';
                          btn.setAttribute('contenteditable', 'false');
                          btn.addEventListener('mousedown', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            el.remove();
                            iframeDirtyRef.current = true;
                          });
                          el.appendChild(btn);
                        };

                        doc.querySelectorAll('li').forEach(addDeleteBtn);
                        doc.querySelectorAll('.section').forEach(addDeleteBtn);
                        doc.querySelectorAll('.stat-card').forEach(addDeleteBtn);

                        // Track user edits to prevent external overwrites
                        doc.addEventListener('input', () => {
                          iframeDirtyRef.current = true;
                        });
                      }}
                    />
                  </div>
                ) : null}
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
