import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  MessageSquare,
  CheckCircle2,
  Clock,
  Save
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AdReviewRecord } from '@/hooks/useAdReviewHistory';

interface AdReviewHistoryProps {
  history: AdReviewRecord[];
  isLoading: boolean;
  onUpdateNotes: (reviewId: string, notes: string) => void;
  onRecordChange: (reviewId: string, change: { action: string; date: string; result?: string }) => void;
}

export function AdReviewHistory({ history, isLoading, onUpdateNotes, onRecordChange }: AdReviewHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<{ id: string; notes: string } | null>(null);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading history...</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No previous reviews found for this client.</p>
          <p className="text-xs text-muted-foreground mt-1">Reviews will be saved automatically after analysis.</p>
        </CardContent>
      </Card>
    );
  }

  const handleSaveNotes = (id: string) => {
    if (editingNotes && editingNotes.id === id) {
      onUpdateNotes(id, editingNotes.notes);
      setEditingNotes(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          365-Day Review History
          <Badge variant="secondary">{history.length} reviews</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {history.map((review, index) => {
              const isExpanded = expandedId === review.id;
              const reviewDate = parseISO(review.review_date);
              const isRecent = index === 0;
              
              return (
                <Collapsible 
                  key={review.id} 
                  open={isExpanded}
                  onOpenChange={() => setExpandedId(isExpanded ? null : review.id)}
                >
                  <div className={`border rounded-lg ${isRecent ? 'border-primary/50 bg-primary/5' : ''}`}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{format(reviewDate, 'MMM d, yyyy')}</span>
                              {isRecent && <Badge className="text-xs">Latest</Badge>}
                            </div>
                            <span className="text-xs text-muted-foreground mt-1">
                              {review.date_range_start} to {review.date_range_end}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {review.platforms?.length > 0 && (
                            <div className="flex gap-1">
                              {review.platforms.slice(0, 2).map((p: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {p.name?.split(' ')[0]}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3 border-t pt-3">
                        {/* Summary */}
                        {review.summary && (
                          <p className="text-sm text-muted-foreground">{review.summary}</p>
                        )}
                        
                        {/* Platform Metrics */}
                        {review.platforms?.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {review.platforms.map((p: any, i: number) => (
                              <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                                <p className="font-medium">{p.name}</p>
                                <div className="flex gap-2 mt-1 text-muted-foreground">
                                  <span>CTR: {p.ctr}</span>
                                  <span>CPC: {p.cpc}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Changes Made */}
                        {review.changes_made?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Changes Made
                            </p>
                            {review.changes_made.map((change: any, i: number) => (
                              <div key={i} className="text-xs text-muted-foreground pl-4">
                                • {change.action} {change.result && `→ ${change.result}`}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Notes */}
                        <div className="space-y-2">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Notes
                          </p>
                          {editingNotes?.id === review.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingNotes.notes}
                                onChange={(e) => setEditingNotes({ id: review.id, notes: e.target.value })}
                                placeholder="Add notes about this review..."
                                className="text-xs min-h-[60px]"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => setEditingNotes(null)}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={() => handleSaveNotes(review.id)}>
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingNotes({ id: review.id, notes: review.notes || '' })}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left w-full"
                            >
                              {review.notes || 'Click to add notes...'}
                            </button>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
