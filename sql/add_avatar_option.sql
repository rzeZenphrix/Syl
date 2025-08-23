-- Migration script to add show_avatar option to welcome_configs table
-- This script can be run safely multiple times

-- Add show_avatar column to welcome_configs table (defaults to true for backward compatibility)
ALTER TABLE public.welcome_configs 
ADD COLUMN IF NOT EXISTS show_avatar boolean DEFAULT true;

-- Update comment to reflect the new feature
COMMENT ON COLUMN public.welcome_configs.show_avatar IS 'Whether to display the user avatar in welcome messages (embed format only)';

-- Optionally, you can update existing rows to ensure the default value is set
UPDATE public.welcome_configs 
SET show_avatar = true 
WHERE show_avatar IS NULL;