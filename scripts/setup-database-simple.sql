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

-- Starboard system
CREATE TABLE IF NOT EXISTS starboards (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  threshold INTEGER NOT NULL DEFAULT 5,
  channel_id TEXT NOT NULL,
  allow_bots BOOLEAN DEFAULT FALSE,
  allow_selfstar BOOLEAN DEFAULT FALSE,
  blacklist_roles TEXT[],
  blacklist_channels TEXT[],
  custom_message TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_starboards_guild ON starboards(guild_id);

CREATE TABLE IF NOT EXISTS starboard_posts (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  starboard_name TEXT NOT NULL,
  message_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  count INTEGER NOT NULL,
  last_starred_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_starboard_posts_guild ON starboard_posts(guild_id);

-- Raid/antinuke logs
CREATE TABLE IF NOT EXISTS raid_logs (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT,
  raid_type TEXT,
  action TEXT,
  count INTEGER,
  timestamp TIMESTAMP DEFAULT now(),
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_raid_logs_guild ON raid_logs(guild_id);

CREATE TABLE IF NOT EXISTS antinuke_logs (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT,
  count INTEGER,
  timestamp TIMESTAMP DEFAULT now(),
  details TEXT
);
CREATE INDEX IF NOT EXISTS idx_antinuke_logs_guild ON antinuke_logs(guild_id);

-- Modmail threads
CREATE TABLE IF NOT EXISTS modmail_threads (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_modmail_threads_guild_user ON modmail_threads(guild_id, user_id);

-- Panic mode
CREATE TABLE IF NOT EXISTS panic_mode (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  activated_by TEXT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now(),
  deactivated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_panic_mode_guild ON panic_mode(guild_id);

-- Feedback
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_guild ON feedback(guild_id);

-- Moderation cases
CREATE TABLE IF NOT EXISTS moderation_cases (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  case_type TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT now(),
  duration_minutes INTEGER,
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,
  case_number INTEGER GENERATED ALWAYS AS IDENTITY
);
CREATE INDEX IF NOT EXISTS idx_cases_guild_user ON moderation_cases(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cases_number ON moderation_cases(case_number);

-- Channel blacklist
CREATE TABLE IF NOT EXISTS channel_blacklist (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_channel_blacklist_guild ON channel_blacklist(guild_id);

-- Watchwords and blacklist words
CREATE TABLE IF NOT EXISTS watchwords (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  word TEXT NOT NULL,
  actions TEXT[],
  added_by TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_watchwords_guild_word ON watchwords(guild_id, word);

CREATE TABLE IF NOT EXISTS blacklist_words (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  word TEXT NOT NULL,
  actions TEXT[],
  added_by TEXT,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_blacklist_words_guild_word ON blacklist_words(guild_id, word);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_backups_guild ON backups(guild_id);

-- Co-owners
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_1_id TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_2_id TEXT;

-- Logging columns
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS log_channel TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS anti_nuke_whitelist TEXT[];
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS raid_protection_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS raid_protection_threshold INTEGER;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS raid_auto_lock BOOLEAN DEFAULT FALSE;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS anti_nuke_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS anti_nuke_auto_ban BOOLEAN DEFAULT FALSE;

-- RLS policies for service_role
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('starboards','starboard_posts','raid_logs','antinuke_logs','modmail_threads','panic_mode','feedback','moderation_cases','channel_blacklist','watchwords','blacklist_words','backups')
  LOOP
    EXECUTE format('CREATE POLICY IF NOT EXISTS "Enable all access for service role" ON %I FOR ALL USING (auth.role() = ''service_role'');', tbl);
  END LOOP;
END $$; 