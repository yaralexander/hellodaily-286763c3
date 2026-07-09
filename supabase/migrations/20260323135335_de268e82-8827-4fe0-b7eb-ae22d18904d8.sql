
-- Create food_logs table for storing individual food entries
CREATE TABLE public.food_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meal_type TEXT NOT NULL DEFAULT 'snack',
  food_name TEXT NOT NULL,
  calories INTEGER NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  portion_size TEXT,
  image_url TEXT,
  ai_analysis JSONB,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own food logs" ON public.food_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food logs" ON public.food_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food logs" ON public.food_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food logs" ON public.food_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create storage bucket for food photos
INSERT INTO storage.buckets (id, name, public) VALUES ('food-photos', 'food-photos', true);

-- Storage RLS policies
CREATE POLICY "Users can upload food photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view food photos" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'food-photos');

CREATE POLICY "Users can delete their food photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
