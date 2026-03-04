import { BarChart3, TrendingUp, DollarSign, Users, Eye, MousePointer, ShoppingCart, Clock, RefreshCw, Target, Zap, Globe, PieChart as PieChartIcon, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';
import { AnimatedCounter } from './AnimatedCounter';
import { CalloutBadge } from './ProposalAnnotations';
import { PlatformBadge } from './PlatformLogos';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line } from 'recharts';

interface LiveDashboardSectionProps {
  clientName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  textMutedColor: string;
  cardBackground: string;
  borderColor: string;
  backgroundColor: string;
}

export const LiveDashboardSection = ({
  clientName,
  primaryColor,
  secondaryColor,
  accentColor,
  textColor,
  textMutedColor,
  cardBackground,
  borderColor,
  backgroundColor
}: LiveDashboardSectionProps) => {

  // Sample performance data
  const weeklyData = [
    { day: 'Mon', leads: 12, spend: 420, conversions: 3 },
    { day: 'Tue', leads: 18, spend: 450, conversions: 5 },
    { day: 'Wed', leads: 15, spend: 380, conversions: 4 },
    { day: 'Thu', leads: 22, spend: 520, conversions: 7 },
    { day: 'Fri', leads: 28, spend: 580, conversions: 9 },
    { day: 'Sat', leads: 8, spend: 200, conversions: 2 },
    { day: 'Sun', leads: 6, spend: 180, conversions: 1 }
  ];

  const channelData = [
    { name: 'Google Ads', value: 45, leads: 156, color: primaryColor },
    { name: 'LinkedIn', value: 30, leads: 104, color: secondaryColor },
    { name: 'Meta Ads', value: 15, leads: 52, color: accentColor },
    { name: 'Organic', value: 10, leads: 35, color: `color-mix(in srgb, ${primaryColor} 50%, ${secondaryColor})` }
  ];

  // KPI cards
  const kpis = [
    { 
      icon: Users, 
      label: 'Total Leads', 
      value: '347', 
      change: '+23%', 
      positive: true,
      sublabel: 'This month'
    },
    { 
      icon: DollarSign, 
      label: 'Ad Spend', 
      value: '$12,450', 
      change: '-8%', 
      positive: true,
      sublabel: 'Under budget'
    },
    { 
      icon: Target, 
      label: 'Cost Per Lead', 
      value: '$35.87', 
      change: '-15%', 
      positive: true,
      sublabel: 'Target: $50'
    },
    { 
      icon: TrendingUp, 
      label: 'ROAS', 
      value: '4.2x', 
      change: '+12%', 
      positive: true,
      sublabel: 'Return on ad spend'
    }
  ];

  // Dashboard features
  const dashboardFeatures = [
    {
      icon: RefreshCw,
      title: 'Real-Time Data',
      description: 'Metrics update every 15 minutes with live API connections to all ad platforms'
    },
    {
      icon: Globe,
      title: 'All Channels Unified',
      description: 'Google, LinkedIn, Meta, and organic data in one view. No platform hopping.'
    },
    {
      icon: PieChartIcon,
      title: 'Custom Reports',
      description: 'Weekly and monthly reports delivered to your inbox with insights and recommendations'
    },
    {
      icon: Zap,
      title: 'Alert System',
      description: 'Instant notifications when campaigns hit targets or need attention'
    }
  ];

  return (
    <section id="live-dashboard" className="py-24 relative overflow-hidden" style={{
      background: `linear-gradient(180deg, ${backgroundColor}, color-mix(in srgb, ${primaryColor} 5%, ${backgroundColor}))`
    }}>
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl opacity-10 animate-pulse" style={{
          background: `radial-gradient(circle, ${primaryColor}, transparent)`
        }} />
        <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full blur-3xl opacity-10 animate-pulse" style={{
          background: `radial-gradient(circle, ${secondaryColor}, transparent)`,
          animationDelay: '1s'
        }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-3" style={{
          backgroundImage: `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="container max-w-6xl mx-auto px-4 relative z-10">
        {/* Header */}
        <AnimatedSection>
          <div className="text-center mb-16">
            <p className="font-medium uppercase tracking-widest text-sm mb-4" style={{ color: secondaryColor }}>
              Real-Time Intelligence
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
              <h2 className="text-3xl md:text-5xl font-display font-bold" style={{ color: textColor }}>
                Live Performance Dashboard
              </h2>
              <CalloutBadge text="24/7 Access" variant="highlight" />
            </div>
            <p className="text-lg max-w-3xl mx-auto leading-relaxed" style={{ color: textMutedColor }}>
              Your custom {clientName} marketing command center. Track every dollar spent, every lead generated, 
              and every conversion in real time. No more waiting for end-of-month reports.
            </p>
          </div>
        </AnimatedSection>

        {/* Platform Integrations */}
        <AnimatedSection delay={50}>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
            <span className="text-sm font-medium" style={{ color: textMutedColor }}>Integrated with:</span>
            <PlatformBadge platform="ga4" />
            <PlatformBadge platform="google" />
            <PlatformBadge platform="meta" />
            <PlatformBadge platform="hubspot" />
            <PlatformBadge platform="looker" />
          </div>
        </AnimatedSection>

        {/* KPI Cards */}
        <AnimatedSection delay={100}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {kpis.map((kpi, i) => (
              <div key={i} className="p-6 rounded-2xl relative overflow-hidden group transition-all duration-300 hover:scale-105 hover:-translate-y-1" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`,
                boxShadow: `0 15px 40px -15px ${primaryColor}15`
              }}>
                {/* Hover glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                  background: `radial-gradient(circle at 50% 100%, ${primaryColor}10, transparent 70%)`
                }} />
                
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                      background: `color-mix(in srgb, ${primaryColor} 15%, transparent)`
                    }}>
                      <kpi.icon className="w-5 h-5" style={{ color: primaryColor }} />
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium ${kpi.positive ? 'text-green-500' : 'text-red-500'}`}>
                      {kpi.positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                      {kpi.change}
                    </div>
                  </div>
                  <p className="text-3xl font-bold mb-1" style={{ color: textColor }}>
                    <AnimatedCounter value={kpi.value} />
                  </p>
                  <p className="font-medium text-sm" style={{ color: textMutedColor }}>{kpi.label}</p>
                  <p className="text-xs mt-1" style={{ color: textMutedColor }}>{kpi.sublabel}</p>
                </div>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Dashboard Preview */}
        <AnimatedSection delay={200}>
          <div className="p-8 rounded-3xl relative overflow-hidden" style={{
            background: cardBackground,
            border: `1px solid ${borderColor}`,
            boxShadow: `0 30px 60px -15px ${primaryColor}20`
          }}>
            {/* Browser chrome */}
            <div className="flex items-center gap-2 mb-6 pb-4" style={{ borderBottom: `1px solid ${borderColor}` }}>
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 mx-4">
                <div className="px-4 py-2 rounded-lg text-sm flex items-center gap-2" style={{
                  background: `color-mix(in srgb, ${primaryColor} 5%, ${backgroundColor})`
                }}>
                  <Globe className="w-4 h-4" style={{ color: textMutedColor }} />
                  <span style={{ color: textMutedColor }}>dashboard.melleka.com/{clientName.toLowerCase().replace(/\s+/g, '-')}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Activity className="w-3 h-3 text-green-500" />
                    <span className="text-xs text-green-500">Live</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Chart */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold" style={{ color: textColor }}>Weekly Lead Performance</h4>
                  <div className="flex gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ background: primaryColor }} />
                      <span style={{ color: textMutedColor }}>Leads</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ background: secondaryColor }} />
                      <span style={{ color: textMutedColor }}>Conversions</span>
                    </div>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData}>
                      <defs>
                        <linearGradient id="leadGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" stroke={textMutedColor} fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke={textMutedColor} fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          background: cardBackground, 
                          border: `1px solid ${borderColor}`,
                          borderRadius: '12px',
                          boxShadow: `0 10px 30px -10px ${primaryColor}30`
                        }}
                        labelStyle={{ color: textColor }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="leads" 
                        stroke={primaryColor} 
                        strokeWidth={3}
                        fill="url(#leadGradient)" 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="conversions" 
                        stroke={secondaryColor} 
                        strokeWidth={2}
                        dot={{ fill: secondaryColor, strokeWidth: 0, r: 4 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Channel Breakdown */}
              <div>
                <h4 className="font-bold mb-4" style={{ color: textColor }}>Lead Sources</h4>
                <div className="space-y-4">
                  {channelData.map((channel, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm" style={{ color: textColor }}>{channel.name}</span>
                        <span className="text-sm font-medium" style={{ color: textMutedColor }}>{channel.leads} leads</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: `color-mix(in srgb, ${channel.color} 20%, transparent)` }}>
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${channel.value}%`, 
                            background: channel.color,
                            boxShadow: `0 0 10px ${channel.color}50`
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Quick action */}
                <div className="mt-6 p-4 rounded-xl" style={{
                  background: `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
                  border: `1px dashed ${primaryColor}40`
                }}>
                  <p className="text-xs font-medium mb-1" style={{ color: primaryColor }}>💡 Insight</p>
                  <p className="text-xs" style={{ color: textMutedColor }}>
                    LinkedIn is driving 30% of leads at $42 CPL. Consider increasing budget by 20%.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* Features Grid */}
        <AnimatedSection delay={300}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            {dashboardFeatures.map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl text-center transition-all duration-300 hover:scale-105" style={{
                background: cardBackground,
                border: `1px solid ${borderColor}`
              }}>
                <div className="w-12 h-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{
                  background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
                }}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h4 className="font-bold mb-2" style={{ color: textColor }}>{feature.title}</h4>
                <p className="text-sm" style={{ color: textMutedColor }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </AnimatedSection>

        {/* Access Info */}
        <AnimatedSection delay={400}>
          <div className="mt-12 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6" style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
            boxShadow: `0 20px 50px -15px ${primaryColor}40`
          }}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-bold text-white">Available 24/7</p>
                <p className="text-white/80 text-sm">Access your dashboard anytime, from any device</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="text-center px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm">
                <p className="text-2xl font-bold text-white">15min</p>
                <p className="text-xs text-white/80">Data Refresh</p>
              </div>
              <div className="text-center px-6 py-3 rounded-xl bg-white/10 backdrop-blur-sm">
                <p className="text-2xl font-bold text-white">∞</p>
                <p className="text-xs text-white/80">Historical Data</p>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
};
