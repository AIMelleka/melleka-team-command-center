import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, Eye, Play, Instagram, Linkedin, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SocialPost {
  platform: string;
  handle?: string;
  postDate?: string;
  contentType?: string;
  caption?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  impressions: number;
  engagementRate: number;
  videoViews: number;
  postUrl?: string;
}

interface DeckSocialMediaSectionProps {
  posts: SocialPost[];
  brandColor?: string;
  onScreenshotClick?: (url: string) => void;
}

const PLATFORM_CONFIG: Record<string, { label: string; icon: any; color: string; gradient: string }> = {
  instagram: { label: 'Instagram', icon: Instagram, color: '#E1306C', gradient: 'from-[#833AB4] via-[#E1306C] to-[#F77737]' },
  facebook: { label: 'Facebook', icon: Facebook, color: '#1877F2', gradient: 'from-[#1877F2] to-[#0C5DC7]' },
  tiktok: { label: 'TikTok', icon: Play, color: '#00f2ea', gradient: 'from-[#00f2ea] to-[#ff0050]' },
  linkedin: { label: 'LinkedIn', icon: Linkedin, color: '#0A66C2', gradient: 'from-[#0A66C2] to-[#004182]' },
};

const formatNumber = (n: number): string => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

export const DeckSocialMediaSection = ({ posts, brandColor = '#6366f1', onScreenshotClick }: DeckSocialMediaSectionProps) => {
  const platforms = [...new Set(posts.map(p => p.platform))];
  const [activeTab, setActiveTab] = useState(platforms[0] || 'all');

  const filteredPosts = activeTab === 'all' ? posts : posts.filter(p => p.platform === activeTab);

  // Aggregate stats per platform
  const platformStats = platforms.map(platform => {
    const platformPosts = posts.filter(p => p.platform === platform);
    const totalLikes = platformPosts.reduce((s, p) => s + p.likes, 0);
    const totalComments = platformPosts.reduce((s, p) => s + p.comments, 0);
    const totalShares = platformPosts.reduce((s, p) => s + p.shares, 0);
    const totalReach = platformPosts.reduce((s, p) => s + p.reach, 0);
    const totalImpressions = platformPosts.reduce((s, p) => s + p.impressions, 0);
    const avgEngagement = platformPosts.length > 0
      ? platformPosts.reduce((s, p) => s + p.engagementRate, 0) / platformPosts.length
      : 0;
    const config = PLATFORM_CONFIG[platform] || { label: platform, icon: Eye, color: brandColor, gradient: 'from-primary to-primary' };
    return { platform, ...config, postCount: platformPosts.length, totalLikes, totalComments, totalShares, totalReach, totalImpressions, avgEngagement };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Platform Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {platformStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.platform} className="deck-glass-card p-5 relative overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-10`} />
              <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5" style={{ color: stat.color }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--deck-text)' }}>{stat.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: `${stat.color}20`, color: stat.color }}>
                    {stat.postCount} posts
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold" style={{ color: 'var(--deck-text)' }}>{formatNumber(stat.totalLikes)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--deck-text-muted)' }}>Likes</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: 'var(--deck-text)' }}>{formatNumber(stat.totalComments)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--deck-text-muted)' }}>Comments</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold" style={{ color: 'var(--deck-text)' }}>{formatNumber(stat.totalShares)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--deck-text-muted)' }}>Shares</p>
                  </div>
                </div>
                {stat.avgEngagement > 0 && (
                  <div className="mt-2 text-xs text-center" style={{ color: stat.color }}>
                    Avg Engagement: {stat.avgEngagement.toFixed(2)}%
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Platform Tabs + Post Cards */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white/5 border border-white/10">
          {platforms.length > 1 && <TabsTrigger value="all" className="text-xs">All</TabsTrigger>}
          {platforms.map(p => {
            const config = PLATFORM_CONFIG[p];
            return (
              <TabsTrigger key={p} value={p} className="text-xs flex items-center gap-1.5">
                {config?.icon && <config.icon className="w-3.5 h-3.5" />}
                {config?.label || p}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPosts.slice(0, 12).map((post, idx) => {
              const config = PLATFORM_CONFIG[post.platform] || { color: brandColor, gradient: '', icon: Eye, label: post.platform };
              return (
                <div key={idx} className="deck-glass-card overflow-hidden group hover:ring-1 transition-all" style={{ '--ring-color': config.color } as any}>
                  {/* Post Image */}
                  {(post.imageUrl || post.thumbnailUrl) && (
                    <div
                      className="relative aspect-square bg-black/30 cursor-pointer overflow-hidden"
                      onClick={() => onScreenshotClick?.(post.imageUrl || post.thumbnailUrl || '')}
                    >
                      <img
                        src={post.imageUrl || post.thumbnailUrl}
                        alt={post.caption?.slice(0, 50) || 'Post'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {post.contentType === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-10 h-10 text-white/90 fill-white/90" />
                        </div>
                      )}
                      {/* Platform Badge */}
                      <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold backdrop-blur-md" style={{ background: `${config.color}cc`, color: '#fff' }}>
                        {config.label}
                      </div>
                      {/* Date */}
                      {post.postDate && (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] backdrop-blur-md bg-black/50 text-white/80">
                          {new Date(post.postDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post Metrics */}
                  <div className="p-4 space-y-3">
                    {/* Caption Preview */}
                    {post.caption && (
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--deck-text-muted)' }}>
                        {post.caption}
                      </p>
                    )}

                    {/* Engagement Row */}
                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--deck-text-muted)' }}>
                      {post.likes > 0 && (
                        <span className="flex items-center gap-1">
                          <Heart className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                          {formatNumber(post.likes)}
                        </span>
                      )}
                      {post.comments > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3.5 h-3.5" />
                          {formatNumber(post.comments)}
                        </span>
                      )}
                      {post.shares > 0 && (
                        <span className="flex items-center gap-1">
                          <Share2 className="w-3.5 h-3.5" />
                          {formatNumber(post.shares)}
                        </span>
                      )}
                      {post.saves > 0 && (
                        <span className="flex items-center gap-1">
                          <Bookmark className="w-3.5 h-3.5" />
                          {formatNumber(post.saves)}
                        </span>
                      )}
                      {post.videoViews > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          {formatNumber(post.videoViews)}
                        </span>
                      )}
                    </div>

                    {/* Reach + Impressions bar */}
                    {(post.reach > 0 || post.impressions > 0) && (
                      <div className="flex gap-3 text-[10px]" style={{ color: 'var(--deck-text-muted)' }}>
                        {post.reach > 0 && <span>Reach: {formatNumber(post.reach)}</span>}
                        {post.impressions > 0 && <span>Impressions: {formatNumber(post.impressions)}</span>}
                      </div>
                    )}

                    {/* Engagement Rate Badge */}
                    {post.engagementRate > 0 && (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${config.color}20`, color: config.color }}>
                        {post.engagementRate.toFixed(2)}% engagement
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredPosts.length === 0 && (
            <div className="text-center py-12" style={{ color: 'var(--deck-text-muted)' }}>
              <p className="text-sm">No posts found for this platform</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
