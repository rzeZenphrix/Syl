// index.js
// Discord.js v14 Moderator Bot with Linux-like Commands, Multiple Prefixes & Guild Config
// Combined bot and dashboard server

// Setup Express server for both bot health checks and dashboard
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { isModuleEnabled } = require('./src/utils/modules');
const CogManager = require('./src/cogManager');
const { logEvent } = require('./src/logger');
const { EnhancedLogger } = require('./src/enhanced-logger.js');

// Environment variables
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

// Initialize Supabase (conditional to prevent crashes when not configured)
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized');
} else {
  console.log('Warning: Supabase not configured - some features may not work');
}

// Initialize enhanced logger
const enhancedLogger = new EnhancedLogger(supabase);

// Setup Express server for dashboard and health checks
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint (for Render and other health monitoring)
app.get('/', (req, res) => {
  res.writeHead(200);
  res.end('OK');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the OAuth URL from the environment
app.get('/api/oauth-url', (req, res) => {
  const url = process.env.DISCORD_OAUTH_URL;
  if (url) {
    res.json({ url });
  } else {
    res.status(500).json({ error: 'OAuth URL not configured.' });
  }
});

// OAuth redirect endpoint
app.get('/api/oauth', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const scope = 'identify guilds';
  
  if (!clientId || !redirectUri) {
    return res.status(500).json({ error: 'OAuth not configured properly.' });
  }
  
  const oauthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;
  res.redirect(oauthUrl);
});

// OAuth callback endpoint (GET for Discord redirect)
app.get('/api/oauth-callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const params = new URLSearchParams();
  params.append('client_id', process.env.DISCORD_CLIENT_ID);
  params.append('client_secret', process.env.DISCORD_CLIENT_SECRET);
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', process.env.DISCORD_REDIRECT_URI);
  params.append('scope', 'identify guilds');

  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.status(400).json({ error: 'Failed to get access token', details: tokenData });
    }

    // Get user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const user = await userRes.json();

    // For demo, return a fake token (in production, use JWT/session)
    const fakeToken = 'discord-' + user.id;

    // Persist the Discord access token keyed by Discord user id (if Supabase is available)
    if (supabase) {
      const { error } = await supabase
        .from('user_tokens')
        .upsert({ 
          user_id: user.id,
          access_token: tokenData.access_token 
        });
      
      if (error) {
        console.error('Failed to store user token:', error);
      }
    }

    // Redirect to callback page with token
    res.redirect(`/dashboard/public/callback.html?token=${fakeToken}&user=${encodeURIComponent(JSON.stringify(user))}`);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: 'OAuth failed', details: error.message });
  }
});

// Import and initialize dashboard API routes
const { initializeSetupRoutes } = require('./dashboard/api-routes/setup.cjs');
const { initializeRealtimeRoutes } = require('./dashboard/api-routes/realtime.cjs');
const { initializeLoggingRoutes } = require('./dashboard/api-routes/logging.cjs');

// Discord client for API routes (will be initialized when bot connects)
let discordClientForAPI = null;

// Function to initialize API routes (will be called after bot connects)
function initializeAPIRoutes() {
  console.log('Initializing API routes...');
  
  const setupRoutes = initializeSetupRoutes(supabase, discordClientForAPI, enhancedLogger);
  const realtimeRoutes = initializeRealtimeRoutes(supabase, discordClientForAPI, enhancedLogger);
  const loggingRoutes = initializeLoggingRoutes(supabase, discordClientForAPI, enhancedLogger);
  
  app.use('/api/setup', setupRoutes);
  app.use('/api/realtime', realtimeRoutes);
  app.use('/api/logging', loggingRoutes);
  
  console.log('API routes initialized');
}

// Bot configuration
const prefixes = [';', '&'];

// Initialize client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Initialize cog manager
const cogManager = new CogManager(client);
client.cogManager = cogManager;

// Supabase helper functions
async function addWarning(guildId, userId, reason, warnedBy) {
  const { error } = await supabase.from('warnings').insert([
    { guild_id: guildId, user_id: userId, reason, warned_by: warnedBy, date: Date.now() }
  ]);
  if (error) throw error;
}

async function getWarnings(guildId, userId) {
  const { data, error } = await supabase.from('warnings').select('*').eq('guild_id', guildId).eq('user_id', userId);
  if (error) throw error;
  return data;
}

async function clearWarnings(guildId, userId) {
  const { error } = await supabase.from('warnings').delete().eq('guild_id', guildId).eq('user_id', userId);
  if (error) throw error;
}

async function addMute(guildId, userId, mutedBy, reason, durationMs) {
  const start = Date.now();
  const end = durationMs ? start + durationMs : null;
  const { error } = await supabase.from('mutes').insert([
    { guild_id: guildId, user_id: userId, muted_by: mutedBy, reason, start_time: start, end_time: end }
  ]);
  if (error) throw error;
}

async function removeMute(guildId, userId) {
  const { error } = await supabase.from('mutes').delete().eq('guild_id', guildId).eq('user_id', userId);
  if (error) throw error;
}

async function isMuted(guildId, userId) {
  const { data, error } = await supabase.from('mutes').select('*').eq('guild_id', guildId).eq('user_id', userId);
  if (error) throw error;
  return data && data.length > 0;
}

async function addBlacklist(guildId, userId, addedBy, reason) {
  const { error } = await supabase.from('blacklist').insert([
    { guild_id: guildId, user_id: userId, added_by: addedBy, reason, date: Date.now() }
  ]);
  if (error) throw error;
}

