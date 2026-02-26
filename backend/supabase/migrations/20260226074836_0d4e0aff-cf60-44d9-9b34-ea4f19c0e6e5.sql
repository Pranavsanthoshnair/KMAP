-- Create capsules table (public read)
CREATE TABLE public.capsules (
  id TEXT NOT NULL PRIMARY KEY,
  concept TEXT NOT NULL,
  grade INTEGER NOT NULL DEFAULT 1,
  difficulty INTEGER NOT NULL DEFAULT 1,
  core_idea TEXT NOT NULL,
  rule TEXT NOT NULL,
  example TEXT NOT NULL,
  pattern TEXT NOT NULL,
  practice TEXT NOT NULL,
  practice_answer TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT 'math',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.capsules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Capsules are publicly readable" ON public.capsules FOR SELECT USING (true);
