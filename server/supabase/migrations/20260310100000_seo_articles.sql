-- Saved SEO articles (similar to decks table pattern)
CREATE TABLE IF NOT EXISTS seo_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  primary_keyword text,
  article_type text NOT NULL DEFAULT 'prompt',
  content text NOT NULL DEFAULT '',
  meta_title text,
  meta_description text,
  word_count integer DEFAULT 0,
  settings jsonb DEFAULT '{}'::jsonb,
  scores jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_articles_user_date ON seo_articles(user_id, created_at DESC);
CREATE INDEX idx_seo_articles_slug ON seo_articles(slug);

ALTER TABLE seo_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to seo_articles" ON seo_articles FOR ALL USING (true) WITH CHECK (true);