async function removeBlacklist(guildId, userId) {
  const { error } = await supabase.from('blacklist').delete().eq('guild_id', guildId).eq('user_id', userId);
  if (error) throw error;
}

async function isBlacklisted(guildId, userId) {
  const { data, error } = await supabase.from('blacklist').select('*').eq('guild_id', guildId).eq('user_id', userId);
  if (error) throw error;
  return data && data.length > 0;
}

async function addModlog(guildId, userId, action, moderatorId, reason) {
  const { error } = await supabase.from('modlogs').insert([
    { guild_id: guildId, user_id: userId, action, moderator_id: moderatorId, reason, date: Date.now() }
  ]);
  if (error) throw error;
}

async function getAutorole(guildId) {
  const { data, error } = await supabase.from('guild_configs').select('autorole').eq('guild_id', guildId).single();
  if (error) return null;
  return data?.autorole || null;
}

async function setAutorole(guildId, roleId) {
  const { error } = await supabase.from('guild_configs').upsert([{ guild_id: guildId, autorole: roleId }], { onConflict: ['guild_id'] });
  if (error) throw error;
}

async function getLogChannel(guildId) {
  const { data, error } = await supabase.from('guild_configs').select('log_channel').eq('guild_id', guildId).single();
  if (error) return null;
  return data?.log_channel || null;
}

async function setLogChannel(guildId, channelId) {
  const { error } = await supabase.from('guild_configs').upsert([{ guild_id: guildId, log_channel: channelId }], { onConflict: ['guild_id'] });
  if (error) throw error;
}

// Ticketing system helpers
async function addTicketType(guildId, label, description, tags, color, createdBy) {
  const { error } = await supabase.from('ticket_types').insert([
    { guild_id: guildId, label, description, tags, color, created_by: createdBy }
  ]);
  if (error) throw error;
}

async function getTicketTypes(guildId) {
  const { data, error } = await supabase.from('ticket_types').select('*').eq('guild_id', guildId);
  if (error) throw error;
  return data;
}

