import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Calendar, RefreshCw, Clock } from 'lucide-react';
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

interface ScheduledPost {
  id: string;
  post?: string;
  body?: string;
  platforms?: string[];
  scheduleDate?: string;
  status?: string;
}

export function CalendarTab() {
  const [scheduled, setScheduled] = useState<ScheduledPost[]>([]);
  const [autoSchedule, setAutoSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyRes, scheduleRes] = await Promise.all([
        fetch(`${API_BASE}/social/history`, { headers: await authHeaders() }),
        fetch(`${API_BASE}/social/auto-schedule`, { headers: await authHeaders() }),
      ]);

      const historyData = await historyRes.json();
      const scheduleData = await scheduleRes.json();

      // Filter to only scheduled (not yet published) posts
      const allPosts = Array.isArray(historyData) ? historyData : (historyData.history || []);
      const scheduledPosts = allPosts.filter((p: any) =>
        p.status === 'scheduled' || p.scheduleDate
      );
      // Sort by schedule date ascending
      scheduledPosts.sort((a: any, b: any) => {
        const da = a.scheduleDate || '';
        const db = b.scheduleDate || '';
        return da.localeCompare(db);
      });
      setScheduled(scheduledPosts);
      setAutoSchedule(scheduleData);
    } catch (err: any) {
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Scheduled Posts
        </h2>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {scheduled.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No scheduled posts. Use the Compose tab to schedule posts for later.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {scheduled.map((post) => {
            const text = post.post || post.body || '';
            return (
              <Card key={post.id}>
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{text}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(post.platforms || []).map(p => (
                          <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-sm text-primary">
                        <Clock className="h-3.5 w-3.5" />
                        {post.scheduleDate
                          ? format(new Date(post.scheduleDate), 'MMM dd, yyyy h:mm a')
                          : 'Pending'}
                      </div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {post.status || 'scheduled'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Auto-schedule info */}
      {autoSchedule && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Auto-Schedule Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {autoSchedule.schedules && Array.isArray(autoSchedule.schedules) && autoSchedule.schedules.length > 0 ? (
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                {JSON.stringify(autoSchedule.schedules, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">
                No auto-schedule configured. You can set this up through the chat agent.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
