const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../utils/supabase');

// Helper functions
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

async function addModlog(guildId, userId, action, moderatorId, reason) {
  const { error } = await supabase.from('modlogs').insert([
    { guild_id: guildId, user_id: userId, action, moderator_id: moderatorId, reason, date: Date.now() }
  ]);
  if (error) throw error;
}

// Blacklist functions
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

// Mute functions
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

// Utility function to parse duration
function parseDuration(durationStr) {
  const timeUnits = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000
  };
  
  const match = durationStr.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  
  const [, amount, unit] = match;
  return parseInt(amount) * timeUnits[unit];
}

// Permission checking
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

// Add new commands to commandDescriptions
const commandDescriptions = {
  ban: 'Ban a user from the server. Usage: `/ban @user [reason]`',
  kick: 'Kick a user from the server. Usage: `/kick @user [reason]`',
  warn: 'Warn a user. Usage: `/warn @user <reason>`',
  warnings: 'Show warnings for a user. Usage: `/warnings [@user]`',
  clearwarn: 'Clear all warnings for a user. Usage: `/clearwarn @user`',
  purge: 'Delete multiple messages. Usage: `/purge <1-100>`',
  nuke: 'Nuke a channel. Usage: `/nuke`',
  blacklist: 'Add a user to the blacklist. Usage: `/blacklist @user <reason>`',
  unblacklist: 'Remove a user from the blacklist. Usage: `/unblacklist @user`',
  mute: 'Mute a user. Usage: `/mute @user <duration> [reason]\nDuration format: 30s, 5m, 2h, 1d`',
  unmute: 'Unmute a user. Usage: `/unmute @user`',
  timeout: 'Timeout a user. Usage: `/timeout @user <duration> [reason]\nDuration format: 30s, 5m, 2h, 1d`',
  blacklistchannel: 'Blacklist this channel from bot commands (admin only)',
  unblacklistchannel: 'Remove this channel from the blacklist (admin only)',
  report: 'Report a user for breaking rules. Usage: `/report @user <reason>`',
  modmail: 'Open a private conversation with staff. Usage: `/modmail <message>`',
  panic: 'Emergency lockdown - locks all channels and pings mods. Usage: `/panic <reason>` (admin only)',
  feedback: 'Send anonymous feedback to staff. Usage: `/feedback <message>`',
  case: 'View moderation case details. Usage: `/case view <ID>`'
};

