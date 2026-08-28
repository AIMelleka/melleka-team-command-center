-- Store verified Supermetrics platform metrics separately from AI-generated analysis.
-- Scoring uses this column exclusively for 100% accurate numbers.
ALTER TABLE ad_review_history
  ADD COLUMN IF NOT EXISTS verified_platforms JSONB DEFAULT '[]';
