import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.PROD
  ? "https://server-production-0486.up.railway.app/api"
  : "/api";

const CACHE_KEY = "getting-started-dismissed";

export function useGettingStarted() {
  const [dismissed, setDismissed] = useState<boolean>(
    () => localStorage.getItem(CACHE_KEY) === "true"
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(`${API_BASE}/preferences`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            const val = !!data.getting_started_dismissed;
            setDismissed(val);
            localStorage.setItem(CACHE_KEY, String(val));
          }
        }
      } catch {
        // Fall back to cached/default value
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const dismiss = useCallback(async () => {
    setDismissed(true);
    localStorage.setItem(CACHE_KEY, "true");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/preferences/dismiss-getting-started`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch {
      // Dismiss persisted locally even if server call fails
    }
  }, []);

  return { gettingStartedDismissed: dismissed, dismissGettingStarted: dismiss, isLoading };
}
