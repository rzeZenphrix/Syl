-- Asylum Discord Bot Database Setup
-- Run this script in your Supabase SQL editor

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

-- Create ticket_types table
CREATE TABLE IF NOT EXISTS ticket_types (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  color TEXT,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  type_id INTEGER REFERENCES ticket_types(id),
  created_at BIGINT NOT NULL,
  closed_at BIGINT,
  closed_by BIGINT
);

-- Create welcome_configs table
CREATE TABLE IF NOT EXISTS welcome_configs (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  channel_id BIGINT,
  message TEXT,
  embed BOOLEAN DEFAULT true,
  color TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create goodbye_configs table
CREATE TABLE IF NOT EXISTS goodbye_configs (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  channel_id BIGINT,
  message TEXT,
  embed BOOLEAN DEFAULT true,
  color TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_stats table for leaderboards
CREATE TABLE IF NOT EXISTS user_stats (
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  message_count INTEGER DEFAULT 0,
  vc_seconds BIGINT DEFAULT 0, -- Total seconds spent in voice channels
  chat_seconds BIGINT DEFAULT 0, -- Total seconds spent active in chat (approximate)
  PRIMARY KEY (guild_id, user_id)
);

-- Create watchwords table for watchword system
CREATE TABLE IF NOT EXISTS watchwords (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  word TEXT NOT NULL,
  actions TEXT[] DEFAULT ARRAY['delete','warn','log'],
  added_by BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (guild_id, word)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_modlogs_guild_user ON modlogs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mutes_guild_user ON mutes(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_guild_user ON blacklist(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_guild ON ticket_types(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_guild_user ON user_stats(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_watchwords_guild_word ON watchwords(guild_id, word);

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Service role can do everything" ON guild_configs;
DROP POLICY IF EXISTS "Service role can do everything" ON warnings;
DROP POLICY IF EXISTS "Service role can do everything" ON modlogs;
DROP POLICY IF EXISTS "Service role can do everything" ON mutes;
DROP POLICY IF EXISTS "Service role can do everything" ON blacklist;
DROP POLICY IF EXISTS "Service role can do everything" ON ticket_types;
DROP POLICY IF EXISTS "Service role can do everything" ON tickets;
DROP POLICY IF EXISTS "Service role can do everything" ON welcome_configs;
DROP POLICY IF EXISTS "Service role can do everything" ON goodbye_configs;
DROP POLICY IF EXISTS "Service role can do everything" ON watchwords;

-- Enable Row Level Security (RLS)
ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE modlogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE goodbye_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchwords ENABLE ROW LEVEL SECURITY;

-- Create more permissive policies for service role access
-- These policies allow the service role to perform all operations
CREATE POLICY "Enable all access for service role" ON guild_configs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON warnings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON modlogs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON mutes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON blacklist FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON ticket_types FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON tickets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON welcome_configs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON goodbye_configs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Enable all access for service role" ON watchwords FOR ALL USING (auth.role() = 'service_role');

-- Alternative: If the above doesn't work, create policies that allow all operations
-- Uncomment these if the service_role policies don't work
/*
CREATE POLICY "Allow all operations" ON guild_configs FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON warnings FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON modlogs FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON mutes FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON blacklist FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON ticket_types FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON tickets FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON welcome_configs FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON goodbye_configs FOR ALL USING (true);
*/

-- Insert some sample data for testing (optional)
-- INSERT INTO guild_configs (guild_id, admin_role_id, extra_role_ids, disabled_commands) 
-- VALUES (123456789012345678, 987654321098765432, ARRAY[111111111111111111], ARRAY['eval', 'shutdown']);

COMMENT ON TABLE guild_configs IS 'Stores per-guild bot configuration including admin roles and disabled commands';
COMMENT ON TABLE warnings IS 'Stores user warnings with reasons and moderators';
COMMENT ON TABLE modlogs IS 'Stores all moderation actions for audit purposes';
COMMENT ON TABLE mutes IS 'Stores user mute records with durations';
COMMENT ON TABLE blacklist IS 'Stores blacklisted users per guild';
COMMENT ON TABLE ticket_types IS 'Stores ticket category definitions';
COMMENT ON TABLE tickets IS 'Stores active and closed tickets';
COMMENT ON TABLE welcome_configs IS 'Stores welcome message configuration';
COMMENT ON TABLE goodbye_configs IS 'Stores goodbye message configuration'; 
COMMENT ON TABLE user_stats IS 'Stores leaderboard statistics for messages, voice channel uptime, and chat uptime';
COMMENT ON TABLE watchwords IS 'Stores watchword definitions and actions'; 

-- Enable RLS and allow service_role
GRANT ALL PRIVILEGES ON TABLE watchwords TO service_role; 

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
  guild_id BIGINT NOT NULL,
  word TEXT NOT NULL,
  actions TEXT[] DEFAULT ARRAY['delete','warn','log'],
  added_by BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_watchwords_guild_word ON watchwords(guild_id, word);

CREATE TABLE IF NOT EXISTS blacklist_words (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  word TEXT NOT NULL,
  actions TEXT[] DEFAULT ARRAY['delete','warn','log'],
  added_by BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_blacklist_words_guild_word ON blacklist_words(guild_id, word);

-- Backups
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_backups_guild ON backups(guild_id);

-- Co-owners
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_1_id TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_2_id TEXT;

-- Logging columns
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS log_channel BIGINT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS anti_nuke_whitelist BIGINT[];
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS raid_protection_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS raid_protection_threshold INTEGER;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS raid_auto_lock BOOLEAN DEFAULT FALSE;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS anti_nuke_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS anti_nuke_auto_ban BOOLEAN DEFAULT FALSE;

-- RLS policies for service_role
DROP POLICY IF EXISTS "Enable all access for service role" ON starboards;
CREATE POLICY "Enable all access for service role" ON starboards FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON starboard_posts;
CREATE POLICY "Enable all access for service role" ON starboard_posts FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON raid_logs;
CREATE POLICY "Enable all access for service role" ON raid_logs FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON antinuke_logs;
CREATE POLICY "Enable all access for service role" ON antinuke_logs FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON modmail_threads;
CREATE POLICY "Enable all access for service role" ON modmail_threads FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON panic_mode;
CREATE POLICY "Enable all access for service role" ON panic_mode FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON feedback;
CREATE POLICY "Enable all access for service role" ON feedback FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON moderation_cases;
CREATE POLICY "Enable all access for service role" ON moderation_cases FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON channel_blacklist;
CREATE POLICY "Enable all access for service role" ON channel_blacklist FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON watchwords;
CREATE POLICY "Enable all access for service role" ON watchwords FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON blacklist_words;
CREATE POLICY "Enable all access for service role" ON blacklist_words FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Enable all access for service role" ON backups;
CREATE POLICY "Enable all access for service role" ON backups FOR ALL USING (auth.role() = 'service_role'); 