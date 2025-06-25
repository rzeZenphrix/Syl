const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  // .env file doesn't exist, that's okay
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment.');
  console.error('');
  console.error('If you\'re running this locally, create a .env file with:');
  console.error('SUPABASE_URL=your_supabase_url');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  console.error('');
  console.error('If you\'re on Render, make sure these environment variables are set in your Render dashboard.');
  console.error('');
  console.error('Alternatively, you can manually run the SQL file in your Supabase SQL editor:');
  console.error('1. Go to your Supabase dashboard');
  console.error('2. Navigate to SQL Editor');
  console.error('3. Copy and paste the contents of sql/missing_tables.sql');
  console.error('4. Run the SQL');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupMissingTables() {
  try {
    console.log('🔧 Setting up missing tables...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, '../sql/missing_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('📄 SQL file loaded successfully');
    console.log('📊 Executing SQL statements...');
    
    // Split the SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.error('❌ Error executing statement:', error.message);
            errorCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          console.error('❌ Error executing statement:', e.message);
          errorCount++;
        }
      }
    }
    
    console.log('');
    console.log(`✅ Setup completed!`);
    console.log(`📈 Successfully executed: ${successCount} statements`);
    if (errorCount > 0) {
      console.log(`⚠️  Errors: ${errorCount} statements`);
      console.log('Some statements may have failed due to tables already existing or other issues.');
    }
    console.log('');
    console.log('🎉 The bot should now work without database errors!');
    
  } catch (error) {
    console.error('❌ Error setting up missing tables:', error);
    console.error('');
    console.error('💡 Manual setup instructions:');
    console.error('1. Go to your Supabase dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Copy and paste the contents of sql/missing_tables.sql');
    console.error('4. Run the SQL');
    process.exit(1);
  }
}

setupMissingTables(); 