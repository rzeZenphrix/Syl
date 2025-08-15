// This file is a Node.js server. Run with: node dashboard/server.cjs
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Serve the OAuth URL from the environment
app.get('/api/oauth-url', (req, res) => {
  const url = process.env.DISCORD_OAUTH_URL;
  if (url) {
    res.json({ url });
  } else {
    res.status(500).json({ error: 'OAuth URL not configured.' });
  }
});

// OAuth callback endpoint
app.post('/api/oauth-callback', async (req, res) => {
  const code = req.body.code;
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

    // Persist the Discord access token keyed by Discord user id
    const { error } = await supabase
      .from('user_tokens')
      .upsert({ 
        user_id: user.id,
        access_token: tokenData.access_token 
      });
    
    if (error) {
      console.error('Failed to store user token in Supabase:', error);
      return res.status(500).json({ error: 'Failed to store user token' });
    }
    res.json({ token: fakeToken, user });
  } catch (e) {
    res.status(500).json({ error: 'OAuth callback failed', details: e.message });
  }
});

// Endpoint to get user's guilds
app.get('/api/user-guilds', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = auth.slice('Bearer '.length);
  if (!token.startsWith('discord-')) {
    return res.status(401).json({ error: 'Invalid token format' });
  }
  const userId = token.replace('discord-', '');
  const { data, error } = await supabase
    .from('user_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  if (error || !data) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  const accessToken = data.access_token;
  try {
    const guildRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!guildRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch guilds from Discord' });
    }
    const guilds = await guildRes.json();
    res.json(guilds);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch guilds', details: e.message });
  }
});

// --- Add /api/user endpoint ---
app.get('/api/user', async (req, res) => {
  const auth = req.headers.authorization;
  console.log('/api/user Authorization header:', auth); // DEBUG
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  const token = auth.slice('Bearer '.length);
  if (!token.startsWith('discord-')) {
    return res.status(401).json({ error: 'Invalid token format' });
  }
  const userId = token.replace('discord-', '');
  const { data, error } = await supabase
    .from('user_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  if (error || !data) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
  const accessToken = data.access_token;
  try {
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!userRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch user from Discord' });
    }
    const user = await userRes.json();
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user', details: e.message });
  }
});

// In-memory boost message configs: { [guildId]: { message, color } }
const boostConfigs = {};

// Get boost message config
app.get('/api/guild/:guildId/boost-message', (req, res) => {
  const { guildId } = req.params;
  const config = boostConfigs[guildId] || { message: 'Thank you for boosting, {user}!', color: '#5865f2' };
  res.json(config);
});

// Save boost message config
app.post('/api/guild/:guildId/boost-message', express.json(), (req, res) => {
  const { guildId } = req.params;
  const { message, color } = req.body;
  if (!message || typeof message !== 'string' || message.length > 300) {
    return res.status(400).json({ error: 'Invalid message' });
  }
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
    return res.status(400).json({ error: 'Invalid color' });
  }
  boostConfigs[guildId] = { message, color };
  res.json({ success: true });
});

// In-memory module activation state: { [guildId]: { [moduleKey]: true/false } }
const moduleActivation = {};

// Get module activation state (persistent)
app.get('/api/guild/:guildId/modules', async (req, res) => {
  const { guildId } = req.params;
  const { data, error } = await supabase
    .from('guild_modules')
    .select('module_key, enabled')
    .eq('guild_id', guildId);

  if (error) return res.status(500).json({ error: 'Database error', details: error.message });
  
  const state = {};
  (data || []).forEach(row => { state[row.module_key] = !!row.enabled; });
  res.json(state);
});

// Set module activation state (persistent)
app.post('/api/guild/:guildId/modules', express.json(), async (req, res) => {
  const { guildId } = req.params;
  const { moduleKey, enabled } = req.body;
  
  if (!moduleKey || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Invalid moduleKey or enabled' });
  }

  const { error } = await supabase
    .from('guild_modules')
    .upsert({
      guild_id: guildId,
      module_key: moduleKey,
      enabled: enabled
    });

  if (error) return res.status(500).json({ error: 'Database error', details: error.message });
  res.json({ success: true });
});

