// This file is a Node.js server. Run with: node dashboard/server.cjs
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

    // Persist the Discord access token keyed by Discord user id
    const { error } = await supabase
      .from('user_tokens')
      .upsert({ 
        user_id: user.id,
        access_token: tokenData.access_token 
      });
    
    if (error) {
      console.error('Failed to store user token in Supabase:', error);
      return res.redirect('/callback.html?error=Failed to store user token');
    }
    
    // Redirect to frontend with token
    res.redirect(`/callback.html?token=${encodeURIComponent(fakeToken)}&user=${encodeURIComponent(JSON.stringify(user))}`);
  } catch (e) {
    console.error('OAuth callback error:', e);
    res.redirect('/callback.html?error=OAuth callback failed');
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

// Helpers for auth and permissions
async function getAccessTokenFromAuthHeader(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length);
  if (!token.startsWith('discord-')) return null;
  const userId = token.replace('discord-', '');
  const { data, error } = await supabase
    .from('user_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data.access_token;
}

async function isUserManagerOfGuild(userAccessToken, guildId) {
  try {
    const res = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${userAccessToken}` }
    });
    if (!res.ok) return false;
    const guilds = await res.json();
    const g = guilds.find(g => g.id === guildId);
    if (!g) return false;
    const MANAGE_GUILD = 0x20;
    try {
      return (BigInt(g.permissions) & BigInt(MANAGE_GUILD)) !== 0n;
    } catch {
      const perms = typeof g.permissions === 'string' ? parseInt(g.permissions, 10) : (g.permissions || 0);
      return (perms & MANAGE_GUILD) !== 0;
    }
  } catch {
    return false;
  }
}

async function isGuildModuleEnabled(guildId, moduleKey) {
  const { data, error } = await supabase
    .from('guild_modules')
    .select('enabled')
    .eq('guild_id', guildId)
    .eq('module_key', moduleKey)
    .single();
  if (error && error.code !== 'PGRST116') return false;
  return !!data?.enabled;
}

// Backup endpoint: export guild structure
app.get('/api/guild/:guildId/backup', async (req, res) => {
  const { guildId } = req.params;
  const accessToken = await getAccessTokenFromAuthHeader(req);
  if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });
  const authorized = await isUserManagerOfGuild(accessToken, guildId);
  if (!authorized) return res.status(403).json({ error: 'Insufficient permissions' });
  const enabled = await isGuildModuleEnabled(guildId, 'backup');
  if (!enabled) return res.status(403).json({ error: 'Backup module disabled' });

  if (!process.env.DISCORD_TOKEN) return res.status(500).json({ error: 'Bot token not configured' });
  try {
    const [guildRes, rolesRes, channelsRes] = await Promise.all([
      fetch(`https://discord.com/api/guilds/${guildId}`, { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }),
      fetch(`https://discord.com/api/guilds/${guildId}/roles`, { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } }),
      fetch(`https://discord.com/api/guilds/${guildId}/channels`, { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` } })
    ]);
    if (!guildRes.ok || !rolesRes.ok || !channelsRes.ok) {
      return res.status(500).json({ error: 'Failed to fetch guild data' });
    }
    const guild = await guildRes.json();
    const roles = await rolesRes.json();
    const channels = await channelsRes.json();
    const backup = {
      version: 1,
      createdAt: Date.now(),
      guild: { id: guild.id, name: guild.name, icon: guild.icon, features: guild.features },
      roles: roles.map(r => ({
        id: r.id,
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: r.permissions,
        mentionable: r.mentionable,
        position: r.position,
        managed: r.managed
      })),
      channels: channels.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        topic: c.topic,
        nsfw: c.nsfw,
        bitrate: c.bitrate,
        user_limit: c.user_limit,
        rate_limit_per_user: c.rate_limit_per_user,
        parent_id: c.parent_id,
        permission_overwrites: c.permission_overwrites,
        position: c.position
      }))
    };
    const filename = `guild-${guildId}-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch (e) {
    res.status(500).json({ error: 'Backup failed', details: e.message });
  }
});

// Restore endpoint: recreate roles/channels
app.post('/api/guild/:guildId/restore', async (req, res) => {
  const { guildId } = req.params;
  const backup = req.body;
  const accessToken = await getAccessTokenFromAuthHeader(req);
  if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });
  const authorized = await isUserManagerOfGuild(accessToken, guildId);
  if (!authorized) return res.status(403).json({ error: 'Insufficient permissions' });
  const enabled = await isGuildModuleEnabled(guildId, 'backup');
  if (!enabled) return res.status(403).json({ error: 'Backup module disabled' });
  if (!backup || !backup.roles || !backup.channels) return res.status(400).json({ error: 'Invalid backup file' });
  if (!process.env.DISCORD_TOKEN) return res.status(500).json({ error: 'Bot token not configured' });

  const botHeaders = { 'Authorization': `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' };

  try {
    // Create roles (skip @everyone)
    const roleIdMap = {};
    const rolesSorted = backup.roles
      .filter(r => r.name !== '@everyone')
      .sort((a, b) => a.position - b.position);
    for (const r of rolesSorted) {
      const body = {
        name: r.name,
        permissions: r.permissions,
        color: r.color,
        hoist: r.hoist,
        mentionable: r.mentionable
      };
      const createRes = await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
        method: 'POST', headers: botHeaders, body: JSON.stringify(body)
      });
      if (createRes.ok) {
        const created = await createRes.json();
        roleIdMap[r.id] = created.id;
      }
    }

    // Reorder roles
    const rolesReorderPayload = rolesSorted.map(r => ({ id: roleIdMap[r.id], position: r.position }));
    if (rolesReorderPayload.length > 0) {
      await fetch(`https://discord.com/api/guilds/${guildId}/roles`, {
        method: 'PATCH', headers: botHeaders, body: JSON.stringify(rolesReorderPayload)
      });
    }

    // Create channels: categories first
    const channelIdMap = {};
    const categories = backup.channels.filter(c => c.type === 4).sort((a, b) => a.position - b.position);
    for (const cat of categories) {
      const body = { name: cat.name, type: 4, position: cat.position };
      const resp = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
        method: 'POST', headers: botHeaders, body: JSON.stringify(body)
      });
      if (resp.ok) {
        const created = await resp.json();
        channelIdMap[cat.id] = created.id;
      }
    }

    // Create non-category channels
    const others = backup.channels.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
    for (const ch of others) {
      const overwrites = (ch.permission_overwrites || []).map(ow => ({
        id: ow.type === 0 && roleIdMap[ow.id] ? roleIdMap[ow.id] : ow.id,
        type: ow.type,
        allow: ow.allow,
        deny: ow.deny
      }));
      const body = {
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
        nsfw: ch.nsfw,
        bitrate: ch.bitrate,
        user_limit: ch.user_limit,
        rate_limit_per_user: ch.rate_limit_per_user,
        parent_id: ch.parent_id ? (channelIdMap[ch.parent_id] || null) : null,
        permission_overwrites: overwrites
      };
      const resp = await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
        method: 'POST', headers: botHeaders, body: JSON.stringify(body)
      });
      if (resp.ok) {
        const created = await resp.json();
        channelIdMap[ch.id] = created.id;
      }
    }

    // Reorder channels
    const positionsPayload = backup.channels.map(c => ({
      id: channelIdMap[c.id] || null,
      position: c.position,
      parent_id: c.parent_id ? (channelIdMap[c.parent_id] || null) : null
    })).filter(x => !!x.id);
    if (positionsPayload.length > 0) {
      await fetch(`https://discord.com/api/guilds/${guildId}/channels`, {
        method: 'PATCH', headers: botHeaders, body: JSON.stringify(positionsPayload)
      });
    }

    res.json({ success: true, createdRoles: Object.keys(roleIdMap).length, createdChannels: Object.keys(channelIdMap).length });
  } catch (e) {
    res.status(500).json({ error: 'Restore failed', details: e.message });
  }
});

// Optionally, serve static files for the dashboard
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index for SPA-like navigation (Express 5: avoid '*' with path-to-regexp)
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || process.env.LOGIN_SERVER_PORT || 5174;
app.listen(PORT, () => {
  console.log(`Dashboard server listening on port ${PORT}`);
}); 