// Premium Deck Components - Barrel Exports
export { DeckHero } from './DeckHero';
export { DeckEditProvider, useDeckEdit } from './DeckEditContext';
export { InlineEdit, SectionToggle } from './InlineEdit';
export { EditableImage, AddImageButton } from './EditableImage';
export { DeckExecutiveSummary } from './DeckExecutiveSummary';
export { DeckMetricCard } from './DeckMetricCard';
export { DeckPlatformSection } from './DeckPlatformSection';
export { EnhancedPlatformSection } from './EnhancedPlatformSection';
export type { EnhancedPlatformData, CampaignRow, CreativeRow, DailyDataPoint, PlatformGameplan, KeywordRow } from './EnhancedPlatformSection';
export { DeckComparisonChart } from './DeckComparisonChart';
export { DeckRecommendationCard } from './DeckRecommendationCard';
export { DeckPerformanceGrade } from './DeckPerformanceGrade';
export { DeckSectionHeader } from './DeckSectionHeader';
export { DeckNav } from './DeckNav';
export { DeckFooter } from './DeckFooter';
export { DeckTrendChart } from './DeckTrendChart';
export { DeckSocialMediaSection } from './DeckSocialMediaSection';

// Types
export interface DeckNarrative {
  summary: string;
  wins: string[];
  challenges: string[];
  outlook: string;
}

export interface PerformanceGrades {
  overall: string;
  google: string;
  meta: string;
  engagement?: string;
}

export interface TrendAnalysis {
  spending: 'up' | 'down' | 'stable';
  conversions: 'up' | 'down' | 'stable';
  efficiency: 'up' | 'down' | 'stable';
}
