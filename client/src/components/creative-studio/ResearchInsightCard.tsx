import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Globe, Shield, Users, Search, ImageIcon, X, ChevronDown, ChevronUp,
  ExternalLink, TrendingUp, AlertTriangle, Loader2, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ResearchSource, ResearchSourceType } from './types';

interface ResearchInsightCardProps {
  source: ResearchSource;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}

const TYPE_ICONS: Record<ResearchSourceType, typeof Globe> = {
  'website': Globe,
  'ad-transparency': Shield,
  'social-media': Users,
  'seo': Search,
  'ad-screenshot': ImageIcon,
};

function WebsiteContent({ data }: { data: any }) {
  return (
    <div className="flex flex-col gap-3">
      {(data.businessName || data.tagline) && (
        <div>
          {data.businessName && <p className="text-sm font-medium text-foreground">{data.businessName}</p>}
          {data.tagline && <p className="text-xs text-muted-foreground">{data.tagline}</p>}
        </div>
      )}

      {data.colors && Object.keys(data.colors).length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Colors:</span>
          <div className="flex gap-1.5">
            {Object.values(data.colors).map((color: any, i: number) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border border-border/50"
                style={{ backgroundColor: color }}
                title={String(color)}
              />
            ))}
          </div>
        </div>
      )}

      {data.logo && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Logo:</span>
          <img src={data.logo} alt="Logo" className="h-8 max-w-[120px] object-contain rounded" />
        </div>
      )}

      {data.messaging && data.messaging.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Key messaging:</span>
          {data.messaging.slice(0, 3).map((msg: string, i: number) => (
            <p key={i} className="text-xs text-foreground/80 italic pl-2 border-l-2 border-border/50">
              "{msg}"
            </p>
          ))}
        </div>
      )}

      {data.screenshots && data.screenshots.length > 0 && (
        <div className="flex gap-2">
          {data.screenshots.slice(0, 2).map((s: any, i: number) => (
            <img
              key={i}
              src={s.screenshot || s.url}
              alt={s.title || 'Screenshot'}
              className="h-20 w-auto rounded border border-border/50 object-cover"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdTransparencyContent({ data }: { data: any }) {
  const truncated = data.content && data.content.length > 300
    ? data.content.slice(0, 300) + '...'
    : data.content;

  return (
    <div className="flex flex-col gap-3">
      {data.screenshot && (
        <img
          src={data.screenshot}
          alt="Ad screenshot"
          className="max-h-40 w-auto rounded border border-border/50 object-contain"
        />
      )}
      {truncated && <p className="text-xs text-foreground/80">{truncated}</p>}
    </div>
  );
}

function SocialMediaContent({ data }: { data: any }) {
  const posts: any[] = data.posts || [];
  const sorted = [...posts].sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0));

  return (
    <div className="flex flex-col gap-2">
      <Badge variant="secondary" className="w-fit text-xs">{posts.length} posts</Badge>
      {sorted.slice(0, 3).map((post, i) => (
        <div key={i} className="flex flex-col gap-0.5 p-2 rounded bg-muted/40">
          <p className="text-xs text-foreground/80">
            {post.caption && post.caption.length > 80
              ? post.caption.slice(0, 80) + '...'
              : post.caption}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{post.likes?.toLocaleString()} likes</span>
            <span>{post.comments?.toLocaleString()} comments</span>
            {post.contentType && <Badge variant="outline" className="text-[10px] px-1 py-0">{post.contentType}</Badge>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SeoContent({ data }: { data: any }) {
  const keywords: any[] = data.topKeywords || [];
  const competitors: any[] = data.competitors || [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {data.organicTraffic != null && (
          <Badge variant="secondary" className="text-xs">
            <TrendingUp className="w-3 h-3 mr-1" />
            {Number(data.organicTraffic).toLocaleString()} traffic
          </Badge>
        )}
        {data.domainAuthority != null && (
          <Badge variant="secondary" className="text-xs">DA {data.domainAuthority}</Badge>
        )}
      </div>

      {keywords.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Top keywords:</span>
          {keywords.slice(0, 5).map((kw, i) => (
            <p key={i} className="text-xs text-foreground/80 pl-2">
              {kw.keyword} <span className="text-muted-foreground">(vol: {kw.volume?.toLocaleString()}, pos: {kw.position})</span>
            </p>
          ))}
        </div>
      )}

      {competitors.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Top competitors:</span>
          {competitors.slice(0, 3).map((c, i) => (
            <p key={i} className="text-xs text-foreground/80 pl-2">{c.domain}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function AdScreenshotContent({ data }: { data: any }) {
  const issues: string[] = data.issues || [];
  const quickWins: string[] = data.quickWins || [];

  return (
    <div className="flex flex-col gap-3">
      {data.overallScore && (
        <Badge variant="secondary" className="w-fit text-xs">Score: {data.overallScore}</Badge>
      )}

      {issues.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Issues
          </span>
          {issues.slice(0, 3).map((issue, i) => (
            <p key={i} className="text-xs text-foreground/80 pl-2">- {issue}</p>
          ))}
        </div>
      )}

      {quickWins.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Quick wins:</span>
          {quickWins.slice(0, 3).map((win, i) => (
            <p key={i} className="text-xs text-foreground/80 pl-2">- {win}</p>
          ))}
        </div>
      )}
    </div>
  );
}

const CONTENT_RENDERERS: Record<ResearchSourceType, React.FC<{ data: any }>> = {
  'website': WebsiteContent,
  'ad-transparency': AdTransparencyContent,
  'social-media': SocialMediaContent,
  'seo': SeoContent,
  'ad-screenshot': AdScreenshotContent,
};

export default function ResearchInsightCard({ source, onRemove, onRetry }: ResearchInsightCardProps) {
  const [expanded, setExpanded] = useState(source.status === 'success');
  const Icon = TYPE_ICONS[source.type];
  const ContentRenderer = CONTENT_RENDERERS[source.type];

  return (
    <Card className="border-border/50 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground truncate flex-1">{source.label}</span>

        {source.status === 'loading' && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-amber-500 border-amber-500/30 bg-amber-500/5 shrink-0">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Researching...
          </Badge>
        )}
        {source.status === 'success' && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-emerald-500 border-emerald-500/30 bg-emerald-500/5 shrink-0">
            Done
          </Badge>
        )}
        {source.status === 'error' && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-red-500 border-red-500/30 bg-red-500/5 shrink-0">
            Failed
          </Badge>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => { e.stopPropagation(); onRemove(source.id); }}
        >
          <X className="w-3.5 h-3.5" />
        </Button>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <CardContent className="px-3 pb-3 pt-0">
          {source.status === 'loading' && (
            <div className="flex flex-col gap-2 animate-pulse">
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
              <div className="h-3 w-2/3 rounded bg-muted" />
            </div>
          )}

          {source.status === 'error' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-red-500">{source.error || 'Research failed'}</p>
              <Button
                variant="outline"
                size="sm"
                className="w-fit text-xs"
                onClick={() => onRetry(source.id)}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {source.status === 'success' && source.data && (
            <ContentRenderer data={source.data} />
          )}
        </CardContent>
      )}
    </Card>
  );
}
