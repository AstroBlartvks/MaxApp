-- This script contains CREATE TABLE statements for the project's database schema.

-- Table to store user information from the messenger
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY,                      -- User ID from the messenger
    first_name VARCHAR(255) NOT NULL,           -- User's first name
    last_name VARCHAR(255),                     -- User's last name (optional)
    username VARCHAR(255) UNIQUE,               -- User's username (optional, but should be unique if present)
    language_code VARCHAR(10),                  -- User's language code (e.g., 'ru')
    photo_url TEXT,                             -- URL to the user's profile photo (optional)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Timestamp of when the user was first added
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- Timestamp of the user's last activity
);

COMMENT ON TABLE users IS 'Stores information about users from the messenger application.';
COMMENT ON COLUMN users.id IS 'User ID from the messenger, serves as the primary key.';

-- Table to store information about digital art objects
CREATE TABLE IF NOT EXISTS art_objects (
    id SERIAL PRIMARY KEY,                                  -- Unique internal ID for the art object
    owner_id BIGINT NOT NULL REFERENCES users(id),          -- Current owner of the art object
    creator_id BIGINT NOT NULL REFERENCES users(id),        -- The original creator of the art object
    file_id VARCHAR(255) NOT NULL,                          -- File identifier from the messenger or our storage
    file_type VARCHAR(50),                                  -- Type of the file (e.g., 'photo', 'gif')
    is_original BOOLEAN NOT NULL DEFAULT TRUE,              -- Flag to distinguish originals from duplicates
    original_art_id INTEGER REFERENCES art_objects(id),     -- For duplicates, references the original art object
    signature TEXT,                                         -- Digital signature to verify authenticity
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()           -- Timestamp of the art object's creation
);

COMMENT ON TABLE art_objects IS 'Stores digital art objects, including originals and duplicates.';
COMMENT ON COLUMN art_objects.is_original IS 'If TRUE, this is the original art object. If FALSE, it is a duplicate.';
COMMENT ON COLUMN art_objects.original_art_id IS 'A reference to the original art object if this is a duplicate.';


-- Table to log the history of ownership transfers
CREATE TABLE IF NOT EXISTS ownership_history (
    id SERIAL PRIMARY KEY,                                  -- Unique ID for the history record
    art_object_id INTEGER NOT NULL REFERENCES art_objects(id), -- The art object that was transferred
    from_user_id BIGINT REFERENCES users(id),               -- The user who transferred the object (can be NULL for initial creation)
    to_user_id BIGINT NOT NULL REFERENCES users(id),        -- The user who received the object
    transfer_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),       -- Timestamp of the transfer
    transaction_type VARCHAR(50) NOT NULL                   -- Type of transaction (e.g., 'creation', 'transfer', 'sale')
);

COMMENT ON TABLE ownership_history IS 'Logs all ownership changes for art objects.';
COMMENT ON COLUMN ownership_history.from_user_id IS 'The previous owner. NULL for the initial creation event.';

-- Table to store user refresh tokens for JWT authentication
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(512) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens (token);

COMMENT ON TABLE refresh_tokens IS 'Stores refresh tokens for users to maintain persistent sessions.';
COMMENT ON COLUMN refresh_tokens.is_revoked IS 'If TRUE, the token can no longer be used.';

-- Table to manage the state of art object trades
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),          -- Unique identifier for the trade
    art_object_id INTEGER NOT NULL REFERENCES art_objects(id), -- The art object being traded
    sender_id BIGINT NOT NULL REFERENCES users(id),         -- The user initiating the trade
    receiver_id BIGINT,                                     -- The user who scans the QR code (can be NULL initially)
    status VARCHAR(50) NOT NULL DEFAULT 'pending',          -- Status of the trade (e.g., 'pending', 'completed', 'rejected')
    share_token VARCHAR(8),                                -- Short token for grouping multiple trades in a single QR code
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Timestamp of when the trade was initiated
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minute') -- The trade is valid for 5 minutes
);

CREATE INDEX IF NOT EXISTS idx_trades_sender_id ON trades (sender_id);
CREATE INDEX IF NOT EXISTS idx_trades_receiver_id ON trades (receiver_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);
CREATE INDEX IF NOT EXISTS idx_trades_share_token ON trades (share_token);

