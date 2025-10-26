-- Create chatbot_conversations table to store all chatbot interactions
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    current_page VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes for faster queries
    INDEX idx_chatbot_conversations_session_id (session_id),
    INDEX idx_chatbot_conversations_user_id (user_id),
    INDEX idx_chatbot_conversations_created_at (created_at)
);
