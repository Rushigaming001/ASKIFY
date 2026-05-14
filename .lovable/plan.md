# SSC Board Paper Intelligence

A new premium module added to the existing Paper Generator app (`src/pages/PaperApp.tsx`) that ingests Maharashtra SSC board papers (2015–2026), analyzes them with AI, and produces realistic predicted papers + "most repeated" insights.

## Scope

5 subjects: English, Mathematics 1, Mathematics 2, Science 1, Science 2. Years 2015–2026.

## Architecture

```text
PaperApp (existing)
└── new tab: "Board Intelligence"
    ├── 🔒 Access Pass gate (blur + unlock)
    ├── Board Papers tab        → year × subject grid, view/download/copy/analyze
    ├── Repeated Questions tab  → AI-extracted, chapter-grouped, confidence scored
    ├── Predictor tab           → "2027 Prediction Mode" generator
    ├── History tab             → recently opened papers
    └── Owner Settings (hidden) → pass mgmt, upload/remove papers, featured toggle
```

## Data model

New DB tables (RLS: public read, owner-only write):

- `ssc_board_papers` — `id, year (2015–2026), subject, title, content (text), pdf_url?, is_featured, uploaded_by, created_at`
- `ssc_paper_analyses` — cached AI output: `id, paper_ids[], subject, repeated_questions (jsonb), trends (jsonb), chapter_weightage (jsonb), generated_at`
- `ssc_access_passes` — `id, code_hash, label, is_active, created_by`
- `ssc_paper_views` — per-user history: `id, user_id, paper_id, viewed_at`

Plus a `public.verify_ssc_access_pass(code text)` SECURITY DEFINER function so client never sees the hash.

## AI engine

New edge function `ssc-intelligence` with actions:
- `analyze` — given a subject + paper texts, returns `{repeatedQuestions[], chapterWeightage{}, trends[], importantConcepts[]}` as strict JSON via Lovable AI Gateway (`google/gemini-2.5-flash` for speed, falls back to Groq).
- `predict` — given subject + analysis + target year, generates a realistic SSC-style paper (reuses existing multi-AI orchestration in `test-generator` with a richer prompt).
- `inject-styles` — adds "Did You Know? / Fun Fact / Challenge / Board Trick / Examiner Favorite / Memory Trick" question variants into a generated paper.

All real AI calls — no placeholder logic. Outputs cached in `ssc_paper_analyses` to save credits.

## UI

New `src/pages/BoardIntelligence.tsx` route `/board-intelligence` + entry tab inside PaperApp.

Components in `src/components/board-intel/`:
- `AccessPassGate.tsx` — blurred preview + unlock dialog, persists unlock in localStorage (`ssc.access.v1`) after server-verified.
- `BoardPapersGrid.tsx` — year filter chips (2015–2026), subject tabs, search; cards with View / Download PDF / Copy / Analyze.
- `PaperViewerDialog.tsx` — full text + actions, logs to `ssc_paper_views`.
- `RepeatedQuestionsPanel.tsx` — chapter-grouped list, frequency badges ("Asked 5×", "High Probability", "Most Expected"), confidence bar.
- `PredictorPanel.tsx` — "2027 Prediction Mode" with subject picker, runs AI predict, shows result with download.
- `HistoryPanel.tsx` — recent views from DB.
- `OwnerSettingsPanel.tsx` — visible only to `yenurkarrajabhau@gmail.com` / owner role: rotate access pass, upload paper (paste text + optional PDF link), delete, mark featured, toggle premium mode.

Design: glassmorphism cards, dark-mode first, smooth framer-motion entrance, mobile-first grid (1 col → 2 → 3).

## Seed data

Seed migration inserts placeholder rows for every (year, subject) pair (2015–2026 × 5 = 60) with `content = ''` and `is_featured = false`, so the grid renders immediately. Owner uploads real text via the settings panel — the AI analyzer skips empty papers and reports coverage.

## Files

**New**
- `supabase/migrations/<ts>_ssc_board_intelligence.sql` — 4 tables + RLS + verify function + seed
- `supabase/functions/ssc-intelligence/index.ts`
- `src/pages/BoardIntelligence.tsx`
- `src/components/board-intel/AccessPassGate.tsx`
- `src/components/board-intel/BoardPapersGrid.tsx`
- `src/components/board-intel/PaperViewerDialog.tsx`
- `src/components/board-intel/RepeatedQuestionsPanel.tsx`
- `src/components/board-intel/PredictorPanel.tsx`
- `src/components/board-intel/HistoryPanel.tsx`
- `src/components/board-intel/OwnerSettingsPanel.tsx`
- `src/lib/sscIntel.ts` — client wrapper (analyze, predict, list, upload, verify pass)

**Edited**
- `src/App.tsx` — add `/board-intelligence` route
- `src/pages/PaperApp.tsx` — add "Board Intelligence" entry button/tab linking to new page
- `supabase/config.toml` — register `ssc-intelligence` function

## Out of scope / honest limits

- Real PDFs of past board papers are not bundled — owner uploads text content (or PDF URL) via the settings panel. Until uploaded, the grid shows empty cards marked "Awaiting upload" and analysis explicitly says "insufficient sample data for year X". This avoids fake placeholder analysis.
- Access pass uses a hashed code stored in DB; verification is server-side via the SECURITY DEFINER function.

Confirm and I'll build it.