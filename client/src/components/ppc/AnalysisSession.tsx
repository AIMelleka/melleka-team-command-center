import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AnalysisSessionProps {
  session: {
    id: string;
    client_name: string;
    platform: string;
    date_range_start: string;
    date_range_end: string;
    ai_reasoning: string;
    ai_summary: string;
    status: string;
    supermetrics_data: any;
    created_at: string;
  };
}

export function AnalysisSession({ session }: AnalysisSessionProps) {
  const [showFullReasoning, setShowFullReasoning] = useState(false);
  const data = session.supermetrics_data as any || {};

  const totalSpend = data.totalSpend || 0;
  const totalConversions = data.totalConversions || 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : null;

  const reasoningParagraphs = (session.ai_reasoning || '').split('\n').filter(Boolean);
  const previewParagraphs = reasoningParagraphs.slice(0, 2);
  const hasMore = reasoningParagraphs.length > 2;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Brain className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">AI Executive Summary</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{session.ai_summary || 'Analysis complete.'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics snapshot */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total Spend Analyzed</p>
            <p className="text-xl font-bold text-foreground">${totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Total Conversions</p>
            <p className="text-xl font-bold text-foreground">{totalConversions.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Current CPA</p>
            <p className="text-xl font-bold text-foreground">{cpa ? `$${cpa.toFixed(2)}` : 'N/A'}</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Chain-of-Thought Reasoning */}
      {session.ai_reasoning && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              AI Chain-of-Thought Reasoning
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(showFullReasoning ? reasoningParagraphs : previewParagraphs).map((p, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">{p}</p>
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => setShowFullReasoning(!showFullReasoning)}
                className="mt-3 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {showFullReasoning ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showFullReasoning ? 'Show less' : `Show full reasoning (${reasoningParagraphs.length} paragraphs)`}
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Top campaigns */}
      {data.campaigns && data.campaigns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-sm font-semibold">Campaign Performance Snapshot</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.campaigns.slice(0, 8).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <p className="text-xs font-medium text-foreground truncate flex-1">{c.name}</p>
                  <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                    <span>${c.cost?.toFixed(0)}</span>
                    <span>{c.conversions} conv</span>
                    {c.cpa === Infinity ? (
                      <Badge variant="destructive" className="text-[10px]">No Conv</Badge>
                    ) : (
                      <span>${c.cpa?.toFixed(0)} CPA</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
