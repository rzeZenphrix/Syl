const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../utils/supabase');
const fs = require('fs');
const path = require('path');
const { logEvent } = require('../logger');

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

// Helper: Check if member is owner or co-owner
async function isOwnerOrCoOwner(member) {
  if (!member || !member.guild) return false;
  if (member.guild.ownerId === member.id) return true;
  // Check co-owner columns in guild_configs
  const { data, error } = await supabase
    .from('guild_configs')
    .select('co_owner_1_id, co_owner_2_id')
    .eq('guild_id', member.guild.id)
    .single();
  if (error) return false;
  return [data?.co_owner_1_id, data?.co_owner_2_id].includes(member.id);
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
  case: 'View moderation case details. Usage: `/case view <ID>`',
  raid: 'Configure raid prevention settings. Usage: `/raid <on/off/threshold>` (admin only)',
  steal: 'Steal an emoji from another server. Usage: `;steal <emoji> [new_name]` (admin only)',
  antinuke: 'Configure anti-nuke protection. Usage: `/antinuke <on/off/whitelist>` (owner only)'
};

// Add new commands to prefixCommands
const prefixCommands = {
  ban: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    let user = msg.mentions.users.first();
    let userId = user ? user.id : args[0];
    if (!user && userId && /^\d{17,20}$/.test(userId)) {
      // Try to fetch user by ID (may not be in guild)
      try {
        user = await msg.client.users.fetch(userId);
      } catch {}
    }
    if (!userId || !/^\d{17,20}$/.test(userId)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';ban @user|user_id [reason]').setColor(0xe74c3c)] });
    }
    if (userId === msg.client.user.id) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Protected').setDescription('Cannot ban the bot.').setColor(0xe74c3c)] });
    }
    const reason = args.slice(user ? 1 : 1).join(' ') || 'No reason provided';
    try {
      await msg.guild.members.ban(userId, { reason });
      await addModlog(msg.guild.id, userId, 'ban', msg.author.id, reason);
      const embed = new EmbedBuilder()
        .setTitle('User Banned')
        .setDescription(`${user ? user.tag : userId} has been banned.\n**Reason:** ${reason}`)
        .setColor(0xe74c3c)
        .setTimestamp();
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Ban error:', e.message || JSON.stringify(e));
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to ban user. Make sure the ID is valid and the bot has ban permissions.').setColor(0xe74c3c)] });
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
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a user to report. Usage: `;report @user <reason>`').setColor(0xe74c3c)] });
    }
    if (user.id === msg.author.id) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('You cannot report yourself.').setColor(0xe74c3c)] });
    }
    const reason = args.slice(1).join(' ');
    if (!reason) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide a reason for the report. Usage: `;report @user <reason>`').setColor(0xe74c3c)] });
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
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide your message.\nUsage: `/modmail <message>`').setColor(0xe74c3c)] });
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
      // Log to modmail_threads table (one open per user per guild)
      await supabase.from('modmail_threads').upsert({
        guild_id: msg.guild.id,
        user_id: msg.author.id,
        channel_id: targetChannel.id,
        status: 'open',
        created_at: new Date().toISOString()
      }, { onConflict: ['guild_id', 'user_id'] });
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
      // DM user confirmation
      await msg.author.send({ embeds: [new EmbedBuilder().setTitle('Modmail Sent').setDescription('Your message has been sent to the moderators.').setColor(0x2ecc71)] }).catch(() => {});
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
    const arg = args[0]?.toLowerCase();
    if (arg === 'off') {
      // Turn off panic mode
      try {
        const { data: panic } = await supabase
          .from('panic_mode')
          .select('*')
          .eq('guild_id', msg.guild.id)
          .eq('is_active', true)
          .single();
        if (!panic) {
          return msg.reply({ embeds: [new EmbedBuilder().setTitle('Panic Mode').setDescription('Panic mode is not active.').setColor(0x2ecc71)] });
        }
        // Unlock all channels
        const channels = msg.guild.channels.cache.filter(ch => ch.type === 0);
        for (const [id, channel] of channels) {
          try {
            await channel.permissionOverwrites.edit(msg.guild.roles.everyone, {
              SendMessages: null,
              AddReactions: null,
              CreatePublicThreads: null,
              CreatePrivateThreads: null,
              SendMessagesInThreads: null
            });
          } catch (e) {
            console.error(`Failed to unlock channel ${channel.name}:`, e);
          }
        }
        await supabase
          .from('panic_mode')
          .update({ is_active: false, deactivated_at: new Date().toISOString() })
          .eq('guild_id', msg.guild.id);
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Panic Mode Disabled').setDescription('All channels have been unlocked.').setColor(0x2ecc71)] });
      } catch (e) {
        console.error('Panic off error:', e);
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to disable panic mode.').setColor(0xe74c3c)] });
      }
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
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide feedback.\nUsage: `/feedback <message>`').setColor(0xe74c3c)] });
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
      // Log feedback to DB
      await supabase.from('feedback').insert({
        guild_id: msg.guild.id,
        user_id: msg.author.id,
        message: feedback,
        is_anonymous: true
      });
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
      // DM user confirmation
      await msg.author.send({ embeds: [new EmbedBuilder().setTitle('Feedback Submitted').setDescription('Your anonymous feedback has been submitted successfully.').setColor(0x2ecc71)] }).catch(() => {});
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
  },

  raid: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can configure raid protection.').setColor(0xe74c3c)] });
    }
    
    const sub = args[0]?.toLowerCase();
    
    if (!sub || !['on', 'off', 'threshold', 'autolock'].includes(sub)) {
      const { data: config } = await supabase
        .from('guild_configs')
        .select('raid_protection_enabled, raid_protection_threshold, raid_auto_lock')
        .eq('guild_id', msg.guild.id)
        .single();
      
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Raid Protection Status')
        .addFields(
          { name: 'Enabled', value: config?.raid_protection_enabled !== false ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Threshold', value: config?.raid_protection_threshold || 'Default (10 joins/30s, 20 msgs/10s)', inline: true },
          { name: 'Auto-Lock', value: config?.raid_auto_lock ? '✅ Yes' : '❌ No', inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    }
    
    if (sub === 'on') {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        raid_protection_enabled: true
      }, { onConflict: ['guild_id'] });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('✅ Raid Protection Enabled').setDescription('Raid detection is now active.').setColor(0x2ecc71)] });
    }
    
    if (sub === 'off') {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        raid_protection_enabled: false
      }, { onConflict: ['guild_id'] });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('❌ Raid Protection Disabled').setDescription('Raid detection is now inactive.').setColor(0xe74c3c)] });
    }
    
    if (sub === 'threshold') {
      const threshold = args[1];
      if (!threshold || !/^\d+$/.test(threshold)) {
        return msg.reply('Usage: `;raid threshold <number>`');
      }
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        raid_protection_threshold: parseInt(threshold)
      }, { onConflict: ['guild_id'] });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('✅ Threshold Updated').setDescription(`Raid threshold set to ${threshold} events.`).setColor(0x2ecc71)] });
    }
    
    if (sub === 'autolock') {
      const enabled = args[1]?.toLowerCase() === 'on';
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        raid_auto_lock: enabled
      }, { onConflict: ['guild_id'] });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('✅ Auto-Lock Updated').setDescription(`Auto-lock is now ${enabled ? 'enabled' : 'disabled'}.`).setColor(0x2ecc71)] });
    }
  },

  antinuke: async (msg, args) => {
    if (!await isOwnerOrCoOwner(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner or co-owners can configure anti-nuke protection.').setColor(0xe74c3c)] });
    }
    
    const sub = args[0]?.toLowerCase();
    
    if (!sub || !['on', 'off', 'whitelist', 'autoban'].includes(sub)) {
      const { data: config } = await supabase
        .from('guild_configs')
        .select('anti_nuke_enabled, anti_nuke_whitelist, anti_nuke_auto_ban')
        .eq('guild_id', msg.guild.id)
        .single();
      
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Anti-Nuke Protection Status')
        .addFields(
          { name: 'Enabled', value: config?.anti_nuke_enabled ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Auto-Ban', value: config?.anti_nuke_auto_ban ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Whitelist', value: config?.anti_nuke_whitelist?.length || 0 + ' users', inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    }
    
    if (sub === 'on') {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        anti_nuke_enabled: true
      }, { onConflict: ['guild_id'] });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('✅ Anti-Nuke Enabled').setDescription('Anti-nuke protection is now active.').setColor(0x2ecc71)] });
    }
    
    if (sub === 'off') {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        anti_nuke_enabled: false
      }, { onConflict: ['guild_id'] });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('❌ Anti-Nuke Disabled').setDescription('Anti-nuke protection is now inactive.').setColor(0xe74c3c)] });
    }
    
    if (sub === 'whitelist') {
      const action = args[1]?.toLowerCase();
      const user = msg.mentions.users.first();
      
      if (!action || !['add', 'remove', 'list'].includes(action)) {
        return msg.reply('Usage: `;antinuke whitelist <add/remove/list> [@user]`');
      }
      
      if (action === 'list') {
        const { data: config } = await supabase
          .from('guild_configs')
          .select('anti_nuke_whitelist')
          .eq('guild_id', msg.guild.id)
          .single();
        
        const whitelist = config?.anti_nuke_whitelist || [];
        if (whitelist.length === 0) {
          return msg.reply('No users in anti-nuke whitelist.');
        }
        
        const userList = whitelist.map(id => `<@${id}>`).join('\n');
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Anti-Nuke Whitelist')
          .setDescription(userList)
          .setColor(0x3498db);
        
        return msg.reply({ embeds: [embed] });
      }
      
      if (!user) {
        return msg.reply('Please mention a user to add/remove from whitelist.');
      }
      
      const { data: config } = await supabase
        .from('guild_configs')
        .select('anti_nuke_whitelist')
        .eq('guild_id', msg.guild.id)
        .single();
      
      let whitelist = config?.anti_nuke_whitelist || [];
      
      if (action === 'add') {
        if (!whitelist.includes(user.id)) {
          whitelist.push(user.id);
        }
      } else if (action === 'remove') {
        whitelist = whitelist.filter(id => id !== user.id);
      }
      
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        anti_nuke_whitelist: whitelist
      }, { onConflict: ['guild_id'] });
      
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('✅ Whitelist Updated').setDescription(`User ${user} ${action === 'add' ? 'added to' : 'removed from'} anti-nuke whitelist.`).setColor(0x2ecc71)] });
    }
    
    if (sub === 'autoban') {
      const enabled = args[1]?.toLowerCase() === 'on';
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        anti_nuke_auto_ban: enabled
      }, { onConflict: ['guild_id'] });
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('✅ Auto-Ban Updated').setDescription(`Auto-ban is now ${enabled ? 'enabled' : 'disabled'}.`).setColor(0x2ecc71)] });
    }
  },

  steal: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can steal emojis.').setColor(0xe74c3c)] });
    }
    if (args.length < 1) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';steal <emoji> [new_name]\nExample: `;steal 🎉 party`').setColor(0xe74c3c)] });
    }
    const emojiArg = args[0];
    const newName = args[1] || 'stolen_emoji';
    // Reject user mentions
    if (/^<@!?\d+>$/.test(emojiArg)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Usage').setDescription('Please provide a custom emoji from another server, not a user mention.').setColor(0xe74c3c)] });
    }
    // Extract emoji ID from the emoji string
    const emojiMatch = emojiArg.match(/<a?:(\w+):(\d+)>/);
    if (!emojiMatch) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Emoji').setDescription('Please provide a valid custom emoji from another server.').setColor(0xe74c3c)] });
    }
    const [, emojiName, emojiId] = emojiMatch;
    const isAnimated = emojiArg.startsWith('<a:');
    const extension = isAnimated ? 'gif' : 'png';
    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`;
    try {
      // Create the emoji in the current server
      const createdEmoji = await msg.guild.emojis.create({
        attachment: emojiUrl,
        name: newName
      });
      const embed = new EmbedBuilder()
        .setTitle('🎭 Emoji Stolen Successfully!')
        .setDescription(`**Original:** ${emojiArg}\n**New Name:** ${newName}\n**New Emoji:** ${createdEmoji}`)
        .setThumbnail(emojiUrl)
        .setColor(0x2ecc71)
        .setTimestamp();
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Steal emoji error:', e);
      let errorMessage = 'Failed to steal emoji.';
      if (e.code === 30008) {
        errorMessage = 'Server has reached the maximum number of emojis.';
      } else if (e.code === 50035) {
        errorMessage = 'Invalid emoji name. Use only letters, numbers, and underscores.';
      } else if (e.code === 50013) {
        errorMessage = 'Bot lacks permission to manage emojis.';
      }
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription(errorMessage).setColor(0xe74c3c)] });
    }
  },
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
      .addIntegerOption(opt => opt.setName('id').setDescription('Case ID to view').setRequired(true))),

  new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Configure raid prevention settings or lift lockdown')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('What to do')
        .setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'on' },
          { name: 'Disable', value: 'off' },
          { name: 'Set Threshold', value: 'threshold' },
          { name: 'Toggle Auto-Lock', value: 'autolock' },
          { name: 'Status', value: 'status' },
          { name: 'Safe (Lift Lockdown)', value: 'safe' }
        )
    )
    .addIntegerOption(option =>
      option.setName('threshold')
        .setDescription('Number of events to trigger raid detection')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('autolock')
        .setDescription('Whether to auto-lock channels during raid')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure anti-nuke protection (owner only)')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('What to do')
        .setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'on' },
          { name: 'Disable', value: 'off' },
          { name: 'Manage Whitelist', value: 'whitelist' },
          { name: 'Toggle Auto-Ban', value: 'autoban' },
          { name: 'Status', value: 'status' }
        )
    )
    .addUserOption(option =>
      option.setName('user')
        .setDescription('User to add/remove from whitelist')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('whitelist_action')
        .setDescription('Add or remove from whitelist')
        .setRequired(false)
        .addChoices(
          { name: 'Add', value: 'add' },
          { name: 'Remove', value: 'remove' }
        )
    )
    .addBooleanOption(option =>
      option.setName('autoban')
        .setDescription('Whether to auto-ban violators')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('steal')
    .setDescription('Steal an emoji from another server')
    .addStringOption(option =>
      option.setName('emoji')
        .setDescription('Emoji to steal (copy from another server)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('name')
        .setDescription('New name for the emoji')
        .setRequired(false)
    ),
];

// Slash command handlers
const slashHandlers = {
  ban: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    let user = interaction.options.getUser('user');
    let userId = user ? user.id : null;
    const reason = interaction.options.getString('reason') || 'No reason provided';
    if (!userId) {
      // Try to parse as ID from a string option (if added in the future)
      return interaction.reply({ content: 'Please specify a user to ban.', ephemeral: true });
    }
    if (userId === interaction.client.user.id) {
      return interaction.reply({ content: 'Cannot ban the bot.', ephemeral: true });
    }
    try {
      await interaction.guild.members.ban(userId, { reason });
      await addModlog(interaction.guild.id, userId, 'ban', interaction.user.id, reason);
      const embed = new EmbedBuilder()
        .setTitle('User Banned')
        .setDescription(`${user ? user.tag : userId} has been banned.\n**Reason:** ${reason}`)
        .setColor(0xe74c3c)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Ban error:', e.message || JSON.stringify(e));
      return interaction.reply({ content: 'Failed to ban user. Make sure the ID is valid and the bot has ban permissions.', ephemeral: true });
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
    if (!user) {
      return interaction.reply({ content: 'Please specify a user to report.', ephemeral: true });
    }
    if (user.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot report yourself.', ephemeral: true });
    }
    if (!reason) {
      return interaction.reply({ content: 'Please provide a reason for the report.', ephemeral: true });
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
    const message = interaction.options.getString('message');
    if (!message) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide your message. Usage: `/modmail <message>`').setColor(0xe74c3c)] });
    }
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
      // Log to modmail_threads table (one open per user per guild)
      await supabase.from('modmail_threads').upsert({
        guild_id: interaction.guild.id,
        user_id: interaction.user.id,
        channel_id: targetChannel.id,
        status: 'open',
        created_at: new Date().toISOString()
      }, { onConflict: ['guild_id', 'user_id'] });
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
      // DM user confirmation
      await interaction.user.send({ embeds: [new EmbedBuilder().setTitle('Modmail Sent').setDescription('Your message has been sent to the moderators.').setColor(0x2ecc71)] }).catch(() => {});
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
    const arg = interaction.options.getString('reason')?.toLowerCase();
    if (arg === 'off') {
      // Turn off panic mode
      try {
        const { data: panic } = await supabase
          .from('panic_mode')
          .select('*')
          .eq('guild_id', interaction.guild.id)
          .eq('is_active', true)
          .single();
        if (!panic) {
          return interaction.reply({ content: 'Panic mode is not active.', ephemeral: true });
        }
        // Unlock all channels
        const channels = interaction.guild.channels.cache.filter(ch => ch.type === 0);
        for (const [id, channel] of channels) {
          try {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
              SendMessages: null,
              AddReactions: null,
              CreatePublicThreads: null,
              CreatePrivateThreads: null,
              SendMessagesInThreads: null
            });
          } catch (e) {
            console.error(`Failed to unlock channel ${channel.name}:`, e);
          }
        }
        await supabase
          .from('panic_mode')
          .update({ is_active: false, deactivated_at: new Date().toISOString() })
          .eq('guild_id', interaction.guild.id);
        return interaction.reply({ content: 'Panic mode disabled. All channels have been unlocked.', ephemeral: true });
      } catch (e) {
        console.error('Panic off error:', e);
        return interaction.reply({ content: 'Failed to disable panic mode.', ephemeral: true });
      }
    }
    const reason = interaction.options.getString('reason') || 'Emergency lockdown activated';
    
    try {
      // Check if panic mode is already active
      const { data: existingPanic } = await supabase
        .from('panic_mode')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .eq('is_active', true)
        .single();
      
      if (existingPanic) {
        return interaction.reply({ content: 'Panic mode is already active. Use `/panic off` to disable it.', ephemeral: true });
      }
      
      // Lock all channels
      const channels = interaction.guild.channels.cache.filter(ch => ch.type === 0); // Text channels only
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
      
      // Save panic mode to database
      await supabase
        .from('panic_mode')
        .upsert({
          guild_id: interaction.guild.id,
          is_active: true,
          activated_by: interaction.user.id,
          reason: reason
        }, { onConflict: ['guild_id'] });
      
      // Get configuration for notifications
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
    const feedback = interaction.options.getString('message');
    if (!feedback) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please provide feedback. Usage: `/feedback <message>`').setColor(0xe74c3c)] });
    }
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
      // Log feedback to DB
      await supabase.from('feedback').insert({
        guild_id: interaction.guild.id,
        user_id: interaction.user.id,
        message: feedback,
        is_anonymous: true
      });
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
      // DM user confirmation
      await interaction.user.send({ embeds: [new EmbedBuilder().setTitle('Feedback Submitted').setDescription('Your anonymous feedback has been submitted successfully.').setColor(0x2ecc71)] }).catch(() => {});
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
  },

  raid: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Only admins can configure raid protection.', ephemeral: true });
    }
    
    const action = interaction.options.getString('action');
    const threshold = interaction.options.getInteger('threshold');
    const autolock = interaction.options.getBoolean('autolock');
    
    if (action === 'on') {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        raid_protection_enabled: true
      }, { onConflict: ['guild_id'] });
      return interaction.reply({ content: '✅ Raid protection enabled.', ephemeral: true });
    }
    
    if (action === 'off') {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        raid_protection_enabled: false
      }, { onConflict: ['guild_id'] });
      return interaction.reply({ content: '❌ Raid protection disabled.', ephemeral: true });
    }
    
    if (action === 'threshold' && threshold) {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        raid_protection_threshold: threshold
      }, { onConflict: ['guild_id'] });
      return interaction.reply({ content: `✅ Raid threshold set to ${threshold} events.`, ephemeral: true });
    }
    
    if (action === 'autolock' && autolock !== null) {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        raid_auto_lock: autolock
      }, { onConflict: ['guild_id'] });
      return interaction.reply({ content: `✅ Auto-lock ${autolock ? 'enabled' : 'disabled'}.`, ephemeral: true });
    }
    
    if (action === 'status') {
      const { data: config } = await supabase
        .from('guild_configs')
        .select('raid_protection_enabled, raid_protection_threshold, raid_auto_lock')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Raid Protection Status')
        .addFields(
          { name: 'Enabled', value: config?.raid_protection_enabled !== false ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Threshold', value: config?.raid_protection_threshold || 'Default', inline: true },
          { name: 'Auto-Lock', value: config?.raid_auto_lock ? '✅ Yes' : '❌ No', inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  antinuke: async (interaction) => {
    if (!await isOwnerOrCoOwner(interaction.member)) {
      return interaction.reply({ content: 'Only the server owner or co-owners can configure anti-nuke protection.', ephemeral: true });
    }
    
    const action = interaction.options.getString('action');
    const user = interaction.options.getUser('user');
    const whitelistAction = interaction.options.getString('whitelist_action');
    const autoban = interaction.options.getBoolean('autoban');
    
    if (action === 'on') {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        anti_nuke_enabled: true
      }, { onConflict: ['guild_id'] });
      return interaction.reply({ content: '✅ Anti-nuke protection enabled.', ephemeral: true });
    }
    
    if (action === 'off') {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        anti_nuke_enabled: false
      }, { onConflict: ['guild_id'] });
      return interaction.reply({ content: '❌ Anti-nuke protection disabled.', ephemeral: true });
    }
    
    if (action === 'whitelist' && user && whitelistAction) {
      const { data: config } = await supabase
        .from('guild_configs')
        .select('anti_nuke_whitelist')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      let whitelist = config?.anti_nuke_whitelist || [];
      
      if (whitelistAction === 'add') {
        if (!whitelist.includes(user.id)) {
          whitelist.push(user.id);
        }
      } else if (whitelistAction === 'remove') {
        whitelist = whitelist.filter(id => id !== user.id);
      }
      
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        anti_nuke_whitelist: whitelist
      }, { onConflict: ['guild_id'] });
      
      return interaction.reply({ content: `✅ User ${user} ${whitelistAction === 'add' ? 'added to' : 'removed from'} anti-nuke whitelist.`, ephemeral: true });
    }
    
    if (action === 'autoban' && autoban !== null) {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        anti_nuke_auto_ban: autoban
      }, { onConflict: ['guild_id'] });
      return interaction.reply({ content: `✅ Auto-ban ${autoban ? 'enabled' : 'disabled'}.`, ephemeral: true });
    }
    
    if (action === 'status') {
      const { data: config } = await supabase
        .from('guild_configs')
        .select('anti_nuke_enabled, anti_nuke_whitelist, anti_nuke_auto_ban')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Anti-Nuke Protection Status')
        .addFields(
          { name: 'Enabled', value: config?.anti_nuke_enabled ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Auto-Ban', value: config?.anti_nuke_auto_ban ? '✅ Yes' : '❌ No', inline: true },
          { name: 'Whitelist', value: (config?.anti_nuke_whitelist?.length || 0) + ' users', inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  steal: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Only admins can steal emojis.', ephemeral: true });
    }
    const emojiArg = interaction.options.getString('emoji');
    const newName = interaction.options.getString('name') || 'stolen_emoji';
    if (!emojiArg) {
      return interaction.reply({ content: 'Please provide an emoji to steal. Usage: `/steal emoji:🎉 name:party`', ephemeral: true });
    }
    // Reject user mentions
    if (/^<@!?\d+>$/.test(emojiArg)) {
      return interaction.reply({ content: 'Please provide a custom emoji from another server, not a user mention.', ephemeral: true });
    }
    // Extract emoji ID from the emoji string
    const emojiMatch = emojiArg.match(/<a?:(\w+):(\d+)>/);
    if (!emojiMatch) {
      return interaction.reply({ content: 'Please provide a valid custom emoji from another server.', ephemeral: true });
    }
    const [, emojiName, emojiId] = emojiMatch;
    const isAnimated = emojiArg.startsWith('<a:');
    const extension = isAnimated ? 'gif' : 'png';
    const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`;
    try {
      // Create the emoji in the current server
      const createdEmoji = await interaction.guild.emojis.create({
        attachment: emojiUrl,
        name: newName
      });
      const embed = new EmbedBuilder()
        .setTitle('🎭 Emoji Stolen Successfully!')
        .setDescription(`**Original:** ${emojiArg}\n**New Name:** ${newName}\n**New Emoji:** ${createdEmoji}`)
        .setThumbnail(emojiUrl)
        .setColor(0x2ecc71)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Steal emoji error:', e);
      let errorMessage = 'Failed to steal emoji.';
      if (e.code === 30008) {
        errorMessage = 'Server has reached the maximum number of emojis.';
      } else if (e.code === 50035) {
        errorMessage = 'Invalid emoji name. Use only letters, numbers, and underscores.';
      } else if (e.code === 50013) {
        errorMessage = 'Bot lacks permission to manage emojis.';
      }
      return interaction.reply({ content: errorMessage, ephemeral: true });
    }
  },
};