async function getTicketTypeById(id) {
  const { data, error } = await supabase.from('ticket_types').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

async function createTicket(guildId, userId, typeId) {
  const { error } = await supabase.from('tickets').insert([
    { guild_id: guildId, user_id: userId, type_id: typeId, created_at: Date.now() }
  ]);
  if (error) throw error;
}

// Permission checking functions
async function isAdmin(member) {
  try {
    if (!member || !member.guild) return false;
    
    // Always allow the server owner
    if (member.guild.ownerId === member.id) return true;
    
    // Check for Administrator permission
    if (member.permissions.has('Administrator')) return true;
    
    // Check guild config for admin roles
    const { data, error } = await supabase
      .from('guild_configs')
      .select('admin_role_id, extra_role_ids')
      .eq('guild_id', member.guild.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking admin roles:', error);
      return false;
    }
    
    if (!data) return false;
    
    const adminRoles = [data.admin_role_id, ...(data.extra_role_ids || [])].filter(Boolean);
    return member.roles.cache.some(role => adminRoles.includes(role.id));
  } catch (err) {
    console.error('Error in isAdmin check:', err);
    return false;
  }
}

async function isCommandEnabled(guildId, commandName, member = null) {
  try {
    // If we have member info, check if they should bypass disabled commands
    if (member) {
      // Always allow server owner
      if (member.guild.ownerId === member.id) {
        return true;
      }
      
      // Always allow users with Administrator permission
      if (member.permissions.has('Administrator')) {
        return true;
      }
      
      // Check if user has admin roles configured
      const { data: config, error: configError } = await supabase
        .from('guild_configs')
        .select('admin_role_id, extra_role_ids')
        .eq('guild_id', guildId)
        .single();
      
      if (!configError && config) {
        const adminRoles = [config.admin_role_id, ...(config.extra_role_ids || [])].filter(Boolean);
        if (member.roles.cache.some(role => adminRoles.includes(role.id))) {
          return true;
        }
      }
    }
    
    // Check if command is disabled
    const { data, error } = await supabase
      .from('guild_configs')
      .select('disabled_commands')
      .eq('guild_id', guildId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking disabled commands:', error);
      return true; // Allow command if can't check
    }
    
    if (!data || !data.disabled_commands) {
      return true; // No disabled commands list means all commands are enabled
    }
    
    return !data.disabled_commands.includes(commandName);
  } catch (err) {
    console.error('Error in isCommandEnabled check:', err);
    return true; // Allow command if can't check
  }
}

function isBotProtected(targetId, clientId) {
  return targetId === clientId;
}

// Utility functions
function logError(context, error) {
  console.error(`[${context}] Error:`, error);
  const logLine = `[${new Date().toISOString()}] [${context}] ${error}\n`;
  fs.appendFileSync('logs.txt', logLine);
}

async function sendErrorToLogChannel(guild, context, error) {
  if (!guild) return;
  try {
    const logChannelId = await getLogChannel(guild.id);
    if (logChannelId) {
      const channel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (channel && channel.isTextBased()) {
    const embed = new EmbedBuilder()
          .setTitle('Bot Error')
          .setDescription(`An error occurred in **${context}**.\n\`\`\`${error.message || error}\`\`\``)
      .setColor(0xe74c3c)
      .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('Failed to send error to log channel:', err);
  }
}

async function logCommand(guild, commandName, user, message) {
  if (!guild) return;
  try {
    const logChannelId = await getLogChannel(guild.id);
    if (logChannelId) {
      const channel = await guild.channels.fetch(logChannelId).catch(() => null);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('Command Executed')
          .setDescription(`**Command:** \`${commandName}\`\n**User:** ${user.tag} (${user.id})\n**Channel:** ${message.channel.name}`)
          .setColor(0x3498db)
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (e) {
    console.error('Failed to log command:', e);
  }
}

// Add helper for channel blacklist
async function isChannelBlacklisted(guildId, channelId) {
  const { data, error } = await supabase.from('channel_blacklist').select('*').eq('guild_id', guildId).eq('channel_id', channelId);
  if (error) throw error;
  return data && data.length > 0;
}

// Check Discord credentials (but don't exit if missing - web server can still run)
const hasDiscordCredentials = token && clientId;
if (!hasDiscordCredentials) {
  console.log('⚠️  Missing DISCORD_TOKEN or CLIENT_ID - Discord bot will not connect');
  console.log('📊 Web dashboard will still be available');
}

// Event handlers
client.on('ready', async () => {
  try {
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guilds`);
    // Load cogs
    try {
      await cogManager.loadCogs();
    } catch (e) {
      const logLine = `[${new Date().toISOString()}] [startup-cogs] ${e.message || e}\n`;
      fs.appendFileSync('logs.txt', logLine);
      console.error('Cog loading error:', e);
    }
    // Register slash commands
    const rest = new REST({ version: '10' }).setToken(token);
    try {
      const slashCommands = cogManager.getAllSlashCommands();
      await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
      console.log('Slash commands registered successfully.');
    } catch (err) {
      const logLine = `[${new Date().toISOString()}] [startup-slash] ${err.message || err}\n`;
      fs.appendFileSync('logs.txt', logLine);
      console.error('Error registering slash commands:', err);
    }
    // Initialize userVoiceStates for users already in voice
    try {
      for (const guild of client.guilds.cache.values()) {
        for (const member of guild.members.cache.values()) {
          if (member.voice && member.voice.channelId) {
            const key = `${guild.id}-${member.id}`;
            if (!userVoiceStates.has(key)) {
              userVoiceStates.set(key, Date.now());
            }
          }
        }
      }
    } catch (e) {
      const logLine = `[${new Date().toISOString()}] [startup-voice-init] ${e.message || e}\n`;
      fs.appendFileSync('logs.txt', logLine);
      console.error('Voice state init error:', e);
    }
    // Periodically flush in-progress voice sessions to DB
    setInterval(async () => {
      for (const [key, joinTime] of userVoiceStates.entries()) {
        const [guildId, userId] = key.split('-');
        const duration = Math.floor((Date.now() - joinTime) / 1000);
        try {
          if (!(await isModuleEnabled(guildId, 'stats'))) continue;
          const { data, error } = await supabase.from('user_stats').select('vc_seconds').eq('guild_id', guildId).eq('user_id', userId).single();
          if (!data) {
            await supabase.from('user_stats').insert({
              guild_id: guildId,
              user_id: userId,
              vc_seconds: duration
            });
          } else {
            await supabase.from('user_stats').update({
              vc_seconds: (data.vc_seconds || 0) + duration
            }).eq('guild_id', guildId).eq('user_id', userId);
          }
          // Reset join time
          userVoiceStates.set(key, Date.now());
        } catch (e) {
          const logLine = `[${new Date().toISOString()}] [voice-flush] ${e.message || e}\n`;
          fs.appendFileSync('logs.txt', logLine);
          console.error('Voice session flush error:', e);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  } catch (e) {
    const logLine = `[${new Date().toISOString()}] [startup-main] ${e.message || e}\n`;
    fs.appendFileSync('logs.txt', logLine);
    console.error('Startup error:', e);
  }
});

// --- VC and Chat Uptime Tracking ---
const userVoiceStates = new Map(); // Map<guildId-userId, joinTimestamp>

client.on('voiceStateUpdate', async (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const key = `${guildId}-${userId}`;

  // User joins a VC
  if (!oldState.channelId && newState.channelId) {
    userVoiceStates.set(key, Date.now());
  }
  // User leaves a VC
  else if (oldState.channelId && !newState.channelId) {
    const joinTime = userVoiceStates.get(key);
    if (joinTime) {
      const duration = Math.floor((Date.now() - joinTime) / 1000); // seconds
      userVoiceStates.delete(key);
      // Update user_stats
      if (await isModuleEnabled(guildId, 'stats')) {
        const { data, error } = await supabase.from('user_stats').select('vc_seconds').eq('guild_id', guildId).eq('user_id', userId).single();
        if (!data) {
          await supabase.from('user_stats').insert({
            guild_id: guildId,
            user_id: userId,
            vc_seconds: duration
          });
        } else {
          await supabase.from('user_stats').update({
            vc_seconds: (data.vc_seconds || 0) + duration
          }).eq('guild_id', guildId).eq('user_id', userId);
        }
      }
    }
  }
  // User switches VC
  else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    const joinTime = userVoiceStates.get(key);
    if (joinTime) {
      const duration = Math.floor((Date.now() - joinTime) / 1000);
      // Update user_stats for the time spent in the previous VC
      if (await isModuleEnabled(guildId, 'stats')) {
        const { data, error } = await supabase.from('user_stats').select('vc_seconds').eq('guild_id', guildId).eq('user_id', userId).single();
        if (!data) {
          await supabase.from('user_stats').insert({
            guild_id: guildId,
            user_id: userId,
            vc_seconds: duration
          });
        } else {
          await supabase.from('user_stats').update({
            vc_seconds: (data.vc_seconds || 0) + duration
          }).eq('guild_id', guildId).eq('user_id', userId);
        }
      }
    }
    // Reset join time for new VC
    userVoiceStates.set(key, Date.now());
  }
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;

  // --- Watchword and Blacklisted Word Enforcement ---
  try {
    const { monitorWatchwords, monitorBlacklistedWords } = require('./src/cogs/utility');
    await monitorWatchwords(msg);
    await monitorBlacklistedWords(msg);
  } catch (e) {
    console.error('Watchword/Blacklist enforcement error:', e);
  }

  // --- SPY LOGIC (move to top) ---
  global.spyUsers = global.spyUsers || {};
  if (global.spyUsers[msg.guild.id] && global.spyUsers[msg.guild.id].has(msg.author.id)) {
    const { logToModLog } = require('./src/cogs/utility');
    let description = `User: <@${msg.author.id}>\nChannel: <#${msg.channel.id}>\nContent: ${msg.content || '[No text content]'}\nTimestamp: <t:${Math.floor(msg.createdTimestamp/1000)}:R>`;
    if (msg.attachments.size > 0) {
      description += `\nAttachments: ${[...msg.attachments.values()].map(a => a.url).join(', ')}`;
    }
    await logToModLog(msg, 'Spy Log', description);
  }
  
  // Check for raid protection (message spam)
  try {
    const { checkRaidProtection } = require('./src/cogs/moderation');
    if (checkRaidProtection) {
      const isRaid = await checkRaidProtection(msg.guild, 'messages', msg.author.id);
      if (isRaid) {
        console.log(`[RAID] Message raid detected in ${msg.guild.name} - ${msg.author.tag} sent message`);
        // Delete the message if it's part of a raid
        await msg.delete().catch(() => {});
        return;
      }
    }
  } catch (e) {
    console.error('Raid protection check error:', e);
  }
  
  // Blacklist checks
  if (await isBlacklisted(msg.guild.id, msg.author.id)) {
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Blacklisted').setDescription('You are blacklisted from using this bot.').setColor(0xe74c3c)] });
  }
  if (await isChannelBlacklisted(msg.guild.id, msg.channel.id)) {
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Channel Blacklisted').setDescription('Commands are disabled in this channel.').setColor(0xe74c3c)] });
  }
  
  // Increment message count and chat uptime in user_stats
  if (await isModuleEnabled(msg.guild.id, 'stats')) {
  const { data, error } = await supabase.from('user_stats').select('message_count, chat_seconds').eq('guild_id', msg.guild.id).eq('user_id', msg.author.id).single();
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user_stats:', error);
    return;
  }
  if (!data) {
    await supabase.from('user_stats').insert({
      guild_id: msg.guild.id,
      user_id: msg.author.id,
      message_count: 1,
      chat_seconds: 30 // Assume 30s active per message
    });
  } else {
    await supabase.from('user_stats').update({
      message_count: (data.message_count || 0) + 1,
      chat_seconds: (data.chat_seconds || 0) + 30 // Add 30s per message
    }).eq('guild_id', msg.guild.id).eq('user_id', msg.author.id);
  }
  }
  
  // Log every message to modlogs for accurate 'messages today'
  await supabase.from('modlogs').insert({
    guild_id: msg.guild.id,
    user_id: msg.author.id,
    action: 'message',
    moderator_id: msg.author.id,
    reason: null,
    date: Date.now()
  });
  
  // Get custom prefix for this guild
  let guildPrefixes = prefixes;
  try {
    const { data: config, error: configError } = await supabase
      .from('guild_configs')
      .select('custom_prefix')
      .eq('guild_id', msg.guild.id)
      .single();
    
    if (!configError && config?.custom_prefix && config.custom_prefix.trim() !== '') {
      guildPrefixes = [config.custom_prefix];
    } else {
      guildPrefixes = prefixes;
    }
  } catch (e) {
    // If error, fall back to default prefixes
    console.error('Error fetching custom prefix:', e);
    guildPrefixes = prefixes;
  }
  
  // Only accept the first matching prefix (if custom, only that one)
  const prefix = guildPrefixes.find(p => msg.content.startsWith(p));
  if (!prefix) return;
  
  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  const commandHandler = cogManager.getPrefixCommand(command);
  if (!commandHandler) return;
  
  try {
    // Check if command is enabled for this guild
    const isEnabled = await isCommandEnabled(msg.guild.id, command, msg.member);
    if (!isEnabled) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Command Disabled').setDescription('This command is disabled in this server.').setColor(0xe74c3c)] });
    }
    
    await commandHandler(msg, args);
    // Log successful command execution
    await logCommand(msg.guild, command, msg.author, msg);
  } catch (e) {
    console.error('Command error:', e.message || JSON.stringify(e));
    await msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('An error occurred while processing the command.').setColor(0xe74c3c)] });
    sendErrorToLogChannel(msg.guild, 'command', e.message || JSON.stringify(e));
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  // Blacklist checks
  if (await isBlacklisted(interaction.guild.id, interaction.user.id)) {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Blacklisted').setDescription('You are blacklisted from using this bot.').setColor(0xe74c3c)], ephemeral: true });
  }
  if (await isChannelBlacklisted(interaction.guild.id, interaction.channel.id)) {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Channel Blacklisted').setDescription('Commands are disabled in this channel.').setColor(0xe74c3c)], ephemeral: true });
  }
  
  try {
    const { commandName } = interaction;
    
    // Check if command is enabled for this guild
    const isEnabled = await isCommandEnabled(interaction.guild.id, commandName, interaction.member);
    if (!isEnabled) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Command Disabled').setDescription('This command is disabled in this server.').setColor(0xe74c3c)], ephemeral: true });
    }
    
    const handler = cogManager.getSlashHandler(commandName);
    if (!handler) {
      return interaction.reply({ content: 'Command not implemented.', ephemeral: true });
    }
    
    await handler(interaction);
    // Log successful slash command execution
    await logCommand(interaction.guild, interaction.commandName, interaction.user, interaction);
  } catch (e) {
    console.error('Interaction error:', e.message || JSON.stringify(e));
    await interaction.reply({ content: 'An error occurred while processing the command.', ephemeral: true });
    sendErrorToLogChannel(interaction.guild, 'interaction', e.message || JSON.stringify(e));
  }
});

