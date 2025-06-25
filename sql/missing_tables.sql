-- Missing tables that are referenced in the code but don't exist in the database

-- Channel blacklist table
CREATE TABLE IF NOT EXISTS channel_blacklist (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, channel_id)
);

-- Message archives table
CREATE TABLE IF NOT EXISTS message_archives (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    requested_by BIGINT NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Channel mirrors table
CREATE TABLE IF NOT EXISTS channel_mirrors (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    source_channel_id BIGINT NOT NULL,
    target_channel_id BIGINT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, source_channel_id, target_channel_id)
);

-- Command cooldowns table
CREATE TABLE IF NOT EXISTS command_cooldowns (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    command VARCHAR(50) NOT NULL,
    cooldown_seconds INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, command)
);

-- Watchwords table
CREATE TABLE IF NOT EXISTS watchwords (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    word VARCHAR(100) NOT NULL,
    actions TEXT[] NOT NULL,
    added_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, word)
);

-- Blacklisted words table
CREATE TABLE IF NOT EXISTS blacklisted_words (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    word VARCHAR(100) NOT NULL,
    added_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, word)
);

-- Cursed users table
CREATE TABLE IF NOT EXISTS cursed_users (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    suffix VARCHAR(50) NOT NULL,
    added_by BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

-- Worldstate table
CREATE TABLE IF NOT EXISTS worldstate (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL UNIQUE,
    state TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    reporter_id BIGINT NOT NULL,
    reported_user_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modmail threads table
CREATE TABLE IF NOT EXISTS modmail_threads (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    channel_id BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

-- Panic mode table
CREATE TABLE IF NOT EXISTS panic_mode (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    reason TEXT,
    activated_by BIGINT NOT NULL,
    activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deactivated_at TIMESTAMP WITH TIME ZONE
);

-- User stats table
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    guild_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    message_count INTEGER DEFAULT 0,
    infraction_count INTEGER DEFAULT 0,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(guild_id, user_id)
);

-- Add RLS policies for all tables
ALTER TABLE channel_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_mirrors ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklisted_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE worldstate ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE modmail_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE panic_mode ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for each table (basic read/write for authenticated users)
CREATE POLICY "Enable read access for authenticated users" ON channel_blacklist FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON channel_blacklist FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON channel_blacklist FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON channel_blacklist FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON message_archives FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON message_archives FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON channel_mirrors FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON channel_mirrors FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON channel_mirrors FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON command_cooldowns FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON command_cooldowns FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON command_cooldowns FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON watchwords FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON watchwords FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON watchwords FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON blacklisted_words FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON blacklisted_words FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON blacklisted_words FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON cursed_users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON cursed_users FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON cursed_users FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON worldstate FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON worldstate FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON worldstate FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON reports FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON modmail_threads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON modmail_threads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON modmail_threads FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON panic_mode FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON panic_mode FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON panic_mode FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read access for authenticated users" ON user_stats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable insert access for authenticated users" ON user_stats FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON user_stats FOR UPDATE USING (auth.role() = 'authenticated'); 