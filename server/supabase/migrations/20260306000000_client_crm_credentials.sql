-- Per-client CRM credentials table
-- Ensures CRM integrations are strictly isolated per client
CREATE TABLE IF NOT EXISTS client_crm_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  crm_provider text NOT NULL DEFAULT 'servis',
  client_id text NOT NULL,
  client_secret text NOT NULL,
  base_url text NOT NULL DEFAULT 'https://freeagent.network',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_name, crm_provider)
);

-- Insert Sin City's Servis CRM credentials
INSERT INTO client_crm_credentials (client_name, crm_provider, client_id, client_secret)
VALUES ('Sin City', 'servis', 'f47ec1a7-c5f9-454b-96fa-bb626377ba66', 'fa-secret-80B1D9E5D1E501EDF90759')
ON CONFLICT (client_name, crm_provider) DO NOTHING;
