ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_calorie_limit integer NOT NULL DEFAULT 2200,
ADD COLUMN IF NOT EXISTS calorie_input_mode text NOT NULL DEFAULT 'auto';