-- Add suspended column to users table for user management

-- Add the suspended column if it doesn't exist
ALTER TABLE users
ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false;

-- Create an index for faster queries on suspended status
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended);

-- Add a comment for documentation
COMMENT ON COLUMN users.suspended IS 'Indicates if the user account is suspended by an admin';
