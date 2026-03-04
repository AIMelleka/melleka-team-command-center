import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, Zap, TrendingDown, Target, Eye, Search, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Change {
  id: string;
  change_type: string;
  entity_type: string;
  entity_name: string;
  entity_id?: string | null;
  before_value: Record<string, any>;
  after_value: Record<string, any>;
  ai_rationale: string;
  confidence: 'high' | 'medium' | 'low';
  expected_impact: string;
  priority: 'high' | 'medium' | 'low';
  approval_status: 'pending' | 'approved' | 'auto_approved' | 'rejected';
  executed_at?: string;
  execution_error?: string;
}

interface ChangeCardProps {
  change: Change;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  readOnly?: boolean;
}

const CHANGE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  adjust_bid: { label: 'Adjust Bid', icon: Target, color: 'text-blue-500' },
  bid_adjustment: { label: 'Adjust Bid', icon: Target, color: 'text-blue-500' },
  add_negative_keyword: { label: 'Add Negative Keyword', icon: AlertTriangle, color: 'text-yellow-500' },
  change_match_type: { label: 'Change Match Type', icon: Zap, color: 'text-purple-500' },
  flag_creative_issue: { label: 'Creative Issue', icon: Eye, color: 'text-orange-500' },
  flag_keyword_opportunity: { label: 'Keyword Opportunity', icon: Search, color: 'text-emerald-500' },
};

const CONFIDENCE_STYLE = {
  high: 'bg-green-500/10 text-green-400 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const PRIORITY_STYLE = {
  high: 'bg-red-500/10 text-red-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-muted text-muted-foreground',
};

export function ChangeCard({ change, onApprove, onReject, readOnly = false }: ChangeCardProps) {
  // Auto-expand for high priority changes
  const [expanded, setExpanded] = useState(change.priority === 'high');
  const config = CHANGE_TYPE_CONFIG[change.change_type] || { label: change.change_type, icon: Lightbulb, color: 'text-primary' };
  const Icon = config.icon;

  const isApproved = change.approval_status === 'approved';
  const isAutoApproved = change.approval_status === 'auto_approved';
  const isRejected = change.approval_status === 'rejected';
  const isExecuted = !!change.executed_at;
  const isFlag = change.change_type.startsWith('flag_');
  const hasUnresolvedEntity = !change.entity_id;

  return (
    <Card className={cn(
      'border transition-all duration-200',
      isApproved && !isExecuted && 'border-green-500/40 bg-green-500/5',
      isAutoApproved && !isExecuted && 'border-purple-500/40 bg-purple-500/5',
      isRejected && 'border-border/40 opacity-60',
      isExecuted && (isAutoApproved ? 'border-purple-500/40 bg-purple-500/5' : 'border-blue-500/40 bg-blue-500/5'),
      !isApproved && !isAutoApproved && !isRejected && 'border-border hover:border-border/80',
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={cn('mt-0.5 shrink-0', config.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold text-foreground text-sm">{config.label}</span>
                {isFlag && (
                  <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-400 gap-1">
                    <Eye className="h-2.5 w-2.5" />
                    Advisory — no API change
                  </Badge>
                )}
                {hasUnresolvedEntity && !isFlag && (
                  <Badge variant="outline" className="text-[10px] border-orange-500/40 text-orange-400 gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Unresolved entity — cannot execute
                  </Badge>
                )}
              </div>
              <p className="text-foreground font-medium truncate">{change.entity_name}</p>
              {change.entity_type && (
                <p className="text-xs text-muted-foreground capitalize">{change.entity_type.replace('_', ' ')}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn('text-[10px] border', CONFIDENCE_STYLE[change.confidence])}>
              {change.confidence.toUpperCase()} CONFIDENCE
            </Badge>
            <Badge className={cn('text-[10px]', PRIORITY_STYLE[change.priority])}>
              {change.priority.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Before / After */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-3">
            <p className="text-[10px] text-red-400 font-semibold mb-1.5 uppercase tracking-wide">Before</p>
            {Object.entries(change.before_value || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs gap-2">
                <span className="text-muted-foreground capitalize">{k.replace('_', ' ')}</span>
                <span className="font-medium text-foreground">{String(v)}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-green-500/5 border border-green-500/10 p-3">
            <p className="text-[10px] text-green-400 font-semibold mb-1.5 uppercase tracking-wide">After</p>
            {Object.entries(change.after_value || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs gap-2">
                <span className="text-muted-foreground capitalize">{k.replace('_', ' ')}</span>
                <span className="font-medium text-foreground">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expected impact */}
        {change.expected_impact && (
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 p-3">
            <TrendingDown className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">{change.expected_impact}</p>
          </div>
        )}

        {/* Expandable rationale */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Hide' : 'Show'} AI Rationale
        </button>

        {expanded && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">{change.ai_rationale}</p>
          </div>
        )}

        {/* Execution status */}
        {isExecuted && (
          <div className="flex items-center gap-2 text-xs pt-1">
            <CheckCircle className={cn('h-3.5 w-3.5', isAutoApproved ? 'text-purple-400' : 'text-blue-400')} />
            <span className={isAutoApproved ? 'text-purple-400' : 'text-blue-400'}>
              {isAutoApproved ? '⚡ Auto-executed' : 'Executed'} {new Date(change.executed_at!).toLocaleDateString()}
            </span>
          </div>
        )}
        {change.execution_error && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <XCircle className="h-3.5 w-3.5" />
            Error: {change.execution_error}
          </div>
        )}

        {/* Auto-approved badge (not yet executed) */}
        {isAutoApproved && !isExecuted && (
          <div className="flex items-center gap-2 text-xs text-purple-400 pt-1">
            <Zap className="h-3.5 w-3.5" />
            Auto-approved by Strategist — executing now
          </div>
        )}

        {/* Action buttons — hide for flag types (advisory only) */}
        {!readOnly && change.approval_status === 'pending' && !isFlag && !hasUnresolvedEntity && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => onApprove(change.id)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1.5"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReject(change.id)}
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}

        {/* Pending flag-type changes show acknowledge instead */}
        {!readOnly && change.approval_status === 'pending' && isFlag && (
          <div className="flex items-center gap-2 text-xs text-blue-400 pt-1">
            <Eye className="h-3.5 w-3.5" />
            Advisory recommendation — review and take manual action if needed
          </div>
        )}

        {/* Pending but unresolved entity */}
        {!readOnly && change.approval_status === 'pending' && hasUnresolvedEntity && !isFlag && (
          <div className="flex items-center gap-2 text-xs text-orange-400 pt-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Cannot execute — entity not found in ad account. Apply manually.
          </div>
        )}

        {isApproved && !readOnly && (
          <div className="flex items-center gap-2 text-xs text-green-400 pt-1">
            <CheckCircle className="h-3.5 w-3.5" />
            Approved — will execute when you click "Execute Approved Changes"
          </div>
        )}
        {isRejected && !readOnly && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <XCircle className="h-3.5 w-3.5" />
            Rejected
          </div>
        )}
      </CardContent>
    </Card>
  );
}