const buttonHandlers = {};
const modalHandlers = {};

// Raid prevention system
const raidDetection = new Map(); // Map<guildId, {joins: [], messages: [], lastAlert: 0}>
const RAID_THRESHOLDS = {
  joins: { count: 10, timeWindow: 30000 }, // 10 joins in 30 seconds
  messages: { count: 20, timeWindow: 10000 } // 20 messages in 10 seconds
};

async function checkRaidProtection(guild, type, userId) {
  const now = Date.now();
  const guildId = guild.id;
  
  if (!raidDetection.has(guildId)) {
    raidDetection.set(guildId, { joins: [], messages: [], lastAlert: 0 });
  }
  
  const data = raidDetection.get(guildId);
  const threshold = RAID_THRESHOLDS[type];
  
  // Add new event
  data[type].push({ userId, timestamp: now });
  
  // Remove old events outside time window
  data[type] = data[type].filter(event => now - event.timestamp < threshold.timeWindow);
  
  // Check if threshold exceeded
  if (data[type].length >= threshold.count) {
    // Prevent spam alerts
    if (now - data.lastAlert < 60000) return false;
    data.lastAlert = now;
    
    // Get unique users
    const uniqueUsers = new Set(data[type].map(e => e.userId));
    
    // Get raid protection config
    const { data: config } = await supabase
      .from('guild_configs')
      .select('raid_protection_enabled, raid_protection_threshold, log_channel')
      .eq('guild_id', guildId)
      .single();
    
    if (config?.raid_protection_enabled !== false) {
      await logEvent(guild, type, Array.from(uniqueUsers), `Threshold: ${threshold.count} in ${threshold.timeWindow / 1000}s`);
      await handleRaidDetection(guild, type, uniqueUsers, config);
      return true;
    }
  }
  
  return false;
}

