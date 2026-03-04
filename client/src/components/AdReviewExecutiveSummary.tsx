import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Target,
  Users,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';
import { IndustryBenchmark } from '@/data/industryBenchmarks';

interface Platform {
  name: string;
  spend: string;
  impressions: string;
  clicks: string;
  conversions: string;
  cpc: string;
  ctr: string;
  roas: string;
  conversionRate?: string;
  costPerLead?: string;
  costPerConversion?: string;
  leads?: string;
  trend: 'up' | 'down' | 'stable';
  health: 'good' | 'warning' | 'critical';
  vsBenchmark?: 'above' | 'at' | 'below';
}

interface AdReviewExecutiveSummaryProps {
  summary: string;
  platforms: Platform[];
  benchmark: IndustryBenchmark;
  cplCpaAnalysis?: {
    overallHealth: 'excellent' | 'good' | 'warning' | 'critical';
    googleCpl?: number;
    googleCpa?: number;
    metaCpl?: number;
    metaCpa?: number;
    googleCplVsBenchmark?: 'above' | 'at' | 'below';
    metaCplVsBenchmark?: 'above' | 'at' | 'below';
    googleCpaVsBenchmark?: 'above' | 'at' | 'below';
    metaCpaVsBenchmark?: 'above' | 'at' | 'below';
    primaryConcerns?: string[];
    quickWins?: string[];
  };
}

