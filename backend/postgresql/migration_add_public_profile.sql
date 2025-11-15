-- Migration: Add is_public_profile field to users table
-- Public profile allows all photos to be viewed without permission requests

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.is_public_profile IS 'If TRUE, all users photos are publicly accessible without permission requests. Photo-level is_public checks are bypassed.';

-- Create index for filtering public profiles
CREATE INDEX IF NOT EXISTS idx_users_is_public_profile ON users (is_public_profile);