// Handle button interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  try {
    const buttonId = interaction.customId;
    let handler = cogManager.getButtonHandler(buttonId);
    // Support dynamic ticket button IDs
    if (!handler) {
      if (buttonId.startsWith('ticket_close_')) handler = cogManager.getButtonHandler('ticket_close');
      else if (buttonId.startsWith('ticket_claim_')) handler = cogManager.getButtonHandler('ticket_claim');
      else if (buttonId.startsWith('ticket_delete_')) handler = cogManager.getButtonHandler('ticket_delete');
      else if (buttonId.startsWith('ticket_reopen_')) handler = cogManager.getButtonHandler('ticket_reopen');
    }
    if (handler) {
      await handler(interaction);
    } else {
      console.log(`No handler found for button: ${buttonId}`);
    }
  } catch (e) {
    console.error('Button interaction error:', e.message || JSON.stringify(e));
    await interaction.reply({ content: 'An error occurred while processing the button.', ephemeral: true });
    sendErrorToLogChannel(interaction.guild, 'button-interaction', e.message || JSON.stringify(e));
  }
});

// Handle modal submissions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  
  try {
    const modalId = interaction.customId;
    const handler = cogManager.getModalHandler(modalId);
    
    if (handler) {
      await handler(interaction);
    } else {
      console.log(`No handler found for modal: ${modalId}`);
    }
  } catch (e) {
    console.error('Modal interaction error:', e.message || JSON.stringify(e));
    await interaction.reply({ content: 'An error occurred while processing the form.', ephemeral: true });
    sendErrorToLogChannel(interaction.guild, 'modal-interaction', e.message || JSON.stringify(e));
  }
});

