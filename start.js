#!/usr/bin/env node

console.log('🚀 Starting Asylum Discord Bot...');
console.log('📦 Node.js version:', process.version);
console.log('🔧 Environment:', process.env.NODE_ENV || 'development');

// Check for required environment variables
const requiredEnvVars = ['DISCORD_TOKEN', 'CLIENT_ID', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please set these environment variables in your Render dashboard.');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

// Test cog loading
console.log('\n🔍 Testing cog loading...');
try {
  const { Client, GatewayIntentBits } = require('discord.js');
  const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
  });
  
  // Test each cog individually
  const cogs = ['moderation', 'setup', 'tickets', 'utility', 'welcome'];
  
  for (const cogName of cogs) {
    try {
      const cog = require(`./src/cogs/${cogName}.js`);
      const prefixCount = Object.keys(cog.prefixCommands || {}).length;
      const slashCount = (cog.slashCommands || []).length;
      console.log(`  ✅ ${cogName}.js: ${prefixCount} prefix, ${slashCount} slash commands`);
    } catch (error) {
      console.log(`  ❌ ${cogName}.js: ${error.message}`);
    }
  }
  
  console.log('\n🎯 Starting main bot...');
  require('./index.js');
  
} catch (error) {
  console.error('❌ Failed to start bot:', error.message);
  process.exit(1);
} 