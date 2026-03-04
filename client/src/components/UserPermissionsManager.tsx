import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TOOL_CATALOG, CATEGORY_LABELS } from '@/data/toolCatalog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface UserView {
  id: string;
  email: string;
  is_admin: boolean;
}

export function UserPermissionsManager({ users }: { users: UserView[] }) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const nonAdminUsers = users.filter(u => !u.is_admin);
  const filtered = nonAdminUsers.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search non-admin users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          {nonAdminUsers.length === 0 ? 'No non-admin users to manage' : 'No users match your search'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <UserPermissionRow
              key={u.id}
              userId={u.id}
              email={u.email}
              isExpanded={expandedUser === u.id}
              onToggle={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
              grantedBy={currentUser?.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UserPermissionRow({
  userId,
  email,
  isExpanded,
  onToggle,
  grantedBy,
}: {
  userId: string;
  email: string;
  isExpanded: boolean;
  onToggle: () => void;
  grantedBy?: string;
}) {
  const queryClient = useQueryClient();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['user-tool-permissions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_tool_permissions')
        .select('tool_key')
        .eq('user_id', userId);
      if (error) throw error;
      return data.map(r => r.tool_key);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ toolKey, enabled }: { toolKey: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase
          .from('user_tool_permissions')
          .insert({ user_id: userId, tool_key: toolKey, granted_by: grantedBy });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_tool_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('tool_key', toolKey);
        if (error) throw error;
      }
    },
    onSuccess: (_, { toolKey, enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['user-tool-permissions', userId] });
      toast.success(`${enabled ? 'Granted' : 'Revoked'} access to ${TOOL_CATALOG.find(t => t.key === toolKey)?.label}`);
    },
    onError: (err: any) => toast.error('Failed to update permission', { description: err.message }),
  });

  const grantAllMutation = useMutation({
    mutationFn: async (grant: boolean) => {
      if (grant) {
        const rows = TOOL_CATALOG
          .filter(t => !permissions.includes(t.key))
          .map(t => ({ user_id: userId, tool_key: t.key, granted_by: grantedBy }));
        if (rows.length > 0) {
          const { error } = await supabase.from('user_tool_permissions').insert(rows);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('user_tool_permissions')
          .delete()
          .eq('user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: (_, grant) => {
      queryClient.invalidateQueries({ queryKey: ['user-tool-permissions', userId] });
      toast.success(grant ? 'Granted all tools' : 'Revoked all tools');
    },
    onError: (err: any) => toast.error('Failed to update permissions', { description: err.message }),
  });

  const categories = [...new Set(TOOL_CATALOG.map(t => t.category))];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">{email}</span>
          <Badge variant="outline" className="text-[10px]">
            {permissions.length}/{TOOL_CATALOG.length} tools
          </Badge>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {isExpanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Bulk actions:</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                disabled={grantAllMutation.isPending || permissions.length === TOOL_CATALOG.length}
                onClick={() => grantAllMutation.mutate(true)}
              >
                Grant All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                disabled={grantAllMutation.isPending || permissions.length === 0}
                onClick={() => grantAllMutation.mutate(false)}
              >
                Revoke All
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </h4>
                <div className="grid gap-1">
                  {TOOL_CATALOG.filter(t => t.category === cat).map(tool => {
                    const enabled = permissions.includes(tool.key);
                    const Icon = tool.icon;
                    return (
                      <div key={tool.key} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/20">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="text-sm">{tool.label}</span>
                            <p className="text-[11px] text-muted-foreground">{tool.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={enabled}
                          disabled={toggleMutation.isPending}
                          onCheckedChange={(checked) => toggleMutation.mutate({ toolKey: tool.key, enabled: checked })}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
