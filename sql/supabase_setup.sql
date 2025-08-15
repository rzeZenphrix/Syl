-- Drop existing tables if they exist
DROP TABLE IF EXISTS guild_modules CASCADE;
DROP TABLE IF EXISTS user_tokens CASCADE;

-- Create extension for UUID support if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the guild_modules table
CREATE TABLE guild_modules (
    guild_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (guild_id, module_key)
);

-- Create the user_tokens table
CREATE TABLE user_tokens (
    user_id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating updated_at
CREATE TRIGGER update_guild_modules_updated_at
    BEFORE UPDATE ON guild_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tokens_updated_at
    BEFORE UPDATE ON user_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE guild_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT ALL ON guild_modules TO authenticated;
GRANT ALL ON user_tokens TO authenticated;

-- Create policies
CREATE POLICY "Allow authenticated access to guild_modules"
ON guild_modules FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow users to access their own tokens"
ON user_tokens FOR ALL
TO authenticated
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Create indexes
CREATE INDEX idx_guild_modules_guild_id ON guild_modules(guild_id);
CREATE INDEX idx_guild_modules_module_key ON guild_modules(module_key);
