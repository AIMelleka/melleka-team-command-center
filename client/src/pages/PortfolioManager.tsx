import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AdminHeader from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Trash2, Image, Loader2, Copy, Check, ExternalLink, Video, Play } from 'lucide-react';

const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || "https://api.teams.melleka.com/api")
  : "/api";

async function getFreshToken(): Promise<string> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token || (session.expires_at && session.expires_at * 1000 - Date.now() < 60_000)) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session;
  }
  return session?.access_token || "";
}

interface PortfolioItem {
  type: 'image' | 'video';
  name: string;
  url: string;
  created_at: string;
}

const PortfolioManager = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_BASE}/uploads/portfolio`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to load portfolio');

      const data: PortfolioItem[] = await res.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to load portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const token = await getFreshToken();
      const formData = new FormData();
      for (const file of Array.from(files)) {
        formData.append('files', file);
      }

      const res = await fetch(`${API_BASE}/uploads/portfolio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Upload failed');
      }

      const result = await res.json();
      toast.success(`Uploaded ${result.successful} of ${result.total} file(s)`);
      fetchItems();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (item: PortfolioItem) => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_BASE}/uploads/portfolio/${encodeURIComponent(item.name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to delete');

      toast.success('File deleted');
      setItems(prev => prev.filter(i => i.name !== item.name));
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete');
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('URL copied!');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const imageCount = items.filter(i => i.type === 'image').length;
  const videoCount = items.filter(i => i.type === 'video').length;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20">
              <Image className="h-8 w-8 text-primary" />
            </div>
            <div className="text-left">
              <h1 className="text-3xl md:text-4xl font-bold">Portfolio Manager</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Upload images and videos for the Creative Excellence carousel in proposals
              </p>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Images & Videos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
                id="portfolio-upload"
              />
              <label
                htmlFor="portfolio-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                {uploading ? (
                  <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                ) : (
                  <Image className="w-10 h-10 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {uploading ? 'Uploading...' : 'Click to upload images or videos'}
                  </p>
                  <p className="text-muted-foreground text-sm">PNG, JPG, WebP, GIF, MP4, WebM up to 50MB each</p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Image className="w-5 h-5 text-primary" />
                Portfolio ({items.length})
              </span>
              <div className="flex gap-3 text-sm font-normal text-muted-foreground">
                <span>{imageCount} images</span>
                <span>{videoCount} videos</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No portfolio items yet</p>
                <p className="text-sm">Upload images or videos above</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item, idx) => (
                  <div
                    key={`${item.type}-${item.name}-${idx}`}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-muted border border-border"
                  >
                    {item.type === 'image' ? (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-card relative">
                        <video
                          src={item.url}
                          className="w-full h-full object-cover absolute inset-0"
                          muted
                          preload="metadata"
                        />
                        <div className="relative z-10 flex flex-col items-center gap-2">
                          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                            <Play className="w-6 h-6 text-white ml-0.5" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Type badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm ${
                        item.type === 'video'
                          ? 'bg-red-500/80 text-white'
                          : 'bg-black/60 text-white'
                      }`}>
                        {item.type === 'video' ? 'VIDEO' : 'IMAGE'}
                      </span>
                    </div>

                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={() => copyUrl(item.url)}
                      >
                        {copiedUrl === item.url ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-white/20"
                        onClick={() => window.open(item.url, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-400 hover:bg-red-500/20"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Filename */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-xs text-white/80 truncate">{item.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <div className="mt-8 p-6 rounded-xl bg-primary/5 border border-primary/20">
          <h3 className="text-lg font-semibold text-primary mb-2">How this works</h3>
          <ul className="text-muted-foreground text-sm space-y-1.5">
            <li>Images and videos uploaded here appear in the "Creative Excellence" carousel on ALL proposals.</li>
            <li>Supported formats: PNG, JPG, WebP, GIF, MP4, WebM (up to 50MB each).</li>
            <li>You can also add showcase media per-proposal in the Proposal Builder (Step 2).</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PortfolioManager;
