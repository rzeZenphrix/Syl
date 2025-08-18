// Enhanced Logger for comprehensive activity tracking
const { EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

class EnhancedLogger {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.colors = {
      ERROR: 0xff0000,
      WARN: 0xffb347,
      INFO: 0x7289da,
      DEBUG: 0x95a5a6,
      SUCCESS: 0x43b581,
      CONFIG: 0x6c7fff,
      MODERATION: 0xe91e63,
      MEMBER: 0x9c27b0,
      CHANNEL: 0x2196f3,
      ROLE: 0xff9800
    };
  }

  // Database logging with structured data
  async logToDatabase(guildId, type, level, message, metadata = {}) {
    try {
      const logEntry = {
        guild_id: guildId,
        log_type: type,
        log_level: level,
        message: message,
        metadata: metadata,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('system_logs')
        .insert([logEntry]);

      if (error) {
        console.error('Failed to log to database:', error);
      }
    } catch (err) {
      console.error('Database logging error:', err);
    }
  }

  // Discord channel logging with embeds
  async logToDiscord(guild, type, level, message, metadata = {}) {
    try {
      const config = await this.getGuildConfig(guild.id);
      const logChannelId = config?.log_channel;
      
      if (!logChannelId) return;
      
      const channel = guild.channels.cache.get(logChannelId);
      if (!channel) return;

      const color = this.colors[type] || this.colors[level] || this.colors.INFO;
      
      const embed = new EmbedBuilder()
        .setTitle(`${this.getTypeIcon(type)} ${type} Log`)
        .setDescription(message)
        .setColor(color)
        .setTimestamp()
        .addFields([
          { name: 'Level', value: level, inline: true },
          { name: 'Guild', value: guild.name, inline: true }
        ]);

      // Add metadata fields
      if (metadata.user) {
        embed.addFields([{ name: 'User', value: `<@${metadata.user}>`, inline: true }]);
      }
      if (metadata.channel) {
        embed.addFields([{ name: 'Channel', value: `<#${metadata.channel}>`, inline: true }]);
      }
      if (metadata.role) {
        embed.addFields([{ name: 'Role', value: `<@&${metadata.role}>`, inline: true }]);
      }
      if (metadata.command) {
        embed.addFields([{ name: 'Command', value: metadata.command, inline: true }]);
      }
      if (metadata.before && metadata.after) {
        embed.addFields([
          { name: 'Before', value: String(metadata.before).substring(0, 1024), inline: false },
          { name: 'After', value: String(metadata.after).substring(0, 1024), inline: false }
        ]);
      }

      await channel.send({ embeds: [embed] });
    } catch (err) {
      console.error('Discord logging error:', err);
    }
  }

  // Unified logging method
  async log(guildId, type, level, message, metadata = {}) {
    // Always log to database
    await this.logToDatabase(guildId, type, level, message, metadata);
    
    // Log to console for development
    console.log(`[${level}] [${type}] [${guildId}] ${message}`, metadata);
    
    // Log to Discord if guild is available
    if (metadata.guild) {
      await this.logToDiscord(metadata.guild, type, level, message, metadata);
    }
  }

  // Convenience methods for different log types
  async logConfigChange(guildId, guild, setting, oldValue, newValue, userId) {
    await this.log(guildId, 'CONFIG', 'INFO', 
      `Configuration changed: ${setting}`,
      {
        guild,
        user: userId,
        setting,
        before: oldValue,
        after: newValue,
        change_type: 'configuration'
      }
    );
  }

  async logModerationAction(guildId, guild, action, targetUserId, moderatorId, reason) {
    await this.log(guildId, 'MODERATION', 'INFO',
      `Moderation action: ${action}`,
      {
        guild,
        user: targetUserId,
        moderator: moderatorId,
        action,
        reason,
        action_type: 'moderation'
      }
    );
  }

  async logMemberEvent(guildId, guild, event, userId, details = {}) {
    await this.log(guildId, 'MEMBER', 'INFO',
      `Member event: ${event}`,
      {
        guild,
        user: userId,
        event,
        ...details,
        event_type: 'member'
      }
    );
  }

  async logChannelEvent(guildId, guild, event, channelId, userId, details = {}) {
    await this.log(guildId, 'CHANNEL', 'INFO',
      `Channel event: ${event}`,
      {
        guild,
        channel: channelId,
        user: userId,
        event,
        ...details,
        event_type: 'channel'
      }
    );
  }

  async logRoleEvent(guildId, guild, event, roleId, userId, details = {}) {
    await this.log(guildId, 'ROLE', 'INFO',
      `Role event: ${event}`,
      {
        guild,
        role: roleId,
        user: userId,
        event,
        ...details,
        event_type: 'role'
      }
    );
  }

  async logError(guildId, guild, error, context = {}) {
    await this.log(guildId, 'ERROR', 'ERROR',
      `Error occurred: ${error.message}`,
      {
        guild,
        error: error.stack,
        context,
        error_type: 'system'
      }
    );
  }

  async logCommand(guildId, guild, command, userId, success, details = {}) {
    const level = success ? 'INFO' : 'WARN';
    await this.log(guildId, 'COMMAND', level,
      `Command ${success ? 'executed' : 'failed'}: ${command}`,
      {
        guild,
        user: userId,
        command,
        success,
        ...details,
        event_type: 'command'
      }
    );
  }

  // Helper methods
  getTypeIcon(type) {
    const icons = {
      CONFIG: '⚙️',
      MODERATION: '🔨',
      MEMBER: '👤',
      CHANNEL: '📢',
      ROLE: '🎭',
      ERROR: '❌',
      WARN: '⚠️',
      INFO: 'ℹ️',
      DEBUG: '🐛',
      SUCCESS: '✅',
      COMMAND: '💻'
    };
    return icons[type] || '📝';
  }

  async getGuildConfig(guildId) {
    try {
      const { data, error } = await this.supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', guildId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (err) {
      console.error('Failed to get guild config:', err);
      return null;
    }
  }

  // Get logs for dashboard
  async getLogs(guildId, filters = {}) {
    try {
      let query = this.supabase
        .from('system_logs')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

      if (filters.type) {
        query = query.eq('log_type', filters.type);
      }
      if (filters.level) {
        query = query.eq('log_level', filters.level);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to get logs:', err);
      return [];
    }
  }

  // Get log statistics for dashboard
  async getLogStats(guildId, timeframe = '24h') {
    try {
      const timeframeSql = {
        '1h': "created_at >= NOW() - INTERVAL '1 hour'",
        '24h': "created_at >= NOW() - INTERVAL '24 hours'",
        '7d': "created_at >= NOW() - INTERVAL '7 days'",
        '30d': "created_at >= NOW() - INTERVAL '30 days'"
      };

      const { data, error } = await this.supabase
        .rpc('get_log_stats', {
          p_guild_id: guildId,
          p_timeframe: timeframeSql[timeframe] || timeframeSql['24h']
        });

      if (error) throw error;
      return data || {};
    } catch (err) {
      console.error('Failed to get log stats:', err);
      return {};
    }
  }
}

module.exports = { EnhancedLogger };