// Add new commands to prefixCommands
const prefixCommands = {
  ban: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';ban @user [reason]').setColor(0xe74c3c)] });
    
    if (user.id === msg.client.user.id) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Protected').setDescription('Cannot ban the bot.').setColor(0xe74c3c)] });
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
      await msg.guild.members.ban(user, { reason });
      await addModlog(msg.guild.id, user.id, 'ban', msg.author.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Banned')
        .setDescription(`${user.tag} has been banned.\n**Reason:** ${reason}`)
        .setColor(0xe74c3c)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Ban error:', e.message || JSON.stringify(e));
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to ban user.').setColor(0xe74c3c)] });
    }
  },
  
  kick: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';kick @user [reason]').setColor(0xe74c3c)] });
    
    if (user.id === msg.client.user.id) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Protected').setDescription('Cannot kick the bot.').setColor(0xe74c3c)] });
    }
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
      const member = await msg.guild.members.fetch(user.id);
      await member.kick(reason);
      await addModlog(msg.guild.id, user.id, 'kick', msg.author.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Kicked')
        .setDescription(`${user.tag} has been kicked.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Kick error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to kick user.').setColor(0xe74c3c)] });
    }
  },
  
  warn: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';warn @user <reason>').setColor(0xe74c3c)] });
    
    const reason = args.slice(1).join(' ');
    if (!reason) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';warn @user <reason>').setColor(0xe74c3c)] });
    
    try {
      await addWarning(msg.guild.id, user.id, reason, msg.author.id);
      await addModlog(msg.guild.id, user.id, 'warn', msg.author.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Warned')
        .setDescription(`${user.tag} has been warned.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Warn error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to warn user.').setColor(0xe74c3c)] });
    }
  },
  
  warnings: async (msg, args) => {
    const user = msg.mentions.users.first() || msg.author;
    try {
      const warnings = await getWarnings(msg.guild.id, user.id);
      
      if (!warnings || warnings.length === 0) {
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Warnings').setDescription(`${user.tag} has no warnings.`).setColor(0x2ecc71)] });
      }
      
      const warningList = warnings.map((w, i) => `${i + 1}. **${w.reason}** - <@${w.warned_by}> (${new Date(w.date).toLocaleDateString()})`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${user.tag}`)
        .setDescription(warningList)
        .setColor(0xf39c12)
        .setFooter({ text: `Total: ${warnings.length} warning(s)` });
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Warnings error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to fetch warnings.').setColor(0xe74c3c)] });
    }
  },
  
  clearwarn: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';clearwarn @user').setColor(0xe74c3c)] });
    
    try {
      await clearWarnings(msg.guild.id, user.id);
      
      const embed = new EmbedBuilder()
        .setTitle('Warnings Cleared')
        .setDescription(`All warnings for ${user.tag} have been cleared.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Clearwarn error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to clear warnings.').setColor(0xe74c3c)] });
    }
  },
  
  purge: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';purge <1-100>').setColor(0xe74c3c)] });
    }
    
    try {
      // Delete the command message first to avoid reference issues
      await msg.delete().catch(() => {});
      
      const messages = await msg.channel.messages.fetch({ limit: amount });
      const messagesToDelete = messages.filter(m => !m.pinned);
      
      if (messagesToDelete.size === 0) {
        return msg.channel.send({ embeds: [new EmbedBuilder().setTitle('No Messages').setDescription('No messages found to delete.').setColor(0xe74c3c)] });
      }
      
      await msg.channel.bulkDelete(messagesToDelete);
      
      const embed = new EmbedBuilder()
        .setTitle('Messages Purged')
        .setDescription(`Deleted ${messagesToDelete.size} messages.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      const reply = await msg.channel.send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (e) {
      console.error('Purge error:', e);
      return msg.channel.send({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to delete messages.').setColor(0xe74c3c)] });
    }
  },

  nuke: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    try {
      // Delete the command message first
      await msg.delete().catch(() => {});
      
      const channel = msg.channel;
      const channelName = channel.name;
      const channelPosition = channel.position;
      const channelParent = channel.parent;
      const channelPermissions = channel.permissionOverwrites.cache;
      
      // Create a new channel with the same settings
      const newChannel = await channel.guild.channels.create({
        name: channelName,
        type: channel.type,
        parent: channelParent,
        position: channelPosition,
        permissionOverwrites: channelPermissions,
        topic: channel.topic,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser,
        bitrate: channel.bitrate,
        userLimit: channel.userLimit,
        reason: `Channel nuked by ${msg.author.tag}`
      });
      
      // Delete the old channel
      await channel.delete(`Channel nuked by ${msg.author.tag}`);
      
      // Send confirmation in the new channel
      const embed = new EmbedBuilder()
        .setTitle('💥 Channel Nuked')
        .setDescription(`This channel has been nuked by ${msg.author.tag}`)
        .setColor(0xe74c3c)
        .setTimestamp();
      
      const reply = await newChannel.send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 10000);
    } catch (e) {
      console.error('Nuke error:', e);
      return msg.channel.send({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to nuke channel.').setColor(0xe74c3c)] });
    }
  },

  blacklist: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';blacklist @user <reason>').setColor(0xe74c3c)] });
    
    const reason = args.slice(1).join(' ') || 'No reason provided';
    
    try {
      await addBlacklist(msg.guild.id, user.id, msg.author.id, reason);
      await addModlog(msg.guild.id, user.id, 'blacklist', msg.author.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Blacklisted')
        .setDescription(`${user.tag} has been blacklisted.\n**Reason:** ${reason}`)
        .setColor(0x2c3e50)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Blacklist error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to blacklist user.').setColor(0xe74c3c)] });
    }
  },

  unblacklist: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';unblacklist @user').setColor(0xe74c3c)] });
    
    try {
      await removeBlacklist(msg.guild.id, user.id);
      await addModlog(msg.guild.id, user.id, 'unblacklist', msg.author.id, 'Removed from blacklist');
      
      const embed = new EmbedBuilder()
        .setTitle('User Unblacklisted')
        .setDescription(`${user.tag} has been removed from the blacklist.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Unblacklist error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to unblacklist user.').setColor(0xe74c3c)] });
    }
  },

  mute: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';mute @user <duration> [reason]\nDuration format: 30s, 5m, 2h, 1d').setColor(0xe74c3c)] });
    
    const durationStr = args[1];
    if (!durationStr) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';mute @user <duration> [reason]\nDuration format: 30s, 5m, 2h, 1d').setColor(0xe74c3c)] });
    
    const duration = parseDuration(durationStr);
    if (!duration) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Duration').setDescription('Use format: 30s, 5m, 2h, 1d').setColor(0xe74c3c)] });
    
    const reason = args.slice(2).join(' ') || 'No reason provided';
    
    try {
      const member = await msg.guild.members.fetch(user.id);
      await member.timeout(duration, reason);
      await addMute(msg.guild.id, user.id, msg.author.id, reason, duration);
      await addModlog(msg.guild.id, user.id, 'mute', msg.author.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Muted')
        .setDescription(`${user.tag} has been muted for ${durationStr}.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Mute error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to mute user.').setColor(0xe74c3c)] });
    }
  },

  unmute: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';unmute @user').setColor(0xe74c3c)] });
    
    try {
      const member = await msg.guild.members.fetch(user.id);
      await member.timeout(null);
      await removeMute(msg.guild.id, user.id);
      await addModlog(msg.guild.id, user.id, 'unmute', msg.author.id, 'Mute removed');
      
      const embed = new EmbedBuilder()
        .setTitle('User Unmuted')
        .setDescription(`${user.tag} has been unmuted.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Unmute error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to unmute user.').setColor(0xe74c3c)] });
    }
  },

  timeout: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';timeout @user <duration> [reason]\nDuration format: 30s, 5m, 2h, 1d').setColor(0xe74c3c)] });
    
    const durationStr = args[1];
    if (!durationStr) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';timeout @user <duration> [reason]\nDuration format: 30s, 5m, 2h, 1d').setColor(0xe74c3c)] });
    
    const duration = parseDuration(durationStr);
    if (!duration) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Duration').setDescription('Use format: 30s, 5m, 2h, 1d').setColor(0xe74c3c)] });
    
    const reason = args.slice(2).join(' ') || 'No reason provided';
    
    try {
      const member = await msg.guild.members.fetch(user.id);
      await member.timeout(duration, reason);
      await addModlog(msg.guild.id, user.id, 'timeout', msg.author.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Timed Out')
        .setDescription(`${user.tag} has been timed out for ${durationStr}.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Timeout error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to timeout user.').setColor(0xe74c3c)] });
    }
  },

  blacklistchannel: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    const channelId = msg.channel.id;
    try {
      await supabase.from('channel_blacklist').upsert({ guild_id: msg.guild.id, channel_id: channelId });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Channel Blacklisted').setDescription('This channel is now blacklisted from bot commands.').setColor(0x2c3e50)] });
    } catch (e) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to blacklist channel.').setColor(0xe74c3c)] });
    }
  },
  unblacklistchannel: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    const channelId = msg.channel.id;
    try {
      await supabase.from('channel_blacklist').delete().eq('guild_id', msg.guild.id).eq('channel_id', channelId);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Channel Unblacklisted').setDescription('This channel is no longer blacklisted.').setColor(0x2ecc71)] });
    } catch (e) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to unblacklist channel.').setColor(0xe74c3c)] });
    }
  },
  
  report: async (msg, args) => {
    const user = msg.mentions.users.first();
    if (!user) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a user to report.\nUsage: `/report @user <reason>`').setColor(0xe74c3c)] });
    }
    
    if (user.id === msg.author.id) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('You cannot report yourself.').setColor(0xe74c3c)] });
    }
    
    const reason = args.slice(1).join(' ');
    if (!reason) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide a reason for the report.\nUsage: `/report @user <reason>`').setColor(0xe74c3c)] });
    }
    
    try {
      // Save report to database
      const { data, error } = await supabase
        .from('reports')
        .insert({
          guild_id: msg.guild.id,
          reporter_id: msg.author.id,
          reported_user_id: user.id,
          reason: reason
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Get report channel from config
      const { data: config } = await supabase
        .from('guild_configs')
        .select('report_channel_id')
        .eq('guild_id', msg.guild.id)
        .single();
      
      const reportEmbed = new EmbedBuilder()
        .setTitle('🚨 New Report')
        .setDescription(`**Reported User:** ${user} (${user.id})\n**Reporter:** ${msg.author} (${msg.author.id})\n**Reason:** ${reason}`)
        .setColor(0xe74c3c)
        .setTimestamp()
        .setFooter({ text: `Report ID: ${data.id}` });
      
      // Send to report channel if configured
      if (config?.report_channel_id) {
        const reportChannel = msg.guild.channels.cache.get(config.report_channel_id);
        if (reportChannel) {
          await reportChannel.send({ embeds: [reportEmbed] });
        }
      }
      
      // Confirm to reporter
      const confirmEmbed = new EmbedBuilder()
        .setTitle('Report Submitted')
        .setDescription(`Your report against ${user} has been submitted.\n**Reason:** ${reason}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [confirmEmbed] });
    } catch (e) {
      console.error('Report error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to submit report. Please try again.').setColor(0xe74c3c)] });
    }
  },

  modmail: async (msg, args) => {
    if (args.length === 0) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide your message.\nUsage: `&modmail your message to moderators`').setColor(0xe74c3c)] });
    }
    
    const message = args.join(' ');
    
    try {
      // Get configured modmail channel
      const { data: config } = await supabase
        .from('guild_configs')
        .select('modmail_channel_id')
        .eq('guild_id', msg.guild.id)
        .single();
      
      let targetChannel = msg.channel; // Default to current channel
      
      if (config?.modmail_channel_id) {
        const configuredChannel = msg.guild.channels.cache.get(config.modmail_channel_id);
        if (configuredChannel) {
          targetChannel = configuredChannel;
        }
      }
      
      const embed = new EmbedBuilder()
        .setTitle('Modmail Message')
        .setDescription(message)
        .addFields(
          { name: 'From', value: `${msg.author} (${msg.author.tag})`, inline: true },
          { name: 'Channel', value: msg.channel.name, inline: true },
          { name: 'User ID', value: msg.author.id, inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      await targetChannel.send({ embeds: [embed] });
      
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Message Sent').setDescription('Your message has been sent to the moderators.').setColor(0x2ecc71)] });
    } catch (e) {
      console.error('Modmail error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to send message to moderators.').setColor(0xe74c3c)] });
    }
  },

  panic: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use panic mode.').setColor(0xe74c3c)] });
    }
    
    const reason = args.join(' ') || 'Emergency lockdown activated';
    
    try {
      // Check if panic mode is already active
      const { data: existingPanic } = await supabase
        .from('panic_mode')
        .select('*')
        .eq('guild_id', msg.guild.id)
        .eq('is_active', true)
        .single();
      
      if (existingPanic) {
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Panic Mode Active').setDescription('Panic mode is already active. Use `/panic off` to disable it.').setColor(0xe74c3c)] });
      }
      
      // Lock all channels
      const channels = msg.guild.channels.cache.filter(ch => ch.type === 0); // Text channels only
      const lockedChannels = [];
      
      for (const [id, channel] of channels) {
        try {
          await channel.permissionOverwrites.edit(msg.guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false
          });
          lockedChannels.push(channel.name);
        } catch (e) {
          console.error(`Failed to lock channel ${channel.name}:`, e);
        }
      }
      
      // Save panic mode to database
      await supabase
        .from('panic_mode')
        .upsert({
          guild_id: msg.guild.id,
          is_active: true,
          activated_by: msg.author.id,
          reason: reason
        }, { onConflict: ['guild_id'] });
      
      // Get configuration for notifications
      const { data: config } = await supabase
        .from('guild_configs')
        .select('mod_role_id, admin_role_id, extra_role_ids')
        .eq('guild_id', msg.guild.id)
        .single();
      
      // Build notification list
      const notifications = [];
      
      // Add mod role if configured
      if (config?.mod_role_id) {
        const modRole = msg.guild.roles.cache.get(config.mod_role_id);
        if (modRole) {
          notifications.push(`${modRole}`);
        }
      }
      
      // Add admin role if configured
      if (config?.admin_role_id) {
        const adminRole = msg.guild.roles.cache.get(config.admin_role_id);
        if (adminRole) {
          notifications.push(`${adminRole}`);
        }
      }
      
      // Add extra admin roles if configured
      if (config?.extra_role_ids) {
        for (const roleId of config.extra_role_ids) {
          const extraRole = msg.guild.roles.cache.get(roleId);
          if (extraRole) {
            notifications.push(`${extraRole}`);
          }
        }
      }
      
      // If no roles configured, ping server owner
      if (notifications.length === 0) {
        notifications.push(`<@${msg.guild.ownerId}>`);
      }
      
      const panicEmbed = new EmbedBuilder()
        .setTitle('🚨 PANIC MODE ACTIVATED')
        .setDescription(`**Reason:** ${reason}\n**Activated by:** ${msg.author}\n**Channels locked:** ${lockedChannels.length}`)
        .addFields(
          { name: 'Locked Channels', value: lockedChannels.slice(0, 10).join(', ') + (lockedChannels.length > 10 ? '...' : ''), inline: false },
          { name: 'Notified Roles', value: notifications.join(', '), inline: false }
        )
        .setColor(0xe74c3c)
        .setTimestamp();
      
      await msg.channel.send({ content: notifications.join(', '), embeds: [panicEmbed] });
      
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Panic Mode Activated').setDescription('All channels have been locked and mods/admins have been notified.').setColor(0xe74c3c)] });
    } catch (e) {
      console.error('Panic mode error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to activate panic mode.').setColor(0xe74c3c)] });
    }
  },

  feedback: async (msg, args) => {
    if (args.length === 0) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide feedback.\nUsage: `&feedback your feedback message`').setColor(0xe74c3c)] });
    }
    
    const feedback = args.join(' ');
    
    try {
      // Get configured feedback channel
      const { data: config } = await supabase
        .from('guild_configs')
        .select('feedback_channel_id')
        .eq('guild_id', msg.guild.id)
        .single();
      
      let targetChannel = msg.channel; // Default to current channel
      
      if (config?.feedback_channel_id) {
        const configuredChannel = msg.guild.channels.cache.get(config.feedback_channel_id);
        if (configuredChannel) {
          targetChannel = configuredChannel;
        }
      }
      
      const embed = new EmbedBuilder()
        .setTitle('Anonymous Feedback')
        .setDescription(feedback)
        .addFields(
          { name: 'Submitted by', value: 'Anonymous', inline: true },
          { name: 'Channel', value: msg.channel.name, inline: true },
          { name: 'Timestamp', value: new Date().toLocaleString(), inline: true }
        )
        .setColor(0x9b59b6)
        .setTimestamp();
      
      await targetChannel.send({ embeds: [embed] });
      
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Feedback Submitted').setDescription('Your anonymous feedback has been submitted successfully.').setColor(0x2ecc71)] });
    } catch (e) {
      console.error('Feedback error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to submit feedback.').setColor(0xe74c3c)] });
    }
  },

  case: async (msg, args) => {
    if (args.length < 2 || args[0] !== 'view') {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Usage: `/case view <ID>`').setColor(0xe74c3c)] });
    }
    
    const caseId = parseInt(args[1]);
    if (isNaN(caseId)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Please provide a valid case ID.').setColor(0xe74c3c)] });
    }
    
    try {
      const { data: caseData, error } = await supabase
        .from('moderation_cases')
        .select('*')
        .eq('guild_id', msg.guild.id)
        .eq('case_number', caseId)
        .single();
      
      if (error || !caseData) {
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Case Not Found').setDescription(`No case found with ID ${caseId}.`).setColor(0xe74c3c)] });
      }
      
      const caseEmbed = new EmbedBuilder()
        .setTitle(`Case #${caseData.case_number}`)
        .addFields(
          { name: 'User', value: `<@${caseData.user_id}> (${caseData.user_id})`, inline: true },
          { name: 'Type', value: caseData.case_type.toUpperCase(), inline: true },
          { name: 'Moderator', value: `<@${caseData.moderator_id}> (${caseData.moderator_id})`, inline: true },
          { name: 'Reason', value: caseData.reason || 'No reason provided', inline: false },
          { name: 'Status', value: caseData.active ? 'Active' : 'Inactive', inline: true },
          { name: 'Created', value: `<t:${Math.floor(new Date(caseData.created_at).getTime() / 1000)}:F>`, inline: true }
        )
        .setColor(caseData.case_type === 'ban' ? 0xe74c3c : caseData.case_type === 'kick' ? 0xf39c12 : 0x3498db)
        .setTimestamp();
      
      if (caseData.duration_minutes) {
        caseEmbed.addFields({ name: 'Duration', value: `${caseData.duration_minutes} minutes`, inline: true });
      }
      
      if (caseData.expires_at) {
        caseEmbed.addFields({ name: 'Expires', value: `<t:${Math.floor(new Date(caseData.expires_at).getTime() / 1000)}:F>`, inline: true });
      }
      
      return msg.reply({ embeds: [caseEmbed] });
    } catch (e) {
      console.error('Case view error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to retrieve case information.').setColor(0xe74c3c)] });
    }
  }
};

