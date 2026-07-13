-- Add client matching rule columns to managed_clients
ALTER TABLE managed_clients
  ADD COLUMN match_aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN match_exclude_patterns text[] NOT NULL DEFAULT '{}',
  ADD COLUMN match_exact_only boolean NOT NULL DEFAULT false;

-- Seed existing hardcoded data for Global Guard Insurance Services
UPDATE managed_clients
SET match_aliases = ARRAY['ggis', 'global guard', 'global guard insurance', 'global guardins'],
    match_exclude_patterns = ARRAY['gsp', 'global staffing partners'],
    match_exact_only = true
WHERE lower(client_name) LIKE '%global guard%';

-- Seed existing hardcoded data for Global Staffing Partners
UPDATE managed_clients
SET match_aliases = ARRAY['gsp', 'global staffing partners'],
    match_exclude_patterns = ARRAY['ggis', 'global guard', 'global guard insurance', 'global guardins'],
    match_exact_only = true
WHERE lower(client_name) LIKE '%global staffing%';
