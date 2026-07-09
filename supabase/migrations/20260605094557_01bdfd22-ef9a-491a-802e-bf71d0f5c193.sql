ALTER TABLE public.food_scans ADD COLUMN IF NOT EXISTS added_at timestamptz;
CREATE INDEX IF NOT EXISTS food_scans_user_added_at_idx ON public.food_scans(user_id, added_at) WHERE added_at IS NOT NULL;