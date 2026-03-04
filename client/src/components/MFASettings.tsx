import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { EnrollMFA } from './EnrollMFA';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function MFASettings() {
  const [hasMFA, setHasMFA] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showEnroll, setShowEnroll] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  const checkMFAStatus = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (!error && data.totp.length > 0) {
      setHasMFA(true);
      setFactorId(data.totp[0].id);
    } else {
      setHasMFA(false);
      setFactorId(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const handleUnenroll = async () => {
    if (!factorId) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error('Failed to disable 2FA', { description: error.message });
      return;
    }
    toast.success('Two-factor authentication disabled');
    setHasMFA(false);
    setFactorId(null);
  };

  if (showEnroll) {
    return (
      <EnrollMFA
        onEnrolled={() => {
          setShowEnroll(false);
          checkMFAStatus();
        }}
        onCancelled={() => setShowEnroll(false)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </div>
          </div>
          {!isLoading && (
            <Badge variant={hasMFA ? 'default' : 'secondary'} className="shrink-0">
              {hasMFA ? (
                <><ShieldCheck className="h-3 w-3 mr-1" /> Enabled</>
              ) : (
                <><ShieldOff className="h-3 w-3 mr-1" /> Disabled</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : hasMFA ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                Disable 2FA
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the extra security layer from your account. You can re-enable it at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleUnenroll}>Disable 2FA</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button onClick={() => setShowEnroll(true)} size="sm">
            <Shield className="h-4 w-4 mr-2" />
            Enable 2FA
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
