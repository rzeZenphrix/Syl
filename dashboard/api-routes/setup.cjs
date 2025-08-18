// Setup Module API Routes
const express = require('express');
const router = express.Router();
const { EnhancedLogger } = require('../../src/enhanced-logger.js');

// Initialize logger (will be passed from main server)
let logger;
let supabase;

function initializeSetupRoutes(supabaseClient, discordClient) {
  supabase = supabaseClient;
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

  // Middleware for guild access validation
  const validateGuildAccess = async (req, res, next) => {
    const { guildId } = req.params;
    const userId = req.userId;
    
    try {
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }
      
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return res.status(403).json({ error: 'Not a member of this guild' });
      }
      
      // Check if user is admin or co-owner
      const isAdmin = member.permissions.has('Administrator') || 
                     guild.ownerId === userId;
      
      if (!isAdmin) {
        // Check co-owner status
        const { data: coOwner } = await supabase
          .from('co_owners')
          .select('permissions')
          .eq('guild_id', guildId)
          .eq('user_id', userId)
          .single();
          
        if (!coOwner) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        req.coOwnerPermissions = coOwner.permissions;
      }
      
      req.guild = guild;
      req.member = member;
      next();
    } catch (error) {
      console.error('Guild access validation error:', error);
      res.status(500).json({ error: 'Failed to validate guild access' });
    }
  };

  // Get current guild configuration
  router.get('/config/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId } = req.params;
      
      const { data: config, error } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Get co-owners
      const { data: coOwners } = await supabase
        .from('co_owners')
        .select('user_id, permissions, added_by, created_at')
        .eq('guild_id', guildId);

      // Get anti-nuke settings
      const { data: antiNuke } = await supabase
        .from('anti_nuke_settings')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      // Get anti-raid settings
      const { data: antiRaid } = await supabase
        .from('anti_raid_settings')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      // Get blacklist entries
      const { data: blacklist } = await supabase
        .from('enhanced_blacklist')
        .select('*')
        .eq('guild_id', guildId);

      res.json({
        config: config || getDefaultConfig(guildId),
        coOwners: coOwners || [],
        antiNuke: antiNuke || getDefaultAntiNukeSettings(guildId),
        antiRaid: antiRaid || getDefaultAntiRaidSettings(guildId),
        blacklist: blacklist || []
      });

    } catch (error) {
      console.error('Failed to get guild config:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/config' });
      res.status(500).json({ error: 'Failed to get configuration' });
    }
  });

  // Update guild configuration
  router.put('/config/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId } = req.params;
      const updates = req.body;
      
      // Get current config for logging
      const { data: currentConfig } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      // Update configuration
      const { data: newConfig, error } = await supabase
        .from('guild_configs')
        .upsert({
          guild_id: guildId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Log configuration changes
      for (const [key, value] of Object.entries(updates)) {
        const oldValue = currentConfig?.[key];
        if (oldValue !== value) {
          await logger.logConfigChange(
            guildId, 
            req.guild, 
            key, 
            oldValue, 
            value, 
            req.userId
          );
        }
      }

      res.json({ success: true, config: newConfig });

    } catch (error) {
      console.error('Failed to update guild config:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/config', updates: req.body });
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  });

  // Add co-owner
  router.post('/co-owners/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { userId: targetUserId, permissions = ['moderate', 'configure'] } = req.body;
      
      // Validate permissions
      if (!req.member.permissions.has('Administrator') && req.guild.ownerId !== req.userId) {
        return res.status(403).json({ error: 'Only administrators can add co-owners' });
      }

      // Check if user exists in guild
      const targetMember = await req.guild.members.fetch(targetUserId).catch(() => null);
      if (!targetMember) {
        return res.status(404).json({ error: 'User not found in guild' });
      }

      const { data: coOwner, error } = await supabase
        .from('co_owners')
        .upsert({
          guild_id: guildId,
          user_id: targetUserId,
          added_by: req.userId,
          permissions,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await logger.logConfigChange(
        guildId,
        req.guild,
        'co_owner_added',
        null,
        targetUserId,
        req.userId
      );

      res.json({ success: true, coOwner });

    } catch (error) {
      console.error('Failed to add co-owner:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/co-owners' });
      res.status(500).json({ error: 'Failed to add co-owner' });
    }
  });

  // Remove co-owner
  router.delete('/co-owners/:guildId/:userId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId, userId: targetUserId } = req.params;
      
      // Validate permissions
      if (!req.member.permissions.has('Administrator') && req.guild.ownerId !== req.userId) {
        return res.status(403).json({ error: 'Only administrators can remove co-owners' });
      }

      const { error } = await supabase
        .from('co_owners')
        .delete()
        .eq('guild_id', guildId)
        .eq('user_id', targetUserId);

      if (error) throw error;

      await logger.logConfigChange(
        guildId,
        req.guild,
        'co_owner_removed',
        targetUserId,
        null,
        req.userId
      );

      res.json({ success: true });

    } catch (error) {
      console.error('Failed to remove co-owner:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/co-owners/delete' });
      res.status(500).json({ error: 'Failed to remove co-owner' });
    }
  });

  // Update anti-nuke settings
  router.put('/anti-nuke/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId } = req.params;
      const settings = req.body;

      const { data, error } = await supabase
        .from('anti_nuke_settings')
        .upsert({
          guild_id: guildId,
          ...settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await logger.logConfigChange(
        guildId,
        req.guild,
        'anti_nuke_settings',
        null,
        settings,
        req.userId
      );

      res.json({ success: true, settings: data });

    } catch (error) {
      console.error('Failed to update anti-nuke settings:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/anti-nuke' });
      res.status(500).json({ error: 'Failed to update anti-nuke settings' });
    }
  });

  // Update anti-raid settings
  router.put('/anti-raid/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId } = req.params;
      const settings = req.body;

      const { data, error } = await supabase
        .from('anti_raid_settings')
        .upsert({
          guild_id: guildId,
          ...settings,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      await logger.logConfigChange(
        guildId,
        req.guild,
        'anti_raid_settings',
        null,
        settings,
        req.userId
      );

      res.json({ success: true, settings: data });

    } catch (error) {
      console.error('Failed to update anti-raid settings:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/anti-raid' });
      res.status(500).json({ error: 'Failed to update anti-raid settings' });
    }
  });

  // Add blacklist entry
  router.post('/blacklist/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { targetId, targetType, blacklistType, reason, expiresAt } = req.body;

      const { data, error } = await supabase
        .from('enhanced_blacklist')
        .insert({
          guild_id: guildId,
          target_id: targetId,
          target_type: targetType,
          blacklist_type: blacklistType,
          reason,
          added_by: req.userId,
          expires_at: expiresAt || null
        })
        .select()
        .single();

      if (error) throw error;

      await logger.logConfigChange(
        guildId,
        req.guild,
        'blacklist_added',
        null,
        { targetId, targetType, blacklistType, reason },
        req.userId
      );

      res.json({ success: true, entry: data });

    } catch (error) {
      console.error('Failed to add blacklist entry:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/blacklist' });
      res.status(500).json({ error: 'Failed to add blacklist entry' });
    }
  });

  // Remove blacklist entry
  router.delete('/blacklist/:guildId/:entryId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const { guildId, entryId } = req.params;

      const { error } = await supabase
        .from('enhanced_blacklist')
        .delete()
        .eq('guild_id', guildId)
        .eq('id', entryId);

      if (error) throw error;

      await logger.logConfigChange(
        guildId,
        req.guild,
        'blacklist_removed',
        entryId,
        null,
        req.userId
      );

      res.json({ success: true });

    } catch (error) {
      console.error('Failed to remove blacklist entry:', error);
      await logger.logError(req.params.guildId, req.guild, error, { endpoint: '/blacklist/delete' });
      res.status(500).json({ error: 'Failed to remove blacklist entry' });
    }
  });

  // Get available channels for configuration
  router.get('/channels/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const channels = req.guild.channels.cache
        .filter(channel => channel.type === 0) // Text channels only
        .map(channel => ({
          id: channel.id,
          name: channel.name,
          position: channel.position,
          parentId: channel.parentId
        }))
        .sort((a, b) => a.position - b.position);

      res.json({ channels });

    } catch (error) {
      console.error('Failed to get channels:', error);
      res.status(500).json({ error: 'Failed to get channels' });
    }
  });

  // Get available roles for configuration
  router.get('/roles/:guildId', requireAuth, validateGuildAccess, async (req, res) => {
    try {
      const roles = req.guild.roles.cache
        .filter(role => !role.managed && role.id !== req.guild.id) // Exclude managed roles and @everyone
        .map(role => ({
          id: role.id,
          name: role.name,
          color: role.hexColor,
          position: role.position,
          permissions: role.permissions.toArray()
        }))
        .sort((a, b) => b.position - a.position);

      res.json({ roles });

    } catch (error) {
      console.error('Failed to get roles:', error);
      res.status(500).json({ error: 'Failed to get roles' });
    }
  });

  return router;
}

