import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, ExternalLink, CheckCircle2, XCircle, Link2, Loader2, AlertCircle,
} from 'lucide-react';
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

const ALL_PLATFORMS = [
  { id: 'facebook', label: 'Facebook', color: 'bg-blue-600' },
  { id: 'instagram', label: 'Instagram', color: 'bg-pink-500' },
  { id: 'twitter', label: 'X / Twitter', color: 'bg-slate-800 dark:bg-slate-300' },
  { id: 'linkedin', label: 'LinkedIn', color: 'bg-blue-700' },
  { id: 'tiktok', label: 'TikTok', color: 'bg-black dark:bg-white' },
  { id: 'pinterest', label: 'Pinterest', color: 'bg-red-600' },
  { id: 'reddit', label: 'Reddit', color: 'bg-orange-600' },
  { id: 'youtube', label: 'YouTube', color: 'bg-red-500' },
  { id: 'threads', label: 'Threads', color: 'bg-slate-700' },
  { id: 'telegram', label: 'Telegram', color: 'bg-sky-500' },
  { id: 'bluesky', label: 'Bluesky', color: 'bg-blue-400' },
  { id: 'gmb', label: 'Google Business', color: 'bg-green-500' },
];

interface ConnectTabProps {
  activePlatforms: string[];
  displayNames: Record<string, { username?: string; displayName?: string }>;
  loading: boolean;
  onRefresh: () => void;
}

export function ConnectTab({ activePlatforms, displayNames, loading, onRefresh }: ConnectTabProps) {
  const active = new Set(activePlatforms.map(p => p.toLowerCase()));
  const [jwtConfigured, setJwtConfigured] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if JWT linking is configured on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/social/connect/status`, {
          headers: await authHeaders(),
        });
        const data = await res.json();
        setJwtConfigured(data.configured);
      } catch {
        setJwtConfigured(false);
      }
    })();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${API_BASE}/social/connect`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'not_configured') {
          toast.error('JWT linking not configured yet. Set AYRSHARE_PRIVATE_KEY and AYRSHARE_DOMAIN in your server environment.');
        } else {
          toast.error(data.message || 'Failed to generate connect URL');
        }
        setConnecting(false);
        return;
      }

      // Open the JWT URL in a popup
      const popup = window.open(data.url, 'ayrshare-connect', 'width=600,height=700,scrollbars=yes');

      if (!popup) {
        // Popup blocked, fall back to new tab
        window.open(data.url, '_blank');
        toast.success('Connect page opened in a new tab. Come back here and click Refresh when done.');
        setConnecting(false);
        return;
      }

      // Start polling for connection changes
      setPolling(true);
      toast.success('Connect your social accounts in the popup window');

      const startPlatformCount = activePlatforms.length;
      let pollCount = 0;
      const maxPolls = 60; // 5 minutes at 5-second intervals

      pollRef.current = setInterval(async () => {
        pollCount++;

        // Check if popup was closed
        if (popup.closed || pollCount >= maxPolls) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          setConnecting(false);
          onRefresh(); // Final refresh
          if (pollCount >= maxPolls) {
            toast.info('Polling timed out. Click Refresh to check connections.');
          }
          return;
        }

        // Poll for updated platforms
        try {
          const userRes = await fetch(`${API_BASE}/social/user`, {
            headers: await authHeaders(),
          });
          const userData = await userRes.json();
          const newPlatforms = userData.activeSocialAccounts || [];
          if (newPlatforms.length > startPlatformCount) {
            toast.success(`New platform connected! (${newPlatforms.length} total)`);
            onRefresh();
          }
        } catch {
          // Silently continue polling
        }
      }, 5000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      if (!polling) setConnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
          <p className="text-sm text-muted-foreground">
            {active.size} of {ALL_PLATFORMS.length} platforms connected
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {/* In-app connect button (JWT flow) */}
          {jwtConfigured && (
            <Button size="sm" onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4 mr-2" />
              )}
              {polling ? 'Waiting for connection...' : 'Connect Accounts'}
            </Button>
          )}

          {/* Fallback to Ayrshare dashboard */}
          {jwtConfigured === false && (
            <Button
              size="sm"
              onClick={() => window.open('https://app.ayrshare.com', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect in Ayrshare
            </Button>
          )}
        </div>
      </div>

      {/* Setup notice if JWT not configured */}
      {jwtConfigured === false && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Enable in-app account linking</p>
                <p className="text-xs text-muted-foreground mt-1">
                  To connect social accounts directly from this page, add these two secrets to your server environment:
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc pl-4">
                  <li>AYRSHARE_PRIVATE_KEY - Your RSA private key from the Ayrshare dashboard (API Page &gt; Integration Package)</li>
                  <li>AYRSHARE_DOMAIN - Your domain registered with Ayrshare during onboarding</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Until then, you can connect accounts through the Ayrshare dashboard directly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {polling && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium">Waiting for you to connect accounts...</p>
              <p className="text-xs text-muted-foreground">
                Complete the process in the popup window. This page will update automatically when new platforms are connected.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_PLATFORMS.map((platform) => {
          const connected = active.has(platform.id);
          const info = displayNames[platform.id];
          return (
            <Card key={platform.id} className={connected ? 'border-green-500/30' : 'opacity-60'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${platform.color}`} />
                    {platform.label}
                  </span>
                  {connected ? (
                    <Badge variant="default" className="bg-green-600 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <XCircle className="h-3 w-3 mr-1" />
                      Not connected
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              {connected && info && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {info.displayName || info.username || 'Connected'}
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
