-- SQL Migration to create chatbot_conversations table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    current_page VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_session_id ON chatbot_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_user_id ON chatbot_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_conversations_created_at ON chatbot_conversations(created_at);

-- Query examples:
-- 1. Get all conversations for a user
-- SELECT * FROM chatbot_conversations WHERE user_id = 24 ORDER BY created_at DESC;

-- 2. Get all conversations in a session
-- SELECT * FROM chatbot_conversations WHERE session_id = 'session-xyz' ORDER BY created_at;

-- 3. Get conversation statistics
-- SELECT 
--   COUNT(*) as total_conversations,
--   COUNT(DISTINCT session_id) as unique_sessions,
--   COUNT(DISTINCT user_id) as unique_users
-- FROM chatbot_conversations;


