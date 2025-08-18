// Real-time Data Integration API Routes
const express = require('express');
const router = express.Router();
const { EnhancedLogger } = require('../../src/enhanced-logger');

let logger;
let supabase;
let discordClient;

function initializeRealtimeRoutes(supabaseClient, client) {
  supabase = supabaseClient;
  discordClient = client;
  logger = new EnhancedLogger(supabaseClient);

  // Middleware for authentication
  const requireAuth = async (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer discord-')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = auth.replace('Bearer discord-', '');
    req.userId = userId;
    next();
  };

  // Sync server data (roles, channels, members)
  router.post('/sync/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = discordClient.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      // Fetch all members if not cached
      await guild.members.fetch();

      // Sync roles
      const roles = guild.roles.cache.map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        permissions: role.permissions.toString(),
        mentionable: role.mentionable,
        hoist: role.hoist,
        managed: role.managed,
        createdAt: role.createdAt.toISOString()
      }));

      // Sync channels
      const channels = guild.channels.cache.map(channel => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        parentId: channel.parentId,
        topic: channel.topic || null,
        nsfw: channel.nsfw || false,
        bitrate: channel.bitrate || null,
        userLimit: channel.userLimit || null,
        createdAt: channel.createdAt.toISOString()
      }));

      // Sync member data (basic info only for privacy)
      const members = guild.members.cache.map(member => ({
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        avatar: member.user.displayAvatarURL(),
        joinedAt: member.joinedAt?.toISOString(),
        roles: member.roles.cache.map(role => role.id),
        status: member.presence?.status || 'offline',
        bot: member.user.bot
      }));

      // Update server structure in database
      await Promise.all([
        supabase.from('server_structure').upsert({
          guild_id: guildId,
          structure_type: 'roles',
          structure_data: roles
        }),
        supabase.from('server_structure').upsert({
          guild_id: guildId,
          structure_type: 'channels',
          structure_data: channels
        }),
        supabase.from('server_structure').upsert({
          guild_id: guildId,
          structure_type: 'members',
          structure_data: members
        })
      ]);

      // Update member tracking
      const memberCounts = getMemberCounts(guild);
      await supabase.from('member_tracking').upsert({
        guild_id: guildId,
        ...memberCounts
      });

      await logger.log(guildId, 'SYNC', 'INFO', 'Server data synchronized', {
        guild,
        user: req.userId,
        roleCount: roles.length,
        channelCount: channels.length,
        memberCount: members.length
      });

      res.json({
        success: true,
        synced: {
          roles: roles.length,
          channels: channels.length,
          members: members.length,
          memberCounts
        }
      });

    } catch (error) {
      console.error('Sync error:', error);
      await logger.logError(req.params.guildId, null, error, { endpoint: '/sync' });
      res.status(500).json({ error: 'Failed to sync server data' });
    }
  });

  // Get current member counts
  router.get('/member-counts/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = discordClient.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const memberCounts = getMemberCounts(guild);
      
      // Update database
      await supabase.from('member_tracking').upsert({
        guild_id: guildId,
        ...memberCounts
      });

      res.json(memberCounts);

    } catch (error) {
      console.error('Member counts error:', error);
      res.status(500).json({ error: 'Failed to get member counts' });
    }
  });

  // Get server structure from cache/database
  router.get('/structure/:guildId/:type', requireAuth, async (req, res) => {
    try {
      const { guildId, type } = req.params;
      
      const { data, error } = await supabase
        .from('server_structure')
        .select('structure_data, last_synced')
        .eq('guild_id', guildId)
        .eq('structure_type', type)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) {
        return res.status(404).json({ error: 'Structure data not found. Please sync first.' });
      }

      res.json({
        data: data.structure_data,
        lastSynced: data.last_synced,
        type
      });

    } catch (error) {
      console.error('Structure fetch error:', error);
      res.status(500).json({ error: 'Failed to get structure data' });
    }
  });

  // Get live guild info
  router.get('/guild-info/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = discordClient.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const owner = await guild.fetchOwner();
      const memberCounts = getMemberCounts(guild);

      const guildInfo = {
        id: guild.id,
        name: guild.name,
        icon: guild.iconURL({ size: 256 }),
        banner: guild.bannerURL({ size: 1024 }),
        description: guild.description,
        ownerId: guild.ownerId,
        ownerTag: owner.user.tag,
        createdAt: guild.createdAt.toISOString(),
        boostLevel: guild.premiumTier,
        boostCount: guild.premiumSubscriptionCount,
        verificationLevel: guild.verificationLevel,
        features: guild.features,
        ...memberCounts,
        channelCount: guild.channels.cache.size,
        roleCount: guild.roles.cache.size,
        emojiCount: guild.emojis.cache.size
      };

      res.json(guildInfo);

    } catch (error) {
      console.error('Guild info error:', error);
      res.status(500).json({ error: 'Failed to get guild info' });
    }
  });

  // Fetch and update roles/channels specifically
  router.post('/fetch-roles-channels/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const guild = discordClient.guilds.cache.get(guildId);
      
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      // Force fetch latest data from Discord
      await Promise.all([
        guild.roles.fetch(),
        guild.channels.fetch()
      ]);

      const roles = guild.roles.cache
        .filter(role => role.id !== guild.id) // Exclude @everyone
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          position: role.position,
          permissions: role.permissions.toString(),
          mentionable: role.mentionable,
          hoist: role.hoist,
          managed: role.managed,
          memberCount: role.members.size,
          createdAt: role.createdAt.toISOString()
        }))
        .sort((a, b) => b.position - a.position);

      const channels = guild.channels.cache
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          position: channel.position,
          parentId: channel.parentId,
          topic: channel.topic || null,
          nsfw: channel.nsfw || false,
          bitrate: channel.bitrate || null,
          userLimit: channel.userLimit || null,
          memberCount: channel.members?.size || 0,
          createdAt: channel.createdAt.toISOString()
        }))
        .sort((a, b) => a.position - b.position);

      // Update database
      await Promise.all([
        supabase.from('server_structure').upsert({
          guild_id: guildId,
          structure_type: 'roles',
          structure_data: roles
        }),
        supabase.from('server_structure').upsert({
          guild_id: guildId,
          structure_type: 'channels',
          structure_data: channels
        })
      ]);

      await logger.log(guildId, 'SYNC', 'INFO', 'Roles and channels fetched', {
        guild,
        user: req.userId,
        roleCount: roles.length,
        channelCount: channels.length
      });

      res.json({
        success: true,
        roles,
        channels,
        counts: {
          roles: roles.length,
          channels: channels.length,
          textChannels: channels.filter(c => c.type === 0).length,
          voiceChannels: channels.filter(c => c.type === 2).length,
          categories: channels.filter(c => c.type === 4).length
        }
      });

    } catch (error) {
      console.error('Fetch roles/channels error:', error);
      await logger.logError(req.params.guildId, null, error, { endpoint: '/fetch-roles-channels' });
      res.status(500).json({ error: 'Failed to fetch roles and channels' });
    }
  });

  // Get recent activity/logs for dashboard
  router.get('/activity/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { limit = 50, type, level } = req.query;

      const logs = await logger.getLogs(guildId, {
        type,
        level,
        limit: parseInt(limit)
      });

      const stats = await logger.getLogStats(guildId, '24h');

      res.json({
        logs,
        stats,
        total: logs.length
      });

    } catch (error) {
      console.error('Activity fetch error:', error);
      res.status(500).json({ error: 'Failed to get activity data' });
    }
  });

  // WebSocket-like endpoint for live updates (using Server-Sent Events)
  router.get('/live-updates/:guildId', requireAuth, async (req, res) => {
    const { guildId } = req.params;
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial data
    const guild = discordClient.guilds.cache.get(guildId);
    if (guild) {
      const memberCounts = getMemberCounts(guild);
      res.write(`data: ${JSON.stringify({ type: 'memberCounts', data: memberCounts })}\n\n`);
    }

    // Set up periodic updates
    const updateInterval = setInterval(async () => {
      try {
        const guild = discordClient.guilds.cache.get(guildId);
        if (guild) {
          const memberCounts = getMemberCounts(guild);
          res.write(`data: ${JSON.stringify({ type: 'memberCounts', data: memberCounts })}\n\n`);
          
          // Update database
          await supabase.from('member_tracking').upsert({
            guild_id: guildId,
            ...memberCounts
          });
        }
      } catch (error) {
        console.error('Live update error:', error);
      }
    }, 30000); // Update every 30 seconds

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(updateInterval);
    });
  });

  return router;
}

// Helper function to get member counts by status
function getMemberCounts(guild) {
  const members = guild.members.cache;
  
  let online = 0, idle = 0, dnd = 0, offline = 0;
  
  members.forEach(member => {
    if (member.user.bot) return; // Skip bots
    
    const status = member.presence?.status || 'offline';
    switch (status) {
      case 'online':
        online++;
        break;
      case 'idle':
        idle++;
        break;
      case 'dnd':
        dnd++;
        break;
      default:
        offline++;
    }
  });

  return {
    total_members: members.size,
    online_members: online,
    idle_members: idle,
    dnd_members: dnd,
    offline_members: offline
  };
}

module.exports = { initializeRealtimeRoutes };