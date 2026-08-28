import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AdminHeader from '@/components/AdminHeader';
import SettingsTabs from '@/components/SettingsTabs';
import { UserPermissionsManager } from '@/components/UserPermissionsManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Users,
  Shield,
  ShieldOff,
  ShieldCheck,
  Search,
  Loader2,
  UserPlus,
  Trash2,
  FileText,
  ExternalLink,
  Eye,
  KeyRound,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { safeFormatDate } from '@/lib/dateUtils';

interface UserView {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_admin: boolean;
}

interface Proposal {
  id: string;
  title: string;
  client_name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}

type Tab = 'users' | 'permissions' | 'proposals';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [proposalSearch, setProposalSearch] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const { user: authUser, isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_users_for_admin');
      if (error) throw error;
      return data as UserView[];
    },
  });

  const { data: superAdminIds = [] } = useQuery({
    queryKey: ['admin-super-admins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin');
      if (error) throw error;
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    },
  });

  const { data: proposals, isLoading: proposalsLoading } = useQuery({
    queryKey: ['admin-proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, title, client_name, slug, status, created_at, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data as Proposal[];
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlyAdmin }: { userId: string; isCurrentlyAdmin: boolean }) => {
      if (isCurrentlyAdmin) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
        if (error) throw error;
      }
    },
    onSuccess: (_, { isCurrentlyAdmin }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(isCurrentlyAdmin ? 'Admin role removed' : 'Admin role granted');
    },
    onError: (error: any) => toast.error('Failed to update role', { description: error.message }),
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: async ({ userId, isCurrentlySA }: { userId: string; isCurrentlySA: boolean }) => {
      if (isCurrentlySA) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'super_admin');
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'super_admin' });
        if (error) throw error;
      }
    },
    onSuccess: (_, { isCurrentlySA }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-super-admins'] });
      toast.success(isCurrentlySA ? 'Super Admin removed' : 'Super Admin granted');
    },
    onError: (error: any) => toast.error('Failed to update role', { description: error.message }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deleted');
    },
    onError: (error: any) => toast.error('Failed to delete user', { description: error.message }),
  });

  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase.from('proposals').delete().eq('id', proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-proposals'] });
      toast.success('Proposal deleted');
    },
    onError: (error: any) => toast.error('Failed to delete proposal', { description: error.message }),
  });

  // ── Create user ───────────────────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: newUserEmail.trim().toLowerCase(), password: newUserPassword, makeAdmin: false },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      toast.success('User created');
      setNewUserEmail('');
      setNewUserPassword('');
      setIsCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (error: any) {
      toast.error('Failed to create user', { description: error.message });
    } finally {
      setIsCreating(false);
    }
  };

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredUsers = users?.filter((u) =>
    (u.email ?? '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const filteredProposals = proposals?.filter((p) =>
    (p.title ?? '').toLowerCase().includes(proposalSearch.trim().toLowerCase()) ||
    (p.client_name ?? '').toLowerCase().includes(proposalSearch.trim().toLowerCase())
  );

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'permissions', label: 'Permissions', icon: KeyRound },
    { key: 'proposals', label: 'Proposals', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <SettingsTabs />

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border rounded-xl p-4 flex gap-3 items-center">
            <div className="p-2 rounded-lg bg-purple-500/10 shrink-0">
              <Users className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex gap-3 items-center">
            <div className="p-2 rounded-lg bg-yellow-500/10 shrink-0">
              <Shield className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{users?.filter((u) => u.is_admin).length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Admins</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex gap-3 items-center">
            <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{proposals?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Proposals</p>
            </div>
          </div>
          <div className="bg-card border rounded-xl p-4 flex gap-3 items-center">
            <div className="p-2 rounded-lg bg-green-500/10 shrink-0">
              <Eye className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{proposals?.filter((p) => p.status === 'published').length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => navigate('/proposal-builder')}>
            <FileText className="h-4 w-4 mr-2" />
            New Proposal
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => navigate('/onboarding-bot')}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Onboarding SOP
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => navigate('/admin/task-bonus')}>
            <Shield className="h-4 w-4 mr-2" />
            Bonus Tracker
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={() => navigate('/admin/task-weights')}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            Task Weights
          </Button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                  activeTab === t.key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Users Tab ──────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="min-h-[44px] shrink-0">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Create a new account. Roles can be assigned after creation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        placeholder="user@melleka.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password">Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="h-11"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateUser} disabled={isCreating}>
                      {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : 'Create User'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {usersLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers?.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">No users found</p>
                )}
                {filteredUsers?.map((user) => {
                  const isCurrentlySA = superAdminIds.includes(user.id);
                  const isSelf = user.id === authUser?.id;
                  const isExpanded = expandedUserId === user.id;

                  return (
                    <div key={user.id} className="bg-card border rounded-xl overflow-hidden">
                      {/* Card header — tap to expand */}
                      <button
                        className="w-full text-left px-4 py-4 flex items-start justify-between gap-3 hover:bg-muted/20 transition-colors"
                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{user.email}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {user.is_admin ? (
                              <Badge variant="outline" className="border-yellow-500/60 text-yellow-600 dark:text-yellow-400 text-[11px]">
                                <Shield className="h-3 w-3 mr-1" />Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[11px]">User</Badge>
                            )}
                            {isCurrentlySA && (
                              <Badge variant="outline" className="border-purple-500/60 text-purple-600 dark:text-purple-400 text-[11px]">
                                <ShieldCheck className="h-3 w-3 mr-1" />Super Admin
                              </Badge>
                            )}
                            {isSelf && (
                              <Badge variant="secondary" className="text-[11px]">You</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Last sign in: {user.last_sign_in_at ? safeFormatDate(user.last_sign_in_at, 'MMM d, yyyy') : 'Never'}
                          </p>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                        }
                      </button>

                      {/* Actions — expanded */}
                      {isExpanded && (
                        <div className="border-t border-border px-4 py-4 space-y-2 bg-muted/10">
                          {/* Admin toggle */}
                          <Button
                            variant={user.is_admin ? 'destructive' : 'outline'}
                            size="sm"
                            className="w-full min-h-[44px] justify-start"
                            disabled={toggleAdminMutation.isPending || isSelf}
                            onClick={() => toggleAdminMutation.mutate({ userId: user.id, isCurrentlyAdmin: user.is_admin })}
                          >
                            {user.is_admin
                              ? <><ShieldOff className="h-4 w-4 mr-2" />Remove Admin Role</>
                              : <><Shield className="h-4 w-4 mr-2" />Grant Admin Role</>
                            }
                          </Button>

                          {/* Super admin toggle — visible to all admins; self-assignment is blocked */}
                          {isAdmin && (
                            <Button
                              variant={isCurrentlySA ? 'destructive' : 'outline'}
                              size="sm"
                              className="w-full min-h-[44px] justify-start"
                              disabled={toggleSuperAdminMutation.isPending || isSelf}
                              onClick={() => toggleSuperAdminMutation.mutate({ userId: user.id, isCurrentlySA })}
                            >
                              {isCurrentlySA
                                ? <><ShieldOff className="h-4 w-4 mr-2" />Remove Super Admin</>
                                : <><ShieldCheck className="h-4 w-4 mr-2" />Grant Super Admin</>
                              }
                            </Button>
                          )}

                          {/* Delete user */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full min-h-[44px] justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={isSelf}
                                title={isSelf ? "Can't delete yourself" : undefined}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete User?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete <strong>{user.email}</strong> and all their data. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteUserMutation.mutate(user.id)}
                                >
                                  {deleteUserMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Permissions Tab ────────────────────────────────────────────────── */}
        {activeTab === 'permissions' && (
          <div className="bg-card border rounded-xl p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-base">Tool Permissions</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Control which tools each non-admin user can access. Admins always have full access.
              </p>
            </div>
            {usersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <UserPermissionsManager
                users={(users || []).map((u) => ({ id: u.id, email: u.email, is_admin: u.is_admin }))}
              />
            )}
          </div>
        )}

        {/* ── Proposals Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'proposals' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search proposals..."
                  value={proposalSearch}
                  onChange={(e) => setProposalSearch(e.target.value)}
                  className="pl-10 h-11"
                />
              </div>
              <Button className="min-h-[44px] shrink-0" onClick={() => navigate('/proposal-builder')}>
                <FileText className="h-4 w-4 mr-2" />
                New
              </Button>
            </div>

            {proposalsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredProposals?.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">No proposals found</p>
                )}
                {filteredProposals?.map((proposal) => (
                  <div key={proposal.id} className="bg-card border rounded-xl px-4 py-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{proposal.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{proposal.client_name}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {proposal.status === 'published' ? (
                          <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 text-[11px]">Published</Badge>
                        ) : proposal.status === 'archived' ? (
                          <Badge variant="secondary" className="text-[11px]">Archived</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px]">Draft</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{safeFormatDate(proposal.updated_at, 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="min-h-[44px] min-w-[44px] p-0"
                        onClick={() => window.open(`/proposal/${proposal.slug}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="min-h-[44px] min-w-[44px] p-0 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Proposal?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{proposal.title}". This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteProposalMutation.mutate(proposal.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminDashboard;