// Simulate fetching text channels for a guild
app.get('/api/guild/:guildId/channels', async (req, res) => {
  const { guildId } = req.params;
  if (!process.env.DISCORD_TOKEN) return res.status(500).json({ error: 'Bot token not configured' });
  try {
    const apiRes = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
    });
    if (apiRes.status === 403 || apiRes.status === 404) {
      return res.status(404).json({ error: 'Bot is not in this server or cannot access channels.' });
    }
    if (!apiRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch channels from Discord' });
    }
    const allChannels = await apiRes.json();
    // Only return text channels (type 0)
    const textChannels = allChannels.filter(c => c.type === 0).map(c => ({ id: c.id, name: `#${c.name}` }));
    res.json(textChannels);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch channels', details: e.message });
  }
});

// Simulate sending a test boost message
app.post('/api/guild/:guildId/boost-test', express.json(), async (req, res) => {
  const { guildId } = req.params;
  const { message, color, channelId, embed } = req.body;
  if (!process.env.DISCORD_TOKEN) return res.status(500).json({ error: 'Bot token not configured' });
  if (!channelId) return res.status(400).json({ error: 'Missing channelId' });
  try {
    let body;
    if (embed) {
      body = {
        embeds: [{ description: message, color: parseInt(color.replace('#', ''), 16) }]
      };
    } else {
      body = { content: message };
    }
    const apiRes = await fetch(`https://discord.com/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!apiRes.ok) {
      const err = await apiRes.json().catch(() => ({}));
      return res.status(500).json({ error: 'Failed to send test message', details: err.message || apiRes.statusText });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send test message', details: e.message });
  }
});

// Fetch real server info from Discord
app.get('/api/guild/:guildId/info', async (req, res) => {
  const { guildId } = req.params;
  try {
    const apiRes = await fetch(`https://discord.com/api/guilds/${guildId}`, {
      headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
    });
    if (!apiRes.ok) return res.status(404).json({ error: 'Guild not found or bot not in guild' });
    const guild = await apiRes.json();
    const icon = guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : '';
    // Fetch channels
    const channelsRes = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
      headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
    });
    const channels = channelsRes.ok ? await channelsRes.json() : [];
    // Fetch roles
    const rolesRes = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
      headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
    });
    const roles = rolesRes.ok ? await rolesRes.json() : [];
    // Fetch member count (approximate, as Discord API does not provide a direct endpoint for member count except via /guilds/{guild.id}/widget.json or presence)
    let activeUsers = '-';
    try {
      const widgetRes = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, {
        headers: { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}` }
      });
      if (widgetRes.ok) {
        const widget = await widgetRes.json();
        activeUsers = widget.presence_count || widget.members?.length || '-';
      }
    } catch {}
    res.json({
      name: guild.name,
      icon,
      activeUsers: activeUsers !== '-' ? activeUsers : (guild.approximate_member_count || '-'),
      channels: channels.length,
      roles: roles.length,
      status: 'Online'
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch guild info', details: e.message });
  }
});

// Cache for bot guilds
let botGuildsCache = { guilds: [], fetchedAt: 0 };

app.get('/api/bot-guilds', async (req, res) => {
  if (!process.env.DISCORD_TOKEN) return res.status(500).json({ error: 'Bot token not configured' });
  const now = Date.now();
  // Cache for 60 seconds
  if (botGuildsCache.guilds.length > 0 && now - botGuildsCache.fetchedAt < 60000) {
    return res.json(botGuildsCache.guilds);
  }
  try {
    const botRes = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
    });
    if (!botRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch bot guilds from Discord' });
    }
    const guilds = await botRes.json();
    botGuildsCache = { guilds, fetchedAt: now };
    res.json(guilds);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch bot guilds', details: e.message });
  }
});

// Optionally, serve static files for the dashboard
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.LOGIN_SERVER_PORT || 5174;
app.listen(PORT, () => {
  console.log(`Login server running at https://syl-2a38.onrender.com`);
}); 