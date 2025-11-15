-- Migration: Add description and tags to art_objects table
-- This adds metadata fields for photo descriptions and tags

-- Add description column
ALTER TABLE art_objects 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add tags column (array of text)
ALTER TABLE art_objects 
ADD COLUMN IF NOT EXISTS tags TEXT[];

COMMENT ON COLUMN art_objects.description IS 'User-provided description of the photo';
COMMENT ON COLUMN art_objects.tags IS 'Array of tags associated with the photo';

-- Create index on tags for faster searching
CREATE INDEX IF NOT EXISTS idx_art_objects_tags ON art_objects USING GIN(tags);
