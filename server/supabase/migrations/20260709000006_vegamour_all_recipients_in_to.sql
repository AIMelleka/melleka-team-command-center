-- Claude inconsistently omits the cc field. Put all 3 recipients in to: directly.
-- from: field removed entirely — tools.ts now enforces FROM_EMAIL server-side.
-- Also clear dedup.

UPDATE team_cron_jobs
SET task = replace(
  task,
  $OLD$To: anthony@mellekamarketing.com
CC: bryan@mellekamarketing.com, david@mellekamarketing.com$OLD$,
  $NEW$To: anthony@mellekamarketing.com, bryan@mellekamarketing.com, david@mellekamarketing.com$NEW$
)
WHERE name = 'Auto Client Update: Vegamour - Daily ROAS';

UPDATE auto_client_updates
SET last_sent_at = NULL
WHERE client_name = 'Vegamour - Daily ROAS';
