import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, ArrowLeft, Mail, CheckCircle, KeyRound } from 'lucide-react';
import GenieLamp from '@/components/icons/GenieLamp';
import { supabase } from '@/integrations/supabase/client';
import { MFAVerify } from '@/components/MFAVerify';
import { MFA_EXEMPT_EMAILS } from '@/lib/mfaConfig';

type ResetStep = 'email' | 'code' | 'newPassword';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showMFA, setShowMFA] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
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

    // Check if user has MFA enrolled (skip for exempt accounts)
    const userEmail = normalizedEmail;

    if (!MFA_EXEMPT_EMAILS.includes(userEmail)) {
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

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(
      resetEmail.trim().toLowerCase()
    );

    if (error) {
      toast.error('Failed to send reset code', { description: error.message });
      setResetLoading(false);
      return;
    }

    toast.success('Check your email for a reset code');
    setResetStep('code');
    setResetLoading(false);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      toast.error('Please enter the code from your email');
      return;
    }

    setResetLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: resetEmail.trim().toLowerCase(),
      token: resetCode.trim(),
      type: 'recovery',
    });

    if (error) {
      toast.error('Invalid or expired code', { description: error.message });
      setResetLoading(false);
      return;
    }

    setResetStep('newPassword');
    setResetLoading(false);
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setResetLoading(true);
    const { data, error } = await supabase.functions.invoke('reset-password', {
      body: { password: newPassword },
    });

    if (error || !data?.success) {
      toast.error('Failed to update password', { description: error?.message || data?.error });
      setResetLoading(false);
      return;
    }

    await supabase.auth.signOut();
    toast.success('Password updated! Please sign in.');
    exitReset();
  };

  const exitReset = () => {
    setShowForgotPassword(false);
    setResetStep('email');
    setResetEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetLoading(false);
  };

  if (showMFA) {
    return <MFAVerify onVerified={handleMFAVerified} onCancel={handleMFACancel} />;
  }

  if (showForgotPassword) {
    const stepSubtitle = {
      email: "Enter your email and we'll send you a code",
      code: `Enter the code sent to ${resetEmail}`,
      newPassword: 'Choose a new password',
    }[resetStep];

    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <GenieLamp size={48} className="mb-4 animate-float" />
            <h1 className="text-2xl font-display font-bold genie-gradient-text text-center">
              Reset Password
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">{stepSubtitle}</p>
          </div>

          {resetStep === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  disabled={resetLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
                ) : (
                  <><Mail className="mr-2 h-4 w-4" />Send Reset Code</>
                )}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={exitReset}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back to login
              </Button>
            </form>
          )}

          {resetStep === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-code">Reset Code</Label>
                <Input
                  id="reset-code"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  required
                  disabled={resetLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                ) : (
                  <><KeyRound className="mr-2 h-4 w-4" />Verify Code</>
                )}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={exitReset}>
                <ArrowLeft className="mr-2 h-4 w-4" />Back to login
              </Button>
            </form>
          )}

          {resetStep === 'newPassword' && (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={resetLoading}
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={resetLoading}
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
                ) : (
                  <><CheckCircle className="mr-2 h-4 w-4" />Update Password</>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    );
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
                onClick={() => setShowForgotPassword(true)}
              >
                Forgot your password?
              </button>
            </div>
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
