const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupCoOwners() {
  console.log('Setting up co-owners system...');
  
  try {
    // Add co-owner columns to guild_configs
    console.log('Adding co-owner columns...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_1_id TEXT;
        ALTER TABLE guild_configs ADD COLUMN IF NOT EXISTS co_owner_2_id TEXT;
      `
    });
    
    if (alterError) {
      console.error('Error adding columns:', alterError);
      return;
    }
    
    // Create index
    console.log('Creating index...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_guild_configs_co_owners ON guild_configs(co_owner_1_id, co_owner_2_id);'
    });
    
    if (indexError) {
      console.error('Error creating index:', indexError);
      return;
    }
    
    // Create function
    console.log('Creating co-owner check function...');
    const { error: functionError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    
    if (functionError) {
      console.error('Error creating function:', functionError);
      return;
    }
    
    console.log('✅ Co-owners system setup complete!');
    console.log('\nFeatures added:');
    console.log('- Co-owner columns in guild_configs table');
    console.log('- Database index for performance');
    console.log('- is_co_owner() function for checking permissions');
    console.log('\nCommands available:');
    console.log('- &co-owners add/remove/list @user');
    console.log('- &add-co-owner @user');
    console.log('- &remove-co-owner @user');
    console.log('- /co-owners (with action dropdown)');
    console.log('- /add-co-owner @user');
    console.log('- /remove-co-owner @user');
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

setupCoOwners(); 