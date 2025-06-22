-- Asylum Discord Bot Database Setup (Simple Version)
-- Run this script in your Supabase SQL editor
-- This version disables RLS for easier testing

-- Create guild_configs table
CREATE TABLE IF NOT EXISTS guild_configs (
  guild_id BIGINT PRIMARY KEY,
  admin_role_id BIGINT,
  extra_role_ids BIGINT[],
  disabled_commands TEXT[],
  log_channel BIGINT,
  autorole BIGINT,
  custom_prefix TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create warnings table
CREATE TABLE IF NOT EXISTS warnings (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  warned_by BIGINT NOT NULL,
  date BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create modlogs table
CREATE TABLE IF NOT EXISTS modlogs (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  moderator_id BIGINT NOT NULL,
  reason TEXT,
  date BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create mutes table
CREATE TABLE IF NOT EXISTS mutes (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  muted_by BIGINT NOT NULL,
  reason TEXT,
  start_time BIGINT NOT NULL,
  end_time BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blacklist table
CREATE TABLE IF NOT EXISTS blacklist (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  added_by BIGINT NOT NULL,
  reason TEXT,
  date BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_modlogs_guild_user ON modlogs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mutes_guild_user ON mutes(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_guild_user ON blacklist(guild_id, user_id);

-- Disable Row Level Security for easier testing
ALTER TABLE guild_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE warnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE modlogs DISABLE ROW LEVEL SECURITY;
ALTER TABLE mutes DISABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist DISABLE ROW LEVEL SECURITY;

-- Insert test data
INSERT INTO guild_configs (guild_id, admin_role_id, extra_role_ids, disabled_commands) 
VALUES (123456789012345678, 987654321098765432, ARRAY[111111111111111111], ARRAY['eval', 'shutdown'])
ON CONFLICT (guild_id) DO NOTHING;

COMMENT ON TABLE guild_configs IS 'Stores per-guild bot configuration including admin roles and disabled commands';
COMMENT ON TABLE warnings IS 'Stores user warnings with reasons and moderators';
COMMENT ON TABLE modlogs IS 'Stores all moderation actions for audit purposes';
COMMENT ON TABLE mutes IS 'Stores user mute records with durations';
COMMENT ON TABLE blacklist IS 'Stores blacklisted users per guild'; 