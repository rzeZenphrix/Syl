-- Create guild_configs table for Discord bot per-server configuration
CREATE TABLE IF NOT EXISTS public.guild_configs (
    guild_id text PRIMARY KEY,  -- Discord guild (server) ID
    admin_roles text[],        -- Array of role IDs that have admin privileges
    disabled_commands text[],   -- Array of command names that are disabled
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
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
