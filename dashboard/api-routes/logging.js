// Logging System API Routes
const express = require('express');
const router = express.Router();
const { EnhancedLogger } = require('../../src/enhanced-logger');

let logger;
let supabase;

function initializeLoggingRoutes(supabaseClient) {
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

  // Get logs with filtering and pagination
  router.get('/logs/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { 
        type, 
        level, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 50,
        search 
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let query = supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      // Apply filters
      if (type && type !== 'all') {
        query = query.eq('log_type', type.toUpperCase());
      }
      if (level && level !== 'all') {
        query = query.eq('log_level', level.toUpperCase());
      }
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      if (search) {
        query = query.or(`message.ilike.%${search}%,metadata->>user.ilike.%${search}%`);
      }

      const { data: logs, error, count } = await query;

      if (error) throw error;

      res.json({
        logs: logs || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          pages: Math.ceil((count || 0) / parseInt(limit))
        }
      });

    } catch (error) {
      console.error('Failed to get logs:', error);
      res.status(500).json({ error: 'Failed to retrieve logs' });
    }
  });

  // Get log statistics
  router.get('/stats/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { timeframe = '24h' } = req.query;

      const stats = await logger.getLogStats(guildId, timeframe);

      // Get additional statistics
      const { data: recentActivity } = await supabase
        .from('system_logs')
        .select('log_type, created_at')
        .eq('guild_id', guildId)
        .gte('created_at', getTimeframeDate(timeframe))
        .order('created_at', { ascending: false })
        .limit(100);

      // Process activity timeline
      const activityTimeline = processActivityTimeline(recentActivity || [], timeframe);

      // Get top error messages
      const { data: topErrors } = await supabase
        .from('system_logs')
        .select('message, metadata')
        .eq('guild_id', guildId)
        .eq('log_level', 'ERROR')
        .gte('created_at', getTimeframeDate(timeframe))
        .limit(10);

      res.json({
        stats,
        activityTimeline,
        topErrors: topErrors || [],
        timeframe
      });

    } catch (error) {
      console.error('Failed to get log stats:', error);
      res.status(500).json({ error: 'Failed to retrieve log statistics' });
    }
  });

  // Get command usage statistics
  router.get('/command-stats/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { days = 30 } = req.query;

      const { data: commandStats, error } = await supabase
        .rpc('get_command_stats', {
          p_guild_id: guildId,
          p_days: parseInt(days)
        });

      if (error) throw error;

      // Get command usage over time
      const { data: usageOverTime } = await supabase
        .from('command_usage')
        .select('command_name, used_at')
        .eq('guild_id', guildId)
        .gte('used_at', new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString())
        .order('used_at', { ascending: true });

      const timelineData = processCommandTimeline(usageOverTime || [], parseInt(days));

      res.json({
        commandStats: commandStats || [],
        usageOverTime: timelineData,
        period: `${days} days`
      });

    } catch (error) {
      console.error('Failed to get command stats:', error);
      res.status(500).json({ error: 'Failed to retrieve command statistics' });
    }
  });

  // Export logs
  router.get('/export/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { format = 'json', type, level, startDate, endDate } = req.query;

      let query = supabase
        .from('system_logs')
        .select('*')
        .eq('guild_id', guildId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (type && type !== 'all') {
        query = query.eq('log_type', type.toUpperCase());
      }
      if (level && level !== 'all') {
        query = query.eq('log_level', level.toUpperCase());
      }
      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: logs, error } = await query;

      if (error) throw error;

      if (format === 'csv') {
        const csv = convertLogsToCSV(logs || []);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="logs_${guildId}_${Date.now()}.csv"`);
        res.send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="logs_${guildId}_${Date.now()}.json"`);
        res.json({
          exportedAt: new Date().toISOString(),
          guildId,
          filters: { type, level, startDate, endDate },
          logs: logs || []
        });
      }

      // Log the export
      await logger.log(guildId, 'SYSTEM', 'INFO', 'Logs exported', {
        user: req.userId,
        format,
        logCount: (logs || []).length,
        filters: { type, level, startDate, endDate }
      });

    } catch (error) {
      console.error('Failed to export logs:', error);
      res.status(500).json({ error: 'Failed to export logs' });
    }
  });

  // Clear old logs
  router.delete('/cleanup/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;
      const { olderThan = '30d', type, level } = req.query;

      const cutoffDate = getTimeframeDate(olderThan);
      
      let query = supabase
        .from('system_logs')
        .delete()
        .eq('guild_id', guildId)
        .lt('created_at', cutoffDate);

      if (type && type !== 'all') {
        query = query.eq('log_type', type.toUpperCase());
      }
      if (level && level !== 'all') {
        query = query.eq('log_level', level.toUpperCase());
      }

      const { data, error } = await query;

      if (error) throw error;

      await logger.log(guildId, 'SYSTEM', 'INFO', 'Log cleanup performed', {
        user: req.userId,
        cutoffDate,
        filters: { type, level }
      });

      res.json({
        success: true,
        deletedCount: data?.length || 0,
        cutoffDate
      });

    } catch (error) {
      console.error('Failed to cleanup logs:', error);
      res.status(500).json({ error: 'Failed to cleanup logs' });
    }
  });

  // Get log types and levels for filters
  router.get('/metadata/:guildId', requireAuth, async (req, res) => {
    try {
      const { guildId } = req.params;

      const { data: types } = await supabase
        .from('system_logs')
        .select('log_type')
        .eq('guild_id', guildId)
        .order('log_type');

      const { data: levels } = await supabase
        .from('system_logs')
        .select('log_level')
        .eq('guild_id', guildId)
        .order('log_level');

      const uniqueTypes = [...new Set((types || []).map(t => t.log_type))];
      const uniqueLevels = [...new Set((levels || []).map(l => l.log_level))];

      res.json({
        types: uniqueTypes,
        levels: uniqueLevels,
        typeIcons: {
          CONFIG: '⚙️',
          MODERATION: '🔨',
          MEMBER: '👤',
          CHANNEL: '📢',
          ROLE: '🎭',
          ERROR: '❌',
          COMMAND: '💻',
          SYSTEM: '🖥️'
        },
        levelColors: {
          ERROR: '#ff5555',
          WARN: '#ffb347',
          INFO: '#7289da',
          DEBUG: '#95a5a6'
        }
      });

    } catch (error) {
      console.error('Failed to get log metadata:', error);
      res.status(500).json({ error: 'Failed to retrieve log metadata' });
    }
  });

  return router;
}

