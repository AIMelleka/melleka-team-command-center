import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Copy, Check, Shield, AlertTriangle } from 'lucide-react';

interface RecoveryCodesDisplayProps {
  codes: string[];
  onComplete: () => void;
}

export function RecoveryCodesDisplay({ codes, onComplete }: RecoveryCodesDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopyAll = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    toast.success('Recovery codes copied to clipboard');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 p-3 rounded-full bg-destructive/10 w-fit">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle>Save Your Recovery Codes</CardTitle>
        <CardDescription>
          Store these codes somewhere safe. Each code can only be used once. If you lose your authenticator, use one of these codes to regain access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg p-4 font-mono text-sm grid grid-cols-2 gap-2">
          {codes.map((code, i) => (
            <div key={i} className="text-center py-1 px-2 rounded bg-background border">
              {code}
            </div>
          ))}
        </div>

        <Button variant="outline" onClick={handleCopyAll} className="w-full">
          {copied ? <Check className="h-4 w-4 mr-2 text-primary" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy All Codes'}
        </Button>

        <div className="border-t pt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input accent-primary"
            />
            <span className="text-sm text-muted-foreground">
              I have saved these recovery codes in a secure location
            </span>
          </label>
        </div>

        <Button onClick={onComplete} className="w-full" disabled={!confirmed}>
          <Shield className="h-4 w-4 mr-2" />
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

// Generate recovery codes and store hashed versions
export async function generateRecoveryCodes(userId: string): Promise<string[]> {
  const codes: string[] = [];
  
  for (let i = 0; i < 8; i++) {
    const array = new Uint8Array(4);
    crypto.getRandomValues(array);
    const code = Array.from(array)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .match(/.{4}/g)!
      .join('-');
    codes.push(code);
  }

  // Delete old codes first
  await supabase
    .from('mfa_recovery_codes')
    .delete()
    .eq('user_id', userId);

  // Hash and store codes
  const encoder = new TextEncoder();
  const inserts = await Promise.all(
    codes.map(async (code) => {
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(code));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const codeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return { user_id: userId, code_hash: codeHash };
    })
  );

  await supabase.from('mfa_recovery_codes').insert(inserts);

  return codes;
}
