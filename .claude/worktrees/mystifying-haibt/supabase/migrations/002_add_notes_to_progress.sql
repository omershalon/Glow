-- Add user-written notes column to progress_photos
ALTER TABLE public.progress_photos
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
