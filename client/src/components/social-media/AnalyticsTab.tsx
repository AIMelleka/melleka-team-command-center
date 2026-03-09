import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart3, Users, Eye, Heart, MessageCircle, Share } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

interface AnalyticsTabProps {
  activePlatforms: string[];
}

export function AnalyticsTab({ activePlatforms }: AnalyticsTabProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const fetchProfileAnalytics = async () => {
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/social/analytics/social`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ platforms: selectedPlatforms }),
      });
      const data = await res.json();
      setProfileData(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Try to extract stats from the analytics response
  const stats: { platform: string; followers?: number; engagement?: number; posts?: number }[] = [];
  if (profileData) {
    // Ayrshare returns analytics keyed by platform
    for (const platform of selectedPlatforms) {
      const pData = profileData[platform] || profileData;
      stats.push({
        platform,
        followers: pData?.followers_count || pData?.followersCount || pData?.followers,
        engagement: pData?.engagement_rate || pData?.engagementRate || pData?.engagement,
        posts: pData?.media_count || pData?.mediaCount || pData?.postsCount,
      });
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Profile Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Select platforms to analyze</p>
            <div className="flex flex-wrap gap-2">
              {activePlatforms.map(p => (
                <Badge
                  key={p}
                  variant={selectedPlatforms.includes(p) ? 'default' : 'outline'}
                  className="cursor-pointer select-none"
                  onClick={() => togglePlatform(p)}
                >
                  {p}
                </Badge>
              ))}
              {activePlatforms.length === 0 && (
                <p className="text-xs text-muted-foreground">No platforms connected.</p>
              )}
            </div>
          </div>
          <Button onClick={fetchProfileAnalytics} disabled={loading || selectedPlatforms.length === 0} size="sm">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
            Get Analytics
          </Button>
        </CardContent>
      </Card>

      {stats.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.platform}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">{s.platform}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{s.followers?.toLocaleString() ?? '-'}</p>
                    <p className="text-[10px] text-muted-foreground">Followers</p>
                  </div>
                  <div>
                    <Heart className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{s.engagement ?? '-'}</p>
                    <p className="text-[10px] text-muted-foreground">Engagement</p>
                  </div>
                  <div>
                    <Share className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <p className="text-lg font-bold">{s.posts?.toLocaleString() ?? '-'}</p>
                    <p className="text-[10px] text-muted-foreground">Posts</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {profileData && stats.length === 0 && (
        <Card>
          <CardContent className="py-6">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-64 overflow-auto">
              {JSON.stringify(profileData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
