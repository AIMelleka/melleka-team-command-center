export interface Employee {
  id: string;
  team_lead_id: string;
  name: string;
  job_description: string | null;
  department: string;
  date_of_hire: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  employee_id: string | null;
  evaluator_id: string;
  employee_name: string;
  department: string | null;
  evaluation_date: string;
  rating: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals: string | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
}
