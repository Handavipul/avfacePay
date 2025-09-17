SELECT id, email, face_encoding, created_at, updated_at, is_active, last_login, failed_attempts, locked_until
	FROM public.users;

	-- Database migration to add face encoding constraint
-- Run this against your database to add the security constraint

-- Add constraint to ensure face_encoding is never null or empty
ALTER TABLE users ADD CONSTRAINT face_encoding_not_null 
CHECK (face_encoding IS NOT NULL AND face_encoding != '');

-- Optional: Add index for better performance on face encoding queries

-- Optional: Add timestamp for face encoding updates
ALTER TABLE users ADD COLUMN IF NOT EXISTS face_encoding_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create trigger to update face_encoding_updated_at when face_encoding changes
CREATE OR REPLACE FUNCTION update_face_encoding_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.face_encoding IS DISTINCT FROM NEW.face_encoding THEN
        NEW.face_encoding_updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER face_encoding_update_trigger
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_face_encoding_timestamp();

	