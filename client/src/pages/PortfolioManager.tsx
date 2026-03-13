import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AdminHeader from '@/components/AdminHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Trash2, Image, Loader2, Copy, Check, ExternalLink, Video, Play, Link } from 'lucide-react';

interface PortfolioItem {
  type: 'image' | 'video';
  name: string;
  url: string;
  thumbnail?: string;
  created_at: string;
}

const VIDEO_STORAGE_KEY = 'portfolio-video-urls';

// Get YouTube/Vimeo thumbnail from URL
const getVideoThumbnail = (url: string): string | undefined => {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  return undefined;
};

const PortfolioManager = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      // Fetch only from proposal-assets/portfolio (your curated showcase images)
      const { data, error } = await supabase.storage
        .from('proposal-assets')
        .list('portfolio', {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      const allStorage: PortfolioItem[] = (data || [])
        .filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => ({
          type: (file.metadata?.mimetype?.startsWith('video/') ? 'video' : 'image') as 'image' | 'video',
          name: file.name,
          url: supabase.storage.from('proposal-assets').getPublicUrl(`portfolio/${file.name}`).data.publicUrl,
          created_at: file.created_at || '',
        }));

      // Fetch video URLs from localStorage
      const savedVideos: PortfolioItem[] = JSON.parse(localStorage.getItem(VIDEO_STORAGE_KEY) || '[]');

      setItems([...savedVideos, ...allStorage]);
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
    let uploadCount = 0;

    try {
      for (const file of Array.from(files)) {
        const timestamp = Date.now();
        const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
        const fileName = `${timestamp}-${cleanName}`;

        const { error } = await supabase.storage
          .from('proposal-assets')
          .upload(`portfolio/${fileName}`, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;
        uploadCount++;
      }

      toast.success(`Uploaded ${uploadCount} file(s) successfully!`);
      fetchItems();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleAddVideo = () => {
    const url = videoUrlInput.trim();
    if (!url) return;

    const thumbnail = getVideoThumbnail(url);
    const newVideo: PortfolioItem = {
      type: 'video',
      name: url,
      url,
      thumbnail,
      created_at: new Date().toISOString(),
    };

    const savedVideos: PortfolioItem[] = JSON.parse(localStorage.getItem(VIDEO_STORAGE_KEY) || '[]');
    const updated = [newVideo, ...savedVideos];
    localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(updated));

    setItems(prev => [newVideo, ...prev]);
    setVideoUrlInput('');
    toast.success('Video added');
  };

  const handleDelete = async (item: PortfolioItem) => {
    // Video URL from localStorage
    if (item.url.startsWith('http') && !item.url.includes('supabase.co/storage')) {
      const savedVideos: PortfolioItem[] = JSON.parse(localStorage.getItem(VIDEO_STORAGE_KEY) || '[]');
      const updated = savedVideos.filter(v => v.url !== item.url);
      localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(updated));
      setItems(prev => prev.filter(i => i.url !== item.url));
      toast.success('Video removed');
      return;
    }

    try {
      const { error } = await supabase.storage
        .from('proposal-assets')
        .remove([`portfolio/${item.name}`]);

      if (error) throw error;

      toast.success('File deleted');
      setItems(prev => prev.filter(i => i.url !== item.url));
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

        {/* Upload Images Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload Images
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
              <Input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                className="hidden"
                id="image-upload"
              />
              <Label
                htmlFor="image-upload"
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
                  <p className="text-muted-foreground text-sm">PNG, JPG, WebP, MP4 up to 10MB each</p>
                </div>
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Add Video URL Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Add Video Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={videoUrlInput}
                  onChange={(e) => setVideoUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddVideo()}
                  placeholder="Paste YouTube or Vimeo URL"
                  className="pl-9"
                />
              </div>
              <Button onClick={handleAddVideo} disabled={!videoUrlInput.trim()}>
                <Video className="w-4 h-4 mr-2" />
                Add Video
              </Button>
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
                <p className="text-sm">Upload images or add video links above</p>
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
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt="Video thumbnail"
                            className="w-full h-full object-cover absolute inset-0"
                          />
                        ) : null}
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
                      <p className="text-xs text-white/80 truncate">
                        {item.type === 'video' && item.url.length > 40
                          ? item.url.slice(0, 40) + '...'
                          : item.name}
                      </p>
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
            <li>Images uploaded here appear in the "Creative Excellence" carousel on ALL proposals (unless a proposal has its own showcase media).</li>
            <li>You can also add showcase media per-proposal in the Proposal Builder (Step 2).</li>
            <li>Video links open in a new tab when clicked in the proposal.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PortfolioManager;
