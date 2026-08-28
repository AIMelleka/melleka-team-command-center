import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminHeader from '@/components/AdminHeader';
import SettingsTabs from '@/components/SettingsTabs';
import { supabase } from '@/integrations/supabase/client';
import { useTaskStats, getManagers, type NotionTask } from '@/hooks/useNotionTasks';
import { useIsTaskDoneInRange } from '@/hooks/useTaskSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { DollarSign, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Loader2, Check, X } from 'lucide-react';
import type { BonusProfile } from '@/hooks/useBonusProfile';

const API_BASE = import.meta.env.PROD
  ? "https://api.teams.melleka.com/api"
  : "/api";

const BONUS_TIERS = [
  { tasks: 150, bonus: 100 }, { tasks: 200, bonus: 150 }, { tasks: 250, bonus: 200 },
  { tasks: 300, bonus: 250 }, { tasks: 350, bonus: 300 }, { tasks: 400, bonus: 350 },
  { tasks: 450, bonus: 400 }, { tasks: 500, bonus: 450 }, { tasks: 550, bonus: 500 },
  { tasks: 600, bonus: 550 }, { tasks: 650, bonus: 600 }, { tasks: 700, bonus: 650 },
  { tasks: 750, bonus: 700 }, { tasks: 800, bonus: 750 }, { tasks: 850, bonus: 800 },
  { tasks: 900, bonus: 850 }, { tasks: 950, bonus: 900 }, { tasks: 1000, bonus: 950 },
  { tasks: 1050, bonus: 1000 },
];

function getMonthDateRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: first.toISOString().split('T')[0],
    dateTo: now.toISOString().split('T')[0],
    monthLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function getBonusTier(taskCount: number) {
  const currentTier = [...BONUS_TIERS].reverse().find((t) => taskCount >= t.tasks) ?? null;
  const nextTier = BONUS_TIERS.find((t) => t.tasks > taskCount) ?? null;
  return { currentTier, nextTier };
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useProfiles() {
  return useQuery<BonusProfile[]>({
    queryKey: ['task-bonus-profiles'],
    queryFn: async () => {
      const resp = await fetch(`${API_BASE}/task-bonus/profiles`, { headers: await authHeaders() });
      if (!resp.ok) throw new Error('Failed to fetch profiles');
      return resp.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

function useUsers() {
  return useQuery<{ id: string; email: string }[]>({
    queryKey: ['task-bonus-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_users_for_admin');
      if (error) throw error;
      return (data as any[]).map((u) => ({ id: u.id, email: u.email }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Pull unique manager names from the last 6 months of Notion tasks
function useNotionManagers() {
  const { dateFrom, dateTo } = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    return {
      dateFrom: sixMonthsAgo.toISOString().split('T')[0],
      dateTo: now.toISOString().split('T')[0],
    };
  }, []);

  const { data: statsData, isLoading } = useTaskStats(dateFrom, dateTo);

  const managerNames = useMemo(() => {
    if (!statsData?.tasks) return [];
    const names = new Set<string>();
    statsData.tasks.forEach((t) => {
      getManagers(t.properties).forEach((m) => {
        if (m.name && m.name !== 'Unknown') names.add(m.name);
      });
    });
    return Array.from(names).sort();
  }, [statsData?.tasks]);

  return { managerNames, isLoading };
}

// ── Profile detail row ─────────────────────────────────────────────────────────

function ProfileDetail({ profile }: { profile: BonusProfile }) {
  const { dateFrom, dateTo, monthLabel } = useMemo(getMonthDateRange, []);
  const { data: statsData, isLoading } = useTaskStats(dateFrom, dateTo);
  const isTaskDoneInRange = useIsTaskDoneInRange(dateFrom, dateTo);

  const taskCount = useMemo(() => {
    if (!statsData?.tasks) return 0;
    return statsData.tasks.filter(
      (t) =>
        isTaskDoneInRange(t) &&
        getManagers(t.properties).some((m) => m.name === profile.notionManagerName),
    ).length;
  }, [statsData, profile.notionManagerName, isTaskDoneInRange]);

  const { currentTier, nextTier } = useMemo(() => getBonusTier(taskCount), [taskCount]);

  return (
    <div className="px-4 py-3 bg-muted/30 border-t border-border text-sm space-y-2">
      <p className="font-medium text-foreground">{monthLabel} stats</p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span>Tasks: <strong className="text-foreground">{taskCount}</strong></span>
          <span>
            Bonus:{' '}
            <strong className="text-green-500">{currentTier ? `$${currentTier.bonus}` : 'None'}</strong>
          </span>
          {nextTier && (
            <span>
              Next tier: <strong className="text-foreground">{nextTier.tasks - taskCount} more tasks for ${nextTier.bonus}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add / Edit form ────────────────────────────────────────────────────────────

const selectClass =
  "w-full bg-background border border-input rounded-md px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50";

interface ProfileFormProps {
  users: { id: string; email: string }[];
  usersLoading: boolean;
  managerNames: string[];
  managersLoading: boolean;
  initial?: BonusProfile;
  onSave: (data: Partial<BonusProfile>) => void;
  onCancel: () => void;
  saving: boolean;
}

function ProfileForm({
  users, usersLoading, managerNames, managersLoading,
  initial, onSave, onCancel, saving,
}: ProfileFormProps) {
  const [userId, setUserId] = useState(initial?.userId ?? '');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [notionManagerName, setNotionManagerName] = useState(initial?.notionManagerName ?? '');
  const [bonusEnabled, setBonusEnabled] = useState(initial?.bonusEnabled ?? true);

  const selectedUser = users.find((u) => u.id === userId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !displayName.trim() || !notionManagerName.trim()) {
      toast.error('All fields are required');
      return;
    }
    onSave({
      userId,
      email: selectedUser?.email ?? '',
      displayName: displayName.trim(),
      notionManagerName: notionManagerName.trim(),
      bonusEnabled,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-muted/20 border rounded-lg space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* User account — native select, always visible */}
        {!initial && (
          <div className="sm:col-span-2 space-y-1.5">
            <Label>User Account</Label>
            {usersLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading users...
              </div>
            ) : (
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className={selectClass}
              >
                <option value="">Select a user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Display name */}
        <div className="space-y-1.5">
          <Label>Display Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Emily"
          />
        </div>

        {/* Notion manager — dropdown of real names from Notion */}
        <div className="space-y-1.5">
          <Label>Notion Manager Name</Label>
          {managersLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading from Notion...
            </div>
          ) : managerNames.length > 0 ? (
            <select
              value={notionManagerName}
              onChange={(e) => setNotionManagerName(e.target.value)}
              className={selectClass}
            >
              <option value="">Select a manager...</option>
              {managerNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ) : (
            // Fallback to text input if no Notion data loaded yet
            <Input
              value={notionManagerName}
              onChange={(e) => setNotionManagerName(e.target.value)}
              placeholder="e.g. Emily Smith"
            />
          )}
        </div>
      </div>

      {/* Enabled toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={bonusEnabled}
          onClick={() => setBonusEnabled((v) => !v)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
            bonusEnabled ? 'bg-green-500' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
              bonusEnabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-sm text-muted-foreground">Bonus enabled</span>
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving} className="min-h-[44px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
          Save
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="min-h-[44px]">
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function TaskBonusAdmin() {
  const qc = useQueryClient();
  const { data: profiles = [], isLoading: profilesLoading } = useProfiles();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { managerNames, isLoading: managersLoading } = useNotionManagers();

  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['task-bonus-profiles'] });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<BonusProfile>) => {
      const resp = await fetch(`${API_BASE}/task-bonus/profiles`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error('Failed to create profile');
      return resp.json();
    },
    onSuccess: () => { toast.success('Employee added'); setShowAddForm(false); invalidate(); },
    onError: () => toast.error('Failed to add employee'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<BonusProfile> }) => {
      const resp = await fetch(`${API_BASE}/task-bonus/profiles/${id}`, {
        method: 'PUT',
        headers: await authHeaders(),
        body: JSON.stringify(data),
      });
      if (!resp.ok) throw new Error('Failed to update profile');
      return resp.json();
    },
    onSuccess: () => { toast.success('Profile updated'); setEditingId(null); invalidate(); },
    onError: () => toast.error('Failed to update profile'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const resp = await fetch(`${API_BASE}/task-bonus/profiles/${id}`, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (!resp.ok) throw new Error('Failed to delete profile');
    },
    onSuccess: () => { toast.success('Profile deleted'); invalidate(); },
    onError: () => toast.error('Failed to delete profile'),
  });

  const formProps = { users, usersLoading, managerNames, managersLoading };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <SettingsTabs />
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DollarSign className="h-7 w-7 text-green-500 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Task Bonus Admin</h1>
              <p className="text-sm text-muted-foreground">
                Link employees to their Notion manager name to enable bonus tracking
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { setShowAddForm(true); setEditingId(null); }}
            className="shrink-0 min-h-[44px]"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Employee
          </Button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <ProfileForm
            {...formProps}
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setShowAddForm(false)}
            saving={createMutation.isPending}
          />
        )}

        {/* Profiles list */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_1fr_1.2fr_80px_100px] gap-4 px-4 py-2.5 bg-muted/40 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Display Name</span>
            <span>Notion Manager Name</span>
            <span>Email</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {profilesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No employees linked yet. Click "Add Employee" to get started.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {profiles.map((profile) => (
                <li key={profile.id}>
                  {editingId === profile.id ? (
                    <div className="p-4">
                      <ProfileForm
                        {...formProps}
                        initial={profile}
                        onSave={(data) => updateMutation.mutate({ id: profile.id, data })}
                        onCancel={() => setEditingId(null)}
                        saving={updateMutation.isPending}
                      />
                    </div>
                  ) : (
                    <>
                      <div
                        className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_1.2fr_80px_100px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedId(expandedId === profile.id ? null : profile.id)}
                      >
                        <span className="text-sm font-medium text-foreground">{profile.displayName}</span>
                        <span className="hidden sm:block text-sm text-muted-foreground">{profile.notionManagerName}</span>
                        <span className="hidden sm:block text-sm text-muted-foreground truncate">{profile.email}</span>
                        <span className="hidden sm:block">
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                            profile.bonusEnabled ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
                          }`}>
                            {profile.bonusEnabled ? 'Active' : 'Disabled'}
                          </span>
                        </span>
                        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => { setEditingId(profile.id); setExpandedId(null); }}
                            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete ${profile.displayName}?`)) deleteMutation.mutate(profile.id);
                            }}
                            className="p-1.5 rounded hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          {expandedId === profile.id
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                      </div>
                      {expandedId === profile.id && <ProfileDetail profile={profile} />}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
