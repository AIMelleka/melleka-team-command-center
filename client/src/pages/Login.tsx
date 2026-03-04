import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock } from 'lucide-react';
import GenieLamp from '@/components/icons/GenieLamp';
import { supabase } from '@/integrations/supabase/client';
import { MFAVerify } from '@/components/MFAVerify';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const redirectAfterLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: isAdminUser } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      toast.success('Welcome back!');
      setTimeout(() => {
        navigate(isAdminUser ? '/client-health' : '/user', { replace: true });
      }, 100);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const { error, data } = await supabase.auth.signInWithPassword({ 
      email: normalizedEmail, 
      password 
    });

    if (error) {
      toast.error('Login failed', { description: error.message });
      setIsLoading(false);
      return;
    }

    // Check if user has MFA enrolled (skip for AI service account)
    const userEmail = normalizedEmail;
    const mfaExemptEmails = ['ai@mellekamarketing.com'];
    
    if (!mfaExemptEmails.includes(userEmail)) {
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (!aalError && aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
        // User has MFA enabled, need to verify
        setShowMFA(true);
        setIsLoading(false);
        return;
      }
    }

    // No MFA required, proceed
    await redirectAfterLogin();
  };

  const handleMFAVerified = async () => {
    await redirectAfterLogin();
  };

  const handleMFACancel = async () => {
    await supabase.auth.signOut();
    setShowMFA(false);
    setEmail('');
    setPassword('');
  };

  if (showMFA) {
    return <MFAVerify onVerified={handleMFAVerified} onCancel={handleMFACancel} />;
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 overflow-y-auto">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <GenieLamp size={48} className="mb-4 animate-float" />
          <h1 className="text-2xl font-display font-bold genie-gradient-text text-center">
            Sign In
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Sign in to access the Content Hub
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Sign In
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
