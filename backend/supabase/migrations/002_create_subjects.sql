-- ================================================================
-- KMAP Subjects table (canonical subject IDs and labels)
-- Run after 001_create_resources.sql
-- ================================================================

CREATE TABLE IF NOT EXISTS subjects (
  id    TEXT PRIMARY KEY,   -- canonical id e.g. math, science, english
  label TEXT NOT NULL       -- display label e.g. Mathematics, Science
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subjects are publicly readable"
  ON subjects FOR SELECT
  USING (true);

-- Seed canonical subjects
INSERT INTO subjects (id, label) VALUES
  ('math', 'Mathematics'),
  ('science', 'Science'),
  ('english', 'English')
ON CONFLICT (id) DO NOTHING;
