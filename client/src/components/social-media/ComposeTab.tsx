import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Send, Clock, Sparkles, Hash, Plus, X, Loader2, Image as ImageIcon,
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

const CHAR_LIMITS: Record<string, number> = {
  twitter: 280,
  linkedin: 3000,
  facebook: 63206,
  instagram: 2200,
  tiktok: 2200,
  threads: 500,
  bluesky: 300,
  pinterest: 500,
  reddit: 40000,
  youtube: 5000,
  telegram: 4096,
  gmb: 1500,
};

interface ComposeTabProps {
  activePlatforms: string[];
}

export function ComposeTab({ activePlatforms }: ComposeTabProps) {
  const [postText, setPostText] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [posting, setPosting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [hashtagging, setHashtagging] = useState(false);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const addMedia = () => {
    if (mediaInput.trim()) {
      setMediaUrls(prev => [...prev, mediaInput.trim()]);
      setMediaInput('');
    }
  };

  const removeMedia = (idx: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== idx));
  };

  const handlePost = async () => {
    if (!postText.trim()) {
      toast.error('Post content is required');
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      return;
    }
    setPosting(true);
    try {
      const body: Record<string, unknown> = {
        post: postText,
        platforms: selectedPlatforms,
      };
      if (mediaUrls.length > 0) body.mediaUrls = mediaUrls;
      if (scheduleEnabled && scheduleDate) body.scheduleDate = new Date(scheduleDate).toISOString();

      const res = await fetch(`${API_BASE}/social/post`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to post');
      } else {
        toast.success(scheduleEnabled ? 'Post scheduled' : 'Post published');
        setPostText('');
        setSelectedPlatforms([]);
        setMediaUrls([]);
        setScheduleEnabled(false);
        setScheduleDate('');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/social/generate`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          text: postText || 'Write an engaging social media post',
        }),
      });
      const data = await res.json();
      if (data.generatedText) {
        setPostText(data.generatedText);
        toast.success('AI post generated');
      } else if (data.post) {
        setPostText(data.post);
        toast.success('AI post generated');
      } else {
        toast.error('Could not generate text');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleHashtags = async () => {
    if (!postText.trim()) {
      toast.error('Write some content first');
      return;
    }
    setHashtagging(true);
    try {
      const res = await fetch(`${API_BASE}/social/hashtags`, {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ post: postText }),
      });
      const data = await res.json();
      const tags = data.hashtags || data.recommendedHashtags;
      if (Array.isArray(tags) && tags.length > 0) {
        setPostText(prev => prev + '\n\n' + tags.join(' '));
        toast.success(`${tags.length} hashtags added`);
      } else {
        toast.error('No hashtags returned');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setHashtagging(false);
    }
  };

  // Show the lowest character limit among selected platforms
  const minLimit = selectedPlatforms.length > 0
    ? Math.min(...selectedPlatforms.map(p => CHAR_LIMITS[p] || 5000))
    : 5000;
  const overLimit = postText.length > minLimit;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Compose Post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform selection */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Platforms</Label>
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
                <p className="text-xs text-muted-foreground">No platforms connected. Go to the Connect tab first.</p>
              )}
            </div>
          </div>

          {/* Post content */}
          <div className="relative">
            <Textarea
              placeholder="What's on your mind?"
              value={postText}
              onChange={e => setPostText(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <span className={`absolute bottom-2 right-3 text-xs ${overLimit ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
              {postText.length} / {minLimit}
            </span>
          </div>

          {/* AI helpers */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              AI Generate
            </Button>
            <Button variant="outline" size="sm" onClick={handleHashtags} disabled={hashtagging}>
              {hashtagging ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Hash className="h-4 w-4 mr-1" />}
              Hashtags
            </Button>
          </div>

          {/* Media URLs */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Media (image/video URLs)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com/image.jpg"
                value={mediaInput}
                onChange={e => setMediaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMedia())}
              />
              <Button variant="outline" size="icon" onClick={addMedia}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {mediaUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {mediaUrls.map((url, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 max-w-[200px]">
                    <ImageIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate text-xs">{url.split('/').pop()}</span>
                    <button onClick={() => removeMedia(i)} className="ml-1 hover:text-red-500">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Schedule toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            <Label className="text-sm">Schedule for later</Label>
          </div>
          {scheduleEnabled && (
            <Input
              type="datetime-local"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
            />
          )}

          {/* Submit */}
          <Button
            className="w-full"
            onClick={handlePost}
            disabled={posting || !postText.trim() || selectedPlatforms.length === 0}
          >
            {posting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : scheduleEnabled ? (
              <Clock className="h-4 w-4 mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {posting ? 'Posting...' : scheduleEnabled ? 'Schedule Post' : 'Post Now'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
