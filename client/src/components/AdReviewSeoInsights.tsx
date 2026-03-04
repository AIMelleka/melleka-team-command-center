import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Users, Target, Zap, BarChart3 } from 'lucide-react';

interface PaidAdData {
  domain: string;
  paidKeywords?: number;
  paidTraffic?: number;
  paidTrafficCost?: number;
  topPaidKeywords?: Array<{
    keyword: string;
    position: number;
    volume: number;
    cpc: number;
    trafficPercent: number;
  }>;
  paidCompetitors?: Array<{
    domain: string;
    commonKeywords: number;
    paidKeywords?: number;
    paidTraffic?: number;
  }>;
  adHistory?: {
    hasActiveAds: boolean;
    estimatedMonthlySpend?: number;
  };
}

interface AdReviewSeoInsightsProps {
  seoData: PaidAdData;
  isLoading?: boolean;
}

export function AdReviewSeoInsights({ seoData, isLoading }: AdReviewSeoInsightsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <BarChart3 className="h-8 w-8 animate-pulse mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Fetching Semrush paid ad data...</p>
        </CardContent>
      </Card>
    );
  }

  if (!seoData || !seoData.domain) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatCpc = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          Semrush Paid Ad Intelligence
        </CardTitle>
        <p className="text-sm text-muted-foreground">{seoData.domain}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Paid Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Target className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{(seoData.paidKeywords || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Paid Keywords</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{(seoData.paidTraffic || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Paid Traffic</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <p className="text-2xl font-bold">{formatCurrency(seoData.paidTrafficCost || 0)}</p>
            <p className="text-xs text-muted-foreground">Traffic Cost</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <Zap className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <p className="text-2xl font-bold">
              {seoData.adHistory?.hasActiveAds ? (
                <Badge variant="default" className="bg-green-500">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">Ad Status</p>
          </div>
        </div>

        {/* Top Paid Keywords */}
        {seoData.topPaidKeywords && seoData.topPaidKeywords.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Top Paid Keywords
            </h4>
            <div className="space-y-2">
              {seoData.topPaidKeywords.slice(0, 5).map((kw, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{kw.keyword}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">Pos #{kw.position}</Badge>
                      <span className="text-xs text-muted-foreground">{kw.volume.toLocaleString()} vol</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm font-medium text-green-600">{formatCpc(kw.cpc)}</p>
                      <p className="text-xs text-muted-foreground">CPC</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{kw.trafficPercent.toFixed(1)}%</p>
                      <p className="text-xs text-muted-foreground">Traffic</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Paid Competitors */}
        {seoData.paidCompetitors && seoData.paidCompetitors.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Paid Search Competitors
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {seoData.paidCompetitors.slice(0, 4).map((comp, index) => (
                <div key={index} className="p-3 bg-muted/30 rounded-lg">
                  <p className="font-medium text-sm truncate">{comp.domain}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{comp.commonKeywords} shared KWs</span>
                    {comp.paidKeywords && <span>{comp.paidKeywords} paid KWs</span>}
                  </div>
                  {comp.paidTraffic && (
                    <p className="text-xs text-green-600 mt-1">{comp.paidTraffic.toLocaleString()} paid traffic</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Monthly Spend */}
        {seoData.adHistory?.estimatedMonthlySpend && (
          <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Estimated Monthly Ad Spend</p>
                <p className="text-xs text-muted-foreground">Based on Semrush traffic cost data</p>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(seoData.adHistory.estimatedMonthlySpend)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
