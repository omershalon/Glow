-- Make storage buckets public so images load without signed URLs
UPDATE storage.buckets SET public = true WHERE id IN ('progress-photos', 'skin-photos');
