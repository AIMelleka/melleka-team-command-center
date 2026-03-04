import { 
  PenLine, 
  Share2, 
  Mail, 
  Search, 
  Megaphone, 
  Palette, 
  Hash, 
  FileText,
  TrendingUp,
  MessageSquare,
  Image,
  Video,
  Users,
  BarChart3,
  Presentation,
  Brain,
  LucideIcon
} from 'lucide-react';

export interface Bot {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: string;
}

export const bots: Bot[] = [
  {
    id: 'content-writer',
    title: 'Content Writer',
    description: 'Generate compelling blog posts, articles, and web copy that engages your audience and boosts SEO.',
    icon: PenLine,
    category: 'Content',
  },
  {
    id: 'social-media',
    title: 'Social Media Genie',
    description: 'Create scroll-stopping captions, posts, and content calendars for all major platforms.',
    icon: Share2,
    category: 'Social',
  },
  {
    id: 'email-campaign',
    title: 'Email Wizard',
    description: 'Craft high-converting email sequences, newsletters, and drip campaigns that drive results.',
    icon: Mail,
    category: 'Email',
  },
  {
    id: 'seo-optimizer',
    title: 'SEO Writer',
    description: 'Generate SEO-optimized blog posts, meta tags, keyword research, and content audits.',
    icon: Search,
    category: 'SEO',
  },
  {
    id: 'ad-copy',
    title: 'Ad Copy Creator',
    description: 'Write persuasive ad copy for Google, Facebook, Instagram, and other advertising platforms.',
    icon: Megaphone,
    category: 'Advertising',
  },
  {
    id: 'brand-voice',
    title: 'Brand Voice Analyst',
    description: 'Define and maintain a consistent brand voice across all your marketing materials.',
    icon: Palette,
    category: 'Branding',
  },
  {
    id: 'hashtag-generator',
    title: 'Hashtag Generator',
    description: 'Discover trending and relevant hashtags to maximize your social media reach and engagement.',
    icon: Hash,
    category: 'Social',
  },
  {
    id: 'blog-outline',
    title: 'Blog Outline Creator',
    description: 'Generate structured blog outlines with headers, subheadings, and key points to cover.',
    icon: FileText,
    category: 'Content',
  },
  {
    id: 'trend-analyzer',
    title: 'Trend Analyzer',
    description: 'Stay ahead of the curve with AI-powered trend analysis and content recommendations.',
    icon: TrendingUp,
    category: 'Research',
  },
  {
    id: 'review-responder',
    title: 'Review Responder',
    description: 'Craft professional and empathetic responses to customer reviews and feedback.',
    icon: MessageSquare,
    category: 'Customer',
  },
  {
    id: 'image-caption',
    title: 'Image Caption Genie',
    description: 'Generate creative and engaging captions for your images and visual content.',
    icon: Image,
    category: 'Content',
  },
  {
    id: 'video-script',
    title: 'Video Script Writer',
    description: 'Create compelling video scripts for YouTube, TikTok, Reels, and promotional videos.',
    icon: Video,
    category: 'Video',
  },
  {
    id: 'client-update',
    title: 'Client Update Bot',
    description: 'Generate client updates by pulling data from Notion, Google Sheets, and Looker Studio reports.',
    icon: Users,
    category: 'Client',
  },
  {
    id: 'ad-review',
    title: 'Ad Review Bot',
    description: 'AI-powered analysis of Google Ads & Meta Ads performance with actionable optimization recommendations.',
    icon: BarChart3,
    category: 'Advertising',
  },
  {
    id: 'deck-bot',
    title: 'Deck Bot',
    description: 'Generate premium client update presentations with Looker screenshots, metrics, and AI-powered insights.',
    icon: Presentation,
    category: 'Client',
  },
  {
    id: 'ppc-optimizer',
    title: 'The Strategist',
    description: 'AI-powered PPC optimization for Google & Meta Ads. Deep reasoning, human approval required, tracks win rate over time.',
    icon: Brain,
    category: 'Advertising',
  },
];

export const categories = ['All', 'Content', 'Social', 'Email', 'SEO', 'Advertising', 'Branding', 'Research', 'Customer', 'Video', 'Client'];

export const BOT_ROUTES: Record<string, string> = {
  'seo-optimizer': '/seo-writer',
  'ad-review': '/ad-review',
  'client-update': '/client-update',
  'deck-bot': '/deck-builder',
  'ppc-optimizer': '/ppc-optimizer',
};
