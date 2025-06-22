#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

console.log('🔍 Testing Supabase Connection...\n');

// Check environment variables
console.log('Environment Variables:');
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing'}`);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.log('\n❌ Missing required environment variables');
  process.exit(1);
}

// Check key format
const key = process.env.SUPABASE_SERVICE_KEY;
console.log(`Key starts with: ${key.substring(0, 20)}...`);
console.log(`Key length: ${key.length} characters`);

if (key.length < 100) {
  console.log('⚠️  Warning: Service key seems too short. Make sure you\'re using the service role key, not the anon key.');
}

// Create client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Test basic connection
async function testConnection() {
  console.log('\n🔗 Testing basic connection...');
  
  try {
    // Test with a simple query
    const { data, error } = await supabase
      .from('guild_configs')
      .select('count')
      .limit(1);
    
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log(`Error code: ${error.code}`);
      console.log(`Error details: ${JSON.stringify(error, null, 2)}`);
      
      // Try to get more specific error info
      if (error.code === 'PGRST116') {
        console.log('\n💡 The table might not exist. Please run the database setup script.');
      } else if (error.code === '42501') {
        console.log('\n💡 Permission denied. Check RLS policies or table permissions.');
      }
      
      return false;
    }
    
    console.log('✅ Connection successful!');
    console.log(`Data: ${JSON.stringify(data)}`);
    return true;
    
  } catch (error) {
    console.log(`❌ Connection failed: ${error.message}`);
    return false;
  }
}

// Test table creation
async function testTableCreation() {
  console.log('\n📋 Testing table creation...');
  
  try {
    // Try to create a test table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS test_table (
          id SERIAL PRIMARY KEY,
          test_field TEXT
        );
      `
    });
    
    if (error) {
      console.log(`❌ Cannot create tables: ${error.message}`);
      console.log('💡 This might be expected if RPC is not enabled.');
    } else {
      console.log('✅ Can create tables');
    }
    
  } catch (error) {
    console.log(`❌ Table creation test failed: ${error.message}`);
  }
}

// Test insert
async function testInsert() {
  console.log('\n📝 Testing insert...');
  
  try {
    const { data, error } = await supabase
      .from('guild_configs')
      .insert([
        {
          guild_id: 999999999999999999,
          admin_role_id: 888888888888888888,
          disabled_commands: ['test']
        }
      ])
      .select();
    
    if (error) {
      console.log(`❌ Insert failed: ${error.message}`);
      return false;
    }
    
    console.log('✅ Insert successful!');
    
    // Clean up test data
    await supabase
      .from('guild_configs')
      .delete()
      .eq('guild_id', 999999999999999999);
    
    console.log('✅ Test data cleaned up');
    return true;
    
  } catch (error) {
    console.log(`❌ Insert test failed: ${error.message}`);
    return false;
  }
}

// Main test
async function runTests() {
  console.log('🚀 Starting database tests...\n');
  
  const connectionOk = await testConnection();
  
  if (connectionOk) {
    await testInsert();
  }
  
  await testTableCreation();
  
  console.log('\n📊 Test Summary:');
  console.log('If you see permission errors, please check:');
  console.log('1. You\'re using the service role key (not anon key)');
  console.log('2. RLS is disabled or proper policies are in place');
  console.log('3. The tables exist in your database');
  console.log('4. Your service role has the necessary permissions');
}

runTests().catch(console.error); 