import { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  mfaEnrolled: boolean;
  mfaVerified: boolean;
  refreshMfaStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);

  // Track last confirmed admin status so we don't silently downgrade on transient failures
  const adminStatusRef = useRef(false);

  const checkAdminAccess = async (currentUser: User, retries = 2): Promise<boolean> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const timeout = 15000 + attempt * 5000; // 15s, 20s, 25s
        const timeoutPromise = new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Admin check timed out')), timeout)
        );

        const checkPromise = supabase.rpc('has_role', {
          _user_id: currentUser.id,
          _role: 'admin'
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error checking admin role:', error);
            throw error;
          }
          return data === true;
        });

        const result = await Promise.race([checkPromise, timeoutPromise]);
        adminStatusRef.current = result;
        return result;
      } catch (err) {
        console.warn(`Admin check attempt ${attempt + 1}/${retries + 1} failed:`, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // backoff: 1s, 2s
        }
      }
    }
    // All retries exhausted - keep last known status instead of silently downgrading
    console.warn('All admin check attempts failed, keeping last known status:', adminStatusRef.current);
    return adminStatusRef.current;
  };

  const checkMfaStatus = async () => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const enrolled = (factors?.totp?.length ?? 0) > 0;
      setMfaEnrolled(enrolled);

      if (enrolled) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        setMfaVerified(aal?.currentLevel === 'aal2');
      } else {
        setMfaVerified(false);
      }
    } catch {
      setMfaEnrolled(false);
      setMfaVerified(false);
    }
  };

  const refreshMfaStatus = useCallback(async () => {
    await checkMfaStatus();
  }, []);

  useEffect(() => {
    let isMounted = true;
    let adminRefreshInterval: ReturnType<typeof setInterval> | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Keep isLoading true while we verify admin status so ProtectedRoute
          // shows a spinner instead of briefly flashing "Access Denied".
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            setIsLoading(true);
          }
          // On TOKEN_REFRESHED, re-verify admin status in the background
          // On SIGNED_IN or INITIAL_SESSION, do full check
          setTimeout(() => {
            if (!isMounted) return;
            Promise.all([
              checkAdminAccess(session.user),
              checkMfaStatus(),
            ]).then(([adminStatus]) => {
              if (isMounted) {
                setIsAdmin(adminStatus);
                adminStatusRef.current = adminStatus;
                setIsLoading(false);
              }
            });
          }, 0);
        } else {
          setIsAdmin(false);
          adminStatusRef.current = false;
          setMfaEnrolled(false);
          setMfaVerified(false);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const [adminStatus] = await Promise.all([
          checkAdminAccess(session.user),
          checkMfaStatus(),
        ]);
        if (isMounted) {
          setIsAdmin(adminStatus);
          adminStatusRef.current = adminStatus;
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    });

    // Periodic admin re-verification every 30 minutes to prevent stale status
    adminRefreshInterval = setInterval(async () => {
      if (!isMounted) return;
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        const adminStatus = await checkAdminAccess(currentSession.user);
        if (isMounted) {
          setIsAdmin(adminStatus);
          adminStatusRef.current = adminStatus;
        }
      }
    }, 30 * 60 * 1000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (adminRefreshInterval) clearInterval(adminRefreshInterval);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setMfaEnrolled(false);
    setMfaVerified(false);
  }, []);

  const value = useMemo(() => ({
    user, session, isAdmin, isLoading, mfaEnrolled, mfaVerified, refreshMfaStatus, signIn, signOut
  }), [user, session, isAdmin, isLoading, mfaEnrolled, mfaVerified, refreshMfaStatus, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
