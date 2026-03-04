import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, KeyRound } from 'lucide-react';

interface MFAVerifyProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function MFAVerify({ onVerified, onCancel }: MFAVerifyProps) {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');

  const handleVerify = async () => {
    setIsLoading(true);

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      toast.error('Failed to retrieve MFA factors');
      setIsLoading(false);
      return;
    }

    const totpFactor = factors.totp[0];
    if (!totpFactor) {
      toast.error('No TOTP factor found');
      setIsLoading(false);
      return;
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeError) {
      toast.error('Challenge failed', { description: challengeError.message });
      setIsLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code,
    });

    if (verifyError) {
      toast.error('Invalid code', { description: 'Please check your authenticator app and try again.' });
      setCode('');
      setIsLoading(false);
      return;
    }

    toast.success('Verified!');
    onVerified();
  };

  const handleRecoveryVerify = async () => {
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('No authenticated user');
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('verify-recovery-code', {
      body: { code: recoveryCode.trim(), userId: user.id },
    });

    if (error || !data?.success) {
      toast.error('Invalid recovery code', {
        description: data?.error || error?.message || 'Please check the code and try again.',
      });
      setRecoveryCode('');
      setIsLoading(false);
      return;
    }

    toast.success('Recovery code accepted', {
      description: `MFA has been reset. ${data.remainingCodes} recovery codes remaining. You'll need to set up 2FA again.`,
    });

    // Refresh the session so mfaEnrolled updates
    await supabase.auth.refreshSession();
    onVerified();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (useRecovery && recoveryCode.length >= 8) {
        handleRecoveryVerify();
      } else if (!useRecovery && code.length === 6) {
        handleVerify();
      }
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
            {useRecovery ? (
              <KeyRound className="h-6 w-6 text-primary" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle>
            {useRecovery ? 'Use Recovery Code' : 'Two-Factor Authentication'}
          </CardTitle>
          <CardDescription>
            {useRecovery
              ? 'Enter one of your backup recovery codes'
              : 'Enter the 6-digit code from your authenticator app'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {useRecovery ? (
            <div className="space-y-2">
              <Label htmlFor="recovery-code">Recovery Code</Label>
              <Input
                id="recovery-code"
                placeholder="XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                className="text-center text-lg tracking-widest font-mono"
                autoFocus
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="mfa-code">Verification Code</Label>
              <Input
                id="mfa-code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={handleKeyDown}
                maxLength={6}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
                disabled={isLoading}
              />
            </div>
          )}

          <Button
            onClick={useRecovery ? handleRecoveryVerify : handleVerify}
            className="w-full"
            disabled={isLoading || (useRecovery ? recoveryCode.length < 8 : code.length !== 6)}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verify
          </Button>

          <div className="flex flex-col gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setCode('');
                setRecoveryCode('');
              }}
              className="w-full text-sm text-muted-foreground"
              disabled={isLoading}
            >
              {useRecovery ? 'Use authenticator app instead' : 'Lost your authenticator? Use a recovery code'}
            </Button>

            <Button variant="ghost" onClick={onCancel} className="w-full text-sm text-muted-foreground" disabled={isLoading}>
              Sign in with a different account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
