-- Update existing guild_configs table with new columns
-- This script adds the new configuration options for feedback, modmail, mod role, and report channels

-- Add new columns if they don't exist
DO $$ 
BEGIN
    -- Add feedback_channel_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'feedback_channel_id') THEN
        ALTER TABLE guild_configs ADD COLUMN feedback_channel_id TEXT;
    END IF;
    
    -- Add modmail_channel_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'modmail_channel_id') THEN
        ALTER TABLE guild_configs ADD COLUMN modmail_channel_id TEXT;
    END IF;
    
    -- Add mod_role_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'mod_role_id') THEN
        ALTER TABLE guild_configs ADD COLUMN mod_role_id TEXT;
    END IF;
    
    -- Add report_channel_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'report_channel_id') THEN
        ALTER TABLE guild_configs ADD COLUMN report_channel_id TEXT;
    END IF;
    
    -- Add co_owner_1 column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'co_owner_1') THEN
        ALTER TABLE guild_configs ADD COLUMN co_owner_1 TEXT;
    END IF;
    
    -- Add co_owner_2 column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'co_owner_2') THEN
        ALTER TABLE guild_configs ADD COLUMN co_owner_2 TEXT;
    END IF;
    
    -- Add extra_role_ids column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'extra_role_ids') THEN
        ALTER TABLE guild_configs ADD COLUMN extra_role_ids TEXT[] DEFAULT '{}';
    END IF;
    
    -- Add autorole_id column if it doesn't exist (rename from autorole if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'autorole_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'autorole') THEN
            ALTER TABLE guild_configs RENAME COLUMN autorole TO autorole_id;
        ELSE
            ALTER TABLE guild_configs ADD COLUMN autorole_id TEXT;
        END IF;
    END IF;
    
    -- Add admin_role_id column if it doesn't exist (rename from admin_roles if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'admin_role_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'admin_roles') THEN
            ALTER TABLE guild_configs RENAME COLUMN admin_roles TO admin_role_id;
        ELSE
            ALTER TABLE guild_configs ADD COLUMN admin_role_id TEXT;
        END IF;
    END IF;
    
    -- Add custom_prefix column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'custom_prefix') THEN
        ALTER TABLE guild_configs ADD COLUMN custom_prefix TEXT DEFAULT ';';
    END IF;
    
    -- Add log_channel column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'guild_configs' AND column_name = 'log_channel') THEN
        ALTER TABLE guild_configs ADD COLUMN log_channel TEXT;
    END IF;
    
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_guild_configs_feedback_channel ON guild_configs(feedback_channel_id);
CREATE INDEX IF NOT EXISTS idx_guild_configs_modmail_channel ON guild_configs(modmail_channel_id);
CREATE INDEX IF NOT EXISTS idx_guild_configs_mod_role ON guild_configs(mod_role_id);
CREATE INDEX IF NOT EXISTS idx_guild_configs_report_channel ON guild_configs(report_channel_id);
CREATE INDEX IF NOT EXISTS idx_guild_configs_co_owners ON guild_configs(co_owner_1, co_owner_2);

-- Update RLS policies if they don't exist
DO $$
BEGIN
    -- Check if RLS is enabled
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'guild_configs' AND rowsecurity = true) THEN
        ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Create policies if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guild_configs' AND policyname = 'Guild configs are viewable by guild members') THEN
        CREATE POLICY "Guild configs are viewable by guild members" ON guild_configs
            FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guild_configs' AND policyname = 'Guild configs are insertable by guild members') THEN
        CREATE POLICY "Guild configs are insertable by guild members" ON guild_configs
            FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guild_configs' AND policyname = 'Guild configs are updatable by guild admins') THEN
        CREATE POLICY "Guild configs are updatable by guild admins" ON guild_configs
            FOR UPDATE USING (true);
    END IF;
END $$;

-- Create or replace the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_guild_configs_updated_at') THEN
        CREATE TRIGGER update_guild_configs_updated_at 
            BEFORE UPDATE ON guild_configs 
            FOR EACH ROW 
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Print success message
SELECT 'Guild configs table updated successfully with new configuration columns!' as status; 