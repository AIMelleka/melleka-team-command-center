import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Lock, ArrowLeft, Mail, CheckCircle, KeyRound } from 'lucide-react';
import mellekaLogo from '@/assets/melleka-logo-dark.png';
import { supabase } from '@/integrations/supabase/client';

type ResetStep = 'email' | 'code' | 'newPassword';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailVerify, setShowEmailVerify] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Countdown timer for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

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

  const API_BASE = import.meta.env.PROD
    ? (import.meta.env.VITE_API_URL || 'https://api.teams.melleka.com/api')
    : '/api';

  const sendOtp = useCallback(async (targetEmail: string) => {
    const res = await fetch(`${API_BASE}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to send code');
    }
    setResendCooldown(60);
  }, [API_BASE]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('Login failed', { description: data.error || 'Invalid email or password' });
        setIsLoading(false);
        return;
      }
    } catch (err: any) {
      toast.error('Login failed', { description: err.message });
      setIsLoading(false);
      return;
    }

    setResendCooldown(60);
    setVerifyEmail(normalizedEmail);
    setShowEmailVerify(true);
    setIsLoading(false);
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailCode.trim()) {
      toast.error('Please enter the verification code');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.verifyOtp({
      email: verifyEmail,
      token: emailCode.trim(),
      type: 'email',
    });

    if (error) {
      toast.error('Invalid or expired code', { description: error.message });
      setIsLoading(false);
      return;
    }

    await redirectAfterLogin();
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    try {
      await sendOtp(verifyEmail);
      toast.success('New code sent to your email');
    } catch (err: any) {
      toast.error('Failed to resend code', { description: err.message });
    }
  };

  const handleCancelVerify = () => {
    setShowEmailVerify(false);
    setVerifyEmail('');
    setEmailCode('');
    setResendCooldown(0);
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
    try {
      const res = await fetch(`${API_BASE}/auth/send-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error('Failed to send reset code', { description: data.error || 'Please try again' });
        setResetLoading(false);
        return;
      }
    } catch (err: any) {
      toast.error('Failed to send reset code', { description: err.message });
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
    // Use updateUser directly — recovery session from verifyOtp allows password updates at AAL1
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error('Failed to update password', { description: error.message });
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

  // Email verification code entry screen
  if (showEmailVerify) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <img src={mellekaLogo} alt="Melleka" className="mb-4 h-12 w-auto" />
            <h1 className="text-2xl font-display font-bold genie-gradient-text text-center">
              Check Your Email
            </h1>
            <p className="text-muted-foreground mt-2 text-sm text-center">
              Enter the 6-digit code sent to {verifyEmail}
            </p>
          </div>

          <form onSubmit={handleVerifyEmailCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-code">Verification Code</Label>
              <Input
                id="email-code"
                type="text"
                placeholder="Enter 6-digit code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
              ) : (
                <><CheckCircle className="mr-2 h-4 w-4" />Verify Code</>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleResendCode}
              disabled={resendCooldown > 0}
            >
              <Mail className="mr-2 h-4 w-4" />
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={handleCancelVerify}>
              <ArrowLeft className="mr-2 h-4 w-4" />Back to login
            </Button>
          </form>
        </div>
      </div>
    );
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
            <img src={mellekaLogo} alt="Melleka" className="mb-4 h-12 w-auto" />
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
          <img src={mellekaLogo} alt="Melleka" className="mb-4 h-12 w-auto" />
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
