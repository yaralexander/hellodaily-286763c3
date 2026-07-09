
-- Drop public SELECT on food-photos; replace with owner-only
DROP POLICY IF EXISTS "Anyone can view food photos" ON storage.objects;
CREATE POLICY "Users can view their own food photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add UPDATE policy for food-photos
CREATE POLICY "Users can update their own food photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'food-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Add WITH CHECK to avatars UPDATE policy
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Restrict avatars SELECT to authenticated (no public listing)
DROP POLICY IF EXISTS "Public avatar read access" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.get_habit_streak(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
