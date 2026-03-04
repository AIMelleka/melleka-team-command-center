import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Search, 
  LogOut, 
  Home,
  Loader2,
  UserPlus,
  Trash2,
  FileText,
  ExternalLink,
  Eye,
  ImageIcon,
  KeyRound
} from 'lucide-react';
import { UserPermissionsManager } from '@/components/UserPermissionsManager';
import { useNavigate } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import GenieLamp from '@/components/icons/GenieLamp';

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

const AdminDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [proposalSearch, setProposalSearch] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { signOut, user: authUser, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Debug logging
  console.log('AdminDashboard render:', { user: authUser?.email, isAdmin, authLoading });

  // Fetch users using the secure admin function
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_users_for_admin');

      if (error) throw error;
      return data as UserView[];
    },
  });

  // Fetch proposals
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

  // Toggle admin role mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      if (isAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
        if (error) throw error;
      }
    },
    onSuccess: (_, { isAdmin }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(isAdmin ? 'Admin role removed' : 'Admin role granted');
    },
    onError: (error) => {
      toast.error('Failed to update role', { description: error.message });
    },
  });

  // Delete proposal mutation
  const deleteProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from('proposals')
        .delete()
        .eq('id', proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-proposals'] });
      toast.success('Proposal deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete proposal', { description: error.message });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete user', { description: error.message });
    },
  });

  // Create new user
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsCreating(true);
    try {
      const normalizedEmail = newUserEmail.trim().toLowerCase();

      // Create a regular user by default. Admin access can be granted after creation
      // using the existing "Make Admin" action.
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: { email: normalizedEmail, password: newUserPassword, makeAdmin: false },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success('User created successfully');
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const normalizedUserSearch = searchQuery.trim().toLowerCase();
  const normalizedProposalSearch = proposalSearch.trim().toLowerCase();

  const filteredUsers = users?.filter((u) =>
    (u.email ?? '').toLowerCase().includes(normalizedUserSearch)
  );

  const filteredProposals = proposals?.filter((p) =>
    (p.title ?? '').toLowerCase().includes(normalizedProposalSearch) ||
    (p.client_name ?? '').toLowerCase().includes(normalizedProposalSearch)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Published</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <GenieLamp size={32} className="text-genie-purple" />
            <div>
              <h1 className="text-lg sm:text-xl font-display font-bold">Admin Dashboard</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Manage users, roles & data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Home</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-genie-purple/10">
                <Users className="h-5 w-5 text-genie-purple" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-genie-gold/10">
                <Shield className="h-5 w-5 text-genie-gold" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter((u) => u.is_admin).length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Admins</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{proposals?.length ?? 0}</p>
                <p className="text-sm text-muted-foreground">Proposals</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Eye className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {proposals?.filter((p) => p.status === 'published').length ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">Published</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Button variant="outline" onClick={() => navigate('/proposal-builder')}>
            <FileText className="h-4 w-4 mr-2" />
            New Proposal
          </Button>
          <Button variant="outline" onClick={() => navigate('/portfolio-manager')}>
            <ImageIcon className="h-4 w-4 mr-2" />
            Portfolio Images
          </Button>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="proposals" className="gap-2">
              <FileText className="h-4 w-4" />
              Proposals
            </TabsTrigger>
            <TabsTrigger value="permissions" className="gap-2">
              <KeyRound className="h-4 w-4" />
              Permissions
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>
                      Create a new user account. They can be promoted to admin after creation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        placeholder="user@example.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="••••••••"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateUser} disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create User'
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

        <div className="bg-card border border-border rounded-lg overflow-x-auto">
              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-genie-purple" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Sign In</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers?.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.email}</TableCell>
                          <TableCell>
                            {user.is_admin ? (
                              <Badge variant="outline" className="border-genie-gold text-genie-gold">
                                <Shield className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="secondary">User</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.last_sign_in_at
                              ? new Date(user.last_sign_in_at).toLocaleDateString()
                              : 'Never'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toggleAdminMutation.mutate({
                                    userId: user.id,
                                    isAdmin: user.is_admin,
                                  })
                                }
                                disabled={toggleAdminMutation.isPending}
                              >
                                {user.is_admin ? (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Remove Admin</span>
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Make Admin</span>
                                  </>
                                )}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    disabled={user.id === authUser?.id}
                                    title={user.id === authUser?.id ? "Can't delete yourself" : 'Delete user'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete <strong>{user.email}</strong> and all their data. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteUserMutation.mutate(user.id)}
                                    >
                                      {deleteUserMutation.isPending ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</>
                                      ) : 'Delete User'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* Proposals Tab */}
          <TabsContent value="proposals" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search proposals..."
                  value={proposalSearch}
                  onChange={(e) => setProposalSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => navigate('/proposal-builder')}>
                <FileText className="h-4 w-4 mr-2" />
                New Proposal
              </Button>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {proposalsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-genie-purple" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProposals?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No proposals found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProposals?.map((proposal) => (
                        <TableRow key={proposal.id}>
                          <TableCell className="font-medium">{proposal.title}</TableCell>
                          <TableCell>{proposal.client_name}</TableCell>
                          <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(proposal.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(`/proposal/${proposal.slug}`, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Proposal?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete "{proposal.title}". This action cannot be undone.
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
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="mb-4">
                <h3 className="text-base font-semibold">Tool Permissions</h3>
                <p className="text-sm text-muted-foreground">
                  Control which tools each non-admin user can access. Admins always have full access.
                </p>
              </div>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <UserPermissionsManager users={(users || []).map(u => ({ id: u.id, email: u.email, is_admin: u.is_admin }))} />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminDashboard;
