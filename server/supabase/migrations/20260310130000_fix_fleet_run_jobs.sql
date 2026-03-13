-- Add mode column to fleet_run_jobs
ALTER TABLE fleet_run_jobs ADD COLUMN IF NOT EXISTS mode text DEFAULT 'full';

-- Replace append_fleet_results to handle both string and object inputs,
-- and atomically increment progress counter
CREATE OR REPLACE FUNCTION append_fleet_results(job_uuid uuid, new_results jsonb)
RETURNS void AS $$
DECLARE
  parsed jsonb;
  item_count integer;
BEGIN
  -- Handle case where new_results contains stringified JSON (legacy callers)
  IF jsonb_typeof(new_results) = 'array' AND jsonb_array_length(new_results) > 0
     AND jsonb_typeof(new_results->0) = 'string' THEN
    -- First element is a string, try parsing it as JSON
    parsed := (new_results->>0)::jsonb;
  ELSE
    parsed := new_results;
  END IF;

  -- Count items being added
  IF jsonb_typeof(parsed) = 'array' THEN
    item_count := jsonb_array_length(parsed);
  ELSE
    item_count := 1;
    parsed := jsonb_build_array(parsed);
  END IF;

  -- Atomically append results AND increment progress
  UPDATE fleet_run_jobs
  SET results = results || parsed,
      progress = progress + item_count
  WHERE id = job_uuid;
END;
$$ LANGUAGE plpgsql;
