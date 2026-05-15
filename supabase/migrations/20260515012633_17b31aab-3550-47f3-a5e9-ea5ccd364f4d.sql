
-- 1. Add series column with default and rebuild unique constraint
ALTER TABLE public.ssc_board_papers
  ADD COLUMN IF NOT EXISTS series text NOT NULL DEFAULT 'March'
  CHECK (series IN ('March', 'July'));

-- Drop old unique constraint (year, subject) if it exists; replace with (year, subject, series)
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.ssc_board_papers'::regclass
     AND contype = 'u'
   LIMIT 1;
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.ssc_board_papers DROP CONSTRAINT %I', c);
  END IF;
END$$;

ALTER TABLE public.ssc_board_papers
  ADD CONSTRAINT ssc_board_papers_year_subject_series_key UNIQUE (year, subject, series);

-- 2. Seed missing (year, subject, series) rows for both series
INSERT INTO public.ssc_board_papers (year, subject, series, title, content)
SELECT y, s, ser,
  'Maharashtra SSC Board ' || ser || ' ' || y || ' — ' || s,
  ''
FROM generate_series(2015, 2026) AS y
CROSS JOIN unnest(ARRAY['English','Mathematics 1','Mathematics 2','Science 1','Science 2']) AS s
CROSS JOIN unnest(ARRAY['March','July']) AS ser
ON CONFLICT (year, subject, series) DO NOTHING;

-- 3. Default access pass: askify@boardintell
UPDATE public.ssc_access_passes SET is_active = false WHERE is_active = true;
INSERT INTO public.ssc_access_passes (code_hash, label, is_active)
VALUES (encode(digest('askify@boardintell', 'sha256'), 'hex'), 'Default', true);