export function AdReviewExecutiveSummary({ 
  summary, 
  platforms, 
  benchmark,
  cplCpaAnalysis 
}: AdReviewExecutiveSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate totals and averages from platforms
  const totalSpend = platforms.reduce((acc, p) => {
    const spend = parseFloat(p.spend?.replace(/[^0-9.]/g, '') || '0');
    return acc + spend;
  }, 0);

  const totalConversions = platforms.reduce((acc, p) => {
    const conv = parseInt(p.conversions?.replace(/[^0-9]/g, '') || '0');
    return acc + conv;
  }, 0);

  const totalLeads = platforms.reduce((acc, p) => {
    const leads = parseInt(p.leads?.replace(/[^0-9]/g, '') || '0');
    return acc + leads;
  }, 0);

  const avgCpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
  const avgCpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

  // Determine health status based on CPL/CPA vs benchmarks
  const getOverallHealth = () => {
    if (!cplCpaAnalysis) {
      // Calculate from available data
      const googleBenchmarkCpa = benchmark.google.cpa;
      const metaBenchmarkCpa = benchmark.facebook.cpa;
      
      let issues = 0;
      if (avgCpa > googleBenchmarkCpa * 1.2) issues++;
      if (avgCpa > metaBenchmarkCpa * 1.2) issues++;
      
      if (issues === 0) return 'excellent';
      if (issues === 1) return 'good';
      return 'warning';
    }
    return cplCpaAnalysis.overallHealth;
  };

  const health = getOverallHealth();

  const healthConfig = {
    excellent: { color: 'bg-green-500', textColor: 'text-green-600', bgColor: 'bg-green-500/10', label: 'Excellent', icon: CheckCircle2 },
    good: { color: 'bg-blue-500', textColor: 'text-blue-600', bgColor: 'bg-blue-500/10', label: 'On Track', icon: CheckCircle2 },
    warning: { color: 'bg-yellow-500', textColor: 'text-yellow-600', bgColor: 'bg-yellow-500/10', label: 'Needs Attention', icon: AlertTriangle },
    critical: { color: 'bg-red-500', textColor: 'text-red-600', bgColor: 'bg-red-500/10', label: 'Critical', icon: AlertCircle },
  };

  const currentHealth = healthConfig[health];
  const HealthIcon = currentHealth.icon;

  // Calculate score (0-100) based on CPL/CPA performance
  const calculateScore = () => {
    const googleCpa = benchmark.google.cpa;
    const metaCpa = benchmark.facebook.cpa;
    const avgBenchmarkCpa = (googleCpa + metaCpa) / 2;
    
    if (avgCpa === 0) return 75; // No data, neutral score
    
    const ratio = avgBenchmarkCpa / avgCpa; // Higher is better (benchmark/actual)
    const score = Math.min(100, Math.max(0, ratio * 75));
    return Math.round(score);
  };

  const score = calculateScore();

  const getCplCpaStatus = (actual: number, benchmarkValue: number, type: 'cpl' | 'cpa') => {
    if (actual === 0) return { status: 'unknown', diff: 0 };
    const diff = ((actual - benchmarkValue) / benchmarkValue) * 100;
    // For cost metrics, lower is better
    if (diff <= -10) return { status: 'excellent', diff };
    if (diff <= 10) return { status: 'good', diff };
    if (diff <= 25) return { status: 'warning', diff };
    return { status: 'critical', diff };
  };

  return (
    <Card className="overflow-hidden">
      {/* Quick Glance Header - Always Visible */}
      <CardHeader className={`${currentHealth.bgColor} border-b`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${currentHealth.color}`}>
              <HealthIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Performance Overview
                <Badge className={`${currentHealth.bgColor} ${currentHealth.textColor} border-0`}>
                  {currentHealth.label}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Cost efficiency analysis based on CPL & CPA benchmarks
              </p>
            </div>
          </div>
          
          {/* Health Score */}
          <div className="text-right">
            <div className="text-3xl font-bold">{score}</div>
            <div className="text-xs text-muted-foreground">Health Score</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Primary Metrics - CPL & CPA Front and Center */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Total Spend */}
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">${totalSpend.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Spend</div>
          </div>

          {/* Average CPL */}
          <div className={`p-4 rounded-lg text-center ${
            avgCpl > 0 && avgCpl < benchmark.google.cpa * 0.7 
              ? 'bg-green-500/10 border border-green-500/20' 
              : avgCpl > benchmark.google.cpa 
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-muted/50'
          }`}>
            <Users className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              ${avgCpl > 0 ? avgCpl.toFixed(2) : '--'}
              {avgCpl > 0 && avgCpl < benchmark.google.cpa * 0.8 && (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
              {avgCpl > benchmark.google.cpa * 1.2 && (
                <TrendingUp className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">Avg Cost/Lead</div>
            <div className="text-xs mt-1">
              <span className="text-muted-foreground">Benchmark: </span>
              <span className="font-medium">${benchmark.google.cpa.toFixed(2)}</span>
            </div>
          </div>

          {/* Average CPA */}
          <div className={`p-4 rounded-lg text-center ${
            avgCpa > 0 && avgCpa < benchmark.google.cpa * 0.7 
              ? 'bg-green-500/10 border border-green-500/20' 
              : avgCpa > benchmark.google.cpa * 1.2 
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-muted/50'
          }`}>
            <Target className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold flex items-center justify-center gap-1">
              ${avgCpa > 0 ? avgCpa.toFixed(2) : '--'}
              {avgCpa > 0 && avgCpa < benchmark.google.cpa * 0.8 && (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
              {avgCpa > benchmark.google.cpa * 1.2 && (
                <TrendingUp className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">Avg Cost/Conversion</div>
            <div className="text-xs mt-1">
              <span className="text-muted-foreground">Benchmark: </span>
              <span className="font-medium">${benchmark.google.cpa.toFixed(2)}</span>
            </div>
          </div>

          {/* Total Conversions */}
          <div className="p-4 bg-muted/50 rounded-lg text-center">
            <Zap className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{totalConversions}</div>
            <div className="text-xs text-muted-foreground">Conversions</div>
          </div>
        </div>

        {/* CPL/CPA Benchmark Comparison Bars */}
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Cost Efficiency vs Industry Benchmarks
          </h4>
          
          {platforms.map((platform, idx) => {
            const platformSpend = parseFloat(platform.spend?.replace(/[^0-9.]/g, '') || '0');
            const platformConversions = parseInt(platform.conversions?.replace(/[^0-9]/g, '') || '0');
            const platformCpa = platformConversions > 0 ? platformSpend / platformConversions : 0;
            
            const isGoogle = platform.name.toLowerCase().includes('google');
            const isMeta = platform.name.toLowerCase().includes('meta') || platform.name.toLowerCase().includes('facebook');
            
            const benchmarkCpa = isGoogle ? benchmark.google.cpa : isMeta ? benchmark.facebook.cpa : benchmark.google.cpa;
            const cpaRatio = platformCpa > 0 ? (platformCpa / benchmarkCpa) * 100 : 0;
            const isOverBenchmark = cpaRatio > 100;
            
            return (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{platform.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={isOverBenchmark ? 'text-red-500' : 'text-green-500'}>
                      ${platformCpa.toFixed(2)} CPA
                    </span>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${isOverBenchmark ? 'border-red-500/50 text-red-500' : 'border-green-500/50 text-green-500'}`}
                    >
                      {isOverBenchmark ? '+' : ''}{(cpaRatio - 100).toFixed(0)}% vs benchmark
                    </Badge>
                  </div>
                </div>
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${isOverBenchmark ? 'bg-red-500' : 'bg-green-500'}`}
                    style={{ width: `${Math.min(cpaRatio, 150)}%` }}
                  />
                  <div 
                    className="absolute top-0 h-full w-0.5 bg-foreground/50" 
                    style={{ left: '66.67%' }} 
                    title="Industry Benchmark"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Alerts - Primary Concerns */}
        {cplCpaAnalysis?.primaryConcerns && cplCpaAnalysis.primaryConcerns.length > 0 && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
            <h4 className="font-medium text-red-600 flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" />
              Attention Required
            </h4>
            <ul className="space-y-1">
              {cplCpaAnalysis.primaryConcerns.map((concern, idx) => (
                <li key={idx} className="text-sm text-red-600/80 flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>{concern}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick Wins */}
        {cplCpaAnalysis?.quickWins && cplCpaAnalysis.quickWins.length > 0 && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg mb-4">
            <h4 className="font-medium text-green-600 flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4" />
              Quick Wins
            </h4>
            <ul className="space-y-1">
              {cplCpaAnalysis.quickWins.map((win, idx) => (
                <li key={idx} className="text-sm text-green-600/80 flex items-start gap-2">
                  <span className="mt-1">✓</span>
                  <span>{win}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Collapsible Deep Dive */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer">
              <span className="text-sm font-medium">
                {isExpanded ? 'Hide' : 'Show'} Detailed Metrics
              </span>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="mt-4">
            {/* AI Summary */}
            <div className="p-4 bg-muted/30 rounded-lg mb-4">
              <h4 className="font-medium mb-2">AI Analysis Summary</h4>
              <p className="text-sm text-muted-foreground">{summary}</p>
            </div>

            {/* Detailed Platform Breakdown */}
            <div className="space-y-4">
              <h4 className="font-medium">Platform Deep Dive</h4>
              {platforms.map((platform, index) => {
                const platformSpend = parseFloat(platform.spend?.replace(/[^0-9.]/g, '') || '0');
                const platformConversions = parseInt(platform.conversions?.replace(/[^0-9]/g, '') || '0');
                const platformCpa = platformConversions > 0 ? platformSpend / platformConversions : 0;
                
                return (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="font-semibold">{platform.name}</h5>
                      <Badge 
                        className={
                          platform.health === 'good' ? 'bg-green-500/20 text-green-600' :
                          platform.health === 'warning' ? 'bg-yellow-500/20 text-yellow-600' :
                          'bg-red-500/20 text-red-600'
                        }
                      >
                        {platform.health === 'good' ? 'Healthy' : platform.health === 'warning' ? 'Needs Attention' : 'Critical'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Spend</p>
                        <p className="font-medium">{platform.spend}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Clicks</p>
                        <p className="font-medium">{platform.clicks}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CTR</p>
                        <p className="font-medium">{platform.ctr}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CPC</p>
                        <p className="font-medium">{platform.cpc}</p>
                      </div>
                      <div className="bg-primary/5 rounded p-1">
                        <p className="text-muted-foreground">CPA</p>
                        <p className="font-bold text-primary">${platformCpa.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3 pt-3 border-t">
                      <div>
                        <p className="text-muted-foreground">Conversions</p>
                        <p className="font-medium">{platform.conversions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conv. Rate</p>
                        <p className="font-medium">{platform.conversionRate || '--'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">ROAS</p>
                        <p className="font-medium">{platform.roas}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Impressions</p>
                        <p className="font-medium">{platform.impressions}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
