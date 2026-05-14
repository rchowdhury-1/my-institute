-- Newsfeed posts table

CREATE TABLE IF NOT EXISTS newsfeed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('quote', 'honour_list', 'general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_url TEXT,
  show_on_homepage BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsfeed_published_at ON newsfeed_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsfeed_homepage ON newsfeed_posts(show_on_homepage) WHERE show_on_homepage = true;
