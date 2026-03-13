import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function isDynamicImportError(error: Error): boolean {
  const msg = error.message || '';
  return msg.includes('dynamically imported module') ||
    msg.includes('Failed to fetch dynamically imported') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk');
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Auto-reload once on stale chunk errors (new deploy invalidated old JS filenames)
    if (isDynamicImportError(error)) {
      const reloadKey = 'chunk_reload_' + window.location.pathname;
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
        return;
      }
      // Already tried reloading once this session, show error UI instead
      sessionStorage.removeItem(reloadKey);
    }
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[200px]">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Something went wrong
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred while loading this section.'}
          </p>
          <Button onClick={this.handleRetry} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Inline error fallback for smaller sections
export const InlineErrorFallback = ({ 
  message = 'Failed to load content',
  onRetry 
}: { 
  message?: string; 
  onRetry?: () => void;
}) => (
  <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
    <p className="text-sm text-muted-foreground flex-1">{message}</p>
    {onRetry && (
      <Button onClick={onRetry} variant="ghost" size="sm">
        <RefreshCw className="w-4 h-4" />
      </Button>
    )}
  </div>
);

export const PageErrorFallback = ({
  error,
  onRetry,
}: {
  error?: Error | null;
  onRetry?: () => void;
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-background">
    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
      <AlertTriangle className="w-8 h-8 text-destructive" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">
      This page ran into an error
    </h3>
    <p className="text-sm text-muted-foreground mb-4 max-w-md">
      {error?.message || 'Something unexpected happened. The rest of the app still works.'}
    </p>
    <div className="flex gap-3">
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      )}
      <Button onClick={() => window.location.href = '/'} variant="default" size="sm">
        Go Home
      </Button>
    </div>
  </div>
);

export default ErrorBoundary;
