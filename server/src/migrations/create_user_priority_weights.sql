-- Create user_priority_weights table
CREATE TABLE IF NOT EXISTS user_priority_weights (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    budget_weight DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    location_weight DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    lifestyle_weight DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    pets_weight DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    timing_weight DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    work_weight DECIMAL(5,2) NOT NULL DEFAULT 14.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure weights sum to 100%
    CONSTRAINT weights_sum_to_100 CHECK (
        ABS((budget_weight + location_weight + lifestyle_weight + pets_weight + timing_weight + work_weight) - 100.00) < 0.01
    ),
    
    -- Ensure each weight is between 0 and 100
    CONSTRAINT budget_weight_range CHECK (budget_weight >= 0 AND budget_weight <= 100),
    CONSTRAINT location_weight_range CHECK (location_weight >= 0 AND location_weight <= 100),
    CONSTRAINT lifestyle_weight_range CHECK (lifestyle_weight >= 0 AND lifestyle_weight <= 100),
    CONSTRAINT pets_weight_range CHECK (pets_weight >= 0 AND pets_weight <= 100),
    CONSTRAINT timing_weight_range CHECK (timing_weight >= 0 AND timing_weight <= 100),
    CONSTRAINT work_weight_range CHECK (work_weight >= 0 AND work_weight <= 100),
    
    -- One set of weights per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_priority_weights_user_id ON user_priority_weights(user_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_priority_weights_updated_at 
    BEFORE UPDATE ON user_priority_weights 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default weights for existing users (optional)
-- This can be run separately if needed
/*
INSERT INTO user_priority_weights (user_id, budget_weight, location_weight, lifestyle_weight, pets_weight, timing_weight, work_weight)
SELECT 
    user_id,
    20.00,
    18.00,
    18.00,
    15.00,
    15.00,
    14.00
FROM users 
WHERE user_id NOT IN (SELECT user_id FROM user_priority_weights)
AND is_admin = false;
*/
