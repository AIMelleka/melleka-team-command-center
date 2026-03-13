import { useState, useEffect } from 'react';
import { ClipboardList, Loader2, Check, X, Sparkles, Send, Plus, Save, Trash2 } from 'lucide-react';
import AdminHeader from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { MARKETING_PACKAGES } from '@/data/packages';

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
  : '/api';

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

const TEMPLATES_KEY = 'onboarding-bot-templates';
const LAST_TEMPLATE_KEY = 'onboarding-bot-last-template';

interface SavedTemplate {
  id: string;
  name: string;
  prompt: string;
  savedAt: string;
}

function loadTemplates(): SavedTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  } catch { return []; }
}

function persistTemplates(templates: SavedTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

interface OnboardingTask {
  task_name: string;
  client_name: string;
  assignee: string;
  manager: string;
  status: string;
  priority: string;
}

type Phase = 'input' | 'generating' | 'review' | 'pushing' | 'done';

export default function OnboardingBot() {
  const [phase, setPhase] = useState<Phase>('input');
  const [clientName, setClientName] = useState('');
  const [clients, setClients] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [packageName, setPackageName] = useState('');
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [pushResults, setPushResults] = useState<Array<{ task_name: string; success: boolean; error?: string }>>([]);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [showSaveAs, setShowSaveAs] = useState(false);

  // Load data on mount
  useEffect(() => {
    Promise.all([
      supabase.from('managed_clients').select('client_name').eq('is_active', true).order('client_name'),
      supabase.from('team_members').select('name').order('name'),
    ]).then(([clientsRes, membersRes]) => {
      setClients((clientsRes.data || []).map((c: any) => c.client_name));
      setTeamMembers((membersRes.data || []).map((m: any) => m.name));
    });

    const saved = loadTemplates();
    setTemplates(saved);

    // Auto-load last used template
    const lastId = localStorage.getItem(LAST_TEMPLATE_KEY);
    if (lastId) {
      const last = saved.find(t => t.id === lastId);
      if (last) {
        setPrompt(last.prompt);
        setSelectedTemplateId(last.id);
      }
    }
  }, []);

  const loadTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;
    setPrompt(tpl.prompt);
    setSelectedTemplateId(tpl.id);
    localStorage.setItem(LAST_TEMPLATE_KEY, tpl.id);
    toast.success(`Loaded "${tpl.name}"`);
  };

  const saveTemplate = (overrideName?: string) => {
    const name = (overrideName ?? templateName).trim();
    if (!name) { toast.error('Enter a template name'); return; }
    if (!prompt.trim()) { toast.error('Write some instructions before saving'); return; }

    const existing = templates.find(t => t.id === selectedTemplateId);
    let updated: SavedTemplate[];

    if (existing && !showSaveAs) {
      updated = templates.map(t => t.id === existing.id ? {
        ...t, name, prompt: prompt.trim(), savedAt: new Date().toISOString(),
      } : t);
      toast.success(`Updated "${name}"`);
    } else {
      const newTpl: SavedTemplate = {
        id: crypto.randomUUID(), name, prompt: prompt.trim(), savedAt: new Date().toISOString(),
      };
      updated = [...templates, newTpl];
      setSelectedTemplateId(newTpl.id);
      localStorage.setItem(LAST_TEMPLATE_KEY, newTpl.id);
      toast.success(`Saved "${name}"`);
    }

    persistTemplates(updated);
    setTemplates(updated);
    setShowSaveAs(false);
  };

  const deleteTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id);
    const updated = templates.filter(t => t.id !== id);
    persistTemplates(updated);
    setTemplates(updated);
    if (selectedTemplateId === id) {
      setSelectedTemplateId('');
      localStorage.removeItem(LAST_TEMPLATE_KEY);
    }
    if (tpl) toast.success(`Deleted "${tpl.name}"`);
  };

  const generateTasks = async () => {
    if (!clientName.trim()) { toast.error('Please enter a client name'); return; }
    if (!prompt.trim() || prompt.trim().length < 5) { toast.error('Please add onboarding instructions'); return; }

    setPhase('generating');

    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/onboarding-bot/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientName: clientName.trim(),
          packageName: packageName.trim(),
          prompt: prompt.trim(),
          teamMembers,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(err.error || 'Generation failed');
      }

      const result = await res.json();
      setTasks(result.tasks || []);
      setPhase('review');
    } catch (err: any) {
      console.error('[OnboardingBot] Generate error:', err);
      toast.error(err.message || 'Failed to generate tasks');
      setPhase('input');
    }
  };

  const pushToNotion = async () => {
    if (tasks.length === 0) { toast.error('No tasks to push'); return; }

    setPhase('pushing');

    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/onboarding-bot/push-to-notion`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tasks }),
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
      console.error('[OnboardingBot] Push error:', err);
      toast.error(err.message || 'Failed to push to Notion');
      setPhase('review');
    }
  };

  const updateTask = (index: number, field: keyof OnboardingTask, value: string) => {
    setTasks(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeTask = (index: number) => {
    setTasks(prev => prev.filter((_, i) => i !== index));
  };

  const addTask = () => {
    setTasks(prev => [...prev, {
      task_name: '', client_name: clientName, assignee: '', manager: '',
      status: '\u{1F44B} NEW \u{1F44B}', priority: 'Medium',
    }]);
  };

  const reset = () => {
    setPhase('input');
    setClientName('');
    setTasks([]);
    setPushResults([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 py-8 pb-20 sm:pb-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <ClipboardList className="w-8 h-8 text-yellow-500" />
            <h1 className="text-2xl font-bold text-foreground">Onboarding Bot</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Generate onboarding tasks for new clients and push them to Notion
          </p>
        </div>

        {/* INPUT PHASE */}
        {phase === 'input' && (
          <div className="space-y-5">
            {/* Client Name */}
            <div className="bg-card border border-border rounded-xl p-5">
              <label className="block text-sm font-medium text-foreground mb-2">Client Name</label>
              <input
                type="text"
                list="client-list"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Select or type a client name..."
                className="w-full bg-transparent border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <datalist id="client-list">
                {clients.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            {/* Package */}
            <div className="bg-card border border-border rounded-xl p-5">
              <label className="block text-sm font-medium text-foreground mb-2">Package</label>
              <select
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                className="w-full bg-transparent border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a package...</option>
                {MARKETING_PACKAGES.map(pkg => (
                  <option key={pkg.id} value={`${pkg.name} - $${pkg.monthlyPrice.toLocaleString()}/mo`}>
                    {pkg.name} - ${pkg.monthlyPrice.toLocaleString()}/mo
                  </option>
                ))}
              </select>
            </div>

            {/* Onboarding Playbook */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">Onboarding Playbook</label>
                {templates.length > 0 && (
                  <span className="text-xs text-muted-foreground">{templates.length} saved</span>
                )}
              </div>

              {/* Saved templates */}
              {templates.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="flex items-center gap-0.5">
                      <button
                        onClick={() => loadTemplate(tpl.id)}
                        className={`px-3 py-1.5 rounded-l-lg text-xs font-medium border transition-colors ${
                          selectedTemplateId === tpl.id
                            ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500'
                            : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                        }`}
                      >
                        {tpl.name}
                      </button>
                      <button
                        onClick={() => deleteTemplate(tpl.id)}
                        className="px-1.5 py-1.5 rounded-r-lg text-xs border border-l-0 border-border text-muted-foreground hover:text-red-400 hover:border-red-400/30 transition-colors"
                        title="Delete template"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={12}
                placeholder={`Paste your full onboarding playbook here. Include everything:\n\n- All tasks that need to be created\n- Who gets assigned to what (e.g. "Sarah handles all Google Ads setup")\n- Who manages/oversees each area\n- Priority levels\n- Any special instructions or order of operations\n\nThis prompt gets saved and reused every time you onboard a new client.`}
                className="w-full bg-transparent border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono"
              />

              {/* Save controls */}
              <div className="flex items-center gap-2">
                {(selectedTemplateId && !showSaveAs) ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tpl = templates.find(t => t.id === selectedTemplateId);
                        if (tpl) saveTemplate(tpl.name);
                      }}
                      className="text-xs gap-1"
                      disabled={!prompt.trim()}
                    >
                      <Save className="w-3 h-3" />
                      Update "{templates.find(t => t.id === selectedTemplateId)?.name}"
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowSaveAs(true); setTemplateName(''); }}
                      className="text-xs"
                    >
                      Save as new...
                    </Button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name, e.g. Standard Onboarding"
                      className="flex-1 bg-transparent border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      onKeyDown={(e) => e.key === 'Enter' && saveTemplate()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveTemplate()}
                      className="text-xs gap-1"
                      disabled={!templateName.trim() || !prompt.trim()}
                    >
                      <Save className="w-3 h-3" />
                      Save Playbook
                    </Button>
                    {showSaveAs && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSaveAs(false)}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={generateTasks}
              disabled={!clientName.trim() || !prompt.trim()}
              className="w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-6 text-base rounded-xl"
            >
              <Sparkles className="w-5 h-5" />
              Generate Onboarding Tasks
            </Button>
          </div>
        )}

        {/* GENERATING PHASE */}
        {phase === 'generating' && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="w-32 h-32 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
            </div>
            <p className="text-lg text-foreground font-medium">
              Generating onboarding tasks...
            </p>
            <p className="text-sm text-muted-foreground">
              Building a task list for {clientName}
            </p>
          </div>
        )}

        {/* REVIEW PHASE */}
        {phase === 'review' && (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{tasks.length} tasks</span> generated for <span className="font-semibold">{clientName}</span>
              </p>
              <Button variant="outline" size="sm" onClick={addTask} className="text-xs gap-1">
                <Plus className="w-3 h-3" />
                Add Task
              </Button>
            </div>

            {/* Task review table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {tasks.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No tasks. Click "Add Task" to add manually.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {/* Header */}
                  <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_80px_auto] gap-2 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span>Task</span>
                    <span>Assignee</span>
                    <span>Manager</span>
                    <span>Priority</span>
                    <span className="w-8" />
                  </div>

                  {tasks.map((task, i) => (
                    <div key={i} className="flex flex-col sm:grid sm:grid-cols-[2fr_1fr_1fr_80px_auto] gap-2 px-4 py-3 sm:py-2 items-stretch sm:items-center">
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
                        <span className="text-[10px] text-muted-foreground uppercase sm:hidden w-14 shrink-0">Mgr</span>
                        <input
                          type="text"
                          value={task.manager || ''}
                          onChange={(e) => updateTask(i, 'manager', e.target.value)}
                          className="bg-transparent border border-border rounded px-2 py-2 sm:py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                          placeholder="Manager"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground uppercase sm:hidden w-14 shrink-0">Pri</span>
                        <select
                          value={task.priority}
                          onChange={(e) => updateTask(i, 'priority', e.target.value)}
                          className="bg-transparent border border-border rounded px-1 py-2 sm:py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary flex-1"
                        >
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
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

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => { setTasks([]); setPhase('input'); }}
                className="px-6"
              >
                Back to Edit
              </Button>
              <Button
                variant="outline"
                onClick={generateTasks}
                className="px-6"
              >
                Regenerate
              </Button>
              <Button
                onClick={pushToNotion}
                disabled={tasks.length === 0}
                className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-5 text-base rounded-xl"
              >
                <Send className="w-4 h-4" />
                Post to Notion
              </Button>
            </div>
          </div>
        )}

        {/* PUSHING PHASE */}
        {phase === 'pushing' && (
          <div className="flex flex-col items-center gap-6 py-16">
            <div className="w-32 h-32 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center">
              <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
            </div>
            <p className="text-lg text-foreground font-medium">
              Pushing tasks to Notion...
            </p>
            <p className="text-sm text-muted-foreground">
              Creating {tasks.length} tasks in the IN HOUSE TO-DO database
            </p>
          </div>
        )}

        {/* DONE PHASE */}
        {phase === 'done' && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-24 h-24 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
                <Check className="w-12 h-12 text-green-500" />
              </div>
              <p className="text-lg text-foreground font-medium">
                Onboarding tasks created!
              </p>
              <p className="text-sm text-muted-foreground">
                {pushResults.filter(r => r.success).length} of {pushResults.length} tasks pushed to Notion
              </p>
            </div>

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
                onClick={reset}
                className="gap-2 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-5 text-base rounded-xl"
              >
                <ClipboardList className="w-5 h-5" />
                Start New Onboarding
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