COMMENT ON TABLE trades IS 'Manages the process of trading art objects between users.';
COMMENT ON COLUMN trades.status IS 'The current status of the trade, e.g., pending, completed, rejected.';
COMMENT ON COLUMN trades.share_token IS 'Short token for grouping multiple trades in a single QR code.';
COMMENT ON COLUMN trades.expires_at IS 'Timestamp indicating when the trade offer expires.';

-- Table to manage pending photo ownership transfers
CREATE TABLE IF NOT EXISTS pending_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),          -- Unique identifier for the transfer request
    photo_id INTEGER NOT NULL REFERENCES art_objects(id),   -- The art object (photo) being transferred
    sharer_id BIGINT NOT NULL REFERENCES users(id),         -- The user who currently owns the photo
    scanner_id BIGINT NOT NULL REFERENCES users(id),        -- The user who scanned the QR and wants to receive the photo
    status VARCHAR(50) NOT NULL DEFAULT 'pending',          -- Status of the transfer (e.g., 'pending', 'accepted', 'rejected')
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Timestamp of when the transfer request was created
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minute') -- The transfer request is valid for 5 minutes
);

CREATE INDEX IF NOT EXISTS idx_pending_transfers_sharer_id ON pending_transfers (sharer_id);
CREATE INDEX IF NOT EXISTS idx_pending_transfers_scanner_id ON pending_transfers (scanner_id);
CREATE INDEX IF NOT EXISTS idx_pending_transfers_status ON pending_transfers (status);

COMMENT ON TABLE pending_transfers IS 'Manages pending requests for photo ownership transfers.';
COMMENT ON COLUMN pending_transfers.status IS 'The current status of the transfer request, e.g., pending, accepted, rejected.';
COMMENT ON COLUMN pending_transfers.expires_at IS 'Timestamp indicating when the transfer request expires.';

-- Table to manage profile view requests
CREATE TABLE IF NOT EXISTS profile_view_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),          -- Unique identifier for the request
    requester_id BIGINT NOT NULL REFERENCES users(id),     -- The user requesting access
    target_id BIGINT NOT NULL REFERENCES users(id),        -- The user whose profile is being requested
    status VARCHAR(50) NOT NULL DEFAULT 'pending',          -- Status: 'pending', 'approved', 'rejected'
    selected_photo_ids INTEGER[],                           -- Array of photo IDs selected when approved
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Timestamp of when the request was created
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hour') -- Request expires after 24 hours
);

CREATE INDEX IF NOT EXISTS idx_profile_view_requests_requester_id ON profile_view_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_requests_target_id ON profile_view_requests (target_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_requests_status ON profile_view_requests (status);
CREATE INDEX IF NOT EXISTS idx_profile_view_requests_expires_at ON profile_view_requests (expires_at);

COMMENT ON TABLE profile_view_requests IS 'Manages requests from users to view other users profiles and selected photos.';
COMMENT ON COLUMN profile_view_requests.requester_id IS 'The user who is requesting access to view the profile.';
COMMENT ON COLUMN profile_view_requests.target_id IS 'The user whose profile is being requested for viewing.';
COMMENT ON COLUMN profile_view_requests.status IS 'Current status of the request: pending, approved, or rejected.';
COMMENT ON COLUMN profile_view_requests.selected_photo_ids IS 'Array of photo IDs that the target user selected to share when approving the request.';
COMMENT ON COLUMN profile_view_requests.expires_at IS 'Timestamp indicating when the request expires (default 24 hours).';

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

COMMENT ON TABLE imported_photos IS 'Stores references to photos that users have imported (requested) from other users profiles.';
COMMENT ON COLUMN imported_photos.user_id IS 'The user who imported/requested this photo.';
COMMENT ON COLUMN imported_photos.photo_id IS 'The photo that was imported.';
COMMENT ON COLUMN imported_photos.imported_at IS 'Timestamp of when the photo was imported.';

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

COMMENT ON TABLE favorite_photos IS 'Stores user favorite photos (both owned and imported photos can be favorited).';
COMMENT ON COLUMN favorite_photos.user_id IS 'The user who favorited this photo.';
COMMENT ON COLUMN favorite_photos.photo_id IS 'The photo that was favorited.';
COMMENT ON COLUMN favorite_photos.favorited_at IS 'Timestamp of when the photo was favorited.';
