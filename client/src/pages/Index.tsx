import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Loader2, MessageSquare, Trash2,
  PanelLeftClose, PanelLeft, ArrowRight, Check, X,
  Pencil, Brain, Bell, Square, Paperclip, FileText,
  Activity, Gauge, ChevronDown, ChevronRight,
  FolderPlus, FolderKanban, Folder, FolderOpen,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import AdminHeader from '@/components/AdminHeader';
import { ClientMentionPopover } from '@/components/ClientMentionPopover';
import teamPitLogo from '@/assets/team-pit-logo.png';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  streamMessage,
  fetchConversations as apiFetchConversations,
  fetchMessages as apiFetchMessages,
  deleteConversation as apiDeleteConversation,
  renameConversation as apiRenameConversation,
  fetchNotifications as apiFetchNotifications,
  ensureTeamMember,
  checkJobStatus,
  fetchActiveJobs,
  reconnectToJob,
  type SSEEvent,
  type Conversation as ApiConversation,
} from '@/lib/chatApi';
import { ToolCallBlock } from '@/components/chat/ToolCallBlock';
import { useVoiceChat, VoiceModeToggle, MicButton } from '@/components/chat/VoiceChat';
import { useVoicePreference } from '@/hooks/useVoicePreference';
import { VoiceConversationOverlay } from '@/components/chat/VoiceConversationOverlay';
import { MemoryPanel } from '@/components/MemoryPanel';
import { ProjectsPanel } from '@/components/chat/ProjectsPanel';
import { useModelPreference } from '@/hooks/useModelPreference';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  fetchChatFolders,
  createChatFolder,
  updateChatFolder,
  deleteChatFolder,
  moveConversationToFolder,
  fetchChatProjects,
  type ChatFolder,
  type ChatProject,
} from '@/lib/chatApi';

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

type EditingState = { id: string; title: string } | null;

// ── Constants ────────────────────────────────────────

const tools = [
  { label: 'Proposal Builder', route: '/proposal-builder' },
  { label: 'SEO Writer', route: '/seo-writer' },
  { label: 'Creative Studio', route: '/creative-studio' },
  { label: 'QA Bot', route: '/qa-bot' },
  { label: 'Email Writer', route: '/email-writer' },
  { label: 'Client Update', route: '/client-update' },
  { label: 'Client Health', route: '/client-health' },
  { label: 'Decks', route: '/decks' },
  { label: 'PPC Optimizer', route: '/ppc-optimizer' },
];

const quickPrompts = [
  "Give me a full status report on all our clients",
  "Which clients have the worst health scores right now?",
  "What's going on with our PPC performance this week?",
  "Show me all recent ad reviews and key insights",
  "Which clients need attention — low scores, missing configs, or high CPA?",
  "What SEO progress have we made across all clients?",
];

// ── Helpers ──────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

let nextMsgId = 0;
function uid() { return `msg-${++nextMsgId}`; }

// ── Drag-and-drop helpers ────────────────────────────

