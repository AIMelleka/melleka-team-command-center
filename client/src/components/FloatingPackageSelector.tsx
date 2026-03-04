import { useState, useEffect } from 'react';
import { ChevronRight, Check, X, Sparkles, Package, Globe } from 'lucide-react';
import { MARKETING_PACKAGES, MarketingPackage, WEBSITE_PACKAGES, WebsitePackage } from '@/data/packages';
import { cn } from '@/lib/utils';

interface FloatingPackageSelectorProps {
  /** The original package on the proposal (used for comparing gains/losses). */
  basePackageId?: string;
  currentPackageId?: string;
  onPackageChange: (pkg: MarketingPackage) => void;
  /** The original website package on the proposal (used for comparing gains/losses). */
  baseWebsitePackageId?: string;
  onWebsitePackageChange?: (pkg: WebsitePackage) => void;
  proposalType?: 'marketing' | 'website' | 'combined';
  currentWebsitePackageId?: string;
}

export const FloatingPackageSelector = ({ 
  basePackageId,
  currentPackageId,
  onPackageChange,
  baseWebsitePackageId,
  onWebsitePackageChange,
  proposalType = 'marketing',
  currentWebsitePackageId
}: FloatingPackageSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Determine which packages to show based on proposal type
  const isWebsiteOnly = proposalType === 'website';
  const showWebsitePackages = proposalType === 'website' || proposalType === 'combined';
  const showMarketingPackages = proposalType === 'marketing' || proposalType === 'combined';
  
  // State for selected packages - sync with parent state
  const [selectedMarketingPackage, setSelectedMarketingPackage] = useState<MarketingPackage | null>(
    currentPackageId ? MARKETING_PACKAGES.find(p => p.id === currentPackageId) || null : null
  );
  const [selectedWebsitePackage, setSelectedWebsitePackage] = useState<WebsitePackage | null>(
    currentWebsitePackageId ? WEBSITE_PACKAGES.find(p => p.id === currentWebsitePackageId) || null : null
  );

  // Sync internal state with prop changes (when parent state updates)
  useEffect(() => {
    if (currentPackageId) {
      const pkg = MARKETING_PACKAGES.find(p => p.id === currentPackageId);
      if (pkg) setSelectedMarketingPackage(pkg);
    }
  }, [currentPackageId]);

  useEffect(() => {
    if (currentWebsitePackageId) {
      const pkg = WEBSITE_PACKAGES.find(p => p.id === currentWebsitePackageId);
      if (pkg) setSelectedWebsitePackage(pkg);
    }
  }, [currentWebsitePackageId]);

  const handleMarketingPackageSelect = (pkg: MarketingPackage) => {
    setSelectedMarketingPackage(pkg);
    onPackageChange(pkg);
  };

  const handleWebsitePackageSelect = (pkg: WebsitePackage) => {
    setSelectedWebsitePackage(pkg);
    onWebsitePackageChange?.(pkg);
  };

  // Base package is the one from the original proposal - used for diff calculations
  const baseMarketingPackage = (basePackageId || currentPackageId)
    ? MARKETING_PACKAGES.find(p => p.id === (basePackageId || currentPackageId)) 
    : null;

  const baseWebsitePackage = (baseWebsitePackageId || currentWebsitePackageId)
    ? WEBSITE_PACKAGES.find(p => p.id === (baseWebsitePackageId || currentWebsitePackageId))
    : null;

  // Get feature differences for marketing packages - compare against PREVIOUS tier
  const getMarketingFeatureDiff = (pkg: MarketingPackage) => {
    const gains: string[] = [];
    const losses: string[] = [];

    const serviceLabels: Record<string, string> = {
      channels: 'Marketing Channels',
      meetings: 'Strategy Meetings',
      slackChannel: 'Dedicated Slack Channel',
      optimization: 'Optimization',
      dedicatedTeam: 'Dedicated Team',
      emailCampaigns: 'Email Campaigns',
      textingCampaigns: 'Texting Campaigns',
      socialMediaManagement: 'Social Media Management',
      aiVoiceAgent: 'AI Voice Agent',
      aiChatBot: 'AI Chatbot',
      reputationManagement: 'Reputation Management',
      ugcContent: 'UGC Content',
      influencerMarketing: 'Influencer Marketing',
      televisionAds: 'Television Advertising',
      inPersonContent: 'In-Person Content',
      aiCRMManager: 'AI CRM Manager',
      aiToolsOnDemand: 'AI Tools On Demand',
      liveDashboard: 'Live Dashboard',
      landingPages: 'Landing Pages',
      funnelCreation: 'Funnel Creation',
    };

    // Find the previous tier package (one tier lower)
    const currentTierIndex = MARKETING_PACKAGES.findIndex(p => p.id === pkg.id);
    const previousTierPackage = currentTierIndex > 0 ? MARKETING_PACKAGES[currentTierIndex - 1] : null;
    
    if (!previousTierPackage) {
      // This is the base tier - show all included features as "gains"
      Object.entries(pkg.services).forEach(([key, value]) => {
        const label = serviceLabels[key] || key;
        if (value.included) {
          gains.push(label);
        }
      });
    } else {
      // Compare against previous tier
      Object.entries(pkg.services).forEach(([key, value]) => {
        const prevValue = (previousTierPackage.services as Record<string, { included: boolean }>)[key];
        const label = serviceLabels[key] || key;
        
        if (value.included && !prevValue?.included) {
          gains.push(label);
        } else if (!value.included && prevValue?.included) {
          losses.push(label);
        }
      });
    }

    return { gains, losses };
  };

  // Get feature differences for website packages - compare against PREVIOUS tier
  const getWebsiteFeatureDiff = (pkg: WebsitePackage) => {
    const gains: string[] = [];
    const losses: string[] = [];

    const serviceLabels: Record<string, string> = {
      googleAnalytics: 'Google Analytics',
      metaPixel: 'Meta Pixel',
      seo: 'SEO Optimization',
      automations: 'Automations',
      blogs: 'Blog Content',
      mobileOptimized: 'Mobile Optimized',
      contactForms: 'Contact Forms',
      socialIntegration: 'Social Integration',
      speedOptimization: 'Speed Optimization',
      securitySSL: 'SSL Security',
    };

    // Find the previous tier package (one tier lower)
    const currentTierIndex = WEBSITE_PACKAGES.findIndex(p => p.id === pkg.id);
    const previousTierPackage = currentTierIndex > 0 ? WEBSITE_PACKAGES[currentTierIndex - 1] : null;
    
    if (!previousTierPackage) {
      // This is the base tier - show all included features as "gains"
      Object.entries(pkg.services).forEach(([key, value]) => {
        const label = serviceLabels[key] || key;
        if (value.included) {
          gains.push(label);
        }
      });
    } else {
      // Compare against previous tier
      Object.entries(pkg.services).forEach(([key, value]) => {
        const prevValue = (previousTierPackage.services as Record<string, { included: boolean }>)[key];
        const label = serviceLabels[key] || key;
        
        if (value.included && !prevValue?.included) {
          gains.push(label);
        } else if (!value.included && prevValue?.included) {
          losses.push(label);
        }
      });
    }

    return { gains, losses };
  };

  const marketingPriceDiff = selectedMarketingPackage && baseMarketingPackage 
    ? selectedMarketingPackage.monthlyPrice - baseMarketingPackage.monthlyPrice 
    : 0;

  const websitePriceDiff = selectedWebsitePackage && baseWebsitePackage
    ? selectedWebsitePackage.price - baseWebsitePackage.price
    : 0;

  return (
    <>
      {/* Collapsed State - Floating Button - Bottom Right */}
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          "fixed right-4 bottom-6 z-40 transition-all duration-300",
          "flex items-center gap-2 px-4 py-3 rounded-xl",
          isWebsiteOnly 
            ? "bg-blue-600"
            : "bg-genie-purple",
          "text-white font-medium shadow-lg",
          "hover:shadow-xl hover:scale-105",
          "animate-breathe",
          isWebsiteOnly ? "border border-blue-400/50" : "border border-genie-purple/50",
          isExpanded && "opacity-0 pointer-events-none"
        )}
      >
        {isWebsiteOnly ? <Globe className="w-5 h-5" /> : <Package className="w-5 h-5" />}
        <span className="hidden sm:inline">
          {isWebsiteOnly ? 'Compare Website Packages' : 'Compare Packages'}
        </span>
        <ChevronRight className="w-4 h-4 rotate-180" />
      </button>

      {/* Expanded Panel - From Right Side */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full z-50 transition-transform duration-300 ease-out",
          "flex flex-row-reverse",
          isExpanded ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Panel Content */}
        <div className="w-80 sm:w-96 h-full bg-background/95 backdrop-blur-xl border-l border-border overflow-y-auto">
          <div className="p-4 border-b border-border sticky top-0 bg-background/95 backdrop-blur-xl z-10">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-display font-semibold flex items-center gap-2">
                {isWebsiteOnly ? (
                  <>
                    <Globe className="w-5 h-5 text-blue-400" />
                    Website Packages
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-genie-gold" />
                    {proposalType === 'combined' ? 'All Packages' : 'Marketing Packages'}
                  </>
                )}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground text-right">
              {isWebsiteOnly 
                ? 'Compare website design tiers'
                : 'See what you gain or lose with each package'
              }
            </p>
          </div>

          {/* Website Packages */}
          {showWebsitePackages && (
            <div className="p-4">
              {proposalType === 'combined' && (
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website Design Packages
                </h4>
              )}
              <div className="space-y-3">
                {WEBSITE_PACKAGES.map((pkg) => {
                  const isSelected = selectedWebsitePackage?.id === pkg.id;
                  const isBase = pkg.id === currentWebsitePackageId;
                  const { gains, losses } = getWebsiteFeatureDiff(pkg);
                  
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => handleWebsitePackageSelect(pkg)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl transition-all duration-200",
                        "border-2",
                        isSelected 
                          ? "border-blue-500 bg-blue-500/10" 
                          : isBase
                          ? "border-cyan-500/50 bg-cyan-500/5"
                          : "border-border hover:border-blue-500/50 hover:bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-display font-semibold text-foreground",
                              isSelected && "text-blue-400"
                            )}>
                              {pkg.name}
                            </span>
                            {isBase && (
                              <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded-full">
                                Current
                              </span>
                            )}
                            {pkg.recommended && (
                              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{pkg.pages}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-400">${pkg.price.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">one-time</p>
                        </div>
                      </div>

                      {/* Show extra features vs previous tier for all packages */}
                      {gains.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-green-400 font-medium mb-1.5">+ Extra features:</p>
                          <div className="flex flex-wrap gap-1">
                            {gains.slice(0, 6).map((gain) => (
                              <span 
                                key={gain} 
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full"
                              >
                                <Check className="w-3 h-3" />
                                {gain}
                              </span>
                            ))}
                            {gains.length > 6 && (
                              <span className="text-xs text-green-400">+{gains.length - 6} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Highlights for non-selected */}
                      {!isSelected && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pkg.highlights.map((h) => (
                            <span key={h} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Divider for combined view */}
          {proposalType === 'combined' && (
            <div className="mx-4 border-t border-border" />
          )}

          {/* Marketing Packages */}
          {showMarketingPackages && (
            <div className="p-4">
              {proposalType === 'combined' && (
                <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Marketing Packages
                </h4>
              )}
              <div className="space-y-3">
                {MARKETING_PACKAGES.map((pkg) => {
                  const isSelected = selectedMarketingPackage?.id === pkg.id;
                  const isBase = pkg.id === currentPackageId;
                  const { gains, losses } = getMarketingFeatureDiff(pkg);
                  
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => handleMarketingPackageSelect(pkg)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl transition-all duration-200",
                        "border-2",
                        isSelected 
                          ? "border-genie-purple bg-genie-purple/10" 
                          : isBase
                          ? "border-genie-gold/50 bg-genie-gold/5"
                          : "border-border hover:border-genie-purple/50 hover:bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-display font-semibold",
                              isSelected && "text-genie-purple-light"
                            )}>
                              {pkg.name}
                            </span>
                            {isBase && (
                              <span className="text-xs px-2 py-0.5 bg-genie-gold/20 text-genie-gold rounded-full">
                                Current
                              </span>
                            )}
                            {pkg.recommended && (
                              <span className="text-xs px-2 py-0.5 bg-genie-purple/20 text-genie-purple-light rounded-full">
                                Popular
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{pkg.channels}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">${pkg.monthlyPrice.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">/month</p>
                        </div>
                      </div>

                      {/* Show extra features vs previous tier for all packages */}
                      {gains.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-green-400 font-medium mb-1.5">+ Extra features:</p>
                          <div className="flex flex-wrap gap-1">
                            {gains.slice(0, 6).map((gain) => (
                              <span 
                                key={gain} 
                                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full"
                              >
                                <Check className="w-3 h-3" />
                                {gain}
                              </span>
                            ))}
                            {gains.length > 6 && (
                              <span className="text-xs text-green-400">+{gains.length - 6} more</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Highlights for non-selected */}
                      {!isSelected && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pkg.highlights.map((h) => (
                            <span key={h} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                              {h}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom CTA */}
          <div className="p-4 border-t border-border sticky bottom-0 bg-background/95 backdrop-blur-xl">
            <p className="text-xs text-muted-foreground text-center mb-3">
              {isWebsiteOnly 
                ? 'Select a website package to update pricing'
                : 'Select a package to see what\'s included in your proposal'
              }
            </p>
            <button
              onClick={() => setIsExpanded(false)}
              className={cn(
                "w-full py-3 rounded-xl font-medium transition-colors",
                isWebsiteOnly 
                  ? "bg-blue-600 text-white hover:opacity-90"
                  : "gold-button"
              )}
            >
              Apply Package
            </button>
          </div>
        </div>

        {/* Click outside to close */}
        <div 
          className="flex-1 bg-black/50 cursor-pointer"
          onClick={() => setIsExpanded(false)}
        />
      </div>
    </>
  );
};