// Slash commands
const slashCommands = [
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban').setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick').setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for warning').setRequired(true)),

  new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Add a user to the blacklist')
    .addUserOption(opt => opt.setName('user').setDescription('User to blacklist').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for blacklist').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unblacklist')
    .setDescription('Remove a user from the blacklist')
    .addUserOption(opt => opt.setName('user').setDescription('User to unblacklist').setRequired(true)),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (30s, 5m, 2h, 1d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for mute').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to unmute').setRequired(true)),

  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true))
    .addStringOption(opt => opt.setName('duration').setDescription('Duration (30s, 5m, 2h, 1d)').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for timeout').setRequired(false)),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Show warnings for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to check warnings for').setRequired(false)),

  new SlashCommandBuilder()
    .setName('clearwarn')
    .setDescription('Clear all warnings for a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to clear warnings for').setRequired(true)),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete multiple messages')
    .addIntegerOption(opt => opt.setName('amount').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100)),

  new SlashCommandBuilder()
    .setName('blacklistchannel')
    .setDescription('Blacklist this channel from bot commands (admin only)'),

  new SlashCommandBuilder()
    .setName('unblacklistchannel')
    .setDescription('Remove this channel from the blacklist (admin only)'),

  new SlashCommandBuilder()
    .setName('report')
    .setDescription('Report a user for breaking rules')
    .addUserOption(opt => opt.setName('user').setDescription('User to report').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for report').setRequired(true)),

  new SlashCommandBuilder()
    .setName('modmail')
    .setDescription('Open a private conversation with staff')
    .addStringOption(opt => opt.setName('message').setDescription('Message to send to staff').setRequired(true)),

  new SlashCommandBuilder()
    .setName('panic')
    .setDescription('Emergency lockdown - locks all channels and pings mods')
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for panic mode').setRequired(false)),

  new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Send anonymous feedback to staff')
    .addStringOption(opt => opt.setName('message').setDescription('Feedback message').setRequired(true)),

  new SlashCommandBuilder()
    .setName('case')
    .setDescription('View moderation case details')
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View a specific case')
      .addIntegerOption(opt => opt.setName('id').setDescription('Case ID to view').setRequired(true)))
];