// Helper functions
function getTimeframeDate(timeframe) {
  const now = new Date();
  const timeframes = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  const ms = timeframes[timeframe] || timeframes['24h'];
  return new Date(now.getTime() - ms).toISOString();
}

function processActivityTimeline(activities, timeframe) {
  const buckets = timeframe === '1h' ? 12 : timeframe === '24h' ? 24 : 7; // 5min, 1hr, or 1day buckets
  const bucketSize = timeframe === '1h' ? 5 * 60 * 1000 : timeframe === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  
  const timeline = Array(buckets).fill(0).map((_, i) => ({
    time: new Date(Date.now() - (buckets - i) * bucketSize),
    count: 0,
    types: {}
  }));

  activities.forEach(activity => {
    const activityTime = new Date(activity.created_at);
    const bucketIndex = Math.floor((Date.now() - activityTime.getTime()) / bucketSize);
    const index = buckets - 1 - bucketIndex;
    
    if (index >= 0 && index < buckets) {
      timeline[index].count++;
      timeline[index].types[activity.log_type] = (timeline[index].types[activity.log_type] || 0) + 1;
    }
  });

  return timeline;
}

function processCommandTimeline(commands, days) {
  const buckets = Math.min(days, 30); // Max 30 data points
  const bucketSize = days * 24 * 60 * 60 * 1000 / buckets;
  
  const timeline = Array(buckets).fill(0).map((_, i) => ({
    date: new Date(Date.now() - (buckets - i) * bucketSize).toISOString().split('T')[0],
    count: 0,
    commands: {}
  }));

  commands.forEach(cmd => {
    const cmdTime = new Date(cmd.used_at);
    const bucketIndex = Math.floor((Date.now() - cmdTime.getTime()) / bucketSize);
    const index = buckets - 1 - bucketIndex;
    
    if (index >= 0 && index < buckets) {
      timeline[index].count++;
      timeline[index].commands[cmd.command_name] = (timeline[index].commands[cmd.command_name] || 0) + 1;
    }
  });

  return timeline;
}

function convertLogsToCSV(logs) {
  if (logs.length === 0) return 'No logs to export';

  const headers = ['Timestamp', 'Type', 'Level', 'Message', 'User', 'Channel', 'Additional Data'];
  const rows = logs.map(log => [
    log.created_at,
    log.log_type,
    log.log_level,
    `"${log.message.replace(/"/g, '""')}"`,
    log.metadata?.user || '',
    log.metadata?.channel || '',
    `"${JSON.stringify(log.metadata || {}).replace(/"/g, '""')}"`
  ]);

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

module.exports = { initializeLoggingRoutes };