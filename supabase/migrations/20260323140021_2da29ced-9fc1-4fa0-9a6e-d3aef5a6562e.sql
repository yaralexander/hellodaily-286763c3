
-- Create lab_results table
CREATE TABLE public.lab_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Lab Results',
  file_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_analysis JSONB,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lab results" ON public.lab_results
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own lab results" ON public.lab_results
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own lab results" ON public.lab_results
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own lab results" ON public.lab_results
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket for lab PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('lab-files', 'lab-files', false);

CREATE POLICY "Users can upload lab files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lab-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view their own lab files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'lab-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own lab files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'lab-files' AND (storage.foldername(name))[1] = auth.uid()::text);
