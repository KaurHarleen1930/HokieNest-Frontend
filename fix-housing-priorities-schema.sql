-- Fix housing_priorities table to match the existing users table schema
-- The users table uses INTEGER user_id, but housing_priorities was created with UUID

-- First, let's check if we need to drop and recreate the table
-- or if we can alter the column type

-- Option 1: Drop and recreate (if no important data exists)
DROP TABLE IF EXISTS housing_priorities;

CREATE TABLE housing_priorities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{"budget": 25, "commute": 25, "safety": 25, "roommates": 25}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- One set of priorities per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX idx_housing_priorities_user_id ON housing_priorities(user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_housing_priorities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_housing_priorities_updated_at 
    BEFORE UPDATE ON housing_priorities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_housing_priorities_updated_at();
