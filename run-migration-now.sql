-- ============================================
-- MIGRATION: Make connection_id nullable
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- This allows property inquiry conversations without requiring a roommate connection

-- Step 1: Drop the UNIQUE constraint on connection_id (since multiple property inquiries can have null)
ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_connection_id_key;

-- Step 2: Drop the foreign key constraint temporarily
ALTER TABLE chat_conversations 
DROP CONSTRAINT IF EXISTS chat_conversations_connection_id_fkey;

-- Step 3: Make connection_id nullable
ALTER TABLE chat_conversations 
ALTER COLUMN connection_id DROP NOT NULL;

-- Step 4: Re-add the foreign key constraint, but allow NULL values
-- (Foreign keys in PostgreSQL automatically allow NULL unless otherwise specified)
ALTER TABLE chat_conversations 
ADD CONSTRAINT chat_conversations_connection_id_fkey 
FOREIGN KEY (connection_id) 
REFERENCES roommate_connections(id) 
ON DELETE CASCADE;

-- Step 5: Create a partial unique index that only applies to non-null connection_ids
-- This ensures that each connection can only have one conversation, but allows multiple nulls
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_conversations_connection_id_unique 
ON chat_conversations(connection_id) 
WHERE connection_id IS NOT NULL;

-- Step 6: Add a comment to document why connection_id can be null
COMMENT ON COLUMN chat_conversations.connection_id IS 
'Connection ID for roommate connections. NULL for property inquiry conversations that don''t require a roommate connection.';

-- ✅ Migration complete! You can now create property inquiry conversations.

