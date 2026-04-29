import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Download, Copy, X, Image as ImageIcon, Video, Megaphone,
  Sparkles, Trash2,
} from 'lucide-react';
import type { GalleryItem, CreativeType } from './types';

interface UnifiedGalleryProps {
  items: GalleryItem[];
  onClear: () => void;
}

const TYPE_ICONS: Record<CreativeType, typeof Megaphone> = {
  ad: Megaphone,
  image: Sparkles,
  video: Video,
  canva: ImageIcon,
};

const TYPE_COLORS: Record<CreativeType, string> = {
  ad: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  image: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  video: 'bg-green-500/20 text-green-400 border-green-500/30',
  canva: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
};

export function UnifiedGallery({ items, onClear }: UnifiedGalleryProps) {
  const [filter, setFilter] = useState<'all' | CreativeType>('all');
  const [expandedItem, setExpandedItem] = useState<GalleryItem | null>(null);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);
  const counts = {
    all: items.length,
    ad: items.filter(i => i.type === 'ad').length,
    image: items.filter(i => i.type === 'image').length,
    video: items.filter(i => i.type === 'video').length,
  };

  const handleDownload = async (item: GalleryItem) => {
    try {
      const resp = await fetch(item.url);
      const blob = await resp.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const ext = item.type === 'video' ? 'mp4' : blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
      a.download = `melleka-${item.type}-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Download failed, opening in new tab...');
      window.open(item.url, '_blank');
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  if (items.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl flex items-center gap-2">
              Creative Gallery
              <Badge variant="secondary">{items.length}</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mt-2">
            <TabsList>
              <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
              {counts.ad > 0 && <TabsTrigger value="ad">Ads ({counts.ad})</TabsTrigger>}
              {counts.image > 0 && <TabsTrigger value="image">Images ({counts.image})</TabsTrigger>}
              {counts.video > 0 && <TabsTrigger value="video">Videos ({counts.video})</TabsTrigger>}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((item) => {
              const TypeIcon = TYPE_ICONS[item.type];
              return (
                <div
                  key={item.id}
                  className="group relative rounded-xl overflow-hidden border border-border hover:border-primary/40 transition-all cursor-pointer bg-card"
                  onClick={() => setExpandedItem(item)}
                >
                  {/* Thumbnail */}
                  {item.type === 'video' ? (
                    <video
                      src={item.url}
                      className="w-full aspect-square object-cover"
                      muted
                      loop
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => { (e.target as HTMLVideoElement).pause(); (e.target as HTMLVideoElement).currentTime = 0; }}
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={item.prompt}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                  )}

                  {/* Type badge */}
                  <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-medium border ${TYPE_COLORS[item.type]}`}>
                    <TypeIcon className="h-3 w-3 inline mr-1" />
                    {item.type}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-[10px] line-clamp-2 mb-2">{item.prompt}</p>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="secondary" size="icon" className="h-6 w-6" onClick={() => handleCopyUrl(item.url)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="secondary" size="icon" className="h-6 w-6" onClick={() => handleDownload(item)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* QA score for ads */}
                  {item.metadata.qa && (
                    <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      item.metadata.qa.score >= 90 ? 'bg-emerald-500/80 text-white' :
                      item.metadata.qa.score >= 70 ? 'bg-amber-500/80 text-white' :
                      'bg-red-500/80 text-white'
                    }`}>
                      {item.metadata.qa.score}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      {expandedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedItem(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
            onClick={() => setExpandedItem(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            {expandedItem.type === 'video' ? (
              <video
                src={expandedItem.url}
                controls
                autoPlay
                loop
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
            ) : (
              <img
                src={expandedItem.url}
                alt={expandedItem.prompt}
                className="w-full max-h-[80vh] object-contain rounded-lg"
              />
            )}
            <div className="mt-4 flex items-center gap-3">
              <Badge className={TYPE_COLORS[expandedItem.type]}>
                {expandedItem.type}
              </Badge>
              {expandedItem.metadata.generator && (
                <Badge variant="outline" className="text-white/70 border-white/20">
                  {expandedItem.metadata.generator}
                </Badge>
              )}
              {expandedItem.metadata.platform && (
                <Badge variant="outline" className="text-white/70 border-white/20">
                  {expandedItem.metadata.platform}
                </Badge>
              )}
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleCopyUrl(expandedItem.url)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy URL
                </Button>
                <Button size="sm" onClick={() => handleDownload(expandedItem)}>
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
              </div>
            </div>
            <p className="text-white/60 text-sm mt-3 line-clamp-3">{expandedItem.prompt}</p>
          </div>
        </div>
      )}
    </>
  );
}
