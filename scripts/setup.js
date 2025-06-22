#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('🚀 Asylum Discord Bot Setup\n');

// Check if .env file exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  console.log('Please create a .env file in the root directory with the following variables:');
  console.log('');
  console.log('DISCORD_TOKEN=your_discord_bot_token');
  console.log('CLIENT_ID=your_discord_client_id');
  console.log('SUPABASE_URL=your_supabase_project_url');
  console.log('SUPABASE_SERVICE_KEY=your_supabase_service_role_key');
  console.log('BOT_OWNER_ID=your_discord_user_id');
  console.log('');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

// Validate environment variables
const requiredVars = [
  'DISCORD_TOKEN',
  'CLIENT_ID', 
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`  - ${varName}`));
  console.log('');
  process.exit(1);
}

console.log('✅ Environment variables loaded successfully');

// Test Supabase connection
async function testSupabaseConnection() {
  console.log('\n🔗 Testing Supabase connection...');
  
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    // Test connection by trying to select from guild_configs
    const { data, error } = await supabase
      .from('guild_configs')
      .select('guild_id')
      .limit(1);
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.log('⚠️  Database tables not found. Please run the setup-database.sql script in your Supabase SQL editor.');
        console.log('   You can find the script at: scripts/setup-database.sql');
        console.log('   Or use the simple version: scripts/setup-database-simple.sql');
      } else if (error.code === '42501' || error.message.includes('permission denied')) {
        console.log('❌ Database permission denied. This is likely due to Row Level Security (RLS) policies.');
        console.log('');
        console.log('🔧 To fix this, you have two options:');
        console.log('');
        console.log('Option 1 (Recommended for development):');
        console.log('   1. Go to your Supabase dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Run the script: scripts/setup-database-simple.sql');
        console.log('   4. This disables RLS for easier testing');
        console.log('');
        console.log('Option 2 (For production):');
        console.log('   1. Go to your Supabase dashboard');
        console.log('   2. Navigate to SQL Editor');
        console.log('   3. Run the script: scripts/setup-database.sql');
        console.log('   4. Check that your service role key has proper permissions');
        console.log('');
        console.log('📋 Make sure you\'re using the SUPABASE_SERVICE_KEY (not the anon key)');
        console.log('   The service key starts with "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."');
      } else {
        console.log('❌ Supabase connection failed:', error.message);
        console.log('   Error code:', error.code);
        console.log('   Please check your SUPABASE_URL and SUPABASE_SERVICE_KEY');
      }
      process.exit(1);
    } else {
      console.log('✅ Supabase connection successful');
      console.log(`   Found ${data.length} guild configurations`);
    }
  } catch (error) {
    console.log('❌ Failed to connect to Supabase:', error.message);
    console.log('   Please check your SUPABASE_URL and SUPABASE_SERVICE_KEY');
    console.log('   Make sure you\'re using the service role key, not the anon key');
    process.exit(1);
  }
}

// Check if required directories exist
function checkDirectories() {
  console.log('\n📁 Checking directory structure...');
  
  const requiredDirs = [
    'src',
    'src/cogs',
    'src/utils',
    'scripts'
  ];
  
  for (const dir of requiredDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`📂 Creating directory: ${dir}`);
      fs.mkdirSync(dirPath, { recursive: true });
    } else {
      console.log(`✅ Directory exists: ${dir}`);
    }
  }
}

// Check if required files exist
function checkFiles() {
  console.log('\n📄 Checking required files...');
  
  const requiredFiles = [
    'index.js',
    'src/cogManager.js',
    'src/utils/supabase.js',
    'src/cogs/moderation.js',
    'src/cogs/utility.js',
    'src/cogs/setup.js'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ File exists: ${file}`);
    } else {
      console.log(`❌ Missing file: ${file}`);
    }
  }
}

// Check package.json dependencies
function checkDependencies() {
  console.log('\n📦 Checking dependencies...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packagePath)) {
    console.log('❌ package.json not found!');
    console.log('   Please run: npm init -y');
    process.exit(1);
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredDeps = [
    'discord.js',
    '@supabase/supabase-js',
    'dotenv'
  ];
  
  const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies?.[dep]);
  
  if (missingDeps.length > 0) {
    console.log('❌ Missing dependencies:');
    missingDeps.forEach(dep => console.log(`  - ${dep}`));
    console.log('');
    console.log('Please run: npm install ' + missingDeps.join(' '));
    process.exit(1);
  }
  
  console.log('✅ All required dependencies are installed');
}

// Main setup function
async function main() {
  try {
    checkDirectories();
    checkFiles();
    checkDependencies();
    await testSupabaseConnection();
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run the database setup script in your Supabase SQL editor');
    console.log('2. Start the bot with: node index.js');
    console.log('3. Use /setup in your Discord server to configure the bot');
    console.log('');
    console.log('For more information, see the README.md file');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run setup
main(); 