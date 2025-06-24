-- New features SQL setup
-- Run this to add support for reports, modmail, panic mode, feedback, and case management

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reported_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    moderator_id TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Modmail threads table
CREATE TABLE IF NOT EXISTS modmail_threads (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(guild_id, user_id)
);

-- Panic mode table
CREATE TABLE IF NOT EXISTS panic_mode (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT FALSE,
    activated_by TEXT NOT NULL,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE,
    reason TEXT
);

-- Feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Case management table (enhanced)
CREATE TABLE IF NOT EXISTS moderation_cases (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    case_type TEXT NOT NULL CHECK (case_type IN ('warn', 'mute', 'kick', 'ban', 'timeout', 'note')),
    reason TEXT,
    duration_minutes INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    case_number INTEGER NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reports_guild_id ON reports(guild_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_modmail_guild_user ON modmail_threads(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_panic_guild ON panic_mode(guild_id);
CREATE INDEX IF NOT EXISTS idx_feedback_guild ON feedback(guild_id);
CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON moderation_cases(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cases_number ON moderation_cases(guild_id, case_number);

-- Grant permissions to service_role
GRANT ALL PRIVILEGES ON TABLE reports TO service_role;
GRANT ALL PRIVILEGES ON TABLE modmail_threads TO service_role;
GRANT ALL PRIVILEGES ON TABLE panic_mode TO service_role;
GRANT ALL PRIVILEGES ON TABLE feedback TO service_role;
GRANT ALL PRIVILEGES ON TABLE moderation_cases TO service_role;

-- Grant sequence permissions
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Enable RLS (Row Level Security) for data protection
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE modmail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE panic_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_cases ENABLE ROW LEVEL SECURITY;

-- Create policies for service_role to access all data
CREATE POLICY "Service role can access all reports" ON reports FOR ALL USING (true);
CREATE POLICY "Service role can access all modmail" ON modmail_threads FOR ALL USING (true);
CREATE POLICY "Service role can access all panic mode" ON panic_mode FOR ALL USING (true);
CREATE POLICY "Service role can access all feedback" ON feedback FOR ALL USING (true);
CREATE POLICY "Service role can access all cases" ON moderation_cases FOR ALL USING (true);

-- Add new columns to guild_configs for new features
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS report_channel_id TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS modmail_channel_id TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS feedback_channel_id TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS mod_role_id TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS next_case_number INTEGER DEFAULT 1;

-- Create function to auto-increment case numbers per guild
CREATE OR REPLACE FUNCTION get_next_case_number(guild_id_param TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_num INTEGER;
BEGIN
    UPDATE guild_configs 
    SET next_case_number = COALESCE(next_case_number, 1) + 1
    WHERE guild_id = guild_id_param;
    
    SELECT COALESCE(next_case_number - 1, 1) INTO next_num
    FROM guild_configs 
    WHERE guild_id = guild_id_param;
    
    RETURN next_num;
END;
$$ LANGUAGE plpgsql; 