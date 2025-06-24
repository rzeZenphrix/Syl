-- Co-owners system SQL setup
-- Allows server owners to designate up to 2 co-owners for bot management

-- Add co-owner columns to guild_configs
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_1_id TEXT;
ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_2_id TEXT;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_guild_configs_co_owners ON guild_configs(co_owner_1_id, co_owner_2_id);

-- Grant permissions to service_role (already done in main setup, but ensuring)
GRANT ALL PRIVILEGES ON TABLE guild_configs TO service_role;

-- Create a function to check if a user is a co-owner
CREATE OR REPLACE FUNCTION is_co_owner(guild_id_param TEXT, user_id_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM guild_configs 
    WHERE guild_id = guild_id_param 
    AND (co_owner_1_id = user_id_param OR co_owner_2_id = user_id_param)
  );
END;
$$ LANGUAGE plpgsql; 