function DraggableConversation({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

function DroppableZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[4px] rounded transition-colors ${isOver ? 'bg-primary/10 ring-1 ring-primary/30' : ''}`}
    >
      {children}
    </div>
  );
}

// ── Component ────────────────────────────────────────

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();

  // Chat state
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  // Conversation state
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [editing, setEditing] = useState<EditingState>(null);

  // Memory & notifications
  const [showMemory, setShowMemory] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [memberName, setMemberName] = useState('');

  // Folders & projects
  const [chatFolders, setChatFolders] = useState<ChatFolder[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectsList, setProjectsList] = useState<ChatProject[]>([]);

  // Active background jobs
  const [activeJobConvIds, setActiveJobConvIds] = useState<Set<string>>(new Set());

  // Low token mode
  const [lowTokenMode, setLowTokenMode] = useState(false);

  // @mention state
  const [mentionedClients, setMentionedClients] = useState<string[]>([]);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  // SSE resilience — auto-reconnect indefinitely until the job finishes
  const [disconnected, setDisconnected] = useState(false);
  const lastUserMessageRef = useRef<string>('');
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 10; // effectively unlimited with backoff

  // Refs
  const editInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice chat — use refs for callbacks to avoid stale closures
  const sendMessageRef = useRef<(text?: string) => void>(() => {});
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const { voiceId } = useVoicePreference();
  const { modelId, setModelId } = useModelPreference();
  const [showModelPicker, setShowModelPicker] = useState(false);
  const voiceChat = useVoiceChat({
    onTranscript: (text) => sendMessageRef.current(text),
    onError: (msg) => toast.error(msg),
    voiceId,
  });
  const voiceFeedTextRef = useRef(voiceChat.feedText);
  voiceFeedTextRef.current = voiceChat.feedText;
  const voiceFinishRef = useRef(voiceChat.finishSpeaking);
  voiceFinishRef.current = voiceChat.finishSpeaking;
  const voiceEnabledRef = useRef(voiceChat.voiceEnabled);
  voiceEnabledRef.current = voiceChat.voiceEnabled;
  const insideToolCallRef = useRef(false);

  // DnD sensor for folder drag-and-drop
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Backtick (`) hotkey: interrupt agent / toggle mic during voice mode
  // Works globally — when voice is on, backtick always controls the mic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!voiceChat.voiceEnabled) return;
      if (e.key !== '`') return;
      e.preventDefault();

      if (voiceChat.isSpeaking) {
        // Agent is talking — interrupt and take over
        voiceChat.interruptAndListen();
      } else if (voiceChat.isListening) {
        // Already listening — stop
        voiceChat.stopListening();
        setShowVoiceOverlay(false);
      } else {
        // Idle — start listening
        voiceChat.startListening();
        setShowVoiceOverlay(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voiceChat.voiceEnabled, voiceChat.isSpeaking, voiceChat.isListening, voiceChat.interruptAndListen, voiceChat.stopListening, voiceChat.startListening]);

  // Open sidebar by default on desktop
  useEffect(() => {
    if (!isMobile) setSidebarOpen(true);
  }, [isMobile]);

  // Initialize: ensure team member + load conversations (retry once on auth failure)
  useEffect(() => {
    (async () => {
      try {
        const { name } = await ensureTeamMember();
        setMemberName(name);
        loadConversations();
      } catch {
        // Token might not be ready yet after login — wait and retry once
        await new Promise(r => setTimeout(r, 1500));
        try {
          const { name } = await ensureTeamMember();
          setMemberName(name);
          loadConversations();
        } catch { /* auth will handle redirect */ }
      }
    })();
  }, []);

  // Poll notifications + cron jobs + active jobs every 30s
  useEffect(() => {
    const poll = async () => {
      try {
        const { count } = await apiFetchNotifications();
        setUnreadCount(count);
      } catch { /* ignore */ }
      try {
        const ids = await fetchActiveJobs();
        setActiveJobConvIds(new Set(ids));
      } catch { /* ignore */ }
    };
    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Page Visibility: when the tab comes back from background, check if the
  // agent is still running and silently reconnect if we lost the SSE stream.
  // Browsers throttle/freeze background tabs, which kills fetch streams.
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      if (isStreaming) return; // still connected, nothing to do
      if (!activeConvoId) return;

      try {
        const status = await checkJobStatus(activeConvoId);
        if (!status.active) return; // job already finished

        // Agent is still running but we lost the stream — reconnect silently
        console.log('[visibility] Tab resumed — agent still running, reconnecting...');
        setIsStreaming(true);
        setDisconnected(false);

        // Find or create an assistant message to append to
        const assistantId = `reconnect-${Date.now()}`;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.streaming) return prev; // already have one
          return [...prev, { id: assistantId, role: 'assistant', parts: [{ type: 'text', content: '*(reconnected)*\n\n' }], streaming: true }];
        });

        abortRef.current = reconnectToJob(
          activeConvoId,
          (event: SSEEvent) => {
            setMessages(prev => {
              const msgs = [...prev];
              const aIdx = msgs.length - 1; // last assistant message
              if (aIdx < 0 || msgs[aIdx].role !== 'assistant') return prev;
              const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts] };

              switch (event.type) {
                case 'text': {
                  const lastPart = assistant.parts[assistant.parts.length - 1];
                  if (lastPart?.type === 'text') {
                    assistant.parts[assistant.parts.length - 1] = { ...lastPart, content: (lastPart.content ?? '') + (event.delta ?? '') };
                  } else {
                    assistant.parts.push({ type: 'text', content: event.delta ?? '' });
                  }
                  break;
                }
                case 'tool_start':
                  assistant.parts.push({ type: 'tool_start', toolName: event.name });
                  break;
                case 'tool_result':
                  for (let i = assistant.parts.length - 1; i >= 0; i--) {
                    if (assistant.parts[i].type === 'tool_start' && assistant.parts[i].toolName === event.name) {
                      assistant.parts[i] = { type: 'tool_result', toolName: event.name, toolOutput: event.output };
                      break;
                    }
                  }
                  break;
                case 'done':
                  assistant.streaming = false;
                  reconnectAttemptsRef.current = 0;
                  break;
                case 'error':
                  assistant.streaming = false;
                  assistant.parts.push({ type: 'text', content: `\n\n**Error:** ${event.message}` });
                  break;
              }

              msgs[aIdx] = assistant;
              return msgs;
            });
          },
          () => {
            setIsStreaming(false);
            loadConversations();
          },
        );
      } catch {
        // Couldn't check status — ignore, normal reconnect logic will handle it
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [activeConvoId, isStreaming]);

  // Track when user scrolls up so we don't force them back down
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      userScrolledUpRef.current = distanceFromBottom > 150;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll only when user is near the bottom
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ── Data loading ───────────────────────────────────

  const loadConversations = async (retried = false) => {
    setLoadingHistory(true);
    try {
      const [data, folders] = await Promise.all([
        apiFetchConversations(),
        fetchChatFolders(),
      ]);
      setConversations(data);
      setChatFolders(folders);
    } catch (err) {
      console.error('[loadConversations] Failed:', err);
      if (!retried) {
        // Retry once after a short delay (handles token refresh timing)
        await new Promise(r => setTimeout(r, 2000));
        return loadConversations(true);
      }
      toast.error('Failed to load past conversations');
    }
    setLoadingHistory(false);
  };



  const selectConversation = async (convoId: string) => {
    // Abort current stream if switching conversations (server-side loop keeps running)
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setActiveConvoId(convoId);
    if (isMobile) setSidebarOpen(false);

    // Auto-set project context when selecting a conversation with a project
    const conv = conversations.find(c => c.id === convoId);
    if (conv?.project_id) {
      setActiveProjectId(conv.project_id);
    } else {
      setActiveProjectId(null);
      setActiveProjectName(null);
    }
    try {
      const data = await apiFetchMessages(convoId);
      setMessages(data.map(m => ({
        id: m.id,
        role: m.role,
        parts: [{ type: 'text' as const, content: m.content }],
      })));

      // Check if there's an active background agent job for this conversation
      const status = await checkJobStatus(convoId);
      if (status.active) {
        const assistantId = uid();
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          parts: [],
          streaming: true,
        }]);
        setIsStreaming(true);

        const abort = reconnectToJob(
          convoId,
          (event: SSEEvent) => {
            if (event.type === 'text' && event.delta) {
              if (!insideToolCallRef.current) voiceFeedTextRef.current(event.delta);
            } else if (event.type === 'tool_start') {
              insideToolCallRef.current = true;
            } else if (event.type === 'tool_result') {
              insideToolCallRef.current = false;
            } else if (event.type === 'done') {
              insideToolCallRef.current = false;
              voiceFinishRef.current();
            }

            setMessages(prev => {
              const msgs = [...prev];
              const aIdx = msgs.findIndex(m => m.id === assistantId);
              if (aIdx === -1) return prev;
              const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts] };

              switch (event.type) {
                case 'text': {
                  const lastPart = assistant.parts[assistant.parts.length - 1];
                  if (lastPart?.type === 'text') {
                    assistant.parts[assistant.parts.length - 1] = {
                      ...lastPart,
                      content: (lastPart.content ?? '') + (event.delta ?? ''),
                    };
                  } else {
                    assistant.parts.push({ type: 'text', content: event.delta ?? '' });
                  }
                  break;
                }
                case 'tool_start':
                  assistant.parts.push({ type: 'tool_start', toolName: event.name });
                  break;
                case 'tool_result': {
                  for (let i = assistant.parts.length - 1; i >= 0; i--) {
                    if (assistant.parts[i].type === 'tool_start' && assistant.parts[i].toolName === event.name) {
                      assistant.parts[i] = { type: 'tool_result', toolName: event.name, toolOutput: event.output };
                      break;
                    }
                  }
                  break;
                }
                case 'done':
                  assistant.streaming = false;
                  break;
                case 'error':
                  assistant.streaming = false;
                  assistant.parts.push({ type: 'text', content: `\n\n**Error:** ${event.message}` });
                  break;
              }

              msgs[aIdx] = assistant;
              return msgs;
            });
          },
          () => {
            setIsStreaming(false);
            loadConversations();
            setActiveJobConvIds(prev => {
              const next = new Set(prev);
              next.delete(convoId);
              return next;
            });
          },
        );
        abortRef.current = abort;
      }
    } catch {
      toast.error('Failed to load messages');
    }
  };

  const startNewChat = (projectId?: string | null) => {
    if (abortRef.current) abortRef.current();
    setActiveConvoId(null);
    setMessages([]);
    setInput('');
    setFiles([]);
    setMentionedClients([]);
    setIsStreaming(false);
    if (projectId !== undefined) {
      setActiveProjectId(projectId || null);
    } else {
      setActiveProjectId(null);
      setActiveProjectName(null);
    }
    if (isMobile) setSidebarOpen(false);
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (convoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiDeleteConversation(convoId);
    setConversations(prev => prev.filter(c => c.id !== convoId));
    if (activeConvoId === convoId) startNewChat();
  };

  const startRename = (convo: ApiConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing({ id: convo.id, title: convo.title });
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const confirmRename = async () => {
    if (!editing || !editing.title.trim()) { setEditing(null); return; }
    const newTitle = editing.title.trim();
    setConversations(prev => prev.map(c => c.id === editing.id ? { ...c, title: newTitle } : c));
    setEditing(null);
    try {
      await apiRenameConversation(editing.id, newTitle);
    } catch {
      toast.error('Failed to rename conversation');
      loadConversations();
    }
  };

  const loadMemory = () => setShowMemory(true);

  // ── Sending messages ──────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const msgText = text || input.trim();
    if ((!msgText && files.length === 0) || isStreaming) return;
    lastUserMessageRef.current = msgText;
    setDisconnected(false);
    userScrolledUpRef.current = false;

    // Build display text
    let displayText = msgText;
    if (files.length > 0) {
      const fileNames = files.map(f => f.name).join(', ');
      displayText = msgText ? `${msgText}\n\n[Attached: ${fileNames}]` : `[Attached: ${fileNames}]`;
    }

    const userMsg: UIMessage = {
      id: uid(),
      role: 'user',
      parts: [{ type: 'text', content: displayText }],
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const currentFiles = [...files];
    setFiles([]);

    // Create assistant placeholder
    const assistantId = uid();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      parts: [],
      streaming: true,
    }]);

    const currentMentions = [...mentionedClients];
    setMentionedClients([]);

    const abort = streamMessage(
      msgText,
      activeConvoId,
      (event: SSEEvent) => {
        // Voice TTS side effects (via refs to avoid stale closures)
        if (event.type === 'text' && event.delta) {
          if (!insideToolCallRef.current) voiceFeedTextRef.current(event.delta);
        } else if (event.type === 'tool_start') {
          insideToolCallRef.current = true;
        } else if (event.type === 'tool_result') {
          insideToolCallRef.current = false;
        } else if (event.type === 'done') {
          insideToolCallRef.current = false;
          voiceFinishRef.current();
        }

        setMessages(prev => {
          const msgs = [...prev];
          const aIdx = msgs.findIndex(m => m.id === assistantId);
          if (aIdx === -1) return prev;
          const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts] };

          switch (event.type) {
            case 'start':
              // Capture conversation ID immediately so reconnect works even if stream drops
              if (event.conversationId && !activeConvoId) {
                setActiveConvoId(event.conversationId);
              }
              break;
            case 'text': {
              // Find or create the last text part
              const lastPart = assistant.parts[assistant.parts.length - 1];
              if (lastPart?.type === 'text') {
                assistant.parts[assistant.parts.length - 1] = {
                  ...lastPart,
                  content: (lastPart.content ?? '') + (event.delta ?? ''),
                };
              } else {
                assistant.parts.push({ type: 'text', content: event.delta ?? '' });
              }
              break;
            }
            case 'tool_start':
              assistant.parts.push({ type: 'tool_start', toolName: event.name });
              break;
            case 'tool_result': {
              // Find the matching pending tool_start and update it
              for (let i = assistant.parts.length - 1; i >= 0; i--) {
                if (assistant.parts[i].type === 'tool_start' && assistant.parts[i].toolName === event.name) {
                  assistant.parts[i] = {
                    type: 'tool_result',
                    toolName: event.name,
                    toolOutput: event.output,
                  };
                  break;
                }
              }
              break;
            }
            case 'done':
              assistant.streaming = false;
              reconnectAttemptsRef.current = 0; // Reset on successful completion
              if (event.conversationId && !activeConvoId) {
                setActiveConvoId(event.conversationId);
              }
              break;
            case 'error':
              assistant.streaming = false;
              assistant.parts.push({ type: 'text', content: `\n\n**Error:** ${event.message}` });
              break;
          }

          msgs[aIdx] = assistant;
          return msgs;
        });
      },
      () => {
        setIsStreaming(false);
        loadConversations(); // refresh sidebar
      },
      currentFiles.length > 0 ? currentFiles : undefined,
      currentMentions.length > 0 ? currentMentions : undefined,
      async () => {
        // SSE stream ended without a "done" event — connection dropped
        // In voice mode, do NOT auto-reconnect (it creates a loop)
        if (voiceEnabledRef.current) {
          console.log('[SSE] Connection dropped during voice mode — not auto-reconnecting');
          voiceChat.stopEverything();
          setMessages(prev => {
            const msgs = [...prev];
            const aIdx = msgs.findIndex(m => m.id === assistantId);
            if (aIdx === -1) return prev;
            const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts], streaming: false };
            msgs[aIdx] = assistant;
            return msgs;
          });
          return;
        }

        // Use the reconnect endpoint instead of re-sending the prompt.
        // This replays buffered events and subscribes to live updates
        // without triggering a new AI response.
        const convoId = activeConvoId;
        if (!convoId) {
          setMessages(prev => {
            const msgs = [...prev];
            const aIdx = msgs.findIndex(m => m.id === assistantId);
            if (aIdx === -1) return prev;
            const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts], streaming: false };
            assistant.parts.push({ type: 'text', content: '\n\nConnection lost (no conversation to reconnect).' });
            msgs[aIdx] = assistant;
            return msgs;
          });
          return;
        }

        reconnectAttemptsRef.current += 1;
        if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
          // Exhausted auto-reconnect attempts — show manual resume
          setDisconnected(true);
          reconnectAttemptsRef.current = 0;
          setMessages(prev => {
            const msgs = [...prev];
            const aIdx = msgs.findIndex(m => m.id === assistantId);
            if (aIdx === -1) return prev;
            const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts], streaming: false };
            assistant.parts.push({ type: 'text', content: '\n\nConnection lost. Click Resume to continue.' });
            msgs[aIdx] = assistant;
            return msgs;
          });
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, 8s, 8s...
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 8000);
        console.log(`[SSE] Connection dropped, reconnecting in ${backoffMs}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`);
        await new Promise(r => setTimeout(r, backoffMs));

        // Check if the agent is still running on the server
        const status = await checkJobStatus(convoId);

        if (status.active) {
          // Agent is still running — reconnect to the existing stream
          console.log('[SSE] Agent still running, reconnecting to existing job...');
          setMessages(prev => {
            const msgs = [...prev];
            const aIdx = msgs.findIndex(m => m.id === assistantId);
            if (aIdx === -1) return prev;
            const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts] };
            assistant.parts.push({ type: 'text', content: '\n\n*(reconnecting...)*\n\n' });
            msgs[aIdx] = assistant;
            return msgs;
          });

          setIsStreaming(true);
          abortRef.current = reconnectToJob(
            convoId,
            (event: SSEEvent) => {
              setMessages(prev => {
                const msgs = [...prev];
                const aIdx = msgs.findIndex(m => m.id === assistantId);
                if (aIdx === -1) return prev;
                const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts] };

                switch (event.type) {
                  case 'text': {
                    const lastPart = assistant.parts[assistant.parts.length - 1];
                    if (lastPart?.type === 'text') {
                      assistant.parts[assistant.parts.length - 1] = {
                        ...lastPart,
                        content: (lastPart.content ?? '') + (event.delta ?? ''),
                      };
                    } else {
                      assistant.parts.push({ type: 'text', content: event.delta ?? '' });
                    }
                    break;
                  }
                  case 'tool_start':
                    assistant.parts.push({ type: 'tool_start', toolName: event.name });
                    break;
                  case 'tool_result':
                    for (let i = assistant.parts.length - 1; i >= 0; i--) {
                      if (assistant.parts[i].type === 'tool_start' && assistant.parts[i].toolName === event.name) {
                        assistant.parts[i] = { type: 'tool_result', toolName: event.name, toolOutput: event.output };
                        break;
                      }
                    }
                    break;
                  case 'done':
                    assistant.streaming = false;
                    reconnectAttemptsRef.current = 0;
                    break;
                  case 'error':
                    assistant.streaming = false;
                    assistant.parts.push({ type: 'text', content: `\n\n**Error:** ${event.message}` });
                    break;
                }

                msgs[aIdx] = assistant;
                return msgs;
              });
            },
            () => {
              setIsStreaming(false);
              loadConversations();
            },
          );
        } else {
          // Agent already finished — just mark stream as done, refresh messages
          console.log('[SSE] Agent already finished, refreshing conversation...');
          reconnectAttemptsRef.current = 0;
          setMessages(prev => {
            const msgs = [...prev];
            const aIdx = msgs.findIndex(m => m.id === assistantId);
            if (aIdx === -1) return prev;
            const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts], streaming: false };
            msgs[aIdx] = assistant;
            return msgs;
          });
          // Reload the conversation to get the full saved response
          if (convoId) {
            const saved = await apiFetchMessages(convoId);
            if (saved.length > 0) {
              setMessages(saved.map((m: any, i: number) => ({
                id: `msg-${i}`,
                role: m.role,
                parts: [{ type: 'text' as const, content: m.content }],
              })));
            }
          }
        }
      },
      lowTokenMode,
      modelId,
      activeProjectId,
    );

    abortRef.current = abort;
  }, [input, files, isStreaming, activeConvoId, mentionedClients, lowTokenMode, activeProjectId]);

  sendMessageRef.current = sendMessage;

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    // Kill voice audio + mic when user hits stop
    voiceChat.stopEverything();
  };

  // ── Input handlers ─────────────────────────────────

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (atMatch) {
      setShowMentionPopover(true);
      setMentionQuery(atMatch[1]);
    } else {
      setShowMentionPopover(false);
      setMentionQuery('');
    }
  };

  const handleMentionSelect = (clientName: string) => {
    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const textBeforeCursor = input.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (atMatch) {
      const beforeAt = textBeforeCursor.slice(0, atMatch.index);
      const afterCursor = input.slice(cursorPos);
      const newInput = `${beforeAt}@${clientName} ${afterCursor}`;
      setInput(newInput);
      if (!mentionedClients.includes(clientName)) {
        setMentionedClients(prev => [...prev, clientName]);
      }
    }
    setShowMentionPopover(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // When mention popover is open, let it handle arrow keys + Enter
    if (showMentionPopover && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Tab')) {
      return; // popover's keydown handler (captured phase) will handle it
    }
    if (e.key === 'Escape' && showMentionPopover) {
      setShowMentionPopover(false);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) setFiles(prev => [...prev, ...selected]);
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  // ── Folder handlers ────────────────────────────────

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const folder = await createChatFolder(newFolderName.trim());
      setChatFolders(prev => [...prev, folder]);
      setNewFolderName('');
      setCreatingFolder(false);
    } catch {
      toast.error('Failed to create folder');
    }
  };

  const handleRenameFolder = async (folderId: string) => {
    if (!editFolderName.trim()) { setEditingFolderId(null); return; }
    try {
      await updateChatFolder(folderId, { name: editFolderName.trim() });
      setChatFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: editFolderName.trim() } : f));
      setEditingFolderId(null);
    } catch {
      toast.error('Failed to rename folder');
    }
  };

  const handleToggleFolder = async (folderId: string) => {
    const folder = chatFolders.find(f => f.id === folderId);
    if (!folder) return;
    const newCollapsed = !folder.is_collapsed;
    setChatFolders(prev => prev.map(f => f.id === folderId ? { ...f, is_collapsed: newCollapsed } : f));
    updateChatFolder(folderId, { is_collapsed: newCollapsed }).catch(() => {});
  };

  const handleDeleteFolder = async (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteChatFolder(folderId);
      setChatFolders(prev => prev.filter(f => f.id !== folderId));
      // Conversations get folder_id=null via DB cascade
      setConversations(prev => prev.map(c => c.folder_id === folderId ? { ...c, folder_id: null } : c));
    } catch {
      toast.error('Failed to delete folder');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const convId = active.id as string;
    const targetId = over.id as string;

    // Target is a folder id or 'unfiled'
    const folderId = targetId === 'unfiled' ? null : targetId;

    // Optimistic update
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, folder_id: folderId } : c));
    try {
      await moveConversationToFolder(convId, folderId);
    } catch {
      toast.error('Failed to move conversation');
      loadConversations(); // revert
    }
  };

  // ── Filtered conversations ─────────────────────────

  const filteredConversations = conversations.filter(c =>
    !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const folderedConversations = chatFolders.map(folder => ({
    folder,
    conversations: filteredConversations.filter(c => c.folder_id === folder.id),
  }));
  const unfiledConversations = filteredConversations.filter(c => !c.folder_id);

  const isEmptyChat = messages.length === 0;
  const canSend = !isStreaming && (input.trim() || files.length > 0);

  // ── Render helpers ─────────────────────────────────

  const renderConversationItem = (c: ApiConversation) => (
    <button
      key={c.id}
      onClick={() => { if (editing?.id !== c.id) selectConversation(c.id); }}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm group flex items-center gap-2 mb-0.5 transition-colors ${
        activeConvoId === c.id
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }`}
    >
      {activeJobConvIds.has(c.id) ? (
        <Loader2 className="w-3.5 h-3.5 shrink-0 text-primary animate-spin" />
      ) : (
        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      )}
      {editing?.id === c.id ? (
        <input
          ref={editInputRef}
          value={editing.title}
          onChange={e => setEditing({ ...editing, title: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setEditing(null); }}
          onBlur={() => confirmRename()}
          onClick={e => e.stopPropagation()}
          className="flex-1 min-w-0 bg-transparent border-b border-primary text-foreground text-sm outline-none"
        />
      ) : (
        <span className="truncate flex-1" onDoubleClick={(e) => startRename(c, e as any)}>{c.title}</span>
      )}
      {c.has_unread && (
        <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
      )}
      {editing?.id === c.id ? (
        <div className="flex items-center gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); confirmRename(); }} className="p-1 hover:text-primary transition-colors">
            <Check className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setEditing(null); }} className="p-1 hover:text-destructive transition-colors">
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => startRename(c, e)} className="p-1 hover:text-primary transition-colors">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={(e) => handleDeleteConversation(c.id, e)} className="p-1 hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </button>
  );

  const renderMessageParts = (msg: UIMessage) => {
    if (msg.parts.length === 0 && msg.streaming) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Thinking...</span>
        </div>
      );
    }

    // Voice mode: show compact speaking indicator while streaming
    if (voiceChat.voiceEnabled && msg.streaming && (voiceChat.isSpeaking || voiceChat.inConversation)) {
      // Show tool calls but collapse text into a voice indicator
      const toolParts = msg.parts.filter(p => p.type === 'tool_start' || p.type === 'tool_result');
      return (
        <>
          {toolParts.map((part, i) => {
            if (part.type === 'tool_start') return <ToolCallBlock key={i} name={part.toolName ?? 'unknown'} pending />;
            if (part.type === 'tool_result') return <ToolCallBlock key={i} name={part.toolName ?? 'unknown'} output={part.toolOutput} />;
            return null;
          })}
          <div className="flex items-center gap-3 py-2">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-muted-foreground">Speaking...</span>
          </div>
        </>
      );
    }

    return msg.parts.map((part, i) => {
      switch (part.type) {
        case 'text': {
          if (!part.content) return null;
          const isError = part.content.includes('**Error:**') || part.content.includes('[Response interrupted');
          return (
            <div key={i}>
              <div className="prose prose-sm prose-invert max-w-none text-foreground [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_li]:text-foreground [&_p]:text-foreground [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border [&_code]:font-mono">
                <MarkdownWithLinks content={part.content} />
              </div>
              {isError && !msg.streaming && (
                <button
                  onClick={() => {
                    // Find the last user message and retry it
                    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                    if (lastUserMsg?.parts[0]?.content) {
                      sendMessage(lastUserMsg.parts[0].content);
                    }
                  }}
                  className="mt-2 px-3 py-1.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors inline-flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3 h-3" /> Retry
                </button>
              )}
            </div>
          );
        }
        case 'tool_start':
          return <ToolCallBlock key={i} name={part.toolName ?? 'unknown'} pending />;
        case 'tool_result':
          return <ToolCallBlock key={i} name={part.toolName ?? 'unknown'} output={part.toolOutput} />;
        default:
          return null;
      }
    });
  };

  // ── Sidebar content ────────────────────────────────

  const sidebarContent = (
    <div className="h-full flex flex-col">
      <div className="p-3 flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1 justify-start gap-2" onClick={() => startNewChat()}>
          <Plus className="w-4 h-4" /> New Chat
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="New Folder" onClick={() => setCreatingFolder(true)}>
          <FolderPlus className="w-4 h-4" />
        </Button>
        {!isMobile && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* New folder inline input */}
      {creatingFolder && (
        <div className="px-3 pb-2">
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName(''); } }}
            onBlur={() => { if (newFolderName.trim()) handleCreateFolder(); else { setCreatingFolder(false); setNewFolderName(''); } }}
            placeholder="Folder name..."
            autoFocus
            className="w-full h-7 px-2 rounded-md bg-muted/50 border border-primary/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
      )}

      <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {searchQuery ? 'No chats found' : 'No chats yet'}
            </p>
          ) : (
            <>
              {/* Folders */}
              {folderedConversations.map(({ folder, conversations: folderConvos }) => (
                <div key={folder.id} className="mb-1">
                  {/* Folder header */}
                  <div className="flex items-center gap-1 px-1 py-1 group">
                    <button
                      onClick={() => handleToggleFolder(folder.id)}
                      className="flex items-center gap-1.5 flex-1 min-w-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {folder.is_collapsed ? (
                        <ChevronRight className="w-3 h-3 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3 h-3 shrink-0" />
                      )}
                      {folder.is_collapsed ? (
                        <Folder className="w-3 h-3 shrink-0" />
                      ) : (
                        <FolderOpen className="w-3 h-3 shrink-0" />
                      )}
                      {editingFolderId === folder.id ? (
                        <input
                          value={editFolderName}
                          onChange={e => setEditFolderName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingFolderId(null); }}
                          onBlur={() => handleRenameFolder(folder.id)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          className="flex-1 min-w-0 bg-transparent border-b border-primary text-foreground text-xs outline-none"
                        />
                      ) : (
                        <span className="truncate">{folder.name}</span>
                      )}
                      {folderConvos.length > 0 && (
                        <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">{folderConvos.length}</span>
                      )}
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); setEditFolderName(folder.name); }}
                        className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteFolder(folder.id, e)}
                        className="p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                  {/* Folder conversations (droppable zone) */}
                  {!folder.is_collapsed && (
                    <DroppableZone id={folder.id}>
                      {folderConvos.length > 0 ? (
                        <div className="pl-2">
                          {folderConvos.map(c => (
                            <DraggableConversation key={c.id} id={c.id}>
                              {renderConversationItem(c)}
                            </DraggableConversation>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/50 text-center py-1.5 pl-6">
                          Drop chats here
                        </p>
                      )}
                    </DroppableZone>
                  )}
                </div>
              ))}

              {/* Unfiled conversations */}
              {unfiledConversations.length > 0 && (
                <DroppableZone id="unfiled">
                  {chatFolders.length > 0 && (
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 pt-2 pb-1">Unfiled</p>
                  )}
                  {unfiledConversations.map(c => (
                    <DraggableConversation key={c.id} id={c.id}>
                      {renderConversationItem(c)}
                    </DraggableConversation>
                  ))}
                </DroppableZone>
              )}
            </>
          )}
        </div>
      </DndContext>

      {/* Footer: memory + projects + notifications */}
      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2 text-muted-foreground" onClick={loadMemory}>
            <Brain className="w-4 h-4" /> My Memory
          </Button>
          <Button variant="ghost" size="sm" className="justify-start gap-2 text-muted-foreground" onClick={() => setShowProjects(true)}>
            <FolderKanban className="w-4 h-4" /> Projects
          </Button>
          {unreadCount > 0 && (
            <div className="relative">
              <Bell className="w-4 h-4 text-primary" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[9px] rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            </div>
          )}
        </div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Quick Tools</p>
        <div className="flex flex-wrap gap-1">
          {tools.slice(0, 6).map(t => (
            <button
              key={t.route}
              onClick={() => {
                navigate(t.route);
                if (isMobile) setSidebarOpen(false);
              }}
              className="text-[11px] px-2 py-1 rounded-md bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {t.label}
            </button>
          ))}
        </div>
        {memberName && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            Logged in as <span className="text-foreground font-medium">{memberName}</span>
          </p>
        )}
      </div>
    </div>
  );

  // ── Main render ────────────────────────────────────

  return (
    <div className="h-screen h-[100dvh] bg-background flex flex-col overflow-hidden">
      <AdminHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile: Sheet sidebar */}
        {isMobile ? (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Chat History</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        ) : (
          <div className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-200 flex-shrink-0 border-r border-border bg-card overflow-hidden`}>
            <div className="w-72 h-full">
              {sidebarContent}
            </div>
          </div>
        )}

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!sidebarOpen && (
            <div className={`absolute ${isMobile ? 'left-2 top-14' : 'left-2 top-16'} z-10`}>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
                <PanelLeft className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Top bar: Agent Dashboard + Project badge + Voice toggle */}
          <div className="flex items-center justify-between px-3 pt-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => navigate('/super-agent-dashboard')}
            >
              <Activity className="h-3.5 w-3.5" />
              Agent Dashboard
            </Button>
            {activeProjectId && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
                <FolderKanban className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{activeProjectName || 'Project'}</span>
                <button onClick={() => { setActiveProjectId(null); setActiveProjectName(null); }} className="hover:text-destructive ml-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <VoiceModeToggle enabled={voiceChat.voiceEnabled} onToggle={voiceChat.toggleVoice} />
          </div>

          {isEmptyChat ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4">
              <img src={teamPitLogo} alt="Melleka Genie" className="w-12 h-12 md:w-16 md:h-16 mb-4 drop-shadow-lg" />
              <h1 className="text-xl md:text-3xl font-display font-bold text-foreground mb-1">Melleka Genie</h1>
              <p className="text-muted-foreground text-xs md:text-sm mb-6 md:mb-8 text-center max-w-md">
                Your AI-powered team assistant with live access to all client data, Google Ads, Meta, and 20+ tools.
              </p>

              <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mb-6">
                {quickPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(prompt)}
                    className="text-left p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:shadow-sm transition-all text-xs sm:text-sm text-muted-foreground hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                      <img src={teamPitLogo} alt="" className="w-6 h-6 md:w-7 md:h-7 rounded-lg shrink-0 mt-1" />
                    )}
                    <div className={`max-w-[90%] md:max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3 md:px-4 py-2 md:py-2.5'
                        : ''
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="text-sm whitespace-pre-wrap">
                          {(msg.parts[0]?.content || '').split(/(@\w[\w\s]*?)(?=\s|$)/g).map((chunk, i) =>
                            chunk.startsWith('@') ? (
                              <span key={i} className="inline-block bg-blue-500/20 text-blue-300 rounded px-1 font-medium">{chunk}</span>
                            ) : (
                              <span key={i}>{chunk}</span>
                            )
                          )}
                        </p>
                      ) : (
                        renderMessageParts(msg)
                      )}
                    </div>
                  </div>
                ))}
                {/* Resume button when SSE connection drops */}
                {disconnected && !isStreaming && (
                  <div className="flex gap-2 md:gap-3">
                    <div className="w-6 md:w-7 shrink-0" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setDisconnected(false);
                        if (!activeConvoId) return;
                        // Check if agent is still running — reconnect if so
                        const status = await checkJobStatus(activeConvoId);
                        if (status.active) {
                          setIsStreaming(true);
                          const assistantId = `resume-${Date.now()}`;
                          setMessages(prev => [...prev, { id: assistantId, role: 'assistant' as const, parts: [{ type: 'text' as const, content: '*(resumed)*\n\n' }], streaming: true }]);
                          abortRef.current = reconnectToJob(activeConvoId, (event: SSEEvent) => {
                            setMessages(prev => {
                              const msgs = [...prev];
                              const aIdx = msgs.length - 1;
                              if (aIdx < 0 || msgs[aIdx].role !== 'assistant') return prev;
                              const assistant = { ...msgs[aIdx], parts: [...msgs[aIdx].parts] };
                              switch (event.type) {
                                case 'text': {
                                  const lastPart = assistant.parts[assistant.parts.length - 1];
                                  if (lastPart?.type === 'text') {
                                    assistant.parts[assistant.parts.length - 1] = { ...lastPart, content: (lastPart.content ?? '') + (event.delta ?? '') };
                                  } else {
                                    assistant.parts.push({ type: 'text', content: event.delta ?? '' });
                                  }
                                  break;
                                }
                                case 'tool_start':
                                  assistant.parts.push({ type: 'tool_start', toolName: event.name });
                                  break;
                                case 'tool_result':
                                  for (let i = assistant.parts.length - 1; i >= 0; i--) {
                                    if (assistant.parts[i].type === 'tool_start' && assistant.parts[i].toolName === event.name) {
                                      assistant.parts[i] = { type: 'tool_result', toolName: event.name, toolOutput: event.output };
                                      break;
                                    }
                                  }
                                  break;
                                case 'done':
                                  assistant.streaming = false;
                                  break;
                                case 'error':
                                  assistant.streaming = false;
                                  assistant.parts.push({ type: 'text', content: `\n\n**Error:** ${event.message}` });
                                  break;
                              }
                              msgs[aIdx] = assistant;
                              return msgs;
                            });
                          }, () => { setIsStreaming(false); loadConversations(); });
                        } else {
                          // Agent finished — just reload messages
                          const saved = await apiFetchMessages(activeConvoId);
                          if (saved.length > 0) {
                            setMessages(saved.map((m: any, i: number) => ({ id: `msg-${i}`, role: m.role, parts: [{ type: 'text' as const, content: m.content }] })));
                          }
                        }
                      }}
                      className="text-xs"
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1.5" />
                      Resume
                    </Button>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-border bg-background p-3 md:p-4">
            <div className="max-w-3xl mx-auto relative">
              {/* Model selector */}
              <div className="flex justify-end mb-1.5">
                <div className="relative">
                  <button
                    onClick={() => setShowModelPicker(!showModelPicker)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/50"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {{ 'claude-opus-4-6': 'Melleka Super Smart', 'claude-sonnet-4-6': 'Melleka F&S', 'claude-haiku-4-5-20251001': 'Melleka Fast' }[modelId] || 'Melleka Super Smart'}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showModelPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowModelPicker(false)} />
                      <div className="absolute right-0 bottom-full mb-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
                        {([
                          { id: 'claude-opus-4-6', label: 'Melleka Super Smart', desc: 'Most capable' },
                          { id: 'claude-sonnet-4-6', label: 'Melleka F&S', desc: 'Fast & smart' },
                          { id: 'claude-haiku-4-5-20251001', label: 'Melleka Fast', desc: 'Fastest' },
                        ] as const).map((m) => (
                          <button
                            key={m.id}
                            onClick={() => { setModelId(m.id); setShowModelPicker(false); }}
                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center justify-between gap-3 ${modelId === m.id ? 'text-primary font-medium' : 'text-foreground'}`}
                          >
                            <span>{m.label}</span>
                            <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* @mention popover */}
              <ClientMentionPopover
                visible={showMentionPopover}
                query={mentionQuery}
                onSelect={handleMentionSelect}
                onClose={() => setShowMentionPopover(false)}
              />
              <div
                className={`bg-card border rounded-2xl transition-all ${
                  isDragging
                    ? 'border-primary border-dashed bg-primary/5'
                    : 'border-border focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {/* Drag overlay */}
                {isDragging && (
                  <div className="px-4 py-3 text-center text-sm text-primary font-medium">
                    Drop files here to upload
                  </div>
                )}
                {/* File preview strip */}
                {files.length > 0 && (
                  files.length > 5 ? (
                    <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                      <div className="flex -space-x-2">
                        {files.slice(0, 4).map((file, i) => (
                          isImageFile(file) ? (
                            <img
                              key={i}
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-8 h-8 rounded border-2 border-background object-cover"
                              onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                            />
                          ) : (
                            <div key={i} className="w-8 h-8 rounded border-2 border-background bg-muted flex items-center justify-center">
                              <FileText className="w-3 h-3" />
                            </div>
                          )
                        ))}
                        {files.length > 4 && (
                          <div className="w-8 h-8 rounded border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                            +{files.length - 4}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {files.length} files ({formatSize(files.reduce((sum, f) => sum + f.size, 0))})
                      </span>
                      <button
                        onClick={() => setFiles([])}
                        className="text-xs text-muted-foreground hover:text-destructive ml-auto"
                      >
                        Clear all
                      </button>
                    </div>
                  ) : (
                  <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1">
                    {files.map((file, i) => (
                      <div
                        key={`${file.name}-${i}`}
                        className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-2.5 py-1.5 max-w-[200px] group"
                      >
                        {isImageFile(file) ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={file.name}
                            className="w-6 h-6 rounded object-cover shrink-0"
                            onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                          />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-foreground truncate leading-tight">{file.name}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight">{formatSize(file.size)}</p>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0 opacity-60 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  )
                )}

                {/* Input row */}
                <div className="flex items-end gap-2 px-3 md:px-4 py-3 md:py-3.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isStreaming}
                    className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all disabled:opacity-40"
                    title="Attach files"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {voiceChat.voiceEnabled && (
                    <MicButton
                      isListening={voiceChat.isListening}
                      isSpeaking={voiceChat.isSpeaking}
                      disabled={isStreaming}
                      onToggle={() => {
                        if (voiceChat.isListening) {
                          voiceChat.stopListening();
                          setShowVoiceOverlay(false);
                        } else {
                          voiceChat.startListening();
                          setShowVoiceOverlay(true);
                        }
                      }}
                      onInterrupt={voiceChat.interruptAndListen}
                    />
                  )}
                  <textarea
                    ref={inputRef}
                    value={voiceChat.isListening && voiceChat.interimTranscript ? voiceChat.interimTranscript : input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={voiceChat.isListening ? "Listening..." : "Ask anything..."}
                    rows={1}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none max-h-[200px]"
                  />
                  <button
                    onClick={isStreaming ? stopStreaming : () => sendMessage()}
                    disabled={!isStreaming && !canSend}
                    className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                      isStreaming
                        ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                        : canSend
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    }`}
                  >
                    {isStreaming ? (
                      <Square className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-center gap-3 mt-2">
                <button
                  onClick={() => setLowTokenMode(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                    lowTokenMode
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-300 dark:ring-green-700'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Gauge className="w-3 h-3" />
                  {lowTokenMode ? 'Low Token' : 'Full Response'}
                </button>

                {/* Project picker */}
                <div className="relative">
                  <button
                    onClick={async () => {
                      if (!showProjectPicker) {
                        try {
                          const projects = await fetchChatProjects();
                          setProjectsList(projects);
                        } catch { /* ignore */ }
                      }
                      setShowProjectPicker(prev => !prev);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${
                      activeProjectId
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <FolderKanban className="w-3 h-3" />
                    {activeProjectId ? (activeProjectName || 'Project') : 'Project'}
                  </button>
                  {showProjectPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowProjectPicker(false)} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover border border-border rounded-lg shadow-lg z-50 w-56 py-1 max-h-[200px] overflow-y-auto">
                        {activeProjectId && (
                          <button
                            onClick={() => { setActiveProjectId(null); setActiveProjectName(null); setShowProjectPicker(false); }}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent text-destructive"
                          >
                            Remove project
                          </button>
                        )}
                        {projectsList.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No projects yet</p>
                        ) : (
                          projectsList.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setActiveProjectId(p.id);
                                setActiveProjectName(p.name);
                                setShowProjectPicker(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent flex items-center justify-between gap-2 ${
                                activeProjectId === p.id ? 'text-primary font-medium' : 'text-foreground'
                              }`}
                            >
                              <span className="truncate">{p.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{p.resource_count}r</span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Powered By Melleka AI · Enter to send{lowTokenMode ? ' · Concise mode' : ''}{voiceChat.voiceEnabled ? ' · Voice mode active' : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Voice conversation overlay (mobile) */}
      {(showVoiceOverlay || voiceChat.inConversation) && voiceChat.voiceEnabled && (
        <VoiceConversationOverlay
          isListening={voiceChat.isListening}
          isTranscribing={voiceChat.isTranscribing}
          isSpeaking={voiceChat.isSpeaking}
          interimTranscript={voiceChat.interimTranscript}
          spokenText={voiceChat.spokenText}
          onInterrupt={voiceChat.interruptAndListen}
          onStop={() => {
            voiceChat.stopListening();
            setShowVoiceOverlay(false);
          }}
        />
      )}

      {/* Memory panel */}
      <MemoryPanel open={showMemory} onOpenChange={setShowMemory} />

      {/* Projects panel */}
      <ProjectsPanel
        open={showProjects}
        onOpenChange={setShowProjects}
        onStartChat={(projectId) => {
          startNewChat(projectId);
          // Fetch project name for badge
          import('@/lib/chatApi').then(({ getChatProject }) => {
            getChatProject(projectId).then(p => setActiveProjectName(p.name)).catch(() => {});
          });
        }}
      />
    </div>
  );
};

// Markdown with clickable tool links
const MarkdownWithLinks = ({ content }: { content: string }) => {
  const navigate = useNavigate();

  return (
    <ReactMarkdown
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith('/')) {
            return (
              <button
                onClick={() => navigate(href)}
                className="inline-flex items-center gap-1 text-primary underline hover:text-primary/80 font-medium"
              >
                {children}
                <ArrowRight className="w-3 h-3" />
              </button>
            );
          }
          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-muted border border-border rounded-lg p-3 overflow-x-auto">
                <code className="font-mono text-xs" {...props}>{children}</code>
              </pre>
            );
          }
          return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default Index;
