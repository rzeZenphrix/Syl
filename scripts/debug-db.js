// scripts/debug-db.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function printTable(table) {
  console.log(`\n--- ${table.toUpperCase()} ---`);
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`Error fetching ${table}:`, error.message || error);
    return;
  }
  if (!data || data.length === 0) {
    console.log('(No rows)');
    return;
  }
  for (const row of data) {
    console.log(JSON.stringify(row, null, 2));
  }
}

(async () => {
  console.log('Checking contents of watchwords, starboards, and starboard_posts tables...');
  await printTable('watchwords');
  await printTable('starboards');
  await printTable('starboard_posts');
  process.exit(0);
})(); 