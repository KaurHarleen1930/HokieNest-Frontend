-- Create roommate chat system tables
-- This migration creates all tables needed for the roommate chat and notification system

-- 1. roommate_connections table
CREATE TABLE IF NOT EXISTS roommate_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'blocked'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(requester_id, recipient_id),
  CHECK (requester_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_requester ON roommate_connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_recipient ON roommate_connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON roommate_connections(status);

-- 2. chat_conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES roommate_connections(id) ON DELETE CASCADE,
  is_group BOOLEAN DEFAULT false,
  group_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(connection_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_connection ON chat_conversations(connection_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON chat_conversations(last_message_at DESC);

-- 3. chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message_text TEXT,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'file', 'image', 'document'
  file_url TEXT,
  file_name VARCHAR(255),
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON chat_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON chat_messages(sender_id);

-- 4. message_read_receipts table
CREATE TABLE IF NOT EXISTS message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_read_receipts_message ON message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user ON message_read_receipts(user_id);

-- 5. typing_indicators table
CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_typing_conversation ON typing_indicators(conversation_id);

-- 6. user_online_status table
CREATE TABLE IF NOT EXISTS user_online_status (
  user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_online_status_last_seen ON user_online_status(last_seen DESC);

-- 7. notifications table (General notification system)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- 'connection_request', 'message', 'match_found', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_id VARCHAR(255), -- ID of related entity (connection_id, message_id, etc.)
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);

-- 8. notification_preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  email_messages BOOLEAN DEFAULT true,
  email_connections BOOLEAN DEFAULT true,
  email_matches BOOLEAN DEFAULT true,
  in_app_messages BOOLEAN DEFAULT true,
  in_app_connections BOOLEAN DEFAULT true,
  in_app_matches BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. conversation_participants table (for group chats)
CREATE TABLE IF NOT EXISTS conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON conversation_participants(user_id);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_roommate_connections_updated_at 
    BEFORE UPDATE ON roommate_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at 
    BEFORE UPDATE ON chat_conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_messages_updated_at 
    BEFORE UPDATE ON chat_messages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at 
    BEFORE UPDATE ON notification_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to clean up expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS void AS $$
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$ language 'plpgsql';

-- Create function to clean up old typing indicators (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_typing_indicators()
RETURNS void AS $$
BEGIN
    DELETE FROM typing_indicators 
    WHERE started_at < NOW() - INTERVAL '5 minutes';
END;
$$ language 'plpgsql';