async function handleRaidDetection(guild, type, users, config) {
  const userList = Array.from(users).slice(0, 10).map(id => `<@${id}>`).join(', ');
  const embed = new EmbedBuilder()
    .setTitle('🚨 RAID DETECTED')
    .setDescription(`**Type:** ${type.toUpperCase()}\n**Users:** ${userList}${users.size > 10 ? ` and ${users.size - 10} more` : ''}`)
    .setColor(0xe74c3c)
    .setTimestamp();
  
  // Send to log channel if configured
  if (config?.log_channel) {
    const logChannel = guild.channels.cache.get(config.log_channel);
    if (logChannel?.isTextBased()) {
      await logChannel.send({ embeds: [embed] });
    }
  }
  
  // Auto-lock channels if configured
  if (config?.raid_auto_lock) {
    const channels = guild.channels.cache.filter(ch => ch.type === 0);
    for (const [id, channel] of channels) {
      try {
        await channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
          AddReactions: false
        });
      } catch (e) {
        console.error(`Failed to lock channel ${channel.name}:`, e);
      }
    }
    
    const lockEmbed = new EmbedBuilder()
      .setTitle('🔒 Channels Auto-Locked')
      .setDescription('All channels have been locked due to raid detection.')
      .setColor(0xe67e22)
      .setTimestamp();
    
    // Send to first available channel
    const firstChannel = guild.channels.cache.find(ch => ch.type === 0 && ch.permissionsFor(guild.members.me).has('SendMessages'));
    if (firstChannel) {
      await firstChannel.send({ embeds: [lockEmbed] });
    }
  }
}

