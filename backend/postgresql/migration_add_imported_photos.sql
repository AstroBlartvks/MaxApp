-- Migration to add imported_photos table for storing references to photos imported by users

-- Table to store imported photos (references to other users' photos)
CREATE TABLE IF NOT EXISTS imported_photos (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- User who imported the photo
    photo_id INTEGER NOT NULL REFERENCES art_objects(id) ON DELETE CASCADE,  -- The imported photo
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When the photo was imported
    UNIQUE(user_id, photo_id)  -- A user can only import the same photo once
);

CREATE INDEX IF NOT EXISTS idx_imported_photos_user_id ON imported_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_imported_photos_photo_id ON imported_photos (photo_id);

-- Grant permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON imported_photos TO app_user;
GRANT USAGE, SELECT ON SEQUENCE imported_photos_id_seq TO app_user;

COMMENT ON TABLE imported_photos IS 'Stores references to photos that users have imported (requested) from other users profiles.';
COMMENT ON COLUMN imported_photos.user_id IS 'The user who imported/requested this photo.';
COMMENT ON COLUMN imported_photos.photo_id IS 'The photo that was imported.';
COMMENT ON COLUMN imported_photos.imported_at IS 'Timestamp of when the photo was imported.';
