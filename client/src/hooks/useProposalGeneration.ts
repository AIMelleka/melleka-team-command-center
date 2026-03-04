import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface JobStatus {
  id: string;
  status: 'processing' | 'complete' | 'failed';
  progress: number;
  progress_message: string | null;
  result: { proposal: Record<string, unknown> } | null;
  error: string | null;
  updated_at: string;
}

interface UseProposalGenerationReturn {
  isGenerating: boolean;
  progress: number;
  progressMessage: string;
  error: string | null;
  startGeneration: (params: Record<string, unknown>) => Promise<{ proposal: Record<string, unknown> } | null>;
  cancelGeneration: () => void;
  retryGeneration: () => void;
}

export function useProposalGeneration(): UseProposalGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<Record<string, unknown> | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollingActiveRef = useRef<boolean>(false);
  const lastSyncTimestampRef = useRef<string | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    pollingActiveRef.current = false;
    activeJobIdRef.current = null;
    lastSyncTimestampRef.current = null;
    
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }, []);

  // Combined Realtime + Polling for bulletproof sync
  const startJobSync = useCallback((jobId: string): Promise<JobStatus> => {
    return new Promise((resolve, reject) => {
      activeJobIdRef.current = jobId;
      pollingActiveRef.current = true;
      let pollInterval = 2000;
      let pollTimeoutId: number | null = null;
      let resolved = false;

      const handleJobUpdate = (job: JobStatus) => {
        // Only update if this data is newer than what we have
        if (lastSyncTimestampRef.current && 
            new Date(job.updated_at) <= new Date(lastSyncTimestampRef.current)) {
          return; // Skip stale data
        }

        lastSyncTimestampRef.current = job.updated_at;
        setProgress(job.progress || 0);
        setProgressMessage(job.progress_message || 'Processing...');

        // Reset poll interval when we get fresh data
        pollInterval = 2000;

        if (job.status === 'complete' && !resolved) {
          resolved = true;
          cleanup();
          resolve(job);
        } else if (job.status === 'failed' && !resolved) {
          resolved = true;
          cleanup();
          reject(new Error(job.error || 'Proposal generation failed'));
        }
      };

      // 1. Primary: Realtime subscription for instant updates
      realtimeChannelRef.current = supabase
        .channel(`job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'proposal_generation_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            console.log('[Realtime] Job update received:', payload.new);
            handleJobUpdate(payload.new as JobStatus);
          }
        )
        .subscribe((status) => {
          console.log('[Realtime] Subscription status:', status);
        });

      // 2. Fallback: Polling with exponential backoff
      const poll = async () => {
        if (!pollingActiveRef.current || resolved) return;

        try {
          const { data, error: fetchError } = await supabase
            .from('proposal_generation_jobs')
            .select('id, status, progress, progress_message, result, error, updated_at')
            .eq('id', jobId)
            .single();

          if (fetchError) {
            console.error('[Polling] Error fetching job:', fetchError);
          } else if (data) {
            handleJobUpdate(data as JobStatus);
          }

          // Backoff if polling (no new data via realtime)
          if (!resolved && pollingActiveRef.current) {
            pollInterval = Math.min(pollInterval * 1.5, 10000);
            pollTimeoutId = setTimeout(poll, pollInterval) as unknown as number;
          }
        } catch (e) {
          console.error('[Polling] Exception:', e);
          if (!resolved && pollingActiveRef.current) {
            pollTimeoutId = setTimeout(poll, pollInterval) as unknown as number;
          }
        }
      };

      // Start initial poll immediately
      poll();

      // Timeout after 5 minutes
      const timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (pollTimeoutId) clearTimeout(pollTimeoutId);
          reject(new Error('Proposal generation timed out after 5 minutes'));
        }
      }, 5 * 60 * 1000);

      // Store cleanup for abort
      abortControllerRef.current = new AbortController();
      abortControllerRef.current.signal.addEventListener('abort', () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (pollTimeoutId) clearTimeout(pollTimeoutId);
          clearTimeout(timeoutId);
          reject(new Error('Generation cancelled'));
        }
      });
    });
  }, [cleanup]);

  const startGeneration = useCallback(async (params: Record<string, unknown>) => {
    setIsGenerating(true);
    setProgress(0);
    setProgressMessage('Initializing...');
    setError(null);
    setLastParams(params);
    cleanup();

    try {
      setProgress(2);
      setProgressMessage('Connecting to generation service...');
      
      // Call the async function
      const { data, error: invokeError } = await supabase.functions.invoke('generate-proposal-async', {
        body: params,
      });

      if (invokeError) {
        console.error('Invoke error:', invokeError);
        throw new Error(invokeError.message || 'Failed to start generation');
      }

      // Check for immediate failure
      if (!data?.success && data?.error) {
        throw new Error(data.error);
      }

      // If we got a direct result (fast completion - rare with quality model)
      if (data?.result?.proposal) {
        setProgress(100);
        setProgressMessage('Proposal generated successfully!');
        return data.result;
      }

      // If we have a job_id, start realtime + polling sync
      if (data?.job_id) {
        console.log('Job started:', data.job_id);
        setProgress(5);
        setProgressMessage('Processing proposal in background...');
        
        const completedJob = await startJobSync(data.job_id);
        
        if (completedJob.result) {
          return completedJob.result as { proposal: Record<string, unknown> };
        }
        
        // If no result in completed job, fetch it fresh
        console.log('Fetching completed job result...');
        const { data: freshJob, error: fetchError } = await supabase
          .from('proposal_generation_jobs')
          .select('result')
          .eq('id', data.job_id)
          .single();
        
        if (fetchError) {
          console.error('Error fetching job result:', fetchError);
          throw new Error('Failed to retrieve completed proposal');
        }
          
        if (freshJob?.result) {
          return freshJob.result as { proposal: Record<string, unknown> };
        }
        
        throw new Error('Proposal generation completed but no result found');
      }

      throw new Error('Generation started but no job ID returned');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Proposal generation error:', err);
      return null;
    } finally {
      setIsGenerating(false);
      cleanup();
    }
  }, [startJobSync, cleanup]);

  const cancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    cleanup();
    setIsGenerating(false);
    setProgress(0);
    setProgressMessage('');
    setError(null);
  }, [cleanup]);

  const retryGeneration = useCallback(() => {
    if (lastParams) {
      startGeneration(lastParams);
    }
  }, [lastParams, startGeneration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isGenerating,
    progress,
    progressMessage,
    error,
    startGeneration,
    cancelGeneration,
    retryGeneration,
  };
}
