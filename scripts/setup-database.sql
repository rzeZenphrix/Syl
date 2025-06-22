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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_modlogs_guild_user ON modlogs(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mutes_guild_user ON mutes(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_guild_user ON blacklist(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_guild ON ticket_types(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);

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