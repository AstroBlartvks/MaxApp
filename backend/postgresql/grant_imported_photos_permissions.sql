-- Grant permissions for imported_photos table to app_user
-- Run this if you get "permission denied for table imported_photos" error

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON imported_photos TO app_user;

-- Grant sequence permissions
GRANT USAGE, SELECT ON SEQUENCE imported_photos_id_seq TO app_user;

-- Verify permissions
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name='imported_photos';

SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_usage_grants 
WHERE object_name='imported_photos_id_seq';
