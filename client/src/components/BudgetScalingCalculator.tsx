import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  Zap,
  ChevronRight,
  Info,
  BarChart3
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Slider } from '@/components/ui/slider';
import { AnimatedCounter } from './AnimatedCounter';

interface BudgetScalingCalculatorProps {
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  textMutedColor?: string;
  initialAdsCount?: number;
  platform?: 'google' | 'meta' | 'both';
}

export const BudgetScalingCalculator = ({ 
  primaryColor = '#6366f1', 
  secondaryColor = '#f59e0b',
  textColor = '#ffffff',
  textMutedColor = 'rgba(255,255,255,0.7)',
  initialAdsCount = 10,
  platform = 'both'
}: BudgetScalingCalculatorProps) => {
  const [adsCount, setAdsCount] = useState(initialAdsCount);
  const [showDetails, setShowDetails] = useState(false);
  
  // Calculate budget scaling over 6 months
  const budgetData = useMemo(() => {
    const startingDailyBudget = 5; // $5 per ad
    const totalDailyStart = adsCount * startingDailyBudget;
    
    // Assumptions:
    // - 30% of ads get killed in week 1-2
    // - Winners get 20-30% budget increase every 3-4 days
    // - By month 3, we've identified top performers
    // - Month 4-6: scaling proven campaigns
    
    const months = [
      { 
        month: 'Month 1', 
        phase: 'Testing',
        activeAds: adsCount,
        dailyBudget: totalDailyStart,
        monthlySpend: totalDailyStart * 30,
        winnerCount: 0,
        description: 'Launch all ad variations at $5/day each'
      },
      { 
        month: 'Month 2', 
        phase: 'Validating',
        activeAds: Math.ceil(adsCount * 0.6), // 40% killed
        dailyBudget: Math.round(totalDailyStart * 1.4),
        monthlySpend: Math.round(totalDailyStart * 1.4 * 30),
        winnerCount: Math.ceil(adsCount * 0.3),
        description: 'Cut losers, scale early winners by 20-30%'
      },
      { 
        month: 'Month 3', 
        phase: 'Optimizing',
        activeAds: Math.ceil(adsCount * 0.4),
        dailyBudget: Math.round(totalDailyStart * 2.2),
        monthlySpend: Math.round(totalDailyStart * 2.2 * 30),
        winnerCount: Math.ceil(adsCount * 0.25),
        description: 'Top performers identified, aggressive scaling'
      },
      { 
        month: 'Month 4', 
        phase: 'Scaling',
        activeAds: Math.ceil(adsCount * 0.35),
        dailyBudget: Math.round(totalDailyStart * 3.5),
        monthlySpend: Math.round(totalDailyStart * 3.5 * 30),
        winnerCount: Math.ceil(adsCount * 0.2),
        description: 'Proven campaigns at full scale'
      },
      { 
        month: 'Month 5', 
        phase: 'Expanding',
        activeAds: Math.ceil(adsCount * 0.4),
        dailyBudget: Math.round(totalDailyStart * 4.5),
        monthlySpend: Math.round(totalDailyStart * 4.5 * 30),
        winnerCount: Math.ceil(adsCount * 0.25),
        description: 'New creative tests + scaling winners'
      },
      { 
        month: 'Month 6', 
        phase: 'Mature',
        activeAds: Math.ceil(adsCount * 0.45),
        dailyBudget: Math.round(totalDailyStart * 5.5),
        monthlySpend: Math.round(totalDailyStart * 5.5 * 30),
        winnerCount: Math.ceil(adsCount * 0.3),
        description: 'Optimized portfolio with proven ROAS'
      },
    ];
    
    return months;
  }, [adsCount]);
  
  const totalSpend6Months = budgetData.reduce((sum, m) => sum + m.monthlySpend, 0);
  const month1Spend = budgetData[0].monthlySpend;
  const month6Spend = budgetData[5].monthlySpend;
  const budgetMultiplier = (month6Spend / month1Spend).toFixed(1);
  
  // Traditional approach comparison (just throwing money at untested ads)
  const traditionalSpend = month6Spend * 6; // If they started at full budget
  const savings = traditionalSpend - totalSpend6Months;
  
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-display font-bold flex items-center gap-2" style={{ color: textColor }}>
            <BarChart3 className="w-6 h-6" style={{ color: primaryColor }} />
            Strategic Budget Calculator
          </h3>
          <p style={{ color: textMutedColor }} className="mt-1">
            See how our $5/day testing approach scales to profitable campaigns
          </p>
        </div>
        <div 
          className="px-4 py-2 rounded-full text-sm font-medium"
          style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 20%, transparent)`, color: secondaryColor }}
        >
          {platform === 'google' ? 'Google Ads' : platform === 'meta' ? 'Meta Ads' : 'All Platforms'}
        </div>
      </div>
      
      {/* Ad Count Slider */}
      <div 
        className="p-6 rounded-2xl"
        style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 8%, var(--background))` }}
      >
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium" style={{ color: textColor }}>Number of Ad Variations to Test</label>
          <span 
            className="text-2xl font-bold"
            style={{ color: primaryColor }}
          >
            {adsCount} ads
          </span>
        </div>
        <Slider
          value={[adsCount]}
          onValueChange={(value) => setAdsCount(value[0])}
          min={5}
          max={30}
          step={1}
          className="mb-4"
        />
        <div className="flex justify-between text-xs" style={{ color: textMutedColor }}>
          <span>5 ads (Conservative)</span>
          <span>15 ads (Recommended)</span>
          <span>30 ads (Aggressive)</span>
        </div>
      </div>
      
      {/* Key Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          className="p-5 rounded-xl text-center"
          style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, var(--background))` }}
        >
          <p className="text-3xl font-bold" style={{ color: textColor }}>
            ${adsCount * 5}
          </p>
          <p className="text-sm" style={{ color: textMutedColor }}>Day 1 Budget</p>
        </div>
        <div 
          className="p-5 rounded-xl text-center"
          style={{ backgroundColor: `color-mix(in srgb, ${secondaryColor} 10%, var(--background))` }}
        >
          <p className="text-3xl font-bold" style={{ color: textColor }}>
            ${budgetData[5].dailyBudget}
          </p>
          <p className="text-sm" style={{ color: textMutedColor }}>Month 6 Daily</p>
        </div>
        <div 
          className="p-5 rounded-xl text-center"
          style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 10%, var(--background))` }}
        >
          <p className="text-3xl font-bold" style={{ color: textColor }}>
            {budgetMultiplier}x
          </p>
          <p className="text-sm" style={{ color: textMutedColor }}>Budget Growth</p>
        </div>
        <div 
          className="p-5 rounded-xl text-center"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}
        >
          <p className="text-3xl font-bold" style={{ color: '#16a34a' }}>
            ${savings.toLocaleString()}
          </p>
          <p className="text-sm" style={{ color: textMutedColor }}>Saved vs Traditional</p>
        </div>
      </div>
      
      {/* Budget Growth Chart */}
      <div 
        className="p-6 rounded-2xl"
        style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 5%, var(--background))`, border: '1px solid var(--border)' }}
      >
        <h4 className="text-lg font-semibold mb-6" style={{ color: textColor }}>Budget Scaling Over 6 Months</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={budgetData}>
              <defs>
                <linearGradient id="budgetGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: textMutedColor, fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: textMutedColor, fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--card)', 
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '12px',
                  color: 'var(--foreground)'
                }}
                labelStyle={{ color: 'var(--foreground)' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'Monthly Spend']}
              />
              <Area 
                type="monotone" 
                dataKey="monthlySpend" 
                stroke={primaryColor} 
                strokeWidth={3}
                fill="url(#budgetGradient)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Monthly Breakdown */}
      <div className="space-y-3">
        <div 
          className="flex items-center justify-between p-4 rounded-xl cursor-pointer hover:bg-accent/50 transition-colors"
          style={{ backgroundColor: `color-mix(in srgb, ${primaryColor} 5%, var(--background))`, color: textColor }}
          onClick={() => setShowDetails(!showDetails)}
        >
          <span className="font-medium">View Monthly Breakdown</span>
          <ChevronRight className={`w-5 h-5 transition-transform ${showDetails ? 'rotate-90' : ''}`} />
        </div>
        
        {showDetails && (
          <div className="grid gap-3">
            {budgetData.map((month, i) => (
              <div 
                key={month.month}
                className="p-4 rounded-xl border border-border bg-card"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ 
                        backgroundColor: i < 2 ? primaryColor : i < 4 ? secondaryColor : '#22c55e'
                      }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: textColor }}>{month.month}: {month.phase}</p>
                      <p className="text-sm" style={{ color: textMutedColor }}>{month.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold" style={{ color: textColor }}>
                      ${month.monthlySpend.toLocaleString()}
                    </p>
                    <p className="text-xs" style={{ color: textMutedColor }}>
                      ${month.dailyBudget}/day
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 pt-3 border-t border-border text-sm">
                  <div className="flex items-center gap-1" style={{ color: textMutedColor }}>
                    <Target className="w-4 h-4" />
                    {month.activeAds} active ads
                  </div>
                  {month.winnerCount > 0 && (
                    <div className="flex items-center gap-1" style={{ color: '#16a34a' }}>
                      <Zap className="w-4 h-4" />
                      {month.winnerCount} proven winners
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Comparison Callout */}
      <div 
        className="p-6 rounded-2xl border-2"
        style={{ 
          borderColor: secondaryColor,
          backgroundColor: `color-mix(in srgb, ${secondaryColor} 5%, var(--background))`
        }}
      >
        <div className="flex items-start gap-4">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: secondaryColor }}
          >
            <Info className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-2" style={{ color: textColor }}>Why This Approach Saves Money</h4>
            <p className="mb-4" style={{ color: textMutedColor }}>
              Traditional agencies would spend <strong style={{ color: textColor }}>${traditionalSpend.toLocaleString()}</strong> over 6 months 
              by starting at full budget from day one. Our strategic testing approach spends only <strong style={{ color: textColor }}>${totalSpend6Months.toLocaleString()}</strong> while 
              building a portfolio of proven, high-performing ads.
            </p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ef4444' }}></div>
                <span style={{ color: textMutedColor }}>Traditional: ${traditionalSpend.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22c55e' }}></div>
                <span style={{ color: textMutedColor }}>Our Approach: ${totalSpend6Months.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#16a34a' }}>
                <DollarSign className="w-4 h-4" />
                You Save: ${savings.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
