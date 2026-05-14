
-- 1. Board papers
CREATE TABLE public.ssc_board_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL CHECK (year BETWEEN 2010 AND 2035),
  subject text NOT NULL CHECK (subject IN ('English','Mathematics 1','Mathematics 2','Science 1','Science 2')),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  pdf_url text,
  is_featured boolean NOT NULL DEFAULT false,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, subject)
);
ALTER TABLE public.ssc_board_papers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view papers"
  ON public.ssc_board_papers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can insert papers"
  ON public.ssc_board_papers FOR INSERT
  WITH CHECK (public.is_owner_or_admin(auth.uid()));

CREATE POLICY "Owners can update papers"
  ON public.ssc_board_papers FOR UPDATE
  USING (public.is_owner_or_admin(auth.uid()));

CREATE POLICY "Owners can delete papers"
  ON public.ssc_board_papers FOR DELETE
  USING (public.is_owner_or_admin(auth.uid()));

CREATE TRIGGER ssc_board_papers_updated
  BEFORE UPDATE ON public.ssc_board_papers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Cached analyses
CREATE TABLE public.ssc_paper_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  paper_ids uuid[] NOT NULL DEFAULT '{}',
  repeated_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  chapter_weightage jsonb NOT NULL DEFAULT '{}'::jsonb,
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  important_concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ssc_paper_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view analyses"
  ON public.ssc_paper_analyses FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Owners manage analyses"
  ON public.ssc_paper_analyses FOR ALL
  USING (public.is_owner_or_admin(auth.uid()))
  WITH CHECK (public.is_owner_or_admin(auth.uid()));

-- Allow edge function (with service role) to insert via owner-or-admin? For caching from client we need authenticated insert.
CREATE POLICY "Authenticated can insert analyses"
  ON public.ssc_paper_analyses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Access passes
CREATE TABLE public.ssc_access_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL,
  label text NOT NULL DEFAULT 'Default',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ssc_access_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage access passes"
  ON public.ssc_access_passes FOR ALL
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));

-- 4. Paper views (history)
CREATE TABLE public.ssc_paper_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paper_id uuid NOT NULL REFERENCES public.ssc_board_papers(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ssc_paper_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own history"
  ON public.ssc_paper_views FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own history"
  ON public.ssc_paper_views FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own history"
  ON public.ssc_paper_views FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_ssc_paper_views_user ON public.ssc_paper_views(user_id, viewed_at DESC);

-- 5. Verify access pass function (returns boolean; client never sees hash)
CREATE OR REPLACE FUNCTION public.verify_ssc_access_pass(_code text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found boolean;
BEGIN
  IF _code IS NULL OR length(_code) = 0 THEN RETURN false; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.ssc_access_passes
    WHERE is_active = true AND code_hash = encode(digest(_code, 'sha256'),'hex')
  ) INTO found;
  RETURN found;
END;
$$;

-- pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 6. Set / rotate access pass (owner only)
CREATE OR REPLACE FUNCTION public.set_ssc_access_pass(_code text, _label text DEFAULT 'Default')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner(auth.uid()) THEN RETURN false; END IF;
  IF _code IS NULL OR length(_code) < 4 THEN RETURN false; END IF;

  UPDATE public.ssc_access_passes SET is_active = false WHERE is_active = true;
  INSERT INTO public.ssc_access_passes (code_hash, label, is_active, created_by)
  VALUES (encode(digest(_code, 'sha256'),'hex'), _label, true, auth.uid());
  RETURN true;
END;
$$;

-- 7. Seed placeholder rows for 2015..2026 × 5 subjects
INSERT INTO public.ssc_board_papers (year, subject, title)
SELECT y, s, 'SSC Board ' || y || ' — ' || s
FROM generate_series(2015, 2026) AS y
CROSS JOIN unnest(ARRAY['English','Mathematics 1','Mathematics 2','Science 1','Science 2']) AS s
ON CONFLICT (year, subject) DO NOTHING;
