import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.PROD
  ? "https://server-production-0486.up.railway.app/api"
  : "/api";

const DEFAULT_MODEL_ID = "claude-opus-4-6";
const CACHE_KEY = "model-preference-id";

export function useModelPreference() {
  const [modelId, setModelIdState] = useState<string>(
    () => localStorage.getItem(CACHE_KEY) || DEFAULT_MODEL_ID
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
          if (!cancelled && data.model_id) {
            setModelIdState(data.model_id);
            localStorage.setItem(CACHE_KEY, data.model_id);
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

  const setModelId = useCallback(async (id: string) => {
    setModelIdState(id);
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
        body: JSON.stringify({ model_id: id }),
      });
    } catch {
      // Save failed silently — localStorage still has the value
    }
  }, []);

  return { modelId, setModelId, isLoading };
}
