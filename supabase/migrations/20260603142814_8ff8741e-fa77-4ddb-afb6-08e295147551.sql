
-- food_scans
CREATE TABLE public.food_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('barcode','package','meal')),
  source TEXT,
  barcode TEXT,
  product_name TEXT NOT NULL DEFAULT 'Unknown',
  brand TEXT,
  image_url TEXT,
  nutrition JSONB NOT NULL DEFAULT '{}'::jsonb,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  nova_group INTEGER,
  additives TEXT[] NOT NULL DEFAULT '{}',
  health_score INTEGER NOT NULL DEFAULT 0,
  score_category TEXT NOT NULL DEFAULT 'moderate',
  positives JSONB NOT NULL DEFAULT '[]'::jsonb,
  concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  ingredient_intelligence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary TEXT,
  coach_tip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_scans TO authenticated;
GRANT ALL ON public.food_scans TO service_role;

ALTER TABLE public.food_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select scans" ON public.food_scans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert scans" ON public.food_scans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update scans" ON public.food_scans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own delete scans" ON public.food_scans FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_food_scans_user_created ON public.food_scans(user_id, created_at DESC);

-- wellness_points
CREATE TABLE public.wellness_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  scan_id UUID REFERENCES public.food_scans(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wellness_points TO authenticated;
GRANT ALL ON public.wellness_points TO service_role;

ALTER TABLE public.wellness_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own select points" ON public.wellness_points FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert points" ON public.wellness_points FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete points" ON public.wellness_points FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_wellness_points_user_created ON public.wellness_points(user_id, created_at DESC);