// Anti-nuke protection
const antiNukeProtection = new Map(); // Map<guildId, {enabled: boolean, whitelist: Set, lastAction: Map}>

async function checkAntiNuke(guild, action, userId) {
  const guildId = guild.id;
  
  if (!antiNukeProtection.has(guildId)) {
    antiNukeProtection.set(guildId, { enabled: false, whitelist: new Set(), lastAction: new Map() });
  }
  
  const data = antiNukeProtection.get(guildId);
  
  // Check if anti-nuke is enabled
  const { data: config } = await supabase
    .from('guild_configs')
    .select('anti_nuke_enabled, anti_nuke_whitelist')
    .eq('guild_id', guildId)
    .single();
  
  if (!config?.anti_nuke_enabled) return false;
  
  data.enabled = true;
  if (config.anti_nuke_whitelist) {
    data.whitelist = new Set(config.anti_nuke_whitelist);
  }
  
  // Check if user is whitelisted
  if (data.whitelist.has(userId)) return false;
  
  // Check for suspicious activity
  const now = Date.now();
  const userActions = data.lastAction.get(userId) || [];
  
  // Remove old actions (older than 1 minute)
  const recentActions = userActions.filter(timestamp => now - timestamp < 60000);
  
  // Check for rapid actions
  if (recentActions.length >= 5) { // 5 actions in 1 minute
    await logEvent(guild, action, userId, recentActions.length, `Threshold: 5 in 60s`);
    await handleAntiNukeViolation(guild, userId, action, recentActions.length);
    return true;
  }
  
  // Add current action
  recentActions.push(now);
  data.lastAction.set(userId, recentActions);
  
  return false;
}

