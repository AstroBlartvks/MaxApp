-- Migration to add favorite_photos table for storing user's favorite photos

-- Table to store favorite photos
CREATE TABLE IF NOT EXISTS favorite_photos (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- User who favorited the photo
    photo_id INTEGER NOT NULL REFERENCES art_objects(id) ON DELETE CASCADE,  -- The favorited photo
    favorited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- When the photo was favorited
    UNIQUE(user_id, photo_id)  -- A user can favorite the same photo only once
);

CREATE INDEX IF NOT EXISTS idx_favorite_photos_user_id ON favorite_photos (user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_photos_photo_id ON favorite_photos (photo_id);

-- Grant permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON favorite_photos TO app_user;
GRANT USAGE, SELECT ON SEQUENCE favorite_photos_id_seq TO app_user;

COMMENT ON TABLE favorite_photos IS 'Stores user favorite photos (both owned and imported photos can be favorited).';
COMMENT ON COLUMN favorite_photos.user_id IS 'The user who favorited this photo.';
COMMENT ON COLUMN favorite_photos.photo_id IS 'The photo that was favorited.';
COMMENT ON COLUMN favorite_photos.favorited_at IS 'Timestamp of when the photo was favorited.';
