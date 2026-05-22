CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_public_order
  ON videos (published, sort_order, created_at);

INSERT INTO videos (
  id,
  title,
  description,
  video_url,
  thumbnail_url,
  sort_order,
  published
)
SELECT
  'seed-youth-onboarding-waitlist',
  'Adding your child to a waitlist',
  'Youth Onboarding tutorial video',
  'https://isfc.uk/r/yo-tutorial-2',
  '',
  0,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM videos WHERE id = 'seed-youth-onboarding-waitlist'
);
