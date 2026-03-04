import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield, Copy, Check } from 'lucide-react';
import { RecoveryCodesDisplay, generateRecoveryCodes } from './RecoveryCodesDisplay';
import { useAuth } from '@/hooks/useAuth';

interface EnrollMFAProps {
  onEnrolled: () => void;
  onCancelled?: () => void;
  hideCancelButton?: boolean;
}

export function EnrollMFA({ onEnrolled, onCancelled, hideCancelButton }: EnrollMFAProps) {
  const { user } = useAuth();
  const [factorId, setFactorId] = useState('');
  const [qr, setQR] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(true);
  const [copied, setCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });
      if (error) {
        toast.error('Failed to start MFA enrollment', { description: error.message });
        return;
      }
      setFactorId(data.id);
      setQR(data.totp.qr_code);
      setSecret(data.totp.secret);
      setIsEnrolling(false);
    })();
  }, []);

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    setIsLoading(true);
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      toast.error('Challenge failed', { description: challengeError.message });
      setIsLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });

    if (verifyError) {
      toast.error('Verification failed', { description: verifyError.message });
      setIsLoading(false);
      return;
    }

    // Generate recovery codes after successful enrollment
    if (user) {
      const codes = await generateRecoveryCodes(user.id);
      setRecoveryCodes(codes);
    }
    
    toast.success('Two-factor authentication enabled!');
    setIsLoading(false);
  };

  // Show recovery codes after successful verification
  if (recoveryCodes) {
    return (
      <RecoveryCodesDisplay
        codes={recoveryCodes}
        onComplete={onEnrolled}
      />
    );
  }

  if (isEnrolling) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 p-3 rounded-full bg-primary/10 w-fit">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Set Up Two-Factor Authentication</CardTitle>
        <CardDescription>
          Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <img src={qr} alt="MFA QR Code" className="rounded-lg border bg-white p-2" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Can't scan? Enter this code manually:</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted p-2 rounded font-mono break-all select-all">
              {secret}
            </code>
            <Button variant="ghost" size="icon" onClick={handleCopySecret} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="verify-code">Verification Code</Label>
          <Input
            id="verify-code"
            placeholder="Enter 6-digit code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            maxLength={6}
            className="text-center text-lg tracking-widest"
            disabled={isLoading}
          />
        </div>

        <div className={hideCancelButton ? '' : 'flex gap-3'}>
          {!hideCancelButton && (
            <Button variant="outline" onClick={onCancelled} className="flex-1" disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button onClick={handleVerify} className="flex-1" disabled={isLoading || verifyCode.length !== 6}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verify & Enable
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
