// Migration script from SQLite to Supabase
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Open the SQLite database
const db = new sqlite3.Database('./dashboard/guild_modules.db');

async function migrateData() {
  console.log('Starting migration...');

  // Migrate guild_modules
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM guild_modules', async (err, rows) => {
      if (err) {
        console.error('Error reading guild_modules:', err);
        reject(err);
        return;
      }

      if (rows.length > 0) {
        const { error } = await supabase
          .from('guild_modules')
          .upsert(rows.map(row => ({
            guild_id: row.guild_id,
            module_key: row.module_key,
            enabled: !!row.enabled
          })));

        if (error) {
          console.error('Error inserting guild_modules:', error);
          reject(error);
          return;
        }
      }
      console.log(`Migrated ${rows.length} guild modules`);
      resolve();
    });
  });

  // Migrate user_tokens
  await new Promise((resolve, reject) => {
    db.all('SELECT * FROM user_tokens', async (err, rows) => {
      if (err) {
        console.error('Error reading user_tokens:', err);
        reject(err);
        return;
      }

      if (rows.length > 0) {
        // Convert user_id strings to UUIDs
        const formattedRows = rows.map(row => ({
          ...row,
          user_id: supabase.auth.user(row.user_id)?.id || row.user_id
        }));

        const { error } = await supabase
          .from('user_tokens')
          .upsert(formattedRows);

        if (error) {
          console.error('Error inserting user_tokens:', error);
          reject(error);
          return;
        }
      }
      console.log(`Migrated ${rows.length} user tokens`);
      resolve();
    });
  });

  console.log('Migration completed successfully!');
  db.close();
  process.exit(0);
}

migrateData().catch(error => {
  console.error('Migration failed:', error);
  db.close();
  process.exit(1);
});