async function handleAntiNukeViolation(guild, userId, action, actionCount) {
  const embed = new EmbedBuilder()
    .setTitle('🛡️ ANTI-NUKE VIOLATION')
    .setDescription(`**User:** <@${userId}>\n**Action:** ${action}\n**Actions in 1min:** ${actionCount}`)
    .setColor(0xe74c3c)
    .setTimestamp();
  
  // Get log channel
  const { data: config } = await supabase
    .from('guild_configs')
    .select('log_channel')
    .eq('guild_id', guild.id)
    .single();
  
  if (config?.log_channel) {
    const logChannel = guild.channels.cache.get(config.log_channel);
    if (logChannel?.isTextBased()) {
      await logChannel.send({ embeds: [embed] });
    }
  }
  
  // Auto-ban if configured
  const { data: antiNukeConfig } = await supabase
    .from('guild_configs')
    .select('anti_nuke_auto_ban')
    .eq('guild_id', guild.id)
    .single();
  
  if (antiNukeConfig?.anti_nuke_auto_ban) {
    try {
      await guild.members.ban(userId, { reason: 'Anti-nuke violation' });
      await addModlog(guild.id, userId, 'ban', 'BOT', 'Anti-nuke violation');
    } catch (e) {
      console.error('Failed to auto-ban anti-nuke violator:', e);
    }
  }
}

