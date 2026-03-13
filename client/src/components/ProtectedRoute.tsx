import { useState, useEffect } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { routeToToolKey, TOOL_CATALOG } from '@/data/toolCatalog';
import { Loader2, RefreshCw, LogIn, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EnrollMFA } from '@/components/EnrollMFA';
import { MFA_EXEMPT_EMAILS } from '@/lib/mfaConfig';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, isAdmin, isLoading, mfaEnrolled, refreshMfaStatus } = useAuth();
  const { hasToolAccess, isLoading: permLoading } = useUserPermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);
  const [forcingEnroll, setForcingEnroll] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return;
    }

    const id = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(id);
  }, [isLoading]);

  if (isLoading || permLoading) {
    if (timedOut) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold text-foreground mb-2">Still loading…</h1>
            <p className="text-muted-foreground mb-6">
              Permission checks are taking longer than expected. You can retry, or go back to the login screen.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => window.location.reload()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => navigate('/login')}>
                <LogIn className="h-4 w-4 mr-2" />
                Go to Login
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-genie-purple" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Force MFA enrollment for all users who haven't set it up (exempt service accounts)
  const userEmail = user?.email?.toLowerCase() ?? '';
  if (!mfaEnrolled && !MFA_EXEMPT_EMAILS.includes(userEmail)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md mb-6 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Two-Factor Authentication Required</h1>
          <p className="text-sm text-muted-foreground">
            You must enable two-factor authentication to continue.
          </p>
        </div>
        <EnrollMFA
          hideCancelButton
          onEnrolled={async () => {
            await refreshMfaStatus();
          }}
        />
      </div>
    );
  }

  // Admins always have full access (after MFA check)
  if (isAdmin) {
    return <>{children}</>;
  }

  // For requireAdmin routes, check if user has tool-level permission or if tool is public
  if (requireAdmin) {
    const toolKey = routeToToolKey(location.pathname);
    if (toolKey) {
      const tool = TOOL_CATALOG.find(t => t.key === toolKey);
      if (tool?.publicAccess || hasToolAccess(toolKey)) {
        return <>{children}</>;
      }
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">You don't have permission to access this tool. Contact your administrator.</p>
          <Button onClick={() => navigate('/user')} variant="outline">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
