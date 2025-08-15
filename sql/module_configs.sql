-- Create module_configs table for storing module-specific configurations
CREATE TABLE IF NOT EXISTS public.module_configs (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  module_key TEXT NOT NULL,
  config_type TEXT NOT NULL,
  config_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guild_id, module_key, config_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_module_configs_guild_id ON module_configs(guild_id);
CREATE INDEX IF NOT EXISTS idx_module_configs_module_key ON module_configs(module_key);
CREATE INDEX IF NOT EXISTS idx_module_configs_config_type ON module_configs(config_type);
CREATE INDEX IF NOT EXISTS idx_module_configs_guild_module ON module_configs(guild_id, module_key);

-- Enable RLS
ALTER TABLE module_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Module configs are viewable by guild members" ON module_configs
  FOR SELECT USING (true);

CREATE POLICY "Module configs are insertable by guild members" ON module_configs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Module configs are updatable by guild admins" ON module_configs
  FOR UPDATE USING (true);

-- Grant permissions to service role
GRANT ALL PRIVILEGES ON TABLE module_configs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE module_configs_id_seq TO service_role;

-- Add comments
COMMENT ON TABLE module_configs IS 'Stores module-specific configurations for each guild';
COMMENT ON COLUMN module_configs.guild_id IS 'Discord guild ID';
COMMENT ON COLUMN module_configs.module_key IS 'Module identifier (e.g., welcome, goodbye, tickets)';
COMMENT ON COLUMN module_configs.config_type IS 'Type of configuration (e.g., settings, data)';
COMMENT ON COLUMN module_configs.config_data IS 'JSON configuration data for the module';