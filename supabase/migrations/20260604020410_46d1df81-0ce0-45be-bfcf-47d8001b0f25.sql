
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nutrition_goal TEXT NOT NULL DEFAULT 'balanced';

ALTER TABLE public.food_scans
  ADD COLUMN IF NOT EXISTS goal_fit_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_at_scan TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS allergens TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS personalized_recommendation TEXT,
  ADD COLUMN IF NOT EXISTS things_to_know JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_food_scans_user_score ON public.food_scans(user_id, health_score DESC);
CREATE INDEX IF NOT EXISTS idx_food_scans_user_goal ON public.food_scans(user_id, goal_at_scan);
