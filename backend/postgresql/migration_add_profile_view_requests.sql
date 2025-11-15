-- Create table for profile view requests
-- This table manages requests from users to view other users' profiles/photos

CREATE TABLE IF NOT EXISTS profile_view_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),          -- Unique identifier for the request
    requester_id BIGINT NOT NULL REFERENCES users(id),     -- The user requesting access
    target_id BIGINT NOT NULL REFERENCES users(id),        -- The user whose profile is being requested
    status VARCHAR(50) NOT NULL DEFAULT 'pending',          -- Status: 'pending', 'approved', 'rejected'
    selected_photo_ids INTEGER[],                           -- Array of photo IDs selected when approved
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),          -- Timestamp of when the request was created
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hour') -- Request expires after 24 hours
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_profile_view_requests_requester_id ON profile_view_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_requests_target_id ON profile_view_requests (target_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_requests_status ON profile_view_requests (status);
CREATE INDEX IF NOT EXISTS idx_profile_view_requests_expires_at ON profile_view_requests (expires_at);

-- Add comments for documentation
COMMENT ON TABLE profile_view_requests IS 'Manages requests from users to view other users profiles and selected photos.';
COMMENT ON COLUMN profile_view_requests.requester_id IS 'The user who is requesting access to view the profile.';
COMMENT ON COLUMN profile_view_requests.target_id IS 'The user whose profile is being requested for viewing.';
COMMENT ON COLUMN profile_view_requests.status IS 'Current status of the request: pending, approved, or rejected.';
COMMENT ON COLUMN profile_view_requests.selected_photo_ids IS 'Array of photo IDs that the target user selected to share when approving the request.';
COMMENT ON COLUMN profile_view_requests.expires_at IS 'Timestamp indicating when the request expires (default 24 hours).';
