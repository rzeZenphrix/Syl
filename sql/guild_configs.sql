-- Create guild_configs table for Discord bot per-server configuration
CREATE TABLE IF NOT EXISTS public.guild_configs (
    guild_id text PRIMARY KEY,  -- Discord guild (server) ID
    admin_roles text[],        -- Array of role IDs that have admin privileges
    disabled_commands text[],   -- Array of command names that are disabled
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    admin_role_id text,
    extra_role_ids text[] DEFAULT '{}',
    log_channel text,
    autorole_id text,
    custom_prefix text DEFAULT ';',
    feedback_channel_id text,
    modmail_channel_id text,
    mod_role_id text,
    report_channel_id text,
    co_owner_1 text,
    co_owner_2 text
);

-- Create an update trigger to set updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER set_guild_configs_updated_at
    BEFORE UPDATE ON guild_configs
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

-- Add appropriate indexes
CREATE INDEX IF NOT EXISTS idx_guild_configs_admin_roles ON guild_configs USING gin(admin_roles);
CREATE INDEX IF NOT EXISTS idx_guild_configs_disabled_commands ON guild_configs USING gin(disabled_commands);

-- Enable RLS
ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Guild configs are viewable by guild members" ON guild_configs
    FOR SELECT USING (true);

CREATE POLICY "Guild configs are insertable by guild members" ON guild_configs
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Guild configs are updatable by guild admins" ON guild_configs
    FOR UPDATE USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_guild_configs_updated_at 
    BEFORE UPDATE ON guild_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