// Helper: Get or create the Safe role
async function getOrCreateSafeRole(guild) {
  let safeRole = guild.roles.cache.find(r => r.name === 'Safe');
  if (!safeRole) {
    safeRole = await guild.roles.create({
      name: 'Safe',
      color: 0x2ecc71,
      reason: 'Created for lockdown bypass',
      mentionable: false
    });
  }
  return safeRole;
}

// Helper: Lockdown all text channels
async function lockdownGuild(guild, safeRole) {
  const channels = guild.channels.cache.filter(ch => ch.type === 0); // Text channels only
  for (const [id, channel] of channels) {
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
        AddReactions: false,
        CreateInstantInvite: false,
        CreateChannels: false
      });
      // Allow Safe role to chat
      await channel.permissionOverwrites.edit(safeRole, {
        SendMessages: true,
        AddReactions: true
      });
    } catch (e) {
      console.error(`Failed to lock channel ${channel.name}:`, e);
    }
  }
}

// Helper: Unlock all text channels
async function unlockGuild(guild, safeRole) {
  const channels = guild.channels.cache.filter(ch => ch.type === 0);
  for (const [id, channel] of channels) {
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null,
        CreatePublicThreads: null,
        CreatePrivateThreads: null,
        AddReactions: null,
        CreateInstantInvite: null,
        CreateChannels: null
      });
      // Remove Safe role override
      await channel.permissionOverwrites.delete(safeRole).catch(() => {});
    } catch (e) {
      console.error(`Failed to unlock channel ${channel.name}:`, e);
    }
  }
}

