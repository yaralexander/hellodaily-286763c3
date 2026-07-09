
-- Create daily_metrics table for steps, sleep, heart rate
CREATE TABLE public.daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER NOT NULL DEFAULT 0,
  step_goal INTEGER NOT NULL DEFAULT 10000,
  calories_burned INTEGER NOT NULL DEFAULT 0,
  calorie_burn_goal INTEGER NOT NULL DEFAULT 2500,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  active_minutes_goal INTEGER NOT NULL DEFAULT 60,
  resting_heart_rate INTEGER,
  sleep_hours NUMERIC NOT NULL DEFAULT 0,
  sleep_score INTEGER,
  sleep_goal_hours NUMERIC NOT NULL DEFAULT 8,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own daily metrics" ON public.daily_metrics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily metrics" ON public.daily_metrics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily metrics" ON public.daily_metrics
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_daily_metrics_updated_at
  BEFORE UPDATE ON public.daily_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
