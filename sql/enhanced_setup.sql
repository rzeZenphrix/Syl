-- Enhanced Database Setup for Advanced Bot Features
-- This script adds new tables and enhances existing ones for comprehensive logging and configuration

-- Create enhanced system_logs table for comprehensive logging
CREATE TABLE IF NOT EXISTS public.system_logs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    log_type text NOT NULL, -- CONFIG, MODERATION, MEMBER, CHANNEL, ROLE, ERROR, etc.
    log_level text NOT NULL, -- ERROR, WARN, INFO, DEBUG
    message text NOT NULL,
    metadata jsonb DEFAULT '{}', -- Flexible storage for additional data
    timestamp timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for efficient log querying
CREATE INDEX IF NOT EXISTS idx_system_logs_guild_id ON public.system_logs(guild_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_type ON public.system_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON public.system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON public.system_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON public.system_logs(created_at);

-- Enhanced guild_configs table with additional settings
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS anti_nuke_enabled boolean DEFAULT false;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS anti_raid_enabled boolean DEFAULT false;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS max_mentions integer DEFAULT 5;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS max_role_creates integer DEFAULT 3;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS max_channel_creates integer DEFAULT 5;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS auto_mod_enabled boolean DEFAULT false;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS welcome_enabled boolean DEFAULT false;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS goodbye_enabled boolean DEFAULT false;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS backup_enabled boolean DEFAULT true;
ALTER TABLE public.guild_configs ADD COLUMN IF NOT EXISTS logging_enabled boolean DEFAULT true;

-- Create co_owners table for multiple bot administrators
CREATE TABLE IF NOT EXISTS public.co_owners (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    added_by text NOT NULL,
    permissions text[] DEFAULT ARRAY['moderate', 'configure', 'backup'], -- Granular permissions
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(guild_id, user_id)
);

-- Create enhanced blacklist table for comprehensive blocking
CREATE TABLE IF NOT EXISTS public.enhanced_blacklist (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    target_id text NOT NULL, -- Can be user, role, or channel ID
    target_type text NOT NULL, -- 'user', 'role', 'channel'
    blacklist_type text NOT NULL, -- 'command', 'feature', 'global'
    reason text,
    added_by text NOT NULL,
    expires_at timestamp with time zone, -- Optional expiration
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create server_backups table for backup management
CREATE TABLE IF NOT EXISTS public.server_backups (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    backup_name text NOT NULL,
    backup_data jsonb NOT NULL, -- Complete server structure
    backup_type text DEFAULT 'manual', -- 'manual', 'automatic', 'scheduled'
    created_by text NOT NULL,
    file_size bigint DEFAULT 0,
    checksum text, -- For integrity verification
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    expires_at timestamp with time zone -- Optional expiration for automatic backups
);

-- Create anti_nuke_settings table
CREATE TABLE IF NOT EXISTS public.anti_nuke_settings (
    guild_id text PRIMARY KEY,
    enabled boolean DEFAULT false,
    max_kicks_per_minute integer DEFAULT 5,
    max_bans_per_minute integer DEFAULT 3,
    max_role_deletes_per_minute integer DEFAULT 2,
    max_channel_deletes_per_minute integer DEFAULT 3,
    max_member_kicks_per_user integer DEFAULT 3,
    punishment_type text DEFAULT 'ban', -- 'ban', 'kick', 'strip_roles'
    whitelist_users text[] DEFAULT '{}',
    whitelist_roles text[] DEFAULT '{}',
    alert_channel text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create anti_raid_settings table
CREATE TABLE IF NOT EXISTS public.anti_raid_settings (
    guild_id text PRIMARY KEY,
    enabled boolean DEFAULT false,
    max_joins_per_minute integer DEFAULT 10,
    min_account_age_days integer DEFAULT 7,
    punishment_type text DEFAULT 'kick', -- 'ban', 'kick', 'mute'
    alert_channel text,
    verification_level text DEFAULT 'medium', -- 'none', 'low', 'medium', 'high', 'very_high'
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now') NOT NULL
);

-- Create member_tracking table for real-time member data
CREATE TABLE IF NOT EXISTS public.member_tracking (
    guild_id text NOT NULL,
    total_members integer DEFAULT 0,
    online_members integer DEFAULT 0,
    offline_members integer DEFAULT 0,
    idle_members integer DEFAULT 0,
    dnd_members integer DEFAULT 0,
    last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (guild_id)
);

-- Create server_structure table for caching Discord data
CREATE TABLE IF NOT EXISTS public.server_structure (
    guild_id text NOT NULL,
    structure_type text NOT NULL, -- 'roles', 'channels', 'members'
    structure_data jsonb NOT NULL,
    last_synced timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (guild_id, structure_type)
);

-- Create command_usage table for analytics
CREATE TABLE IF NOT EXISTS public.command_usage (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    command_name text NOT NULL,
    success boolean DEFAULT true,
    execution_time_ms integer DEFAULT 0,
    error_message text,
    used_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_co_owners_guild_id ON public.co_owners(guild_id);
CREATE INDEX IF NOT EXISTS idx_co_owners_user_id ON public.co_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_blacklist_guild_id ON public.enhanced_blacklist(guild_id);
CREATE INDEX IF NOT EXISTS idx_enhanced_blacklist_target ON public.enhanced_blacklist(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_server_backups_guild_id ON public.server_backups(guild_id);
CREATE INDEX IF NOT EXISTS idx_server_backups_created_at ON public.server_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_command_usage_guild_id ON public.command_usage(guild_id);
CREATE INDEX IF NOT EXISTS idx_command_usage_command ON public.command_usage(command_name);
CREATE INDEX IF NOT EXISTS idx_command_usage_used_at ON public.command_usage(used_at);

-- Create RPC function for log statistics
CREATE OR REPLACE FUNCTION get_log_stats(p_guild_id text, p_timeframe text)
RETURNS TABLE(
    total_logs bigint,
    error_logs bigint,
    warn_logs bigint,
    info_logs bigint,
    debug_logs bigint,
    config_logs bigint,
    moderation_logs bigint,
    member_logs bigint,
    channel_logs bigint,
    role_logs bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_logs,
        COUNT(*) FILTER (WHERE log_level = 'ERROR') as error_logs,
        COUNT(*) FILTER (WHERE log_level = 'WARN') as warn_logs,
        COUNT(*) FILTER (WHERE log_level = 'INFO') as info_logs,
        COUNT(*) FILTER (WHERE log_level = 'DEBUG') as debug_logs,
        COUNT(*) FILTER (WHERE log_type = 'CONFIG') as config_logs,
        COUNT(*) FILTER (WHERE log_type = 'MODERATION') as moderation_logs,
        COUNT(*) FILTER (WHERE log_type = 'MEMBER') as member_logs,
        COUNT(*) FILTER (WHERE log_type = 'CHANNEL') as channel_logs,
        COUNT(*) FILTER (WHERE log_type = 'ROLE') as role_logs
    FROM public.system_logs 
    WHERE guild_id = p_guild_id 
    AND (p_timeframe = '' OR created_at >= NOW() - p_timeframe::interval);
END;
$$ LANGUAGE plpgsql;

-- Create RPC function for command analytics
CREATE OR REPLACE FUNCTION get_command_stats(p_guild_id text, p_days integer DEFAULT 30)
RETURNS TABLE(
    command_name text,
    usage_count bigint,
    success_rate numeric,
    avg_execution_time numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cu.command_name,
        COUNT(*) as usage_count,
        ROUND((COUNT(*) FILTER (WHERE success = true) * 100.0 / COUNT(*)), 2) as success_rate,
        ROUND(AVG(execution_time_ms), 2) as avg_execution_time
    FROM public.command_usage cu
    WHERE cu.guild_id = p_guild_id 
    AND cu.used_at >= NOW() - (p_days || ' days')::interval
    GROUP BY cu.command_name
    ORDER BY usage_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating member tracking timestamp
CREATE OR REPLACE FUNCTION update_member_tracking_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_member_tracking_timestamp
    BEFORE UPDATE ON public.member_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_member_tracking_timestamp();

-- Create trigger for updating server structure timestamp
CREATE OR REPLACE FUNCTION update_server_structure_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_synced = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_server_structure_timestamp
    BEFORE UPDATE ON public.server_structure
    FOR EACH ROW
    EXECUTE FUNCTION update_server_structure_timestamp();

-- Enable RLS (Row Level Security) for multi-tenant access
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.co_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enhanced_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_nuke_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anti_raid_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_structure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.command_usage ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access (adjust role name as needed)
CREATE POLICY "Service role can access all data" ON public.system_logs FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.co_owners FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.enhanced_blacklist FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.server_backups FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.anti_nuke_settings FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.anti_raid_settings FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.member_tracking FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.server_structure FOR ALL USING (true);
CREATE POLICY "Service role can access all data" ON public.command_usage FOR ALL USING (true);