// Prefix command: ;raid safe
prefixCommands['raid'] = async (msg, args) => {
  const sub = args[0]?.toLowerCase();
  if (sub === 'safe') {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can lift lockdown.').setColor(0xe74c3c)] });
    }
    const safeRole = await getOrCreateSafeRole(msg.guild);
    await unlockGuild(msg.guild, safeRole);
    // Log event
    await logEvent(msg.guild, 'Lockdown Lifted', `Lockdown lifted by <@${msg.author.id}>. Permissions restored.`, 0x2ecc71);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Lockdown Lifted').setDescription('All channels have been unlocked and permissions restored.').setColor(0x2ecc71)] });
  }
  // ...existing raid command logic...
  // (Keep the rest of the original raid command implementation here)
};

// Slash command: /raid safe
slashCommands.push(
  new SlashCommandBuilder()
    .setName('raid')
    .setDescription('Configure raid prevention settings or lift lockdown')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('What to do')
        .setRequired(true)
        .addChoices(
          { name: 'Enable', value: 'on' },
          { name: 'Disable', value: 'off' },
          { name: 'Set Threshold', value: 'threshold' },
          { name: 'Toggle Auto-Lock', value: 'autolock' },
          { name: 'Status', value: 'status' },
          { name: 'Safe (Lift Lockdown)', value: 'safe' }
        )
    )
    .addIntegerOption(option =>
      option.setName('threshold')
        .setDescription('Number of events to trigger raid detection')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('autolock')
        .setDescription('Whether to auto-lock channels during raid')
        .setRequired(false)
    )
);

slashHandlers['raid'] = async (interaction) => {
  const action = interaction.options.getString('action');
  if (action === 'safe') {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'Only admins can lift lockdown.', ephemeral: true });
    }
    const safeRole = await getOrCreateSafeRole(interaction.guild);
    await unlockGuild(interaction.guild, safeRole);
    // Log event
    await logEvent(interaction.guild, 'Lockdown Lifted', `Lockdown lifted by <@${interaction.user.id}>. Permissions restored.`, 0x2ecc71);
    return interaction.reply({ content: 'Lockdown lifted. All channels have been unlocked and permissions restored.', ephemeral: true });
  }
  // ...existing raid slash command logic...
  // (Keep the rest of the original slash handler implementation here)
};

