import { Loader2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import GenieLamp from '@/components/icons/GenieLamp';

interface ProposalGenerationProgressProps {
  progress: number;
  progressMessage: string;
  error: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export function ProposalGenerationProgress({
  progress,
  progressMessage,
  error,
  onCancel,
  onRetry,
  isRetrying = false,
}: ProposalGenerationProgressProps) {
  const stages = [
    { threshold: 0, label: 'Initializing...', icon: '🔄' },
    { threshold: 5, label: 'Starting generation', icon: '🚀' },
    { threshold: 10, label: 'Preparing client data', icon: '📋' },
    { threshold: 15, label: 'Extracting business context', icon: '🔍' },
    { threshold: 20, label: 'Analyzing industry benchmarks', icon: '📊' },
    { threshold: 25, label: 'Connecting to AI engine', icon: '🤖' },
    { threshold: 30, label: 'Generating personalized strategy', icon: '✍️' },
    { threshold: 75, label: 'Processing AI response', icon: '⚙️' },
    { threshold: 85, label: 'Parsing proposal content', icon: '📄' },
    { threshold: 90, label: 'Validating structure', icon: '✅' },
    { threshold: 95, label: 'Finalizing proposal', icon: '✨' },
    { threshold: 100, label: 'Complete!', icon: '🎉' },
  ];

  const currentStage = [...stages].reverse().find(s => progress >= s.threshold) || stages[0];

  if (error) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-4 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h3 className="text-xl font-display font-semibold mb-2">Generation Failed</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <div className="flex gap-3 justify-center">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onRetry && (
              <Button onClick={onRetry}>
                Try Again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-4 text-center space-y-6 shadow-2xl">
        {/* Animated Genie */}
        <div className="relative">
          <div className="w-20 h-20 mx-auto relative">
            <div className="absolute inset-0 bg-genie-purple/20 rounded-full animate-pulse" />
            <div className="absolute inset-2 bg-gradient-to-br from-genie-gold to-genie-purple rounded-full flex items-center justify-center">
              <GenieLamp size={32} className="text-white animate-bounce" />
            </div>
          </div>
          {progress === 100 && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Stage indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-lg font-medium">
            <span className="text-2xl">{currentStage.icon}</span>
            <span>{currentStage.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{progressMessage}</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{progress}% complete</p>
        </div>

        {/* Status dots - show fewer dots for cleaner UI */}
        <div className="flex justify-center gap-2">
          {[5, 20, 30, 75, 90, 100].map((threshold, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                progress >= threshold
                  ? 'bg-genie-purple'
                  : 'bg-border'
              }`}
            />
          ))}
        </div>

        {/* Cancel button */}
        {onCancel && progress < 100 && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            Cancel
          </Button>
        )}

        {/* Quality generation message */}
        {progress > 0 && progress < 100 && (
          <div className="text-center space-y-1">
            <p className="text-xs text-muted-foreground italic">
              Crafting a deeply personalized, data-driven proposal...
            </p>
            {progress >= 30 && progress < 75 && (
              <p className="text-xs text-genie-gold/80">
                This may take 1-3 minutes for maximum quality
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