// Welcome/Goodbye/Autorole on member join
client.on('guildMemberAdd', async (member) => {
  try {
    console.log(`[DEBUG] guildMemberAdd fired for ${member.user.tag} (${member.id}) in ${member.guild.name}`);
    // New account flagging
    const accountAgeMs = Date.now() - member.user.createdAt.getTime();
    const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);
    if (accountAgeDays < 3) {
      // Log to mod-log
      await logEvent(member.guild, 'RAID WARNING', `New account joined: <@${member.id}> (created <t:${Math.floor(member.user.createdAt.getTime()/1000)}:R>)`, 0xe67e22);
    }
    // Check for raid protection
    const { checkRaidProtection } = require('./src/cogs/moderation');
    if (checkRaidProtection) {
      const isRaid = await checkRaidProtection(member.guild, 'joins', member.id);
      if (isRaid) {
        console.log(`[RAID] Raid detected in ${member.guild.name} - ${member.user.tag} joined`);
      }
    }
    
    // Autorole
    const roleId = await getAutorole(member.guild.id);
    if (roleId) {
      console.log(`[AUTOROLE] Attempting to assign role ${roleId} to ${member.user.tag} in ${member.guild.name}`);
      
      let role = member.guild.roles.cache.get(roleId);
      if (!role) {
        try { 
          role = await member.guild.roles.fetch(roleId); 
        } catch (e) { 
          console.error(`[AUTOROLE] Failed to fetch role ${roleId}:`, e.message || JSON.stringify(e));
          logError('autorole-fetch', e.message || JSON.stringify(e));
        }
      }
      if (!role) {
        const msg = `[AUTOROLE] Role ${roleId} not found in ${member.guild.name}. Autorole assignment skipped.`;
        console.error(msg);
        logError('autorole-missing', msg);
        const owner = await member.guild.fetchOwner().catch(() => null);
        if (owner) owner.send(`Autorole failed: The configured autorole (ID: ${roleId}) does not exist in your server **${member.guild.name}**. Please update your autorole settings.`).catch(() => {});
        return;
      }
      // Check if bot has permission to assign this role
      if (!member.guild.members.me.permissions.has('ManageRoles')) {
        const msg = `[AUTOROLE] Bot doesn't have ManageRoles permission in ${member.guild.name}`;
        console.error(msg);
        logError('autorole-permission', msg);
        return;
      }
      // Check if the role is manageable (not higher than bot's highest role)
      if (role.position >= member.guild.members.me.roles.highest.position) {
        const msg = `[AUTOROLE] Role ${role.name} is higher than bot's highest role in ${member.guild.name}`;
        console.error(msg);
        logError('autorole-unmanageable', msg);
        return;
      }
      try {
        await member.roles.add(role, 'Autorole assignment');
        console.log(`[AUTOROLE] Successfully assigned role ${role.name} to ${member.user.tag} in ${member.guild.name}`);
      } catch (e) { 
        const msg = `[AUTOROLE] Failed to assign role ${role.name} to ${member.user.tag}: ${e.message || JSON.stringify(e)}`;
        console.error(msg);
        logError('autorole-add', msg); 
      }
    }
    
    // Welcome message
    const { data: welcome } = await supabase.from('welcome_configs').select('*').eq('guild_id', member.guild.id).single();
    console.log('[DEBUG] Welcome config:', welcome);
    if (welcome && welcome.enabled && welcome.channel_id) {
      const channel = member.guild.channels.cache.get(welcome.channel_id);
      console.log('[DEBUG] Welcome channel:', channel ? `${channel.name} (${channel.id})` : 'Not found');
      if (!channel || channel.type !== 0) { // 0 = GUILD_TEXT
        const msg = `[WELCOME] Configured channel (${welcome.channel_id}) is missing or not a text channel in ${member.guild.name}.`;
        console.error(msg);
        logError('welcome-channel-missing', msg);
        return;
      }
      if (!channel.permissionsFor(member.guild.members.me).has('SendMessages')) {
        const msg = `[WELCOME] Bot lacks SendMessages permission in channel ${channel.name} (${channel.id}) in ${member.guild.name}.`;
        console.error(msg);
        logError('welcome-permission', msg);
        return;
      }
        let msg = welcome.message || 'Welcome, {user}, to {server}!';
      msg = msg.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name).replace('{memberCount}', member.guild.memberCount);
      try {
        const imageUrl = welcome.image && welcome.image.trim() ? welcome.image.trim() : null;
        let validImage = false;
        if (imageUrl) {
          try {
            const url = new URL(imageUrl);
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            validImage = validExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)) || url.hostname.includes('cdn.discordapp.com') || url.hostname.includes('media.discordapp.net');
          } catch {}
        }
        if (welcome.embed) {
          const embed = new EmbedBuilder().setDescription(msg).setColor(welcome.color || 0x1abc9c);
          if (validImage) embed.setImage(imageUrl);
          await channel.send({ embeds: [embed] });
        } else {
          await channel.send(msg);
          if (validImage) await channel.send(imageUrl);
        }
      } catch (e) {
        const errMsg = `[WELCOME] Failed to send welcome message in ${channel.name} (${channel.id}): ${e.message || JSON.stringify(e)}`;
        console.error(errMsg);
        logError('welcome-send', errMsg);
      }
    }
  } catch (e) {
    console.error(`[MEMBER-JOIN] Error processing member join for ${member.user.tag} in ${member.guild.name}:`, e.message || JSON.stringify(e));
    logError('member-join', e.message || JSON.stringify(e));
  }
});