// --- Backup & Recovery ---
const BACKUP_DIR = path.resolve(__dirname, '../../backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

async function snapshotGuild(guild) {
  // Snapshot channels and roles
  const channels = guild.channels.cache.map(ch => ({
    id: ch.id,
    name: ch.name,
    type: ch.type,
    parent: ch.parentId,
    position: ch.position,
    topic: ch.topic,
    nsfw: ch.nsfw,
    rateLimitPerUser: ch.rateLimitPerUser,
    permissionOverwrites: ch.permissionOverwrites.cache.map(po => ({
      id: po.id,
      type: po.type,
      allow: po.allow.bitfield,
      deny: po.deny.bitfield
    }))
  }));
  const roles = guild.roles.cache.filter(r => r.id !== guild.id).map(role => ({
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    position: role.position,
    permissions: role.permissions.bitfield,
    mentionable: role.mentionable
  }));
  const backup = {
    guildId: guild.id,
    timestamp: Date.now(),
    channels,
    roles
  };
  fs.writeFileSync(path.join(BACKUP_DIR, `${guild.id}.json`), JSON.stringify(backup, null, 2));
}

// On bot startup, snapshot all guilds
if (typeof client !== 'undefined' && client.on) {
  client.on('ready', async () => {
    for (const guild of client.guilds.cache.values()) {
      try {
        await snapshotGuild(guild);
        console.log(`[BACKUP] Snapshot saved for guild ${guild.name} (${guild.id})`);
      } catch (e) {
        console.error(`[BACKUP] Failed to snapshot guild ${guild.id}:`, e);
      }
    }
  });
}

// Helper: Restore channels and roles from backup
async function restoreGuildFromBackup(guild) {
  const backupFile = path.join(BACKUP_DIR, `${guild.id}.json`);
  if (!fs.existsSync(backupFile)) throw new Error('No backup found for this server.');
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  // Restore roles (skip @everyone)
  for (const roleData of backup.roles) {
    if (guild.roles.cache.has(roleData.id)) continue;
    try {
      await guild.roles.create({
        name: roleData.name,
        color: roleData.color,
        hoist: roleData.hoist,
        position: roleData.position,
        permissions: BigInt(roleData.permissions),
        mentionable: roleData.mentionable,
        reason: 'Restoring from backup'
      });
    } catch (e) {
      console.error(`[RESTORE] Failed to restore role ${roleData.name}:`, e);
    }
  }
  // Restore channels
  for (const chData of backup.channels) {
    if (guild.channels.cache.has(chData.id)) continue;
    try {
      await guild.channels.create({
        name: chData.name,
        type: chData.type,
        parent: chData.parent,
        position: chData.position,
        topic: chData.topic,
        nsfw: chData.nsfw,
        rateLimitPerUser: chData.rateLimitPerUser,
        permissionOverwrites: chData.permissionOverwrites.map(po => ({
          id: po.id,
          type: po.type,
          allow: BigInt(po.allow),
          deny: BigInt(po.deny)
        })),
        reason: 'Restoring from backup'
      });
    } catch (e) {
      console.error(`[RESTORE] Failed to restore channel ${chData.name}:`, e);
    }
  }
}

// Prefix command: ;raid restore
prefixCommands['raid_restore'] = async (msg, args) => {
  if (!await isAdmin(msg.member) && !await isOwnerOrCoOwner(msg.member)) {
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins, the server owner, or co-owners can restore backups.').setColor(0xe74c3c)] });
  }
  try {
    await restoreGuildFromBackup(msg.guild);
    await logEvent(msg.guild, 'Backup Restore', `Backup restored by <@${msg.author.id}>.`, 0x2ecc71);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Backup Restored').setDescription('Channels and roles have been restored from the last backup.').setColor(0x2ecc71)] });
  } catch (e) {
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Restore Failed').setDescription(e.message).setColor(0xe74c3c)] });
  }
};

// Add to ;raid command
const oldRaid = prefixCommands['raid'];
prefixCommands['raid'] = async (msg, args) => {
  if (args[0]?.toLowerCase() === 'restore') {
    return prefixCommands['raid_restore'](msg, args.slice(1));
  }
  return oldRaid(msg, args);
};

// Slash command: /raid restore
// (Add to slash handler)
const oldRaidHandler = slashHandlers['raid'];
slashHandlers['raid'] = async (interaction) => {
  const action = interaction.options.getString('action');
  if (action === 'restore') {
    if (!await isAdmin(interaction.member) && !await isOwnerOrCoOwner(interaction.member)) {
      return interaction.reply({ content: 'Only admins, the server owner, or co-owners can restore backups.', ephemeral: true });
    }
    try {
      await restoreGuildFromBackup(interaction.guild);
      await logEvent(interaction.guild, 'Backup Restore', `Backup restored by <@${interaction.user.id}>.`, 0x2ecc71);
      return interaction.reply({ content: 'Backup restored. Channels and roles have been restored from the last backup.', ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: `Restore failed: ${e.message}`, ephemeral: true });
    }
  }
  return oldRaidHandler(interaction);
};

module.exports = {
  name: 'moderation',
  prefixCommands,
  slashCommands,
  slashHandlers,
  buttonHandlers,
  modalHandlers,
  checkRaidProtection,
  checkAntiNuke,
  handleRaidDetection,
  handleAntiNukeViolation
}; 