// Slash command handlers
const slashHandlers = {
  ban: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (user.id === interaction.client.user.id) {
      return interaction.reply({ content: 'Cannot ban the bot.', ephemeral: true });
    }
    
    try {
      await interaction.guild.members.ban(user, { reason });
      await addModlog(interaction.guild.id, user.id, 'ban', interaction.user.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Banned')
        .setDescription(`${user.tag} has been banned.\n**Reason:** ${reason}`)
        .setColor(0xe74c3c)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Ban error:', e.message || JSON.stringify(e));
      return interaction.reply({ content: 'Failed to ban user.', ephemeral: true });
    }
  },
  
  kick: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    if (user.id === interaction.client.user.id) {
      return interaction.reply({ content: 'Cannot kick the bot.', ephemeral: true });
    }
    
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.kick(reason);
      await addModlog(interaction.guild.id, user.id, 'kick', interaction.user.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Kicked')
        .setDescription(`${user.tag} has been kicked.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Kick error:', e);
      return interaction.reply({ content: 'Failed to kick user.', ephemeral: true });
    }
  },
  
  warn: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    
    try {
      await addWarning(interaction.guild.id, user.id, reason, interaction.user.id);
      await addModlog(interaction.guild.id, user.id, 'warn', interaction.user.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Warned')
        .setDescription(`${user.tag} has been warned.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Warn error:', e);
      return interaction.reply({ content: 'Failed to warn user.', ephemeral: true });
    }
  },

  blacklist: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    try {
      await addBlacklist(interaction.guild.id, user.id, interaction.user.id, reason);
      await addModlog(interaction.guild.id, user.id, 'blacklist', interaction.user.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Blacklisted')
        .setDescription(`${user.tag} has been blacklisted.\n**Reason:** ${reason}`)
        .setColor(0x2c3e50)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Blacklist error:', e);
      return interaction.reply({ content: 'Failed to blacklist user.', ephemeral: true });
    }
  },

  unblacklist: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    
    try {
      await removeBlacklist(interaction.guild.id, user.id);
      await addModlog(interaction.guild.id, user.id, 'unblacklist', interaction.user.id, 'Removed from blacklist');
      
      const embed = new EmbedBuilder()
        .setTitle('User Unblacklisted')
        .setDescription(`${user.tag} has been removed from the blacklist.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Unblacklist error:', e);
      return interaction.reply({ content: 'Failed to unblacklist user.', ephemeral: true });
    }
  },

  mute: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const duration = parseDuration(durationStr);
    if (!duration) {
      return interaction.reply({ content: 'Invalid duration format. Use: 30s, 5m, 2h, 1d', ephemeral: true });
    }
    
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(duration, reason);
      await addMute(interaction.guild.id, user.id, interaction.user.id, reason, duration);
      await addModlog(interaction.guild.id, user.id, 'mute', interaction.user.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Muted')
        .setDescription(`${user.tag} has been muted for ${durationStr}.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Mute error:', e);
      return interaction.reply({ content: 'Failed to mute user.', ephemeral: true });
    }
  },

  unmute: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(null);
      await removeMute(interaction.guild.id, user.id);
      await addModlog(interaction.guild.id, user.id, 'unmute', interaction.user.id, 'Mute removed');
      
      const embed = new EmbedBuilder()
        .setTitle('User Unmuted')
        .setDescription(`${user.tag} has been unmuted.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Unmute error:', e);
      return interaction.reply({ content: 'Failed to unmute user.', ephemeral: true });
    }
  },

  timeout: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const duration = parseDuration(durationStr);
    if (!duration) {
      return interaction.reply({ content: 'Invalid duration format. Use: 30s, 5m, 2h, 1d', ephemeral: true });
    }
    
    try {
      const member = await interaction.guild.members.fetch(user.id);
      await member.timeout(duration, reason);
      await addModlog(interaction.guild.id, user.id, 'timeout', interaction.user.id, reason);
      
      const embed = new EmbedBuilder()
        .setTitle('User Timed Out')
        .setDescription(`${user.tag} has been timed out for ${durationStr}.\n**Reason:** ${reason}`)
        .setColor(0xf39c12)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Timeout error:', e);
      return interaction.reply({ content: 'Failed to timeout user.', ephemeral: true });
    }
  },

  warnings: async (interaction) => {
    const user = interaction.options.getUser('user') || interaction.user;
    try {
      const warnings = await getWarnings(interaction.guild.id, user.id);
      
      if (!warnings || warnings.length === 0) {
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Warnings').setDescription(`${user.tag} has no warnings.`).setColor(0x2ecc71)] });
      }
      
      const warningList = warnings.map((w, i) => `${i + 1}. **${w.reason}** - <@${w.warned_by}> (${new Date(w.date).toLocaleDateString()})`).join('\n');
      
      const embed = new EmbedBuilder()
        .setTitle(`Warnings for ${user.tag}`)
        .setDescription(warningList)
        .setColor(0xf39c12)
        .setFooter({ text: `Total: ${warnings.length} warning(s)` });
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Warnings error:', e);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to fetch warnings.').setColor(0xe74c3c)] });
    }
  },

  clearwarn: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    if (!user) return interaction.reply({ content: 'Usage: /clearwarn @user', ephemeral: true });
    
    try {
      await clearWarnings(interaction.guild.id, user.id);
      
      const embed = new EmbedBuilder()
        .setTitle('Warnings Cleared')
        .setDescription(`All warnings for ${user.tag} have been cleared.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Clearwarn error:', e);
      return interaction.reply({ content: 'Failed to clear warnings.', ephemeral: true });
    }
  },

  purge: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const amount = interaction.options.getInteger('amount');
    if (!amount || amount < 1 || amount > 100) {
      return interaction.reply({ content: 'Usage: /purge <1-100>', ephemeral: true });
    }
    
    try {
      // Delete the command message first to avoid reference issues
      await interaction.deleteReply().catch(() => {});
      
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      const messagesToDelete = messages.filter(m => !m.pinned);
      
      if (messagesToDelete.size === 0) {
        return interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('No Messages').setDescription('No messages found to delete.').setColor(0xe74c3c)] });
      }
      
      await interaction.channel.bulkDelete(messagesToDelete);
      
      const embed = new EmbedBuilder()
        .setTitle('Messages Purged')
        .setDescription(`Deleted ${messagesToDelete.size} messages.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      const reply = await interaction.channel.send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 5000);
    } catch (e) {
      console.error('Purge error:', e);
      return interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to delete messages.').setColor(0xe74c3c)] });
    }
  },

  nuke: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    try {
      // Delete the command message first
      await interaction.deleteReply().catch(() => {});
      
      const channel = interaction.channel;
      const channelName = channel.name;
      const channelPosition = channel.position;
      const channelParent = channel.parent;
      const channelPermissions = channel.permissionOverwrites.cache;
      
      // Create a new channel with the same settings
      const newChannel = await channel.guild.channels.create({
        name: channelName,
        type: channel.type,
        parent: channelParent,
        position: channelPosition,
        permissionOverwrites: channelPermissions,
        topic: channel.topic,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser,
        bitrate: channel.bitrate,
        userLimit: channel.userLimit,
        reason: `Channel nuked by ${interaction.user.tag}`
      });
      
      // Delete the old channel
      await channel.delete(`Channel nuked by ${interaction.user.tag}`);
      
      // Send confirmation in the new channel
      const embed = new EmbedBuilder()
        .setTitle('💥 Channel Nuked')
        .setDescription(`This channel has been nuked by ${interaction.user.tag}`)
        .setColor(0xe74c3c)
        .setTimestamp();
      
      const reply = await newChannel.send({ embeds: [embed] });
      setTimeout(() => reply.delete().catch(() => {}), 10000);
    } catch (e) {
      console.error('Nuke error:', e);
      return interaction.channel.send({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to nuke channel.').setColor(0xe74c3c)] });
    }
  },

  blacklistchannel: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    const channelId = interaction.channel.id;
    try {
      await supabase.from('channel_blacklist').upsert({ guild_id: interaction.guild.id, channel_id: channelId });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Channel Blacklisted').setDescription('This channel is now blacklisted from bot commands.').setColor(0x2c3e50)], ephemeral: true });
    } catch (e) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to blacklist channel.').setColor(0xe74c3c)], ephemeral: true });
    }
  },
  unblacklistchannel: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    const channelId = interaction.channel.id;
    try {
      await supabase.from('channel_blacklist').delete().eq('guild_id', interaction.guild.id).eq('channel_id', channelId);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Channel Unblacklisted').setDescription('This channel is no longer blacklisted.').setColor(0x2ecc71)], ephemeral: true });
    } catch (e) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to unblacklist channel.').setColor(0xe74c3c)], ephemeral: true });
    }
  },
  
  report: async (interaction) => {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    
    if (user.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot report yourself.', ephemeral: true });
    }
    
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          guild_id: interaction.guild.id,
          reporter_id: interaction.user.id,
          reported_user_id: user.id,
          reason: reason
        })
        .select()
        .single();
      
      if (error) throw error;
      
      const { data: config } = await supabase
        .from('guild_configs')
        .select('report_channel_id')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      const reportEmbed = new EmbedBuilder()
        .setTitle('🚨 New Report')
        .setDescription(`**Reported User:** ${user} (${user.id})\n**Reporter:** ${interaction.user} (${interaction.user.id})\n**Reason:** ${reason}`)
        .setColor(0xe74c3c)
        .setTimestamp()
        .setFooter({ text: `Report ID: ${data.id}` });
      
      if (config?.report_channel_id) {
        const reportChannel = interaction.guild.channels.cache.get(config.report_channel_id);
        if (reportChannel) {
          await reportChannel.send({ embeds: [reportEmbed] });
        }
      }
      
      const confirmEmbed = new EmbedBuilder()
        .setTitle('Report Submitted')
        .setDescription(`Your report against ${user} has been submitted.`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [confirmEmbed], ephemeral: true });
    } catch (e) {
      console.error('Report error:', e);
      return interaction.reply({ content: 'Failed to submit report. Please try again.', ephemeral: true });
    }
  },

  modmail: async (interaction) => {
    if (args.length === 0) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide your message.\nUsage: `&modmail your message to moderators`').setColor(0xe74c3c)] });
    }
    
    const message = args.join(' ');
    
    try {
      // Get configured modmail channel
      const { data: config } = await supabase
        .from('guild_configs')
        .select('modmail_channel_id')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      let targetChannel = interaction.channel; // Default to current channel
      
      if (config?.modmail_channel_id) {
        const configuredChannel = interaction.guild.channels.cache.get(config.modmail_channel_id);
        if (configuredChannel) {
          targetChannel = configuredChannel;
        }
      }
      
      const embed = new EmbedBuilder()
        .setTitle('Modmail Message')
        .setDescription(message)
        .addFields(
          { name: 'From', value: `${interaction.user} (${interaction.user.tag})`, inline: true },
          { name: 'Channel', value: interaction.channel.name, inline: true },
          { name: 'User ID', value: interaction.user.id, inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      await targetChannel.send({ embeds: [embed] });
      
      return interaction.reply({ content: 'Your message has been sent to the moderators.', ephemeral: true });
    } catch (e) {
      console.error('Modmail error:', e);
      return interaction.reply({ content: 'Failed to send message to moderators.', ephemeral: true });
    }
  },

  panic: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Only admins can use panic mode.', ephemeral: true });
    }
    
    const reason = interaction.options.getString('reason') || 'Emergency lockdown activated';
    
    try {
      const { data: existingPanic } = await supabase
        .from('panic_mode')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .eq('is_active', true)
        .single();
      
      if (existingPanic) {
        return interaction.reply({ content: 'Panic mode is already active. Use `/panic off` to disable it.', ephemeral: true });
      }
      
      const channels = interaction.guild.channels.cache.filter(ch => ch.type === 0);
      const lockedChannels = [];
      
      for (const [id, channel] of channels) {
        try {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false,
            CreatePublicThreads: false,
            CreatePrivateThreads: false,
            SendMessagesInThreads: false
          });
          lockedChannels.push(channel.name);
        } catch (e) {
          console.error(`Failed to lock channel ${channel.name}:`, e);
        }
      }
      
      await supabase
        .from('panic_mode')
        .upsert({
          guild_id: interaction.guild.id,
          is_active: true,
          activated_by: interaction.user.id,
          reason: reason
        }, { onConflict: ['guild_id'] });
      
      const { data: config } = await supabase
        .from('guild_configs')
        .select('mod_role_id, admin_role_id, extra_role_ids')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      // Build notification list
      const notifications = [];
      
      // Add mod role if configured
      if (config?.mod_role_id) {
        const modRole = interaction.guild.roles.cache.get(config.mod_role_id);
        if (modRole) {
          notifications.push(`${modRole}`);
        }
      }
      
      // Add admin role if configured
      if (config?.admin_role_id) {
        const adminRole = interaction.guild.roles.cache.get(config.admin_role_id);
        if (adminRole) {
          notifications.push(`${adminRole}`);
        }
      }
      
      // Add extra admin roles if configured
      if (config?.extra_role_ids) {
        for (const roleId of config.extra_role_ids) {
          const extraRole = interaction.guild.roles.cache.get(roleId);
          if (extraRole) {
            notifications.push(`${extraRole}`);
          }
        }
      }
      
      // If no roles configured, ping server owner
      if (notifications.length === 0) {
        notifications.push(`<@${interaction.guild.ownerId}>`);
      }
      
      const panicEmbed = new EmbedBuilder()
        .setTitle('🚨 PANIC MODE ACTIVATED')
        .setDescription(`**Reason:** ${reason}\n**Activated by:** ${interaction.user}\n**Channels locked:** ${lockedChannels.length}`)
        .addFields(
          { name: 'Locked Channels', value: lockedChannels.slice(0, 10).join(', ') + (lockedChannels.length > 10 ? '...' : ''), inline: false },
          { name: 'Notified Roles', value: notifications.join(', '), inline: false }
        )
        .setColor(0xe74c3c)
        .setTimestamp();
      
      await interaction.channel.send({ content: notifications.join(', '), embeds: [panicEmbed] });
      
      return interaction.reply({ content: 'Panic mode activated. All channels have been locked and mods/admins have been notified.', ephemeral: true });
    } catch (e) {
      console.error('Panic mode error:', e);
      return interaction.reply({ content: 'Failed to activate panic mode.', ephemeral: true });
    }
  },

  feedback: async (interaction) => {
    if (args.length === 0) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide feedback.\nUsage: `&feedback your feedback message`').setColor(0xe74c3c)] });
    }
    
    const feedback = args.join(' ');
    
    try {
      // Get configured feedback channel
      const { data: config } = await supabase
        .from('guild_configs')
        .select('feedback_channel_id')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      let targetChannel = interaction.channel; // Default to current channel
      
      if (config?.feedback_channel_id) {
        const configuredChannel = interaction.guild.channels.cache.get(config.feedback_channel_id);
        if (configuredChannel) {
          targetChannel = configuredChannel;
        }
      }
      
      const embed = new EmbedBuilder()
        .setTitle('Anonymous Feedback')
        .setDescription(feedback)
        .addFields(
          { name: 'Submitted by', value: 'Anonymous', inline: true },
          { name: 'Channel', value: interaction.channel.name, inline: true },
          { name: 'Timestamp', value: new Date().toLocaleString(), inline: true }
        )
        .setColor(0x9b59b6)
        .setTimestamp();
      
      await targetChannel.send({ embeds: [embed] });
      
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Feedback Submitted').setDescription('Your anonymous feedback has been submitted successfully.').setColor(0x2ecc71)] });
    } catch (e) {
      console.error('Feedback error:', e);
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to submit feedback.').setColor(0xe74c3c)] });
    }
  },

  case: async (interaction) => {
    const subcommand = interaction.options.getSubcommand();
    
    if (subcommand === 'view') {
      const caseId = interaction.options.getInteger('id');
      
      try {
        const { data: caseData, error } = await supabase
          .from('moderation_cases')
          .select('*')
          .eq('guild_id', interaction.guild.id)
          .eq('case_number', caseId)
          .single();
        
        if (error || !caseData) {
          return interaction.reply({ content: `No case found with ID ${caseId}.`, ephemeral: true });
        }
        
        const caseEmbed = new EmbedBuilder()
          .setTitle(`Case #${caseData.case_number}`)
          .addFields(
            { name: 'User', value: `<@${caseData.user_id}> (${caseData.user_id})`, inline: true },
            { name: 'Type', value: caseData.case_type.toUpperCase(), inline: true },
            { name: 'Moderator', value: `<@${caseData.moderator_id}> (${caseData.moderator_id})`, inline: true },
            { name: 'Reason', value: caseData.reason || 'No reason provided', inline: false },
            { name: 'Status', value: caseData.active ? 'Active' : 'Inactive', inline: true },
            { name: 'Created', value: `<t:${Math.floor(new Date(caseData.created_at).getTime() / 1000)}:F>`, inline: true }
          )
          .setColor(caseData.case_type === 'ban' ? 0xe74c3c : caseData.case_type === 'kick' ? 0xf39c12 : 0x3498db)
          .setTimestamp();
        
        if (caseData.duration_minutes) {
          caseEmbed.addFields({ name: 'Duration', value: `${caseData.duration_minutes} minutes`, inline: true });
        }
        
        if (caseData.expires_at) {
          caseEmbed.addFields({ name: 'Expires', value: `<t:${Math.floor(new Date(caseData.expires_at).getTime() / 1000)}:F>`, inline: true });
        }
        
        return interaction.reply({ embeds: [caseEmbed], ephemeral: true });
      } catch (e) {
        console.error('Case view error:', e);
        return interaction.reply({ content: 'Failed to retrieve case information.', ephemeral: true });
      }
    }
  }
};

const buttonHandlers = {};
const modalHandlers = {};

module.exports = {
  name: 'moderation',
  prefixCommands,
  slashHandlers,
  slashCommands,
  buttonHandlers,
  modalHandlers
}; 