// Goodbye message on member leave
client.on('guildMemberRemove', async (member) => {
  try {
    console.log(`[DEBUG] guildMemberRemove fired for ${member.user.tag} (${member.id}) in ${member.guild.name}`);
    const { data: goodbye } = await supabase.from('goodbye_configs').select('*').eq('guild_id', member.guild.id).single();
    console.log('[DEBUG] Goodbye config:', goodbye);
    if (goodbye && goodbye.enabled && goodbye.channel_id) {
      const channel = member.guild.channels.cache.get(goodbye.channel_id);
      console.log('[DEBUG] Goodbye channel:', channel ? `${channel.name} (${channel.id})` : 'Not found');
      if (!channel || channel.type !== 0) { // 0 = GUILD_TEXT
        const msg = `[GOODBYE] Configured channel (${goodbye.channel_id}) is missing or not a text channel in ${member.guild.name}.`;
        console.error(msg);
        logError('goodbye-channel-missing', msg);
        return;
      }
      if (!channel.permissionsFor(member.guild.members.me).has('SendMessages')) {
        const msg = `[GOODBYE] Bot lacks SendMessages permission in channel ${channel.name} (${channel.id}) in ${member.guild.name}.`;
        console.error(msg);
        logError('goodbye-permission', msg);
        return;
      }
        let msg = goodbye.message || 'Goodbye, {user}! We\'ll miss you!';
      msg = msg.replace('{user}', member.user.tag).replace('{server}', member.guild.name).replace('{memberCount}', member.guild.memberCount);
      try {
        const imageUrl = goodbye.image && goodbye.image.trim() ? goodbye.image.trim() : null;
        let validImage = false;
        if (imageUrl) {
          try {
            const url = new URL(imageUrl);
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            validImage = validExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)) || url.hostname.includes('cdn.discordapp.com') || url.hostname.includes('media.discordapp.net');
          } catch {}
        }
        if (goodbye.embed) {
          const embed = new EmbedBuilder().setDescription(msg).setColor(goodbye.color || 0xe74c3c);
          if (validImage) embed.setImage(imageUrl);
          await channel.send({ embeds: [embed] });
        } else {
          await channel.send(msg);
          if (validImage) await channel.send(imageUrl);
        }
      } catch (e) {
        const errMsg = `[GOODBYE] Failed to send goodbye message in ${channel.name} (${channel.id}): ${e.message || JSON.stringify(e)}`;
        console.error(errMsg);
        logError('goodbye-send', errMsg);
      }
    }
  } catch (e) {
    console.error(`[MEMBER-LEAVE] Error processing member leave for ${member.user.tag} in ${member.guild.name}:`, e.message || JSON.stringify(e));
    logError('member-leave', e.message || JSON.stringify(e));
  }
});

// Store deleted messages for sniping (array per channel, last hour)
global.snipedMessages = global.snipedMessages || {};

