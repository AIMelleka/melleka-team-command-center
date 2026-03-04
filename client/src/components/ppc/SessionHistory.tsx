import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Session {
  id: string;
  client_name: string;
  platform: string;
  date_range_start: string;
  date_range_end: string;
  ai_summary: string;
  status: string;
  auto_mode: boolean;
  created_at: string;
  changeCount?: number;
  approvedCount?: number;
}

interface SessionHistoryProps {
  sessions: Session[];
  onSelectSession: (id: string) => void;
  selectedId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; style: string }> = {
  pending_review: { label: 'Pending Review', icon: Clock, style: 'text-yellow-400' },
  approved: { label: 'Approved', icon: CheckCircle, style: 'text-green-400' },
  partially_approved: { label: 'Partial', icon: AlertCircle, style: 'text-orange-400' },
  rejected: { label: 'Rejected', icon: XCircle, style: 'text-red-400' },
  executed: { label: 'Executed', icon: CheckCircle, style: 'text-blue-400' },
  auto_executing: { label: 'Auto Executing', icon: AlertCircle, style: 'text-purple-400' },
  auto_executed: { label: 'Auto Executed', icon: CheckCircle, style: 'text-purple-400' },
};

export function SessionHistory({ sessions, onSelectSession, selectedId }: SessionHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No analysis sessions yet.</p>
        <p className="text-xs mt-1">Run your first analysis to see history here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session) => {
        const statusConfig = STATUS_CONFIG[session.status] || STATUS_CONFIG.pending_review;
        const StatusIcon = statusConfig.icon;
        const isSelected = session.id === selectedId;

        return (
          <Card
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={cn(
              'cursor-pointer transition-all border hover:border-primary/30',
              isSelected && 'border-primary/50 bg-primary/5',
            )}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className={cn('text-[10px]', session.platform === 'google' ? 'border-blue-500/30 text-blue-400' : 'border-blue-400/30 text-blue-300')}>
                      {session.platform === 'google' ? '🔵 Google' : '🔷 Meta'}
                    </Badge>
                    {session.auto_mode && (
                      <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-400">Auto Mode</Badge>
                    )}
                    <div className={cn('flex items-center gap-1 text-xs', statusConfig.style)}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </div>
                  </div>
                  <p className="font-semibold text-sm text-foreground mb-0.5">{session.client_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.date_range_start).toLocaleDateString()} – {new Date(session.date_range_end).toLocaleDateString()}
                  </p>
                  {session.ai_summary && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{session.ai_summary}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground">{new Date(session.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
