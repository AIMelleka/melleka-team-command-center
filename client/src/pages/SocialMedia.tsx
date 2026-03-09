import { useState, useEffect, useCallback } from 'react';
import AdminHeader from '@/components/AdminHeader';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Share2, PenLine, FileText, BarChart3, Calendar, Plug, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ConnectTab } from '@/components/social-media/ConnectTab';
import { ComposeTab } from '@/components/social-media/ComposeTab';
import { PostsTab } from '@/components/social-media/PostsTab';
import { AnalyticsTab } from '@/components/social-media/AnalyticsTab';
import { CalendarTab } from '@/components/social-media/CalendarTab';

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

export default function SocialMedia() {
  const [activePlatforms, setActivePlatforms] = useState<string[]>([]);
  const [displayNames, setDisplayNames] = useState<Record<string, any>>({});
  const [loadingUser, setLoadingUser] = useState(true);

  const fetchUser = useCallback(async () => {
    setLoadingUser(true);
    try {
      const res = await fetch(`${API_BASE}/social/user`, {
        headers: await authHeaders(),
      });
      const data = await res.json();
      const platforms = data.activeSocialAccounts || [];
      setActivePlatforms(platforms);
      setDisplayNames(data.displayNames || {});
    } catch (err: any) {
      toast.error('Failed to load social media status');
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-sky-500/10">
              <Share2 className="h-6 w-6 text-sky-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Social Media</h1>
              <p className="text-sm text-muted-foreground">
                Manage posts, analytics, and connections across all platforms
              </p>
            </div>
          </div>

          {/* Connected platforms bar */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {loadingUser ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : activePlatforms.length > 0 ? (
              <>
                <span className="text-xs text-muted-foreground mr-1">Connected:</span>
                {activePlatforms.map(p => (
                  <Badge key={p} variant="default" className="text-[10px] capitalize bg-green-600">
                    {p}
                  </Badge>
                ))}
              </>
            ) : (
              <span className="text-xs text-muted-foreground">
                No platforms connected. Go to the Connect tab to get started.
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="compose">
          <TabsList className="mb-6">
            <TabsTrigger value="compose" className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="posts" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="connect" className="gap-1.5">
              <Plug className="h-3.5 w-3.5" />
              Connect
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose">
            <ComposeTab activePlatforms={activePlatforms} />
          </TabsContent>

          <TabsContent value="posts">
            <PostsTab />
          </TabsContent>

          <TabsContent value="analytics">
            <AnalyticsTab activePlatforms={activePlatforms} />
          </TabsContent>

          <TabsContent value="calendar">
            <CalendarTab />
          </TabsContent>

          <TabsContent value="connect">
            <ConnectTab
              activePlatforms={activePlatforms}
              displayNames={displayNames}
              loading={loadingUser}
              onRefresh={fetchUser}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
