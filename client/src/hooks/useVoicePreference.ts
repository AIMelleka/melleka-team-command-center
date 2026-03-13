import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.PROD
  ? "https://server-production-0486.up.railway.app/api"
  : "/api";

const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah
const CACHE_KEY = "voice-preference-id";

export function useVoicePreference() {
  const [voiceId, setVoiceIdState] = useState<string>(
    () => localStorage.getItem(CACHE_KEY) || DEFAULT_VOICE_ID
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
          if (!cancelled && data.voice_id) {
            setVoiceIdState(data.voice_id);
            localStorage.setItem(CACHE_KEY, data.voice_id);
          }
        }
      } catch {
        // Silently fall back to cached/default value
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const setVoiceId = useCallback(async (id: string) => {
    setVoiceIdState(id);
    localStorage.setItem(CACHE_KEY, id);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${API_BASE}/preferences`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ voice_id: id }),
      });
    } catch {
      // Save failed silently — localStorage still has the value
    }
  }, []);

  return { voiceId, setVoiceId, isLoading };
}