client.on('messageDelete', async (message) => {
  if (!message.guild || !message.channel || message.author?.bot) return;
  global.sniperEnabled = global.sniperEnabled || {};
  if (!global.sniperEnabled[message.guild.id]) return;
  if (!global.snipedMessages[message.guild.id]) global.snipedMessages[message.guild.id] = {};
  if (!global.snipedMessages[message.guild.id][message.channel.id]) global.snipedMessages[message.guild.id][message.channel.id] = [];
  // Store message details (add author_id and channel_name)
  global.snipedMessages[message.guild.id][message.channel.id].push({
    content: message.content || '[No text content]',
    author: message.author ? `${message.author.tag} (${message.author.id})` : 'Unknown',
    author_id: message.author?.id,
    channel_id: message.channel.id,
    channel_name: message.channel.name,
    timestamp: message.createdTimestamp,
    attachments: message.attachments?.map(a => a.url) || [],
    embeds: message.embeds || []
  });
  // Prune messages older than 1 hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  global.snipedMessages[message.guild.id][message.channel.id] = global.snipedMessages[message.guild.id][message.channel.id].filter(m => m.timestamp > oneHourAgo);
});

// Add anti-nuke monitoring for channel/role changes
client.on('channelDelete', async (channel) => {
  if (!channel.guild) return;
  
  try {
    const { checkAntiNuke } = require('./src/cogs/moderation');
    if (checkAntiNuke) {
      // Get the audit log to find who deleted the channel
      const auditLogs = await channel.guild.fetchAuditLogs({
        type: 'CHANNEL_DELETE',
        limit: 1
      }).catch(() => null);
      
      if (auditLogs && auditLogs.entries.first()) {
        const entry = auditLogs.entries.first();
        const isViolation = await checkAntiNuke(channel.guild, 'channel_delete', entry.executor.id);
        if (isViolation) {
          console.log(`[ANTI-NUKE] Channel deletion violation in ${channel.guild.name} by ${entry.executor.tag}`);
        }
      }
    }
  } catch (e) {
    console.error('Anti-nuke check error:', e);
  }
});

// Emoji deletion anti-nuke
client.on('emojiDelete', async (emoji) => {
  if (!emoji.guild) return;
  try {
    const { checkAntiNuke } = require('./src/cogs/moderation');
    if (checkAntiNuke) {
      // Get the audit log to find who deleted the emoji
      const auditLogs = await emoji.guild.fetchAuditLogs({
        type: 'EMOJI_DELETE',
        limit: 1
      }).catch(() => null);
      if (auditLogs && auditLogs.entries.first()) {
        const entry = auditLogs.entries.first();
        const isViolation = await checkAntiNuke(emoji.guild, 'emoji_delete', entry.executor.id);
        if (isViolation) {
          console.log(`[ANTI-NUKE] Emoji deletion violation in ${emoji.guild.name} by ${entry.executor.tag}`);
        }
      }
    }
  } catch (e) {
    console.error('Anti-nuke emoji check error:', e);
  }
});

// Webhook update anti-nuke (detect creation/deletion)
const webhookCache = new Map(); // Map<guildId-channelId, Set<webhookId>>
client.on('webhookUpdate', async (channel) => {
  if (!channel.guild) return;
  try {
    const webhooks = await channel.fetchWebhooks();
    const key = `${channel.guild.id}-${channel.id}`;
    const prev = webhookCache.get(key) || new Set();
    const current = new Set(webhooks.map(w => w.id));
    // Detect new webhooks
    for (const webhook of webhooks.values()) {
      if (!prev.has(webhook.id)) {
        // New webhook detected
        // Fetch audit log for creation
        const auditLogs = await channel.guild.fetchAuditLogs({
          type: 'WEBHOOK_CREATE',
          limit: 1
        }).catch(() => null);
        let creatorId = null;
        if (auditLogs && auditLogs.entries.first()) {
          const entry = auditLogs.entries.first();
          creatorId = entry.executor.id;
        }
        // Check anti-nuke whitelist
        const { checkAntiNuke } = require('./src/cogs/moderation');
        let isViolation = false;
        if (checkAntiNuke && creatorId) {
          isViolation = await checkAntiNuke(channel.guild, 'webhook_create', creatorId);
        }
        if (isViolation) {
          // Delete the webhook
          await webhook.delete('Unauthorized webhook creation detected by anti-nuke');
          // Log the event
          await logEvent(channel.guild, 'ANTI-NUKE', `Unauthorized webhook created by <@${creatorId}> in <#${channel.id}>. Webhook deleted.`, 0xe74c3c);
        }
      }
    }
    // Update cache
    webhookCache.set(key, current);
  } catch (e) {
    console.error('Anti-nuke webhook check error:', e);
  }
});

client.on('roleDelete', async (role) => {
  if (!role.guild) return;
  
  try {
    const { checkAntiNuke } = require('./src/cogs/moderation');
    if (checkAntiNuke) {
      // Get the audit log to find who deleted the role
      const auditLogs = await role.guild.fetchAuditLogs({
        type: 'ROLE_DELETE',
        limit: 1
      }).catch(() => null);
      
      if (auditLogs && auditLogs.entries.first()) {
        const entry = auditLogs.entries.first();
        const isViolation = await checkAntiNuke(role.guild, 'role_delete', entry.executor.id);
        if (isViolation) {
          console.log(`[ANTI-NUKE] Role deletion violation in ${role.guild.name} by ${entry.executor.tag}`);
        }
      }
    }
  } catch (e) {
    console.error('Anti-nuke check error:', e);
  }
});

