-- Employees table: team leads manage their employee roster
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_lead_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  job_description text,
  department text NOT NULL,
  date_of_hire date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Evaluations table: performance evaluations linked to employees
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name text NOT NULL,
  department text,
  evaluation_date date NOT NULL DEFAULT CURRENT_DATE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  strengths text,
  areas_for_improvement text,
  goals text,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: blanket authenticated access (matches existing project pattern)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full_access" ON employees
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_full_access" ON evaluations
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_employees_team_lead ON employees(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_employee ON evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator ON evaluations(evaluator_id);
