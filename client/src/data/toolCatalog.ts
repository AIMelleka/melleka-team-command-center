import { PenTool, Megaphone, Search, FileText, Mail, Video, Image, Globe, BarChart3, Activity, Layers, Target, ClipboardList, Users, type LucideIcon } from 'lucide-react';

export interface ToolDefinition {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  route: string;
  category: 'content' | 'marketing' | 'analytics' | 'management';
  /** If true, all authenticated users can access this tool without explicit permission */
  publicAccess?: boolean;
}

export const TOOL_CATALOG: ToolDefinition[] = [
  // Content
  { key: 'seo-writer', label: 'SEO Writer', description: 'Generate SEO-optimized articles up to 6,000 words', icon: PenTool, route: '/seo-writer', category: 'content' },
  { key: 'email-writer', label: 'Email Writer', description: 'Create professional email campaigns', icon: Mail, route: '/email-writer', category: 'content' },
  { key: 'ad-generator', label: 'Ad Generator', description: 'Generate ad copy and creatives', icon: Megaphone, route: '/ad-generator', category: 'content' },
  { key: 'image-generator', label: 'Image Generator', description: 'AI-powered image creation', icon: Image, route: '/image-generator', category: 'content' },
  { key: 'video-generator', label: 'Video Generator', description: 'Create marketing videos', icon: Video, route: '/video-generator', category: 'content' },

  // Marketing
  { key: 'ad-review', label: 'Ad Review', description: 'Review and analyze ad performance', icon: Search, route: '/ad-review', category: 'marketing' },
  { key: 'seo-bot', label: 'SEO Bot', description: 'Automated SEO analysis and recommendations', icon: Globe, route: '/seo-bot', category: 'marketing' },
  { key: 'qa-bot', label: 'QA Bot', description: 'Quality assurance for content', icon: ClipboardList, route: '/qa-bot', category: 'marketing' },

  // Analytics
  { key: 'client-health', label: 'Client Health', description: 'Monitor client health scores and metrics', icon: Activity, route: '/client-health', category: 'analytics' },
  { key: 'client-update', label: 'Client Update', description: 'Generate client update reports', icon: BarChart3, route: '/client-update', category: 'analytics' },
  { key: 'client-dashboard', label: 'Client Dashboard', description: 'Overview of client performance', icon: Target, route: '/client-dashboard', category: 'analytics' },
  { key: 'ppc-optimizer', label: 'PPC Optimizer', description: 'Optimize pay-per-click campaigns', icon: Target, route: '/ppc-optimizer', category: 'analytics' },

  // Management
  { key: 'proposals', label: 'Proposals', description: 'Create and manage proposals', icon: FileText, route: '/proposals', category: 'management' },
  { key: 'proposal-builder', label: 'Proposal Builder', description: 'Build detailed proposals', icon: FileText, route: '/proposal-builder', category: 'management' },
  { key: 'proposal-qa', label: 'Proposal QA', description: 'Quality check proposals', icon: ClipboardList, route: '/proposal-qa', category: 'management' },
  { key: 'decks', label: 'Decks', description: 'Performance report decks', icon: Layers, route: '/decks', category: 'management' },
  { key: 'deck-builder', label: 'Deck Builder', description: 'Build performance decks', icon: Layers, route: '/deck-builder', category: 'management' },
  { key: 'portfolio-manager', label: 'Portfolio Manager', description: 'Manage portfolio images', icon: Image, route: '/portfolio-manager', category: 'management' },
];

export const CATEGORY_LABELS: Record<string, string> = {
  content: 'Content Creation',
  marketing: 'Marketing & SEO',
  analytics: 'Analytics & PPC',
  management: 'Management',
};

/** Map route path to tool key */
export function routeToToolKey(route: string): string | null {
  const tool = TOOL_CATALOG.find(t => t.route === route);
  return tool?.key ?? null;
}
