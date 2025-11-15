-- Migration: Add is_public field to art_objects table
-- Public photos can be viewed by anyone who has access to the owner's profile

ALTER TABLE art_objects 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN art_objects.is_public IS 'If TRUE, this photo is publicly available to anyone with profile access. If FALSE, requires explicit permission.';

-- Create index for filtering public photos
CREATE INDEX IF NOT EXISTS idx_art_objects_is_public ON art_objects (owner_id, is_public);
