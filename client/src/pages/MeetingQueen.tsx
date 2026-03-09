import { useState, useRef, useCallback, useEffect } from 'react';
import { Crown, Mic, MicOff, Square, Loader2, Check, X, Send } from 'lucide-react';
import AdminHeader from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api';

// Same STT API base as VoiceChat
const STT_BASE = import.meta.env.PROD
  ? 'https://api.teams.melleka.com/api'
  : '/api';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ── Types ──────────────────────────────────────────
interface ExtractedTask {
  client_name: string;
  task_name: string;
  assignee: string;
  manager?: string;
}

interface AnalysisResult {
  summary: string;
  tasks: ExtractedTask[];
}

type MeetingPhase = 'idle' | 'listening' | 'analyzing' | 'report' | 'pushing' | 'done';

// Web Speech API detection
const SpeechRecognitionClass: typeof SpeechRecognition | null =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// ── Component ──────────────────────────────────────
export default function MeetingQueen() {
  const [phase, setPhase] = useState<MeetingPhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [editedTasks, setEditedTasks] = useState<ExtractedTask[]>([]);
  const [duration, setDuration] = useState(0);
  const [pushResults, setPushResults] = useState<Array<{ task_name: string; success: boolean; error?: string }>>([]);

  // Refs for continuous listening
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const stoppedRef = useRef(false);
  const silenceCleanupRef = useRef<(() => void) | null>(null);

  // Keep transcriptRef in sync
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  // ── Recording logic ──────────────────────────────

  const stopRecording = useCallback(() => {
    stoppedRef.current = true;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    silenceCleanupRef.current?.();
    silenceCleanupRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startNativeListening = useCallback(() => {
    if (!SpeechRecognitionClass) return false;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      setInterimText(interim);
      if (final.trim()) {
        setTranscript(prev => prev + (prev ? ' ' : '') + final.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted' || stoppedRef.current) return;
      if (event.error === 'no-speech') return;
      console.warn('[MeetingQueen] Native STT error:', event.error);
    };

    recognition.onend = () => {
      // Auto-restart unless we intentionally stopped
      if (!stoppedRef.current) {
        try {
          recognition.start();
        } catch {
          // May fail if already started
        }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    return true;
  }, []);

  const sendChunkForTranscription = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 1000 || stoppedRef.current) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const res = await fetch(`${STT_BASE}/stt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });

      if (!res.ok) return;
      const { text } = await res.json() as { text: string };
      if (text && text.trim().length > 2) {
        setTranscript(prev => prev + (prev ? ' ' : '') + text.trim());
      }
    } catch (err) {
      console.warn('[MeetingQueen] STT chunk error:', err);
    }
  }, []);

  const startWhisperListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      // Record in 15-second chunks for continuous transcription
      let chunks: Blob[] = [];

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        if (chunks.length > 0 && !stoppedRef.current) {
          const blob = new Blob(chunks, { type: mimeType });
          chunks = [];
          sendChunkForTranscription(blob);
        }
        // Restart if not stopped
        if (!stoppedRef.current && streamRef.current) {
          try {
            const newRecorder = new MediaRecorder(stream, { mimeType });
            newRecorder.ondataavailable = recorder.ondataavailable;
            newRecorder.onstop = recorder.onstop;
            mediaRecorderRef.current = newRecorder;
            newRecorder.start();
            // Stop after 15 seconds to send chunk
            setTimeout(() => {
              if (newRecorder.state === 'recording' && !stoppedRef.current) {
                newRecorder.stop();
              }
            }, 15000);
          } catch {
            // Stream may have ended
          }
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      // Stop after 15 seconds to send first chunk
      setTimeout(() => {
        if (recorder.state === 'recording' && !stoppedRef.current) {
          recorder.stop();
        }
      }, 15000);

      return true;
    } catch (err) {
      console.warn('[MeetingQueen] Mic access denied:', err);
      toast.error('Microphone access denied. Please allow microphone permissions.');
      return false;
    }
  }, [sendChunkForTranscription]);

  const startMeeting = useCallback(async () => {
    setPhase('listening');
    setTranscript('');
    setInterimText('');
    setAnalysis(null);
    setEditedTasks([]);
    setPushResults([]);
    setDuration(0);
    stoppedRef.current = false;
    startTimeRef.current = Date.now();

    // Start timer
    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    // Try native first, fall back to Whisper
    const nativeStarted = startNativeListening();
    if (!nativeStarted) {
      const whisperStarted = await startWhisperListening();
      if (!whisperStarted) {
        setPhase('idle');
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
  }, [startNativeListening, startWhisperListening]);

  const endMeeting = useCallback(async () => {
    stopRecording();
    setInterimText('');

    const fullTranscript = transcriptRef.current.trim();
    if (!fullTranscript || fullTranscript.length < 20) {
      toast.error('Not enough transcript captured. Try speaking more clearly or check your microphone.');
      setPhase('idle');
      return;
    }

    setPhase('analyzing');

    try {
      // Fetch clients and team members for context
      const [clientsRes, membersRes] = await Promise.all([
        supabase.from('managed_clients').select('client_name').eq('is_active', true).order('client_name'),
        supabase.from('team_members').select('name').order('name'),
      ]);

      const clients = (clientsRes.data || []).map(c => c.client_name);
      const teamMembers = (membersRes.data || []).map(m => m.name);

      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/meeting/analyze`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transcript: fullTranscript, clients, teamMembers }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(err.error || 'Analysis failed');
      }

      const result: AnalysisResult = await res.json();
      setAnalysis(result);
      setEditedTasks(result.tasks.map(t => ({ ...t })));
      setPhase('report');
    } catch (err: any) {
      console.error('[MeetingQueen] Analysis error:', err);
      toast.error(err.message || 'Failed to analyze meeting');
      setPhase('idle');
    }
  }, [stopRecording]);

  const pushToNotion = useCallback(async () => {
    if (editedTasks.length === 0) {
      toast.error('No tasks to push');
      return;
    }

    setPhase('pushing');

    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/meeting/push-to-notion`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tasks: editedTasks }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Push failed' }));
        throw new Error(err.error || 'Push failed');
      }

      const result = await res.json();
      setPushResults(result.results);
      setPhase('done');
      toast.success(`${result.success} of ${result.total} tasks pushed to Notion!`);
    } catch (err: any) {
      console.error('[MeetingQueen] Push error:', err);
      toast.error(err.message || 'Failed to push to Notion');
      setPhase('report');
    }
  }, [editedTasks]);

  const updateTask = (index: number, field: keyof ExtractedTask, value: string) => {
    setEditedTasks(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeTask = (index: number) => {
    setEditedTasks(prev => prev.filter((_, i) => i !== index));
  };

  const addTask = () => {
    setEditedTasks(prev => [...prev, { client_name: '', task_name: '', assignee: '', manager: '' }]);
  };

  const resetMeeting = () => {
    setPhase('idle');
    setTranscript('');
    setInterimText('');
    setAnalysis(null);
    setEditedTasks([]);
    setPushResults([]);
    setDuration(0);
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // ── Render ───────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 py-8 pb-20 sm:pb-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <Crown className="w-8 h-8 text-yellow-500" />
            <h1 className="text-2xl font-bold text-foreground">Team Meeting Queen</h1>
            <Crown className="w-8 h-8 text-yellow-500" />
          </div>
          <p className="text-muted-foreground text-sm">
            She listens to your entire meeting and captures every task for Notion
          </p>
        </div>

        {/* ── IDLE PHASE ──────────────────────────────── */}
        {phase === 'idle' && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="w-32 h-32 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
              <Crown className="w-16 h-16 text-yellow-500" />
            </div>
            <p className="text-muted-foreground text-center max-w-md">
              Start a meeting and the Queen will listen for tasks. She will capture client names,
              task descriptions, and who is in charge of each task.
            </p>
            <Button
              onClick={startMeeting}
              size="lg"
              className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-6 text-lg rounded-xl"
            >
              <Mic className="w-5 h-5" />
              Start Meeting
            </Button>
          </div>
        )}

        {/* ── LISTENING PHASE ─────────────────────────── */}
        {phase === 'listening' && (
          <div className="flex flex-col items-center gap-6">
            {/* Animated listening indicator */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-red-500/10 border-2 border-red-500/40 flex items-center justify-center animate-pulse">
                <Mic className="w-12 h-12 text-red-400" />
              </div>
              <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-red-500/20 animate-ping" />
            </div>

            {/* Timer */}
            <div className="text-3xl font-mono text-foreground font-bold">
              {formatDuration(duration)}
            </div>

            <p className="text-sm text-muted-foreground">
              The Queen is listening... She hears everything.
            </p>

            {/* Live transcript */}
            <div className="w-full max-h-64 overflow-y-auto bg-card border border-border rounded-xl p-4">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {transcript}
                {interimText && (
                  <span className="text-muted-foreground italic"> {interimText}</span>
                )}
                {!transcript && !interimText && (
                  <span className="text-muted-foreground">Waiting for speech...</span>
                )}
              </p>
            </div>

            {/* Word count */}
            <p className="text-xs text-muted-foreground">
              {transcript.split(/\s+/).filter(Boolean).length} words captured
            </p>

            {/* End meeting button */}
            <Button
              onClick={endMeeting}
              size="lg"
              variant="destructive"
              className="gap-2 px-8 py-6 text-lg rounded-xl font-semibold"
            >
              <Square className="w-5 h-5" />
              End the Meeting Queen
            </Button>
          </div>
        )}

        {/* ── ANALYZING PHASE ─────────────────────────── */}
        {phase === 'analyzing' && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="w-32 h-32 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
            </div>
            <p className="text-lg text-foreground font-medium">
              The Queen is analyzing the meeting...
            </p>
            <p className="text-sm text-muted-foreground">
              Extracting tasks, identifying clients, and assigning team members
            </p>
          </div>
        )}

        {/* ── REPORT PHASE ────────────────────────────── */}
        {phase === 'report' && analysis && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">
                Meeting Summary
              </h2>
              <p className="text-sm text-muted-foreground">{analysis.summary}</p>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>Duration: {formatDuration(duration)}</span>
                <span>Words: {transcript.split(/\s+/).filter(Boolean).length}</span>
                <span>Tasks found: {editedTasks.length}</span>
              </div>
            </div>

            {/* Tasks table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                  Captured Tasks
                </h2>
                <Button variant="outline" size="sm" onClick={addTask} className="text-xs">
                  + Add Task
                </Button>
              </div>

              {editedTasks.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No tasks captured. You can add tasks manually.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {/* Header - hidden on mobile */}
                  <div className="hidden sm:grid grid-cols-[1fr_2fr_1fr_1fr_auto] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Client</span>
                    <span>Task</span>
                    <span>Assignee</span>
                    <span>Manager</span>
                    <span className="w-8" />
                  </div>

                  {editedTasks.map((task, i) => (
                    <div key={i} className="flex flex-col sm:grid sm:grid-cols-[1fr_2fr_1fr_1fr_auto] gap-2 px-4 py-3 sm:py-2 items-stretch sm:items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase sm:hidden w-14 shrink-0">Client</span>
                        <input
                          type="text"
                          value={task.client_name}
                          onChange={(e) => updateTask(i, 'client_name', e.target.value)}
                          className="bg-transparent border border-border rounded px-2 py-2 sm:py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                          placeholder="Client"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase sm:hidden w-14 shrink-0">Task</span>
                        <input
                          type="text"
                          value={task.task_name}
                          onChange={(e) => updateTask(i, 'task_name', e.target.value)}
                          className="bg-transparent border border-border rounded px-2 py-2 sm:py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                          placeholder="Task description"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase sm:hidden w-14 shrink-0">Assign</span>
                        <input
                          type="text"
                          value={task.assignee}
                          onChange={(e) => updateTask(i, 'assignee', e.target.value)}
                          className="bg-transparent border border-border rounded px-2 py-2 sm:py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                          placeholder="Assignee"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase sm:hidden w-14 shrink-0">Manager</span>
                        <input
                          type="text"
                          value={task.manager || ''}
                          onChange={(e) => updateTask(i, 'manager', e.target.value)}
                          className="bg-transparent border border-border rounded px-2 py-2 sm:py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                          placeholder="Manager"
                        />
                        <button
                          onClick={() => removeTask(i)}
                          className="w-9 h-9 sm:w-8 sm:h-8 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                          title="Remove task"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Transcript accordion */}
            <details className="bg-card border border-border rounded-xl">
              <summary className="px-5 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                View Full Transcript
              </summary>
              <div className="px-5 pb-4 max-h-48 overflow-y-auto">
                <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{transcript}</p>
              </div>
            </details>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                onClick={resetMeeting}
                className="px-6"
              >
                Discard
              </Button>
              <Button
                onClick={pushToNotion}
                disabled={editedTasks.length === 0}
                className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-5 text-base rounded-xl"
              >
                <Crown className="w-5 h-5" />
                Yasss Queen
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── PUSHING PHASE ───────────────────────────── */}
        {phase === 'pushing' && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="w-32 h-32 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
            </div>
            <p className="text-lg text-foreground font-medium">
              Pushing tasks to Notion...
            </p>
            <p className="text-sm text-muted-foreground">
              Creating {editedTasks.length} tasks in the IN HOUSE TO-DO database
            </p>
          </div>
        )}

        {/* ── DONE PHASE ──────────────────────────────── */}
        {phase === 'done' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
                <Check className="w-12 h-12 text-green-500" />
              </div>
              <p className="text-lg text-foreground font-medium">
                The Queen has spoken!
              </p>
              <p className="text-sm text-muted-foreground">
                {pushResults.filter(r => r.success).length} of {pushResults.length} tasks pushed to Notion
              </p>
            </div>

            {/* Results */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Results</h2>
              </div>
              <div className="divide-y divide-border">
                {pushResults.map((result, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    {result.success ? (
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <X className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    <span className="text-sm text-foreground flex-1">{result.task_name}</span>
                    {result.error && (
                      <span className="text-xs text-red-400">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <Button
                onClick={resetMeeting}
                className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-5 text-base rounded-xl"
              >
                <Crown className="w-5 h-5" />
                Start New Meeting
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
