import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Target, Award } from 'lucide-react';
import { IndustryBenchmark } from '@/data/industryBenchmarks';

interface AdReviewBenchmarksProps {
  industry: string;
  benchmark: IndustryBenchmark;
  currentMetrics: {
    googleCtr?: number;
    googleCpc?: number;
    googleConversionRate?: number;
    metaCtr?: number;
    metaCpc?: number;
    metaConversionRate?: number;
  };
}

export function AdReviewBenchmarks({ industry, benchmark, currentMetrics }: AdReviewBenchmarksProps) {
  const compareMetric = (current: number | undefined, benchmark: number, higherIsBetter = true) => {
    if (!current || !benchmark) return null;
    
    const diff = ((current - benchmark) / benchmark) * 100;
    const isGood = higherIsBetter ? diff >= 0 : diff <= 0;
    
    return {
      diff: Math.abs(diff).toFixed(1),
      direction: diff > 5 ? 'above' : diff < -5 ? 'below' : 'at',
      isGood,
      icon: diff > 5 ? <TrendingUp className="h-4 w-4" /> : diff < -5 ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />,
      color: isGood ? 'text-green-500' : 'text-red-500'
    };
  };

  const metrics = [
    {
      label: 'Google CTR',
      current: currentMetrics.googleCtr,
      benchmark: benchmark.google.searchCtr,
      unit: '%',
      higherIsBetter: true
    },
    {
      label: 'Google CPC',
      current: currentMetrics.googleCpc,
      benchmark: benchmark.google.searchCpc,
      unit: '$',
      higherIsBetter: false // Lower is better
    },
    {
      label: 'Google Conv. Rate',
      current: currentMetrics.googleConversionRate,
      benchmark: benchmark.google.conversionRate,
      unit: '%',
      higherIsBetter: true
    },
    {
      label: 'Meta CTR',
      current: currentMetrics.metaCtr,
      benchmark: benchmark.facebook.ctr,
      unit: '%',
      higherIsBetter: true
    },
    {
      label: 'Meta CPC',
      current: currentMetrics.metaCpc,
      benchmark: benchmark.facebook.cpc,
      unit: '$',
      higherIsBetter: false
    },
    {
      label: 'Meta Conv. Rate',
      current: currentMetrics.metaConversionRate,
      benchmark: benchmark.facebook.conversionRate,
      unit: '%',
      higherIsBetter: true
    },
  ];

  const validMetrics = metrics.filter(m => m.current !== undefined);

  if (validMetrics.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          Industry Benchmark Comparison
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{industry}</Badge>
          <span className="text-sm text-muted-foreground">WordStream 2025 Benchmarks</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {validMetrics.map((metric, index) => {
            const comparison = compareMetric(metric.current, metric.benchmark, metric.higherIsBetter);
            
            return (
              <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-sm font-medium">{metric.label}</p>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Yours</p>
                    <p className="font-bold">
                      {metric.unit === '$' ? `$${metric.current?.toFixed(2)}` : `${metric.current?.toFixed(2)}%`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Industry</p>
                    <p className="font-medium text-muted-foreground">
                      {metric.unit === '$' ? `$${metric.benchmark.toFixed(2)}` : `${metric.benchmark.toFixed(2)}%`}
                    </p>
                  </div>
                </div>
                
                {comparison && (
                  <div className={`flex items-center gap-1 text-sm ${comparison.color}`}>
                    {comparison.icon}
                    <span>
                      {comparison.diff}% {comparison.direction} benchmark
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-3 bg-primary/5 rounded-lg">
          <div className="flex items-start gap-2">
            <Target className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium text-sm">Industry Targets</p>
              <p className="text-xs text-muted-foreground mt-1">
                Google Search: {benchmark.google.searchCtr}% CTR, ${benchmark.google.searchCpc} CPC, {benchmark.google.conversionRate}% CVR
                <br />
                Meta/Facebook: {benchmark.facebook.ctr}% CTR, ${benchmark.facebook.cpc} CPC, {benchmark.facebook.conversionRate}% CVR
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
