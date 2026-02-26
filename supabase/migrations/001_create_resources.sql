-- ================================================================
-- KMAP Resource Table Migration
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ================================================================

CREATE TABLE IF NOT EXISTS resources (
  id            TEXT PRIMARY KEY,
  subject       TEXT NOT NULL,            -- math | science | english
  grade         INT  NOT NULL,            -- 1–5 (grade band)
  subtopic      TEXT NOT NULL,            -- e.g. "cell_structure"
  difficulty    INT  NOT NULL DEFAULT 2,  -- 1 easy | 2 medium | 3 hard
  type          TEXT NOT NULL,            -- pdf | video | text
  title         TEXT NOT NULL,
  thumbnail_url TEXT,
  storage_path  TEXT NOT NULL,            -- Supabase Storage path
  size_kb       INT  NOT NULL DEFAULT 0,
  preview_text  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Indices for fast allocation filtering
CREATE INDEX IF NOT EXISTS idx_resources_subject  ON resources(subject);
CREATE INDEX IF NOT EXISTS idx_resources_grade    ON resources(grade);
CREATE INDEX IF NOT EXISTS idx_resources_subtopic ON resources(subtopic);
CREATE INDEX IF NOT EXISTS idx_resources_type     ON resources(type);

-- Enable Row Level Security
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read resources
CREATE POLICY "Authenticated users can read resources"
  ON resources FOR SELECT
  TO authenticated
  USING (true);

-- ================================================================
-- Sample seed data (replace storage_path with real Supabase paths)
-- ================================================================

INSERT INTO resources (id, subject, grade, subtopic, difficulty, type, title, storage_path, size_kb, preview_text)
VALUES
  ('r001', 'science', 2, 'cell_structure',   1, 'text', 'Introduction to Cell Structure',  'science/cell_intro.txt',       12,  'Cells are the basic unit of life...'),
  ('r002', 'science', 2, 'cell_structure',   2, 'pdf',  'Cell Biology Workbook',            'science/cell_workbook.pdf',     320, 'Practice problems on organelles...'),
  ('r003', 'science', 2, 'photosynthesis',   1, 'text', 'How Plants Make Food',             'science/photosynthesis.txt',    18,  'Photosynthesis converts sunlight...'),
  ('r004', 'science', 2, 'photosynthesis',   2, 'pdf',  'Photosynthesis Diagrams',          'science/photo_diagrams.pdf',    240, 'Step-by-step reaction diagrams...'),
  ('r005', 'science', 2, 'human_body',       1, 'text', 'The Human Organ Systems',          'science/organ_systems.txt',     22,  'The human body has 11 systems...'),
  ('r006', 'science', 3, 'genetics',         2, 'pdf',  'DNA and Heredity Guide',           'science/genetics.pdf',          450, 'Mendel''s laws and modern genetics...'),
  ('r007', 'science', 3, 'genetics',         3, 'pdf',  'Advanced Genetics Problems',       'science/genetics_adv.pdf',      380, 'Punnett squares and probability...'),
  ('r008', 'science', 3, 'chemical_reactions',2,'pdf', 'Reaction Types Summary',            'science/reactions.pdf',         210, 'Oxidation, reduction, acid-base...'),
  ('r009', 'science', 4, 'electricity',      2, 'pdf',  'Circuits and Ohm''s Law',          'science/circuits.pdf',          290, 'Voltage, current, and resistance...'),
  ('r010', 'science', 1, 'basic_biology',    1, 'text', 'Living Things Around Us',          'science/living_things.txt',     8,   'Plants and animals need food...'),
  ('r011', 'math',    1, 'arithmetic',       1, 'text', 'Addition and Subtraction Facts',   'math/arithmetic_basic.txt',     10,  'Adding and subtracting numbers...'),
  ('r012', 'math',    2, 'fractions',        1, 'text', 'Understanding Fractions',          'math/fractions_intro.txt',      14,  'A fraction represents a part...'),
  ('r013', 'math',    2, 'fractions',        2, 'pdf',  'Fraction Practice Worksheets',    'math/fractions_ws.pdf',         180, '50 practice problems on fractions...'),
  ('r014', 'math',    2, 'geometry',         1, 'text', 'Shapes and Their Properties',      'math/geometry_shapes.txt',      16,  'Triangles, squares, circles...'),
  ('r015', 'math',    2, 'geometry',         2, 'pdf',  'Geometry Problem Set',            'math/geometry_problems.pdf',    220, 'Area, perimeter, and volume...'),
  ('r016', 'math',    3, 'algebra',          2, 'pdf',  'Algebra Essentials',              'math/algebra.pdf',              340, 'Variables, equations, expressions...'),
  ('r017', 'math',    3, 'algebra',          3, 'pdf',  'Advanced Algebra Challenges',     'math/algebra_adv.pdf',          390, 'Quadratic equations and factoring...'),
  ('r018', 'math',    4, 'trigonometry',     2, 'pdf',  'Trig Ratios and Applications',    'math/trigonometry.pdf',         410, 'Sine, cosine, tangent explained...'),
  ('r019', 'math',    4, 'statistics',       1, 'text', 'Mean, Median, Mode Guide',        'math/statistics.txt',           12,  'How to find the average...'),
  ('r020', 'math',    5, 'calculus',         3, 'pdf',  'Introduction to Calculus',        'math/calculus_intro.pdf',       520, 'Derivatives and integrals...'),
  ('r021', 'english', 1, 'parts_of_speech',  1, 'text', 'Nouns, Verbs, and Adjectives',   'english/parts_speech.txt',      11,  'Every sentence has a subject...'),
  ('r022', 'english', 2, 'figures_of_speech',1, 'text', 'Simile and Metaphor Guide',      'english/figures.txt',           13,  'Similes use "like" or "as"...'),
  ('r023', 'english', 2, 'figures_of_speech',2, 'pdf',  'Figures of Speech Workbook',     'english/figures_wb.pdf',        200, '30 examples with exercises...'),
  ('r024', 'english', 3, 'literary_devices', 2, 'pdf',  'Literary Devices Handbook',      'english/literary.pdf',          310, 'Irony, foreshadowing, personification...'),
  ('r025', 'english', 4, 'advanced_writing', 3, 'pdf',  'Essay Writing Masterclass',      'english/essay.pdf',             480, 'Thesis, argument, rhetoric...')
ON CONFLICT (id) DO NOTHING;