client.on('guildBanAdd', async (ban) => {
  if (!ban.guild) return;
  
  try {
    const { checkAntiNuke } = require('./src/cogs/moderation');
    if (checkAntiNuke) {
      // Get the audit log to find who banned the user
      const auditLogs = await ban.guild.fetchAuditLogs({
        type: 'MEMBER_BAN_ADD',
        limit: 1
      }).catch(() => null);
      
      if (auditLogs && auditLogs.entries.first()) {
        const entry = auditLogs.entries.first();
        const isViolation = await checkAntiNuke(ban.guild, 'member_ban', entry.executor.id);
        if (isViolation) {
          console.log(`[ANTI-NUKE] Mass ban violation in ${ban.guild.name} by ${entry.executor.tag}`);
        }
      }
    }
  } catch (e) {
    console.error('Anti-nuke check error:', e);
  }
});

// Register starboard reaction handlers
const { handleStarboardReaction } = require('./src/cogs/utility');
client.on('messageReactionAdd', (reaction, user) => handleStarboardReaction(reaction, user, true));
client.on('messageReactionRemove', (reaction, user) => handleStarboardReaction(reaction, user, false));

// Enhanced event handlers for comprehensive logging and cog integration
client.on('guildMemberAdd', async (member) => {
  // Log member join event
  await enhancedLogger.logMemberEvent(
    member.guild.id,
    member.guild,
    'member_join',
    member.id,
    { username: member.user.username, accountAge: Date.now() - member.user.createdTimestamp }
  );

  // Execute cog event handlers
  const handlers = cogManager.getEventHandlers('guildMemberAdd');
  for (const handler of handlers) {
    try {
      await handler(member);
    } catch (error) {
      console.error('Error in guildMemberAdd handler:', error);
      await enhancedLogger.logError(member.guild.id, member.guild, error, { 
        context: 'guildMemberAdd_handler',
        memberId: member.id 
      });
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  // Log member leave event
  await enhancedLogger.logMemberEvent(
    member.guild.id,
    member.guild,
    'member_leave',
    member.id,
    { username: member.user.username, roles: member.roles.cache.map(r => r.name) }
  );

  // Execute cog event handlers
  const handlers = cogManager.getEventHandlers('guildMemberRemove');
  for (const handler of handlers) {
    try {
      await handler(member);
    } catch (error) {
      console.error('Error in guildMemberRemove handler:', error);
      await enhancedLogger.logError(member.guild.id, member.guild, error, { 
        context: 'guildMemberRemove_handler',
        memberId: member.id 
      });
    }
  }
});

client.on('channelCreate', async (channel) => {
  if (!channel.guild) return;
  await enhancedLogger.logChannelEvent(
    channel.guild.id,
    channel.guild,
    'channel_create',
    channel.id,
    null,
    { channelName: channel.name, channelType: channel.type }
  );
});

client.on('channelDelete', async (channel) => {
  if (!channel.guild) return;
  await enhancedLogger.logChannelEvent(
    channel.guild.id,
    channel.guild,
    'channel_delete',
    channel.id,
    null,
    { channelName: channel.name, channelType: channel.type }
  );
});

client.on('roleCreate', async (role) => {
  await enhancedLogger.logRoleEvent(
    role.guild.id,
    role.guild,
    'role_create',
    role.id,
    null,
    { roleName: role.name, roleColor: role.hexColor, permissions: role.permissions.toArray() }
  );
});

// Initialize dashboard API routes when bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  try {
    // Load cogs
    await cogManager.loadCogs();
    
    // Initialize dashboard API routes with the bot client
    discordClientForAPI = client;
    initializeAPIRoutes();
    
    // Start member tracking for all guilds
    for (const guild of client.guilds.cache.values()) {
      await updateMemberTracking(guild);
    }
    
    console.log('Bot initialization complete with enhanced features');
  } catch (error) {
    console.error('Error during bot initialization:', error);
  }
});

// Function to update member tracking
async function updateMemberTracking(guild) {
  try {
    const members = guild.members.cache;
    let online = 0, idle = 0, dnd = 0, offline = 0;
    
    members.forEach(member => {
      if (member.user.bot) return;
      const status = member.presence?.status || 'offline';
      switch (status) {
        case 'online': online++; break;
        case 'idle': idle++; break;
        case 'dnd': dnd++; break;
        default: offline++;
      }
    });

    await supabase.from('member_tracking').upsert({
      guild_id: guild.id,
      total_members: members.size,
      online_members: online,
      idle_members: idle,
      dnd_members: dnd,
      offline_members: offline
    });
  } catch (error) {
    console.error('Error updating member tracking:', error);
  }
}

// Periodic member tracking update
setInterval(async () => {
  for (const guild of client.guilds.cache.values()) {
    await updateMemberTracking(guild);
  }
}, 5 * 60 * 1000); // Update every 5 minutes

// Serve static files from dashboard/public
app.use('/dashboard/public', express.static(path.join(__dirname, 'dashboard/public')));

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the combined server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🌐 Combined bot and dashboard server listening on port ${PORT}`);
  console.log(`📊 Dashboard available at: http://localhost:${PORT}/dashboard/public/`);
  console.log(`🔍 Health check available at: http://localhost:${PORT}/health`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Login to Discord (only if credentials are available)
if (hasDiscordCredentials) {
  console.log('🤖 Starting Discord bot...');
  client.login(token).catch(error => {
    console.error('❌ Failed to connect to Discord:', error.message);
    console.log('📊 Web dashboard will continue running without bot functionality');
  });
} else {
  console.log('🚫 Skipping Discord bot connection - credentials not provided');
  console.log('📊 Web dashboard is running in standalone mode');
} 