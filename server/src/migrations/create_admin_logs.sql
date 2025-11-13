-- Create admin_activity_logs table for audit trail
-- Tracks all administrative actions for security and compliance

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  target_user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_admin_logs_admin_id ON admin_activity_logs(admin_id);
CREATE INDEX idx_admin_logs_target_user_id ON admin_activity_logs(target_user_id);
CREATE INDEX idx_admin_logs_action ON admin_activity_logs(action);
CREATE INDEX idx_admin_logs_created_at ON admin_activity_logs(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE admin_activity_logs IS 'Audit trail of all administrative actions';
COMMENT ON COLUMN admin_activity_logs.admin_id IS 'ID of the admin who performed the action';
COMMENT ON COLUMN admin_activity_logs.action IS 'Type of action performed (suspend_user, unsuspend_user, delete_user, etc.)';
COMMENT ON COLUMN admin_activity_logs.target_user_id IS 'ID of the user affected by the action (if applicable)';
COMMENT ON COLUMN admin_activity_logs.details IS 'Additional context about the action (JSON format)';
COMMENT ON COLUMN admin_activity_logs.ip_address IS 'IP address from which the action was performed';
COMMENT ON COLUMN admin_activity_logs.user_agent IS 'Browser/client user agent string';