// Default configuration helpers
function getDefaultConfig(guildId) {
  return {
    guild_id: guildId,
    admin_role_id: null,
    extra_role_ids: [],
    disabled_commands: [],
    log_channel: null,
    autorole: null,
    custom_prefix: ';',
    anti_nuke_enabled: false,
    anti_raid_enabled: false,
    max_mentions: 5,
    max_role_creates: 3,
    max_channel_creates: 5,
    auto_mod_enabled: false,
    welcome_enabled: false,
    goodbye_enabled: false,
    backup_enabled: true,
    logging_enabled: true
  };
}

function getDefaultAntiNukeSettings(guildId) {
  return {
    guild_id: guildId,
    enabled: false,
    max_kicks_per_minute: 5,
    max_bans_per_minute: 3,
    max_role_deletes_per_minute: 2,
    max_channel_deletes_per_minute: 3,
    max_member_kicks_per_user: 3,
    punishment_type: 'ban',
    whitelist_users: [],
    whitelist_roles: [],
    alert_channel: null
  };
}

function getDefaultAntiRaidSettings(guildId) {
  return {
    guild_id: guildId,
    enabled: false,
    max_joins_per_minute: 10,
    min_account_age_days: 7,
    punishment_type: 'kick',
    alert_channel: null,
    verification_level: 'medium'
  };
}

module.exports = { initializeSetupRoutes };