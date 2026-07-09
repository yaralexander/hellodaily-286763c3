# Evolution to AI Nutrition App (no redesign)

The current visual identity — watercolor background, glassmorphism cards, bottom nav, floating Scan button, gradients, typography — stays exactly as-is. This plan re-focuses copy, structure and a few new surfaces around the Goal Fit Score™ / "Before You Eat AI™" positioning. All new UI reuses existing `glass-card`, spacing, and gradient classes.

## What already exists (keep, just repositioned)
- `NutritionGoalPicker` + 13 goals in `useNutritionGoal` — matches the required goal list exactly. Reuse.
- `goalFit.ts` + `computeGoalFit` in scan pipeline — already produces 0–100 per goal. Reuse.
- Scan flow (barcode/package/meal), `ScanResult` with strengths/concerns/recommendation/daily impact — already matches the "AI Analysis Result" spec. Small copy/labels update only.
- Bottom nav + central Scan button — untouched.

## Changes

### 1. Goal Fit Score™ language (copy only, no visual change)
- Replace "good / bad / healthy / unhealthy" wording across scan UI and AI prompt with the 5 fit tiers: Excellent / Good / Moderate / Weak / Poor Fit.
- Add a small `goalFitTier(score)` helper and use it in `ScanResult.tsx` header + `ScanHistory` list badges.
- Update `aiAnalyze.ts` system prompt: forbid moral labels, require fit-tier framing and tie summary to the user's goal.

### 2. Dashboard becomes nutrition-first
`src/pages/Dashboard.tsx`:
- Reorder sections so today's Nutrition card + Goal Fit summary + Weight progress sit at the top.
- Demote (do not delete) sleep / HR / yoga / generic wellness widgets to a collapsed "More" section lower on the page.
- Add a compact `TodayGoalCard` (glass-card, existing style) showing: current goal chip, calories remaining, P/C/F remaining, and last scan's Goal Fit tier.

### 3. "Before You Eat AI™" surfacing
- On `ScanResult.tsx`, above the current CTA row, add a small `BeforeYouEatPreview` panel (reuses the existing preview totals we already compute) framed as: "Before You Eat — projected impact on today & this week."
- Add a subtitle/tag on the Scan page hero: "Before You Eat AI™ — know in 5 seconds if it fits your goal."
- No new endpoints; uses existing scan analysis + `daily_metrics` totals already queried.

### 4. Weight management (new, minimal)
- Migration: add `current_weight_kg`, `target_weight_kg`, `weekly_goal_kg` to `profiles` (nullable; grants unchanged, RLS already scoped by `user_id`).
- New table `weight_logs (id, user_id, date, weight_kg)` with standard user-scoped RLS + GRANTs.
- New `WeightProgressCard` (glass-card) on Dashboard + Profile: current → target, weekly trend sparkline (reuse `ActivityChart` styling), estimated target date (linear projection from last 4 weeks of logs).
- Simple "Log weight" sheet reusing existing dialog/glass styling.

### 5. Scan menu additions
`src/pages/Scan.tsx` / scan sheet:
- Add "Voice Input" and "Text Input" tiles alongside existing Barcode / Package / Meal, styled identically to current tiles.
- Text Input → reuses existing `analyze-food-text` edge function.
- Voice Input → records via MediaRecorder, transcribes through a new `transcribe-voice` edge function (Lovable AI `openai/gpt-4o-mini-transcribe`), then pipes text into `analyze-food-text`. Same result screen.

### 6. Scan history + AI copy polish
- `ScanHistory` list rows show Goal Fit tier + score for the active goal (already stored per-scan).
- AI prompt updated to always end with a non-judgmental, coach-style single-sentence recommendation.

## Explicitly NOT changing
- Design system, tokens, gradients, glass styling, rounded corners, animations.
- Bottom nav structure and routes.
- Central floating Scan button.
- Existing habits/labs/coach/notes features (kept, just demoted on Dashboard).
- Theme system, language system, auth flow, onboarding.

## Technical notes
- New files: `src/lib/goalFitTier.ts`, `src/components/dashboard/TodayGoalCard.tsx`, `src/components/dashboard/WeightProgressCard.tsx`, `src/components/scan/BeforeYouEatPreview.tsx`, `src/components/weight/LogWeightSheet.tsx`, `src/hooks/useWeight.ts`, `supabase/functions/transcribe-voice/index.ts`.
- Migrations: extend `profiles`, create `weight_logs` with `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;` and per-user RLS policies.
- No changes to `client.ts`, `types.ts`, or design tokens.
