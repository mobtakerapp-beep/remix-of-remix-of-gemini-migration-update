-- Run this once in the Supabase SQL editor.
-- Student results submitted from a shared lesson link.
CREATE TABLE IF NOT EXISTS public.lesson_share_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_token text NOT NULL,
  student_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_share_results_token_idx
  ON public.lesson_share_results (share_token, created_at DESC);

GRANT INSERT ON public.lesson_share_results TO anon;
GRANT SELECT, INSERT ON public.lesson_share_results TO authenticated;
GRANT ALL ON public.lesson_share_results TO service_role;

ALTER TABLE public.lesson_share_results ENABLE ROW LEVEL SECURITY;

-- Anyone holding the link (even signed out) can submit their own result,
-- but only for a share token that really exists.
DROP POLICY IF EXISTS "Anyone can submit a result" ON public.lesson_share_results;
CREATE POLICY "Anyone can submit a result"
ON public.lesson_share_results FOR INSERT TO anon, authenticated
WITH CHECK (char_length(share_token) >= 6 AND char_length(student_name) BETWEEN 1 AND 60);

-- Only the teacher who owns the shared lesson can read the results.
DROP POLICY IF EXISTS "Share owners can read results" ON public.lesson_share_results;
CREATE POLICY "Share owners can read results"
ON public.lesson_share_results FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lesson_shares s
    WHERE s.token = share_token AND s.user_id = auth.uid()
  )
);
