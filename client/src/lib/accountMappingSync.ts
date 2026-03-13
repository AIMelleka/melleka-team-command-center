import { supabase } from '@/integrations/supabase/client';

/**
 * Purge stale cached data and trigger regeneration after a client's
 * ad account mappings change. This ensures Daily Reports, Client Health,
 * and PPC snapshots reflect the new account immediately.
 */
export async function syncAfterMappingChange(clientName: string): Promise<{
  purged: { reports: number; snapshots: number };
  regenerating: boolean;
}> {
  // Clear self-referencing FK before deleting (previous_review_id)
  await supabase
    .from('ad_review_history')
    .update({ previous_review_id: null })
    .eq('client_name', clientName);

  // Delete stale daily reports
  const { count: reportCount } = await supabase
    .from('ad_review_history')
    .delete({ count: 'exact' })
    .eq('client_name', clientName);

  // Delete stale PPC snapshots
  const { count: snapshotCount } = await supabase
    .from('ppc_daily_snapshots')
    .delete({ count: 'exact' })
    .eq('client_name', clientName);

  // Fire-and-forget: regenerate today's report for this client
  supabase.functions
    .invoke('bulk-ad-review', { body: { clientName } })
    .catch(console.error);

  // Fire-and-forget: refresh PPC snapshots (processes all clients, fast)
  supabase.functions
    .invoke('auto-fetch-ppc', {})
    .catch(console.error);

  return {
    purged: { reports: reportCount ?? 0, snapshots: snapshotCount ?? 0 },
    regenerating: true,
  };
}
