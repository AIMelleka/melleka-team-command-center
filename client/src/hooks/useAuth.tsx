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

// --- Auth cache: lets returning users see content instantly instead of a spinner ---
const AUTH_CACHE_KEY = 'melleka_auth_cache';

interface CachedAuth {
  isAdmin: boolean;
  mfaEnrolled: boolean;
  mfaVerified: boolean;
  userId: string;
  ts: number;
}

function readAuthCache(): CachedAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAuth;
    // Cache valid for 4 hours
    if (Date.now() - parsed.ts > 4 * 60 * 60 * 1000) return null;
    return parsed;
  } catch { return null; }
}

function writeAuthCache(c: Omit<CachedAuth, 'ts'>) {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ ...c, ts: Date.now() }));
  } catch { /* ignore */ }
}

function clearAuthCache() {
  try { sessionStorage.removeItem(AUTH_CACHE_KEY); } catch { /* ignore */ }
}

// Read Supabase session directly from localStorage (synchronous).
// This lets us render the first frame with the user already set — no spinner flash.
function readSupabaseSessionSync(): { user: User; session: Session } | null {
  try {
    const raw = localStorage.getItem('sb-nhebotmrnxixvcvtspet-auth-token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.user || !parsed?.access_token) return null;
    return { user: parsed.user as User, session: parsed as Session };
  } catch { return null; }
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Hydrate from cache so returning users see content instantly — NO spinner on first frame
  const cachedRef = useRef(readAuthCache());
  const cached = cachedRef.current;
  const syncSession = useRef(readSupabaseSessionSync()).current;

  // If we have both a cached auth state AND a Supabase session in localStorage,
  // start with isLoading=false and user populated. Zero spinner frames.
  const canQuickStart = !!(cached && syncSession && cached.userId === syncSession.user.id);

  const [user, setUser] = useState<User | null>(canQuickStart ? syncSession!.user : null);
  const [session, setSession] = useState<Session | null>(canQuickStart ? syncSession!.session : null);
  const [isAdmin, setIsAdmin] = useState(cached?.isAdmin ?? false);
  const [isLoading, setIsLoading] = useState(!canQuickStart);
  const [mfaEnrolled, setMfaEnrolled] = useState(cached?.mfaEnrolled ?? false);
  const [mfaVerified, setMfaVerified] = useState(cached?.mfaVerified ?? false);

  // Track last confirmed admin status so we don't silently downgrade on transient failures
  const adminStatusRef = useRef(false);

  // Once auth is initially resolved, never flip isLoading back to true.
  // This prevents keep-alive pages from unmounting during background re-auth.
  const initialAuthResolvedRef = useRef(false);

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

  const checkMfaStatus = async (): Promise<{ enrolled: boolean; verified: boolean }> => {
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const enrolled = (factors?.totp?.length ?? 0) > 0;
      let verified = false;

      if (enrolled) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        verified = aal?.currentLevel === 'aal2';
      }

      setMfaEnrolled(enrolled);
      setMfaVerified(verified);
      return { enrolled, verified };
    } catch {
      setMfaEnrolled(false);
      setMfaVerified(false);
      return { enrolled: false, verified: false };
    }
  };

  const refreshMfaStatus = useCallback(async () => {
    await checkMfaStatus();
  }, []);

  // Guard against duplicate concurrent checks (onAuthStateChange + getSession both fire on mount)
  const checkInFlightRef = useRef<Promise<boolean> | null>(null);

  // Helper to run full auth checks, write cache, and update state
  const runFullChecks = async (
    currentUser: User,
    isMounted: () => boolean
  ) => {
    // Deduplicate: if a check is already running for this user, piggyback on it
    if (checkInFlightRef.current) return checkInFlightRef.current;

    const promise = (async () => {
      const [adminStatus, mfa] = await Promise.all([
        checkAdminAccess(currentUser),
        checkMfaStatus(),
      ]);
      if (isMounted()) {
        setIsAdmin(adminStatus);
        adminStatusRef.current = adminStatus;
        writeAuthCache({
          isAdmin: adminStatus,
          mfaEnrolled: mfa.enrolled,
          mfaVerified: mfa.verified,
          userId: currentUser.id,
        });
      }
      return adminStatus;
    })();

    checkInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      checkInFlightRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const mounted = () => isMounted;
    let adminRefreshInterval: ReturnType<typeof setInterval> | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        // TOKEN_REFRESHED fires on every tab focus/visibility change.
        // The Supabase client already has the new token internally for API calls.
        // Updating React state here causes a massive re-render cascade across
        // the entire component tree (30+ keep-alive pages), which looks like a
        // page refresh. Skip it entirely.
        if (event === 'TOKEN_REFRESHED') return;

        // After a tab switch, Supabase can also fire SIGNED_IN (not just
        // TOKEN_REFRESHED) when recovering the session. If we've already
        // resolved auth once and the user ID hasn't changed, treat it the
        // same as TOKEN_REFRESHED — skip the state update to avoid
        // unmounting keep-alive pages.
        if (
          initialAuthResolvedRef.current &&
          event === 'SIGNED_IN' &&
          session?.user?.id === user?.id
        ) {
          // Still refresh admin/mfa in background, but don't touch loading state
          if (session?.user) {
            setTimeout(() => { if (isMounted) runFullChecks(session.user, mounted); }, 0);
          }
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            // If we have a valid cache for this user, skip the blocking spinner
            if (cached && cached.userId === session.user.id) {
              setIsAdmin(cached.isAdmin);
              adminStatusRef.current = cached.isAdmin;
              setMfaEnrolled(cached.mfaEnrolled);
              setMfaVerified(cached.mfaVerified);
              setIsLoading(false);
              initialAuthResolvedRef.current = true;
              // Verify in background
              setTimeout(() => { if (isMounted) runFullChecks(session.user, mounted); }, 0);
              return;
            }
            // No cache — only show spinner if this is the very first auth check.
            // After initial resolution, do checks in background to avoid unmounting pages.
            if (!initialAuthResolvedRef.current) {
              setIsLoading(true);
            }
          }
          setTimeout(() => {
            if (!isMounted) return;
            runFullChecks(session.user, mounted).then(() => {
              if (isMounted) {
                setIsLoading(false);
                initialAuthResolvedRef.current = true;
              }
            });
          }, 0);
        } else {
          setIsAdmin(false);
          adminStatusRef.current = false;
          setMfaEnrolled(false);
          setMfaVerified(false);
          clearAuthCache();
          setIsLoading(false);
          initialAuthResolvedRef.current = true;
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // If we have a valid cache for this user, render immediately and verify in background
        if (cached && cached.userId === session.user.id) {
          setIsAdmin(cached.isAdmin);
          adminStatusRef.current = cached.isAdmin;
          setMfaEnrolled(cached.mfaEnrolled);
          setMfaVerified(cached.mfaVerified);
          setIsLoading(false);
          initialAuthResolvedRef.current = true;
          // Background verify
          runFullChecks(session.user, mounted);
        } else {
          // No cache or different user - wait for full check
          await runFullChecks(session.user, mounted);
          if (isMounted) {
            setIsLoading(false);
            initialAuthResolvedRef.current = true;
          }
        }
      } else {
        clearAuthCache();
        if (isMounted) {
          setIsLoading(false);
          initialAuthResolvedRef.current = true;
        }
      }
    });

    // Periodic admin re-verification every 4 hours to prevent stale status
    adminRefreshInterval = setInterval(async () => {
      if (!isMounted) return;
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        await runFullChecks(currentSession.user, mounted);
      }
    }, 4 * 60 * 60 * 1000);

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
    clearAuthCache();
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
