-- Migration: Add contact_link field to users table
-- Contact link is a custom URL for contacting the user (shown in public profile)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS contact_link TEXT;

COMMENT ON COLUMN users.contact_link IS 'Custom contact link (e.g., social media, messaging app) shown in public profile. If NULL, user ID is displayed instead.';
