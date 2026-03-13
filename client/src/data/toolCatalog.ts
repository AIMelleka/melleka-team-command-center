import { PenTool, Megaphone, Search, FileText, Mail, Video, Image, Globe, BarChart3, Activity, Layers, Target, ClipboardList, Users, Palette, Bot, Share2, Crown, Timer, Settings, BookOpen, type LucideIcon } from 'lucide-react';

export interface ToolDefinition {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  route: string;
  category: 'content' | 'marketing' | 'analytics' | 'management' | 'system';
  /** If true, all authenticated users can access this tool without explicit permission */
  publicAccess?: boolean;
}

export const TOOL_CATALOG: ToolDefinition[] = [
  // Content
  { key: 'seo-writer', label: 'SEO Writer', description: 'Generate SEO-optimized articles up to 6,000 words', icon: PenTool, route: '/seo-writer', category: 'content' },
  { key: 'email-writer', label: 'Email Writer', description: 'Create professional email campaigns', icon: Mail, route: '/email-writer', category: 'content' },
  { key: 'creative-studio', label: 'Creative Studio', description: 'AI-powered ads, images, and videos with smart brief analysis', icon: Palette, route: '/creative-studio', category: 'content' },
  { key: 'social-media', label: 'Social Media', description: 'Create and manage social media content', icon: Share2, route: '/social-media', category: 'content' },
  { key: 'video-generator', label: 'Great Video Gen', description: 'Premium AI video generation with Kling 3.0, Sora 2, and more', icon: Video, route: '/video-generator', category: 'content' },
  { key: 'saved-articles', label: 'Saved Articles', description: 'View and manage saved SEO articles', icon: BookOpen, route: '/saved-articles', category: 'content' },
  { key: 'websites', label: 'Websites', description: 'Manage client websites', icon: Globe, route: '/websites', category: 'content' },
  { key: 'website-builder', label: 'Website Builder', description: 'Build and edit websites', icon: Globe, route: '/website-builder', category: 'content' },

  // Marketing
  { key: 'ad-review', label: 'Ad Review', description: 'Review and analyze ad performance', icon: Search, route: '/ad-review', category: 'marketing' },
  { key: 'seo-bot', label: 'SEO Bot', description: 'Automated SEO analysis and recommendations', icon: Globe, route: '/seo-bot', category: 'marketing' },
  { key: 'qa-bot', label: 'QA Bot', description: 'Quality assurance for content', icon: ClipboardList, route: '/qa-bot', category: 'marketing' },
  { key: 'home-chat', label: 'Home Chat', description: 'AI-powered marketing assistant with 40+ tools', icon: Bot, route: '/', category: 'marketing' },
  { key: 'super-agent-dashboard', label: 'Agent Dashboard', description: 'Super agent chat and task management', icon: Bot, route: '/super-agent-dashboard', category: 'marketing' },

  // Analytics
  { key: 'client-health', label: 'Client Health', description: 'Monitor client health scores and metrics', icon: Activity, route: '/client-health', category: 'analytics' },
  { key: 'client-update', label: 'Client Update', description: 'Generate client update reports', icon: BarChart3, route: '/client-update', category: 'analytics' },
  { key: 'client-dashboard', label: 'Client Dashboard', description: 'Overview of client performance', icon: Target, route: '/client-dashboard', category: 'analytics' },
  { key: 'ppc-optimizer', label: 'PPC Optimizer', description: 'Optimize pay-per-click campaigns', icon: Target, route: '/ppc-optimizer', category: 'analytics' },
  { key: 'daily-reports', label: 'Daily Reports', description: 'Daily ad performance reports for all clients', icon: BarChart3, route: '/daily-reports', category: 'analytics' },

  // Management
  { key: 'proposal-builder', label: 'Proposal Builder', description: 'Build and manage proposals', icon: FileText, route: '/proposal-builder', category: 'management' },
  { key: 'decks', label: 'Decks', description: 'Performance report decks', icon: Layers, route: '/decks', category: 'management' },
  { key: 'deck-builder', label: 'Deck Builder', description: 'Build performance decks', icon: Layers, route: '/deck-builder', category: 'management' },
  { key: 'portfolio-manager', label: 'Portfolio Manager', description: 'Manage portfolio images', icon: Image, route: '/portfolio-manager', category: 'management' },
  { key: 'onboarding-bot', label: 'Onboarding Bot', description: 'Generate Notion onboarding tasks for new clients with AI', icon: ClipboardList, route: '/onboarding-bot', category: 'management' },
  { key: 'meeting-queen', label: 'Meeting Queen', description: 'AI meeting assistant and note-taker', icon: Crown, route: '/meeting-queen', category: 'management' },

  // System (admin-level pages)
  { key: 'client-settings', label: 'Client Settings', description: 'Manage client accounts and ad mappings', icon: Settings, route: '/client-settings', category: 'system' },
  { key: 'cron-jobs', label: 'Cron Jobs', description: 'Manage scheduled background tasks', icon: Timer, route: '/cron-jobs', category: 'system' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  content: 'Content Creation',
  marketing: 'Marketing & SEO',
  analytics: 'Analytics & PPC',
  management: 'Management',
  system: 'System & Admin',
};

/** Map route path to tool key (handles parameterized routes like /website-builder/:slug) */
export function routeToToolKey(route: string): string | null {
  // Try exact match first
  const exact = TOOL_CATALOG.find(t => t.route === route);
  if (exact) return exact.key;

  // Try prefix match for parameterized routes (e.g. /website-builder/some-slug)
  const match = TOOL_CATALOG.find(t => t.route !== '/' && route.startsWith(t.route + '/'));
  return match?.key ?? null;
}
