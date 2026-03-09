import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, Eye, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

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

interface SocialPost {
  id: string;
  post?: string;
  body?: string;
  platforms?: string[];
  status?: string;
  created?: string;
  createdUTC?: string;
  scheduleDate?: string;
  mediaUrls?: string[];
  errors?: any[];
}

export function PostsTab() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [viewPost, setViewPost] = useState<SocialPost | null>(null);
  const [deletePost, setDeletePost] = useState<SocialPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const platform = platformFilter !== 'all' ? `?platform=${platformFilter}` : '';
      const res = await fetch(`${API_BASE}/social/history${platform}`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      // Ayrshare returns an array directly or { history: [...] }
      const list = Array.isArray(data) ? data : (data.history || []);
      setPosts(list);
    } catch (err: any) {
      toast.error('Failed to load post history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [platformFilter]);

  const handleDelete = async () => {
    if (!deletePost) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/social/post`, {
        method: 'DELETE',
        headers: await authHeaders(),
        body: JSON.stringify({ id: deletePost.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error || 'Failed to delete');
      } else {
        toast.success('Post deleted');
        setPosts(prev => prev.filter(p => p.id !== deletePost.id));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeletePost(null);
    }
  };

  const getStatusVariant = (status?: string): "default" | "secondary" | "outline" | "destructive" => {
    if (!status) return 'outline';
    const s = status.toLowerCase();
    if (s === 'success' || s === 'published') return 'default';
    if (s === 'scheduled') return 'secondary';
    if (s === 'error' || s === 'failed') return 'destructive';
    return 'outline';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Post History</h2>
        <div className="flex gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="twitter">X / Twitter</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchHistory} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No posts found. Create your first post in the Compose tab.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Content</TableHead>
                <TableHead>Platforms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const text = post.post || post.body || '';
                const dateStr = post.created || post.createdUTC || '';
                return (
                  <TableRow key={post.id}>
                    <TableCell className="font-medium text-sm">
                      {text.length > 100 ? text.slice(0, 100) + '...' : text}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(post.platforms || []).map(p => (
                          <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(post.status)}>
                        {post.status || 'unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dateStr ? format(new Date(dateStr), 'MMM dd, yyyy h:mm a') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewPost(post)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => setDeletePost(post)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* View dialog */}
      <Dialog open={!!viewPost} onOpenChange={() => setViewPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
          </DialogHeader>
          {viewPost && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {(viewPost.platforms || []).map(p => (
                  <Badge key={p} variant="outline">{p}</Badge>
                ))}
              </div>
              <p className="text-sm whitespace-pre-wrap">{viewPost.post || viewPost.body}</p>
              {viewPost.mediaUrls && viewPost.mediaUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewPost.mediaUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="h-24 w-24 object-cover rounded-md" />
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                ID: {viewPost.id}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletePost} onOpenChange={() => setDeletePost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the post from all platforms it was published to. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
