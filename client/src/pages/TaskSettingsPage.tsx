import { useState, useEffect } from 'react';
import AdminHeader from '@/components/AdminHeader';
import SettingsTabs from '@/components/SettingsTabs';
import { useTaskSettings, useSaveTaskSettings } from '@/hooks/useTaskSettings';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ListChecks, Loader2, RotateCcw } from 'lucide-react';
import { STATUS_GROUPS } from '@/hooks/useNotionTasks';

const DEFAULT_DONE_STATUSES = STATUS_GROUPS['Complete'] ?? [];

export default function TaskSettingsPage() {
  const { doneStatuses, allStatusGroups, isLoading } = useTaskSettings();
  const save = useSaveTaskSettings();

  // Local state for the checkboxes — initialised once data arrives
  const [selected, setSelected] = useState<Set<string>>(new Set(doneStatuses));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSelected(new Set(doneStatuses));
    setDirty(false);
  }, [doneStatuses]);

  function toggle(statusName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(statusName)) next.delete(statusName);
      else next.add(statusName);
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    try {
      await save.mutateAsync([...selected]);
      toast.success('Task settings saved');
      setDirty(false);
    } catch {
      toast.error('Failed to save settings');
    }
  }

  function handleReset() {
    setSelected(new Set(DEFAULT_DONE_STATUSES));
    setDirty(true);
  }

  // Use server groups if available, fall back to client-side STATUS_GROUPS
  const statusGroups: Record<string, string[]> = allStatusGroups ?? STATUS_GROUPS;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <SettingsTabs />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <ListChecks className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Task Settings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Choose which statuses count as "done" in the Task Tracker and Bonus Tracker
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={handleReset}
              disabled={save.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to defaults
            </Button>
            <Button
              size="sm"
              className="min-h-[44px]"
              onClick={handleSave}
              disabled={!dirty || save.isPending}
            >
              {save.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Info banner */}
        <div className="rounded-lg bg-muted/50 border border-border px-4 py-3 text-sm text-muted-foreground">
          Checked statuses count as completed tasks for the Task Tracker stats and the Bonus Tracker
          monthly task count. Changes take effect immediately for new data loads.
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(statusGroups).map(([groupName, statuses]) => (
              <div key={groupName} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{groupName}</h3>
                  <span className="text-xs text-muted-foreground">
                    {statuses.filter((s) => selected.has(s)).length}/{statuses.length} selected as done
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {statuses.map((statusName) => {
                    const isChecked = selected.has(statusName);
                    return (
                      <button
                        key={statusName}
                        onClick={() => toggle(statusName)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors min-h-[44px]"
                      >
                        {/* Checkbox visual */}
                        <div
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground/40 bg-transparent'
                          }`}
                        >
                          {isChecked && (
                            <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        <span className={`text-sm flex-1 ${isChecked ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                          {statusName}
                        </span>

                        {isChecked && (
                          <span className="text-[11px] font-medium text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
                            Counts as done
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save bar at bottom when dirty */}
        {dirty && (
          <div className="sticky bottom-4 flex justify-end">
            <div className="flex items-center gap-3 bg-card border rounded-xl shadow-lg px-4 py-3">
              <span className="text-sm text-muted-foreground">You have unsaved changes</span>
              <Button size="sm" className="min-h-[44px]" onClick={handleSave} disabled={save.isPending}>
                {save.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
                  : 'Save'}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
