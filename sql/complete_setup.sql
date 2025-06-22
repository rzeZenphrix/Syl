-- Complete Database Setup for Discord Bot
-- This script creates all necessary tables and sets up proper permissions

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create guild_configs table (updated schema)
CREATE TABLE IF NOT EXISTS public.guild_configs (
    guild_id text PRIMARY KEY,
    admin_role_id text,
    extra_role_ids text[],
    disabled_commands text[],
    log_channel text,
    autorole text,
    custom_prefix text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create welcome_configs table
CREATE TABLE IF NOT EXISTS public.welcome_configs (
    guild_id text PRIMARY KEY,
    enabled boolean DEFAULT true,
    channel_id text,
    message text,
    embed boolean DEFAULT true,
    color text DEFAULT '#00ff00',
    image text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create goodbye_configs table
CREATE TABLE IF NOT EXISTS public.goodbye_configs (
    guild_id text PRIMARY KEY,
    enabled boolean DEFAULT true,
    channel_id text,
    message text,
    embed boolean DEFAULT true,
    color text DEFAULT '#ff0000',
    image text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create ticket_configs table
CREATE TABLE IF NOT EXISTS public.ticket_configs (
    guild_id text PRIMARY KEY,
    channel_id text,
    title text DEFAULT '🎫 Support Tickets',
    description text DEFAULT 'Click the button below to create a support ticket.',
    color text DEFAULT '#5865f2',
    staff_role_id text,
    category_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticket_number integer UNIQUE NOT NULL,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    channel_id text NOT NULL,
    ticket_type text NOT NULL,
    status text DEFAULT 'OPEN',
    form_data jsonb DEFAULT '{}',
    claimed_by text,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_by text
);

-- Create warnings table
CREATE TABLE IF NOT EXISTS public.warnings (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    reason text NOT NULL,
    warned_by text NOT NULL,
    date bigint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create mutes table
CREATE TABLE IF NOT EXISTS public.mutes (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    muted_by text NOT NULL,
    reason text,
    start_time bigint NOT NULL,
    end_time bigint,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create blacklist table
CREATE TABLE IF NOT EXISTS public.blacklist (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    added_by text NOT NULL,
    reason text,
    date bigint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create modlogs table
CREATE TABLE IF NOT EXISTS public.modlogs (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    guild_id text NOT NULL,
    user_id text NOT NULL,
    action text NOT NULL,
    moderator_id text NOT NULL,
    reason text,
    date bigint NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create update trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER set_guild_configs_updated_at
    BEFORE UPDATE ON guild_configs
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_welcome_configs_updated_at
    BEFORE UPDATE ON welcome_configs
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_goodbye_configs_updated_at
    BEFORE UPDATE ON goodbye_configs
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_ticket_configs_updated_at
    BEFORE UPDATE ON ticket_configs
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE PROCEDURE set_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_guild_configs_admin_role ON guild_configs(admin_role_id);
CREATE INDEX IF NOT EXISTS idx_guild_configs_extra_roles ON guild_configs USING gin(extra_role_ids);
CREATE INDEX IF NOT EXISTS idx_guild_configs_disabled_commands ON guild_configs USING gin(disabled_commands);
CREATE INDEX IF NOT EXISTS idx_welcome_configs_guild ON welcome_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_goodbye_configs_guild ON goodbye_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_ticket_configs_guild ON ticket_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_mutes_guild_user ON mutes(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_guild_user ON blacklist(guild_id, user_id);
CREATE INDEX IF NOT EXISTS idx_modlogs_guild ON modlogs(guild_id);
CREATE INDEX IF NOT EXISTS idx_modlogs_user ON modlogs(user_id);

-- Disable RLS for development (remove this in production)
ALTER TABLE guild_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE welcome_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE goodbye_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE warnings DISABLE ROW LEVEL SECURITY;
ALTER TABLE mutes DISABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist DISABLE ROW LEVEL SECURITY;
ALTER TABLE modlogs DISABLE ROW LEVEL SECURITY;

-- Grant all privileges to the service role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant privileges on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- Create a sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

-- Function to get next ticket number
CREATE OR REPLACE FUNCTION get_next_ticket_number()
RETURNS integer AS $$
BEGIN
    RETURN nextval('ticket_number_seq');
END;
$$ LANGUAGE plpgsql;

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION get_next_ticket_number() TO service_role; 