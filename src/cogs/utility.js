const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { supabase } = require('../utils/supabase');
const os = require('os');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const commandDescriptions = {
  // Setup & Configuration
  setup: 'Configure server settings and admin roles. Usage: `;setup @adminrole [@extrarole1 ...]` (owner only)',
  config: 'Show current server configuration and settings. Usage: `;config`',
  logchannel: 'Set the log channel for moderation actions. Usage: `;logchannel #channel` (admin only)',
  autorole: 'Set autorole for new members. Usage: `;autorole @role` (admin only)',
  prefix: 'Set a custom command prefix for this server. Usage: `;prefix <new_prefix>` (owner only)',
  'reset-config': 'Reset server configuration to defaults. Usage: `;reset-config` (owner only)',
  'disable-commands': 'Manage which commands are enabled/disabled. Usage: `;disable-commands add/remove/list/clear <commands>` (owner only)',
  
  // Welcome & Goodbye
  welcomesetup: 'Setup welcome messages for new members. Usage: `;welcomesetup` (admin only)',
  goodbyesetup: 'Setup goodbye messages for leaving members. Usage: `;goodbyesetup` (admin only)',
  
  // Ticket System
  ticketsetup: 'Setup ticket system for support. Usage: `;ticketsetup #channel` (admin only)',
  
  // Moderation
  ban: 'Ban a user from the server (removes them from the server entirely). Usage: `;ban @user [reason]` (admin only)',
  kick: 'Kick a user from the server (removes them, but they can rejoin if invited). Usage: `;kick @user [reason]` (admin only)',
  warn: 'Warn a user. Usage: `;warn @user <reason>` (admin only)',
  warnings: 'Show warnings for a member. Usage: `;warnings [@user]`',
  clearwarn: 'Clear warnings for a member. Usage: `;clearwarn @user` (admin only)',
  purge: 'Bulk delete messages. Usage: `;purge <1-100>` (admin only)',
  nuke: 'Clone and delete the channel. Usage: `;nuke` (admin only)',
  blacklist: 'Add a user to the bot blacklist. This blocks the user from using any bot commands, but does NOT ban or kick them from the server. Usage: `;blacklist @user <reason>` (admin only)',
  unblacklist: 'Remove a user from the bot blacklist, restoring their access to bot commands. Usage: `;unblacklist @user` (admin only)',
  mute: 'Mute a user in the server (prevents them from sending messages/voice for a duration). Usage: `;mute @user <duration> [reason]` (admin only)',
  unmute: 'Unmute a user in the server (restores their ability to speak). Usage: `;unmute @user` (admin only)',
  timeout: 'Timeout a user in the server (temporarily restricts their ability to interact). Usage: `;timeout @user <duration> [reason]` (admin only)',
  lock: 'Locks the current channel for everyone (prevents all users from sending messages in the channel, but does not affect the whole server). Usage: `;lock` (admin only)',
  unlock: 'Unlocks the current channel for everyone (restores ability to send messages in the channel). Usage: `;unlock` (admin only)',
  spy: 'Secretly logs all messages from a specific user for moderation. Only affects bot logging, does not affect the user\'s server permissions. Usage: `&spy @user` (admin only)',
  ghostping: 'Sends and deletes a ping instantly for fun or to test mod reactions. Usage: `&ghostping @user` (admin only)',
  sniper: 'Logs and shows deleted messages (message sniping). Only affects bot logging, does not restore deleted messages in the server. Usage: `&sniper on` to enable, `&sniper off` to disable (admin only)',
  revert: 'Removes a user\'s last 10 messages in the current channel (like a soft purge, does not ban or mute the user). Usage: `&revert @user` (admin only)',
  modview: 'View and filter mod actions (bans, mutes, warns, etc) logged by the bot. Does not show server audit log. Usage: `&modview [action] [next|prev]` (admin only)',
  shadowban: 'Bans a user from the server without showing a ban message or logging (silent ban). Usage: `&shadowban @user` (admin only)',
  massban: 'Ban all users with a specific role from the server. Usage: `&massban @role` (admin only)',
  crontab: 'Schedule, list, or cancel commands to run after a delay. Usage: `&crontab <time> <command>` to schedule, `&crontab list` to list, `&crontab cancel <id>` to cancel (admin only)',
  
  // Utility
  ls: 'List all text channels in the server. Usage: `;ls`',
  ps: 'Show all online members in the server. Usage: `;ps`',
  whoami: 'Show your user info, including username, ID, join date, and roles. Usage: `;whoami`',
  ping: 'Check the bot\'s latency to Discord. Usage: `;ping`',
  uptime: 'Show how long the bot has been running. Usage: `;uptime`',
  server: 'Show detailed info about the server, including owner, members, channels, roles, creation date, and boost level. Usage: `;server`',
  roles: 'List all roles in the server. Usage: `;roles`',
  avatar: 'Show the avatar of a user. Usage: `;avatar [@user]` (defaults to yourself if no user is mentioned)',
  poll: 'Create a poll with reactions. Usage: `;poll <question>` (admin only)',
  say: 'Make the bot say something as an embed. Usage: `;say <message>` (admin only)',
  help: 'Show this help message. Usage: `;help`',
  reset: 'Reset the command prefix to default (; and &). Usage: `;reset` (owner only)',
  top: 'Show top users by messages, infractions, or uptime. Usage: `&top messages`, `&top infractions`, or `&top uptime`',
  sysinfo: 'Show system and bot info: CPU, RAM, uptime, Node.js version, OS, guild/user count. Usage: `&sysinfo`',
  man: 'Returns the help info for a command like a Linux manpage. Usage: `&man <command>`',
  passwd: 'Set, get, list, or remove a user codeword for events or actions. Only affects bot features, not server permissions. Usage: `&passwd @user <codeword>` to set, `&passwd @user` to get, `&passwd list` to list all, `&passwd remove @user` to remove (admin only)',
  jump: 'Send a clickable link to a message by ID. Usage: `&jump <message_id>` or `/jump <message_id>`',
  archive: 'Archive messages from a channel to a zip/log file. Usage: `/archive #channel [days]` (admin only)',
  mirror: 'Automatically mirror messages between channels. Usage: `/mirror #source #target` (admin only)',
  cooldown: 'Set or view command cooldowns. Usage: `/cooldown <command> <seconds>` (admin only)',
  watchword: 'Watch for specific words and take actions (delete, warn, log, etc). Usage: `/watchword add/remove <word> <actions...>` (admin only)',
  cloak: 'Temporarily disguise a user\'s name and avatar. Usage: `/cloak @user <nickname>` (admin only)',
  blacklistword: 'Ban a word (e.g., "sus"). Deletes and logs messages. Usage: `&blacklistword <word>` or `/blacklistword <word>` (admin only)',
  curse: 'Edit every message a user sends (add emoji/suffix). Usage: `&curse @user` or `/curse @user` (admin only)',
  npcgen: 'Generate a random character with traits, class, and name. Usage: `&npcgen` or `/npcgen`',
  worldstate: 'Describe the fictional world state of the server. Usage: `&worldstate` or `/worldstate`',
  whois: 'Show another user\'s info. Usage: `;whois [@user]`',
  'co-owners': 'Manage co-owners for bot setup and management. Usage: `&co-owners add/remove/list @user` (owner only)',
  'add-co-owner': 'Add a co-owner to help with bot management. Usage: `&add-co-owner @user` (owner only)',
  'remove-co-owner': 'Remove a co-owner. Usage: `&remove-co-owner @user` (owner only)'
};

// Translation function with language detection
async function detectLanguage(text) {
  try {
    const response = await fetch('https://libretranslate.de/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text })
    });
    if (!response.ok) throw new Error('Failed to detect language');
    const data = await response.json();
    if (data && data.length > 0) {
      return data[0].language;
    }
  } catch (e) {
    console.error('Language detection error:', e);
  }
  return 'en'; // fallback
}

// Translation function using Google Translate (unofficial endpoint, reliable)
async function translateText(text, targetLang = 'en') {
  try {
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data = await response.json();
    // data[2] is the detected source language
    const detectedLang = data[2] || 'unknown';
    const translated = data[0]?.map(part => part[0]).join('') || '';
    if (detectedLang === targetLang) {
      return {
        translated: text,
        detectedLang,
        confidence: 1,
        sameLang: true
      };
    }
    return {
      translated,
      detectedLang,
      confidence: 0.9
    };
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

// Language codes mapping
const languageCodes = {
  'english': 'en', 'en': 'en',
  'spanish': 'es', 'es': 'es',
  'french': 'fr', 'fr': 'fr',
  'german': 'de', 'de': 'de',
  'italian': 'it', 'it': 'it',
  'portuguese': 'pt', 'pt': 'pt',
  'russian': 'ru', 'ru': 'ru',
  'japanese': 'ja', 'ja': 'ja',
  'korean': 'ko', 'ko': 'ko',
  'chinese': 'zh', 'zh': 'zh',
  'arabic': 'ar', 'ar': 'ar',
  'hindi': 'hi', 'hi': 'hi',
  'dutch': 'nl', 'nl': 'nl',
  'swedish': 'sv', 'sv': 'sv',
  'norwegian': 'no', 'no': 'no',
  'danish': 'da', 'da': 'da',
  'finnish': 'fi', 'fi': 'fi',
  'polish': 'pl', 'pl': 'pl',
  'turkish': 'tr', 'tr': 'tr',
  'greek': 'el', 'el': 'el',
  'hebrew': 'he', 'he': 'he',
  'thai': 'th', 'th': 'th',
  'vietnamese': 'vi', 'vi': 'vi',
  'indonesian': 'id', 'id': 'id',
  'malay': 'ms', 'ms': 'ms',
  'filipino': 'tl', 'tl': 'tl',
  'auto': 'auto'
};

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

// Prefix commands
const prefixCommands = {
  ls: async (msg, args) => {
    const names = msg.guild.channels.cache.filter(c => c.isTextBased()).map(c => c.name).join(', ');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Channels').setDescription(names || 'None').setColor(0x3498db)] });
  },
  
  ps: async (msg, args) => {
    const onlineMembers = msg.guild.members.cache.filter(m => m.presence?.status === 'online').size;
    const totalMembers = msg.guild.memberCount;
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Online Members').setDescription(`${onlineMembers}/${totalMembers} members online`).setColor(0x2ecc71)] });
  },
  
  whoami: async (msg, args) => {
    const member = msg.member;
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('User Info').addFields(
      { name: 'Username', value: member.user.username, inline: true },
      { name: 'ID', value: member.id, inline: true },
      { name: 'Joined', value: member.joinedAt.toDateString(), inline: true },
      { name: 'Roles', value: member.roles.cache.map(r => r.name).join(', ') || 'None' }
    ).setColor(0x9b59b6)] });
  },
  
  ping: async (msg, args) => {
    const embed = new EmbedBuilder()
      .setTitle('Pong!')
      .setDescription(`Latency: ${msg.client.ws.ping}ms`)
      .setColor(0x2ecc71)
      .setTimestamp();
    
    return msg.reply({ embeds: [embed] });
  },
  
  uptime: async (msg, args) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const embed = new EmbedBuilder()
      .setTitle('Bot Uptime')
      .setDescription(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      .setColor(0x3498db)
      .setTimestamp();
    
    return msg.reply({ embeds: [embed] });
  },
  
  server: async (msg, args) => {
    const guild = msg.guild;
    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members', value: guild.memberCount.toString(), inline: true },
        { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
        { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
        { name: 'Created', value: guild.createdAt.toDateString(), inline: true },
        { name: 'Boost Level', value: guild.premiumTier.toString(), inline: true }
      )
      .setColor(0x9b59b6);
    
    return msg.reply({ embeds: [embed] });
  },
  
  roles: async (msg, args) => {
    const roles = msg.guild.roles.cache.sort((a, b) => b.position - a.position).map(r => r.name).join(', ');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Roles').setDescription(roles || 'No roles').setColor(0x9b59b6)] });
  },
  
  avatar: async (msg, args) => {
    const user = msg.mentions.users.first() || msg.author;
    const embed = new EmbedBuilder()
      .setTitle(`${user.tag}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor(0x3498db);
    
    return msg.reply({ embeds: [embed] });
  },
  
  reset: async (msg, args) => {
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can reset the prefix.').setColor(0xe74c3c)] });
    }
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        custom_prefix: null
      }, { onConflict: ['guild_id'] });
    const embed = new EmbedBuilder()
        .setTitle('Prefix Reset')
        .setDescription('Command prefix reset to defaults (; and &)')
        .setColor(0x2ecc71)
        .setTimestamp();
    return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Prefix reset error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to reset prefix.').setColor(0xe74c3c)] });
    }
  },
  
  spy: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    const user = msg.mentions.users.first();
    if (!user) return msg.reply('Please mention a user to spy on.');
    global.spyUsers = global.spyUsers || {};
    global.spyUsers[msg.guild.id] = global.spyUsers[msg.guild.id] || new Set();
    global.spyUsers[msg.guild.id].add(user.id);
    return msg.reply(`Now spying on <@${user.id}>. All their messages will be logged to the console.`);
  },

  ghostping: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    const user = msg.mentions.users.first();
    if (!user) return msg.reply('Please mention a user to ghost ping.');
    const pingMsg = await msg.channel.send(`<@${user.id}>`);
    setTimeout(() => pingMsg.delete().catch(() => {}), 1000);
    return msg.reply('Ghost ping sent!');
  },

  sniper: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    const arg = args[0]?.toLowerCase();
    if (arg === 'on') {
      global.sniperEnabled = global.sniperEnabled || {};
      global.sniperEnabled[msg.guild.id] = true;
      return msg.reply('Sniper enabled. Deleted messages will be logged.');
    } else if (arg === 'off') {
      global.sniperEnabled = global.sniperEnabled || {};
      global.sniperEnabled[msg.guild.id] = false;
      return msg.reply('Sniper disabled.');
    } else if (!arg) {
      // Show last deleted message in this channel
      global.snipedMessages = global.snipedMessages || {};
      const sniped = global.snipedMessages[msg.guild.id]?.[msg.channel.id];
      if (!sniped) {
        return msg.reply('No recently deleted message found in this channel.');
      }
      const embed = new EmbedBuilder()
        .setTitle('Sniped Message')
        .setDescription(sniped.content)
        .addFields(
          { name: 'Author', value: sniped.author, inline: true },
          { name: 'Deleted At', value: `<t:${Math.floor(sniped.timestamp/1000)}:R>`, inline: true }
        )
        .setColor(0x7289da)
        .setTimestamp(sniped.timestamp);
      return msg.reply({ embeds: [embed] });
    } else {
      return msg.reply('Usage: &sniper on/off or &sniper to snipe the last deleted message.');
    }
  },

  revert: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    const user = msg.mentions.users.first();
    if (!user) return msg.reply('Please mention a user to revert.');
    const messages = await msg.channel.messages.fetch({ limit: 100 });
    const userMessages = messages.filter(m => m.author.id === user.id).first(10);
    for (const m of userMessages) {
      await m.delete().catch(() => {});
    }
    return msg.reply(`Removed last ${userMessages.length} messages from <@${user.id}>.`);
  },

  modview: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    let actionType = args[0] && !['next', 'prev'].includes(args[0]) ? args[0] : null;
    let page = 0;
    if (args.includes('next')) page++;
    if (args.includes('prev')) page = Math.max(0, page - 1);
    const pageSize = 10;
    let query = supabase.from('modlogs').select('*').eq('guild_id', msg.guild.id);
    if (actionType) query = query.eq('action', actionType);
    query = query.order('date', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await query;
    if (error) return msg.reply('Failed to fetch mod actions.');
    if (!data || data.length === 0) return msg.reply('No mod actions found.');
    const lines = data.map(a => `• [${a.action}] <@${a.user_id}> by <@${a.moderator_id}> (${new Date(a.date).toLocaleDateString()})${a.reason ? `: ${a.reason}` : ''}`).join('\n');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Mod Actions').setDescription(lines).setFooter({ text: `Page ${page + 1}` }).setColor(0x7289da)] });
  },

  shadowban: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    const user = msg.mentions.users.first();
    if (!user) return msg.reply('Please mention a user to shadowban.');
    await msg.guild.members.ban(user.id, { reason: 'Shadowban (silent ban)' });
    return msg.reply(`User <@${user.id}> has been shadowbanned (no message/log).`);
  },

  massban: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    const role = msg.mentions.roles.first();
    if (!role) return msg.reply('Please mention a role to massban.');
    const members = msg.guild.members.cache.filter(m => m.roles.cache.has(role.id));
    for (const member of members.values()) {
      await member.ban({ reason: 'Massban by role' }).catch(() => {});
    }
    return msg.reply(`Massbanned all users with the role ${role.name}.`);
  },

  lock: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });
    return msg.reply('Channel locked.');
  },

  unlock: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    }
    await msg.channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: true });
    return msg.reply('Channel unlocked.');
  },

  crontab: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    if (args[0] === 'list') {
      const { data, error } = await supabase.from('scheduled_commands').select('*').eq('guild_id', msg.guild.id).eq('executed', false).order('run_at', { ascending: true });
      if (error) return msg.reply('Failed to fetch scheduled commands.');
      if (!data || data.length === 0) return msg.reply('No scheduled commands.');
      const lines = data.map(c => `• [ID ${c.id}] ${c.command} at ${c.run_at}`).join('\n');
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Scheduled Commands').setDescription(lines).setColor(0x7289da)] });
    }
    if (args[0] === 'cancel' && args[1]) {
      const id = parseInt(args[1]);
      await supabase.from('scheduled_commands').update({ executed: true }).eq('id', id);
      return msg.reply(`Cancelled scheduled command ID ${id}.`);
    }
    const [time, ...commandArr] = args;
    if (!time || commandArr.length === 0) return msg.reply('Usage: &crontab <time> <command> | &crontab list | &crontab cancel <id>');
    const match = time.match(/^(\d+)([smhd])$/);
    if (!match) return msg.reply('Invalid time format. Use s/m/h/d (e.g., 5m)');
    const num = parseInt(match[1]);
    const unit = match[2];
    let ms = num * 1000;
    if (unit === 'm') ms *= 60;
    if (unit === 'h') ms *= 60 * 60;
    if (unit === 'd') ms *= 24 * 60 * 60;
    const { data, error } = await supabase.from('scheduled_commands').insert({
      guild_id: msg.guild.id,
      user_id: msg.author.id,
      command: commandArr.join(' '),
      run_at: new Date(Date.now() + ms).toISOString()
    }).select();
    if (error) return msg.reply('Failed to schedule command.');
    const id = data[0]?.id;
    setTimeout(async () => {
      // Actually execute the command as if the user sent it
      try {
        // Simulate a message object
        const fakeMsg = Object.create(msg);
        fakeMsg.content = msg.content.startsWith(';') || msg.content.startsWith('&')
          ? msg.content[0] + commandArr.join(' ')
          : ';' + commandArr.join(' ');
        fakeMsg.author = msg.author;
        fakeMsg.member = msg.member;
        fakeMsg.guild = msg.guild;
        fakeMsg.channel = msg.channel;
        // Get the command name
        const commandName = commandArr[0].replace(/^;/, '').replace(/^&/, '').toLowerCase();
        // Use the cogManager instance from the client
        const handler = msg.client.cogManager.getPrefixCommand(commandName);
        if (handler) {
          await handler(fakeMsg, commandArr.slice(1));
        } else {
          msg.channel.send(`Scheduled command: ${commandArr.join(' ')} (no such command)`);
        }
      } catch (e) {
        msg.channel.send(`Scheduled command failed: ${commandArr.join(' ')}\nError: ${e.message}`);
      }
      await supabase.from('scheduled_commands').update({ executed: true }).eq('id', id);
    }, ms);
    return msg.reply(`Scheduled command \`${commandArr.join(' ')}\` to run in ${time}. (ID: ${id})`);
  },

  top: async (msg, args) => {
    const type = args[0] || 'messages';
    let field = 'message_count';
    let title = 'Top Users by Message Count';
    if (type === 'infractions') { field = 'infractions'; title = 'Top Users by Infractions'; }
    if (type === 'uptime') { field = 'uptime_seconds'; title = 'Top Users by Uptime'; }
    const { data, error } = await supabase
      .from('user_stats')
      .select('user_id, ' + field)
      .eq('guild_id', msg.guild.id)
      .order(field, { ascending: false })
      .limit(5);
    if (error) return msg.reply('Failed to fetch stats.');
    if (!data || data.length === 0) return msg.reply('No stats found.');
    const lines = data.map((u, i) => `${i+1}. <@${u.user_id}> (${u[field]}${type === 'uptime' ? 's' : ''})`).join('\n');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle(title).setDescription(lines).setColor(0x2ecc71)] });
  },

  trace: async (msg, args) => {
    const user = msg.mentions.users.first();
    if (!user) return msg.reply('Please mention a user to trace.');
    // Fun visual output
    return msg.reply(`Tracing <@${user.id}>...\n🌐 [█████-----]\nIP: 127.0.0.1\nLocation: Unknown\nStatus: 🟢 Online\n(This is a fun simulation!)`);
  },

  man: async (msg, args) => {
    const commandName = args[0];
    if (!commandName) {
      return msg.reply('Please specify a command. Usage: `&man <command>`');
    }

    const description = commandDescriptions[commandName.toLowerCase()];
    if (!description) {
      return msg.reply(`NAME\n  ${commandName} - No manual entry for this command.`);
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`MAN PAGE: ${commandName.toUpperCase()}`)
      .addFields(
        { name: 'NAME', value: `${commandName} - ${description.split(' Usage:')[0]}` },
      )
      .setColor(0x2ecc71)
      .setFooter({ text: 'End of manual page.' });
    
    const usageMatch = description.match(/Usage: `(.+?)`/);
    if (usageMatch && usageMatch[1]) {
      embed.addFields({ name: 'SYNOPSIS', value: `\`${usageMatch[1]}\`` });
    }
    
    const noteMatch = description.match(/\((.+?)\)/);
    if (noteMatch && noteMatch[1]) {
      embed.addFields({ name: 'DESCRIPTION', value: noteMatch[1] });
    }

    return msg.reply({ embeds: [embed] });
  },

  sysinfo: async (msg, args) => {
    const cpu = os.loadavg()[0].toFixed(2);
    const mem = `${(os.totalmem() - os.freemem()) / 1024 / 1024 | 0}MB/${os.totalmem() / 1024 / 1024 | 0}MB`;
    const guilds = msg.client.guilds.cache.size;
    const users = msg.client.users.cache.size;
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('System Info').addFields(
      { name: 'CPU Load', value: cpu, inline: true },
      { name: 'RAM', value: mem, inline: true },
      { name: 'Guilds', value: guilds.toString(), inline: true },
      { name: 'Users', value: users.toString(), inline: true },
      { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
      { name: 'Node.js', value: process.version, inline: true },
      { name: 'OS', value: `${os.type()} ${os.release()}`, inline: true }
    ).setColor(0x7289da)] });
  },

  passwd: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    if (args[0] === 'list') {
      const { data, error } = await supabase.from('user_codewords').select('*').eq('guild_id', msg.guild.id);
      if (error) return msg.reply('Failed to fetch codewords.');
      if (!data || data.length === 0) return msg.reply('No codewords set.');
      const lines = data.map(c => `<@${c.user_id}>: ${c.codeword}`).join('\n');
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Codewords').setDescription(lines).setColor(0x7289da)] });
    }
    if (args[0] === 'remove' && args[1]) {
      const user = msg.mentions.users.first();
      if (!user) return msg.reply('Usage: &passwd remove @user');
      await supabase.from('user_codewords').delete().eq('guild_id', msg.guild.id).eq('user_id', user.id);
      return msg.reply(`Removed codeword for <@${user.id}>.`);
    }
    const user = msg.mentions.users.first();
    if (user && args.length === 1) {
      // Get codeword
      const { data, error } = await supabase.from('user_codewords').select('codeword').eq('guild_id', msg.guild.id).eq('user_id', user.id).single();
      if (error || !data) return msg.reply('No codeword set for this user.');
      return msg.reply(`Codeword for <@${user.id}>: ${data.codeword}`);
    }
    const codeword = args.slice(1).join(' ');
    if (!user || !codeword) return msg.reply('Usage: &passwd @user <codeword> | &passwd @user | &passwd list | &passwd remove @user');
    await supabase.from('user_codewords').upsert({
      guild_id: msg.guild.id,
      user_id: user.id,
      codeword,
      set_by: msg.author.id
    }, { onConflict: ['guild_id', 'user_id'] });
    return msg.reply(`Set a secret codeword for <@${user.id}>.`);
  },

  jump: async (msg, args) => {
    const messageId = args[0];
    if (!messageId || !/^[0-9]{17,20}$/.test(messageId)) {
      return msg.reply('Please provide a valid message ID.');
    }
    try {
      // Try to find the message in the current channel first
      let message = null;
      try {
        message = await msg.channel.messages.fetch(messageId);
      } catch {}
      // If not found, search all text channels in the guild
      if (!message) {
        for (const channel of msg.guild.channels.cache.values()) {
          if (channel.isTextBased && channel.isTextBased()) {
            try {
              message = await channel.messages.fetch(messageId);
              if (message) break;
            } catch {}
          }
        }
      }
      if (!message) return msg.reply('Message not found in this server or I lack access.');
      const link = `https://discord.com/channels/${msg.guild.id}/${message.channel.id}/${message.id}`;
      return msg.reply({ content: `Jump to message: <${link}>` });
    } catch (e) {
      return msg.reply('Failed to fetch message.');
    }
  },

  archive: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const channel = msg.mentions.channels.first() || msg.channel;
    let days = parseInt(args[1]);
    if (isNaN(days) || days < 1) days = null;
    try {
      let after = null;
      if (days) {
        after = Date.now() - days * 24 * 60 * 60 * 1000;
      }
      let messages = [];
      let lastId = null;
      let fetched;
      do {
        fetched = await channel.messages.fetch({ limit: 100, before: lastId });
        const filtered = after ? fetched.filter(m => m.createdTimestamp >= after) : fetched;
        messages.push(...filtered.values());
        lastId = fetched.size > 0 ? fetched.last().id : null;
      } while (fetched.size === 100 && messages.length < 1000); // Discord API limit
      if (messages.length === 0) return msg.reply('No messages found to archive.');
      // Format messages
      const log = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent}`).join(os.EOL);
      const filename = `archive_${channel.id}_${Date.now()}.txt`;
      fs.writeFileSync(filename, log);
      // Zip the file
      const zipname = filename.replace('.txt', '.zip');
      const output = fs.createWriteStream(zipname);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);
      archive.file(filename, { name: path.basename(filename) });
      await archive.finalize();
      // DM the user
      await msg.author.send({ files: [zipname] });
      // Log in DB
      await supabase.from('message_archives').insert({
        guild_id: msg.guild.id,
        channel_id: channel.id,
        requested_by: msg.author.id,
        file_url: null // Not using external storage
      });
      // Cleanup
      fs.unlinkSync(filename);
      fs.unlinkSync(zipname);
      return msg.reply('Archive sent to your DMs!');
    } catch (e) {
      return msg.reply('Failed to archive messages.');
    }
  },

  mirror: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const source = msg.mentions.channels.first();
    const target = msg.mentions.channels.last();
    if (!source || !target || source.id === target.id) return msg.reply('Usage: &mirror #source #target');
    try {
      await supabase.from('channel_mirrors').upsert({
        guild_id: msg.guild.id,
        source_channel_id: source.id,
        target_channel_id: target.id,
        enabled: true
      });
      return msg.reply(`Mirroring enabled: ${source} → ${target}`);
    } catch (e) {
      return msg.reply('Failed to set up mirror.');
    }
  },

  cooldown: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const command = args[0]?.toLowerCase();
    const seconds = args[1] ? parseInt(args[1]) : null;
    if (!command) return msg.reply('Usage: &cooldown <command> <seconds>');
    if (seconds !== null && (isNaN(seconds) || seconds < 0)) return msg.reply('Cooldown must be a non-negative number.');
    try {
      if (seconds === null) {
        // View cooldown
        const { data } = await supabase.from('command_cooldowns').select('cooldown_seconds').eq('guild_id', msg.guild.id).eq('command', command).single();
        if (!data) return msg.reply('No cooldown set for this command.');
        return msg.reply(`Cooldown for \`${command}\` is ${data.cooldown_seconds} seconds.`);
      } else {
        // Set cooldown
        await supabase.from('command_cooldowns').upsert({
          guild_id: msg.guild.id,
          command,
          cooldown_seconds: seconds
        });
        return msg.reply(`Cooldown for \`${command}\` set to ${seconds} seconds.`);
      }
    } catch (e) {
      return msg.reply('Failed to set/view cooldown.');
    }
  },

  watchword: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const sub = args[0]?.toLowerCase();
    if (!sub || !['add','remove','list'].includes(sub)) {
      return msg.reply('Usage: &watchword add <word> <actions...> | remove <word> | list');
    }
    if (sub === 'add') {
      const word = args[1];
      const actions = args.slice(2).map(a => a.toLowerCase());
      if (!word || actions.length === 0) return msg.reply('Usage: &watchword add <word> <actions...>');
      const valid = ['delete','warn','log'];
      if (!actions.every(a => valid.includes(a))) return msg.reply('Actions: delete, warn, log');
      await addWatchword(msg.guild.id, word, actions, msg.author.id);
      return msg.reply(`Watchword "${word}" added with actions: ${actions.join(', ')}`);
    } else if (sub === 'remove') {
      const word = args[1];
      if (!word) return msg.reply('Usage: &watchword remove <word>');
      await removeWatchword(msg.guild.id, word);
      return msg.reply(`Watchword "${word}" removed.`);
    } else if (sub === 'list') {
      const list = await getWatchwords(msg.guild.id);
      if (!list.length) return msg.reply('No watchwords set.');
      const desc = list.map(w => `• **${w.word}** — ${w.actions.join(', ')}`).join('\n');
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Watchwords').setDescription(desc).setColor(0xe67e22)] });
    }
  },

  cloak: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const user = msg.mentions.users.first();
    const nickname = args.slice(1).join(' ');
    if (!user || !nickname) return msg.reply('Usage: &cloak @user <nickname>');
    const ok = await cloakUser(msg.guild, user.id, nickname);
    if (ok) return msg.reply(`User <@${user.id}> is now cloaked as "${nickname}".`);
    return msg.reply('Failed to cloak user.');
  },

  blacklistword: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const sub = args[0]?.toLowerCase();
    if (!sub || !['add','remove','list'].includes(sub)) {
      return msg.reply('Usage: &blacklistword add <word> | remove <word> | list');
    }
    if (sub === 'add') {
      const word = args[1];
      if (!word) return msg.reply('Usage: &blacklistword add <word>');
      await addBlacklistedWord(msg.guild.id, word, msg.author.id);
      return msg.reply(`Blacklisted word "${word}" added.`);
    } else if (sub === 'remove') {
      const word = args[1];
      if (!word) return msg.reply('Usage: &blacklistword remove <word>');
      await removeBlacklistedWord(msg.guild.id, word);
      return msg.reply(`Blacklisted word "${word}" removed.`);
    } else if (sub === 'list') {
      const list = await getBlacklistedWords(msg.guild.id);
      if (!list.length) return msg.reply('No blacklisted words set.');
      const desc = list.map(w => `• **${w.word}**`).join('\n');
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Blacklisted Words').setDescription(desc).setColor(0xc0392b)] });
    }
  },

  curse: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const user = msg.mentions.users.first();
    const suffix = args.slice(1).join(' ') || '😈';
    if (!user) return msg.reply('Usage: &curse @user [suffix]');
    await addCursedUser(msg.guild.id, user.id, suffix, msg.author.id);
    return msg.reply(`User <@${user.id}> is now cursed. All their messages will end with "${suffix}".`);
  },

  npcgen: async (msg, args) => {
    const npc = generateNPC();
    const desc = `**Name:** ${npc.name}\n**Race:** ${npc.race}\n**Class:** ${npc.class}\n**Trait:** ${npc.trait}`;
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Random NPC').setDescription(desc).setColor(0x8e44ad)] });
  },

  worldstate: async (msg, args) => {
    if (!args.length) {
      const state = await getWorldState(msg.guild.id);
      if (!state) return msg.reply('No world state set.');
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('World State').setDescription(state).setColor(0x16a085)] });
    }
    if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
    const state = args.join(' ');
    await setWorldState(msg.guild.id, state);
    return msg.reply('World state updated.');
  },

  whois: async (msg, args) => {
    let member;
    if (msg.mentions.members.size > 0) {
      member = msg.mentions.members.first();
    } else if (args[0]) {
      // Try to fetch by ID
      try {
        member = await msg.guild.members.fetch(args[0]);
      } catch {
        return msg.reply('User not found. Please mention a user or provide a valid user ID.');
      }
    } else {
      member = msg.member;
    }
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('User Info').addFields(
      { name: 'Username', value: member.user.username, inline: true },
      { name: 'ID', value: member.id, inline: true },
      { name: 'Joined', value: member.joinedAt.toDateString(), inline: true },
      { name: 'Roles', value: member.roles.cache.map(r => r.name).join(', ') || 'None' }
    ).setColor(0x9b59b6)] });
  },
};

// Slash commands
const PAGE_SIZE = 8;

function getAllCommandsByCategory() {
  return [
    { category: '🛡️ Moderation', commands: ['ban', 'kick', 'warn', 'warnings', 'clearwarn', 'purge', 'nuke', 'blacklist', 'unblacklist', 'mute', 'unmute', 'timeout', 'spy', 'sniper', 'revert', 'shadowban', 'massban', 'lock', 'unlock', 'modview', 'crontab', 'report', 'modmail', 'panic', 'feedback', 'case'] },
    { category: '🛠️ Utility', commands: ['ls', 'ps', 'whoami', 'whois', 'ping', 'uptime', 'server', 'roles', 'avatar', 'poll', 'say', 'reset', 'man', 'top', 'sysinfo', 'passwd'] },
    { category: '🔧 Setup & Configuration', commands: ['setup', 'showsetup', 'config', 'logchannel', 'autorole', 'prefix', 'reset-config', 'disable-commands', 'co-owners', 'add-co-owner', 'remove-co-owner'] },
    { category: '🎫 Tickets', commands: ['ticketsetup', 'ticket', 'close', 'claim'] },
    { category: '👋 Welcome & Goodbye', commands: ['welcomesetup', 'goodbyesetup'] }
  ];
}

function getTotalCommandCount() {
  const categories = getAllCommandsByCategory();
  let total = 0;
  for (const cat of categories) {
    total += cat.commands.length;
  }
  return total;
}

function getPaginatedCommands(page = 0) {
  const categories = getAllCommandsByCategory();
  const allCmds = [];
  for (const cat of categories) {
    for (const cmd of cat.commands) {
      if (commandDescriptions[cmd]) {
        allCmds.push({
          name: cmd,
          desc: commandDescriptions[cmd],
          category: cat.category
        });
      }
    }
  }
  // Sort alphabetically by command name
  allCmds.sort((a, b) => a.name.localeCompare(b.name));
  const totalPages = Math.ceil(allCmds.length / PAGE_SIZE);
  const cmdsOnPage = allCmds.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  return { cmdsOnPage, totalPages, allCmds };
}

const slashCommands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency'),
  
  new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Show bot uptime'),
  
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Show server info'),
  
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Show a user avatar')
    .addUserOption(opt => opt.setName('user').setDescription('User to show avatar for').setRequired(false)),

  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with reactions')
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true)),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all bot commands with descriptions and usage (paginated)')
];

// Slash command handlers
const slashHandlers = {
  ping: async (interaction) => {
    const embed = new EmbedBuilder()
      .setTitle('Pong!')
      .setDescription(`Latency: ${interaction.client.ws.ping}ms`)
      .setColor(0x2ecc71)
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed] });
  },
  
  uptime: async (interaction) => {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    const embed = new EmbedBuilder()
      .setTitle('Bot Uptime')
      .setDescription(`${days}d ${hours}h ${minutes}m ${seconds}s`)
      .setColor(0x3498db)
      .setTimestamp();
    
    return interaction.reply({ embeds: [embed] });
  },
  
  server: async (interaction) => {
    const guild = interaction.guild;
    const embed = new EmbedBuilder()
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL())
      .addFields(
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members', value: guild.memberCount.toString(), inline: true },
        { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
        { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
        { name: 'Created', value: guild.createdAt.toDateString(), inline: true },
        { name: 'Boost Level', value: guild.premiumTier.toString(), inline: true }
      )
      .setColor(0x9b59b6);
    
    return interaction.reply({ embeds: [embed] });
  },
  
  avatar: async (interaction) => {
    const user = interaction.options.getUser('user') || interaction.user;
    const embed = new EmbedBuilder()
      .setTitle(`${user.tag}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setColor(0x3498db);
    
    return interaction.reply({ embeds: [embed] });
  },

  poll: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const question = interaction.options.getString('question');
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Poll')
      .setDescription(question)
      .setColor(0x9b59b6)
      .setFooter({ text: `Poll by ${interaction.user.tag}` })
      .setTimestamp();
    
    const pollMsg = await interaction.reply({ embeds: [embed], fetchReply: true });
    
    // Add reaction options
    const reactions = ['👍', '👎', '🤷'];
    for (const reaction of reactions) {
      await pollMsg.react(reaction);
    }
  },

  help: async (interaction) => {
    let page = 0;
    const { cmdsOnPage, totalPages } = getPaginatedCommands(page);
    const totalCommands = getTotalCommandCount();
    
    const embed = new EmbedBuilder()
      .setTitle(`🤖 Bot Commands (${totalCommands} total)`)
      .setDescription(cmdsOnPage.map(cmd => `• **${cmd.name}** — ${cmd.desc}`).join('\n'))
      .setFooter({ text: `Page ${page + 1} of ${totalPages} • ${totalCommands} commands available` })
      .setColor(0x7289da);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('help_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('help_next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(totalPages <= 1)
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  },

  jump: async (interaction) => {
    const messageId = interaction.options.getString('message_id');
    if (!messageId || !/^[0-9]{17,20}$/.test(messageId)) {
      return interaction.reply({ content: 'Please provide a valid message ID.', ephemeral: true });
    }
    try {
      // Try to find the message in the current channel first
      let message = null;
      try {
        message = await interaction.channel.messages.fetch(messageId);
      } catch {}
      // If not found, search all text channels in the guild
      if (!message) {
        for (const channel of interaction.guild.channels.cache.values()) {
          if (channel.isTextBased && channel.isTextBased()) {
            try {
              message = await channel.messages.fetch(messageId);
              if (message) break;
            } catch {}
          }
        }
      }
      if (!message) return interaction.reply({ content: 'Message not found in this server or I lack access.', ephemeral: true });
      const link = `https://discord.com/channels/${interaction.guild.id}/${message.channel.id}/${message.id}`;
      return interaction.reply({ content: `Jump to message: <${link}>`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: 'Failed to fetch message.', ephemeral: true });
    }
  },

  archive: async (interaction) => {
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    let days = interaction.options.getInteger('days');
    if (isNaN(days) || days < 1) days = null;
    try {
      let after = null;
      if (days) {
        after = Date.now() - days * 24 * 60 * 60 * 1000;
      }
      let messages = [];
      let lastId = null;
      let fetched;
      do {
        fetched = await channel.messages.fetch({ limit: 100, before: lastId });
        const filtered = after ? fetched.filter(m => m.createdTimestamp >= after) : fetched;
        messages.push(...filtered.values());
        lastId = fetched.size > 0 ? fetched.last().id : null;
      } while (fetched.size === 100 && messages.length < 1000);
      if (messages.length === 0) return interaction.reply({ content: 'No messages found to archive.', ephemeral: true });
      // Format messages
      const log = messages.reverse().map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.cleanContent}`).join(os.EOL);
      const filename = `archive_${channel.id}_${Date.now()}.txt`;
      fs.writeFileSync(filename, log);
      // Zip the file
      const zipname = filename.replace('.txt', '.zip');
      const output = fs.createWriteStream(zipname);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);
      archive.file(filename, { name: path.basename(filename) });
      await archive.finalize();
      // DM the user
      await interaction.user.send({ files: [zipname] });
      // Log in DB
      await supabase.from('message_archives').insert({
        guild_id: interaction.guild.id,
        channel_id: channel.id,
        requested_by: interaction.user.id,
        file_url: null
      });
      // Cleanup
      fs.unlinkSync(filename);
      fs.unlinkSync(zipname);
      return interaction.reply({ content: 'Archive sent to your DMs!', ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: 'Failed to archive messages.', ephemeral: true });
    }
  },

  mirror: async (interaction) => {
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    const source = interaction.options.getChannel('source');
    const target = interaction.options.getChannel('target');
    if (!source || !target || source.id === target.id) return interaction.reply({ content: 'Usage: /mirror #source #target', ephemeral: true });
    try {
      await supabase.from('channel_mirrors').upsert({
        guild_id: interaction.guild.id,
        source_channel_id: source.id,
        target_channel_id: target.id,
        enabled: true
      });
      return interaction.reply({ content: `Mirroring enabled: ${source} → ${target}`, ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: 'Failed to set up mirror.', ephemeral: true });
    }
  },

  cooldown: async (interaction) => {
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    const command = interaction.options.getString('command')?.toLowerCase();
    const seconds = interaction.options.getInteger('seconds');
    if (!command) return interaction.reply({ content: 'Usage: /cooldown <command> <seconds>', ephemeral: true });
    if (seconds !== null && seconds !== undefined && (isNaN(seconds) || seconds < 0)) return interaction.reply({ content: 'Cooldown must be a non-negative number.', ephemeral: true });
    try {
      if (seconds === null || seconds === undefined) {
        // View cooldown
        const { data } = await supabase.from('command_cooldowns').select('cooldown_seconds').eq('guild_id', interaction.guild.id).eq('command', command).single();
        if (!data) return interaction.reply({ content: 'No cooldown set for this command.', ephemeral: true });
        return interaction.reply({ content: `Cooldown for \`${command}\` is ${data.cooldown_seconds} seconds.`, ephemeral: true });
      } else {
        // Set cooldown
        await supabase.from('command_cooldowns').upsert({
          guild_id: interaction.guild.id,
          command,
          cooldown_seconds: seconds
        });
        return interaction.reply({ content: `Cooldown for \`${command}\` set to ${seconds} seconds.`, ephemeral: true });
      }
    } catch (e) {
      return interaction.reply({ content: 'Failed to set/view cooldown.', ephemeral: true });
    }
  },

  watchword: async (interaction) => {
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const word = interaction.options.getString('word');
      const actions = interaction.options.getString('actions').split(',').map(a => a.trim().toLowerCase());
      const valid = ['delete','warn','log'];
      if (!actions.every(a => valid.includes(a))) return interaction.reply({ content: 'Actions: delete, warn, log', ephemeral: true });
      await addWatchword(interaction.guild.id, word, actions, interaction.user.id);
      return interaction.reply({ content: `Watchword "${word}" added with actions: ${actions.join(', ')}`, ephemeral: true });
    } else if (sub === 'remove') {
      const word = interaction.options.getString('word');
      await removeWatchword(interaction.guild.id, word);
      return interaction.reply({ content: `Watchword "${word}" removed.`, ephemeral: true });
    } else if (sub === 'list') {
      const list = await getWatchwords(interaction.guild.id);
      if (!list.length) return interaction.reply({ content: 'No watchwords set.', ephemeral: true });
      const desc = list.map(w => `• **${w.word}** — ${w.actions.join(', ')}`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Watchwords').setDescription(desc).setColor(0xe67e22)], ephemeral: true });
    }
  },

  cloak: async (interaction) => {
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    const user = interaction.options.getUser('user');
    const nickname = interaction.options.getString('nickname');
    const ok = await cloakUser(interaction.guild, user.id, nickname);
    if (ok) return interaction.reply({ content: `User <@${user.id}> is now cloaked as "${nickname}".`, ephemeral: true });
    return interaction.reply({ content: 'Failed to cloak user.', ephemeral: true });
  },

  blacklistword: async (interaction) => {
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const word = interaction.options.getString('word');
      await addBlacklistedWord(interaction.guild.id, word, interaction.user.id);
      return interaction.reply({ content: `Blacklisted word "${word}" added.`, ephemeral: true });
    } else if (sub === 'remove') {
      const word = interaction.options.getString('word');
      await removeBlacklistedWord(interaction.guild.id, word);
      return interaction.reply({ content: `Blacklisted word "${word}" removed.`, ephemeral: true });
    } else if (sub === 'list') {
      const list = await getBlacklistedWords(interaction.guild.id);
      if (!list.length) return interaction.reply({ content: 'No blacklisted words set.', ephemeral: true });
      const desc = list.map(w => `• **${w.word}**`).join('\n');
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Blacklisted Words').setDescription(desc).setColor(0xc0392b)], ephemeral: true });
    }
  },

  curse: async (interaction) => {
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    const user = interaction.options.getUser('user');
    const suffix = interaction.options.getString('suffix') || '😈';
    await addCursedUser(interaction.guild.id, user.id, suffix, interaction.user.id);
    return interaction.reply({ content: `User <@${user.id}> is now cursed. All their messages will end with "${suffix}".`, ephemeral: true });
  },

  npcgen: async (interaction) => {
    const npc = generateNPC();
    const desc = `**Name:** ${npc.name}\n**Race:** ${npc.race}\n**Class:** ${npc.class}\n**Trait:** ${npc.trait}`;
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Random NPC').setDescription(desc).setColor(0x8e44ad)], ephemeral: true });
  },

  worldstate: async (interaction) => {
    const state = interaction.options.getString('state');
    if (!state) {
      const current = await getWorldState(interaction.guild.id);
      if (!current) return interaction.reply({ content: 'No world state set.', ephemeral: true });
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('World State').setDescription(current).setColor(0x16a085)], ephemeral: true });
    }
    if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
    await setWorldState(interaction.guild.id, state);
    return interaction.reply({ content: 'World state updated.', ephemeral: true });
  },

  whois: async (interaction) => {
    let member;
    if (interaction.options.getMember('user')) {
      member = interaction.options.getMember('user');
    } else if (interaction.options.getString('user_id')) {
      // Try to fetch by ID
      try {
        member = await interaction.guild.members.fetch(interaction.options.getString('user_id'));
      } catch {
        return interaction.reply({ content: 'User not found. Please mention a user or provide a valid user ID.', ephemeral: true });
      }
    } else {
      member = interaction.member;
    }
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('User Info').addFields(
      { name: 'Username', value: member.user.username, inline: true },
      { name: 'ID', value: member.id, inline: true },
      { name: 'Joined', value: member.joinedAt.toDateString(), inline: true },
      { name: 'Roles', value: member.roles.cache.map(r => r.name).join(', ') || 'None' }
    ).setColor(0x9b59b6)] });
  },
};

// Add button handler for pagination
const buttonHandlers = {
  help_prev: async (interaction) => {
    let page = parseInt(interaction.message.embeds[0].footer.text.match(/Page (\d+)/)[1], 10) - 2;
    if (page < 0) page = 0;
    const { cmdsOnPage, totalPages } = getPaginatedCommands(page);
    const totalCommands = getTotalCommandCount();
    
    const embed = new EmbedBuilder()
      .setTitle(`🤖 Bot Commands (${totalCommands} total)`)
      .setDescription(cmdsOnPage.map(cmd => `• **${cmd.name}** — ${cmd.desc}`).join('\n'))
      .setFooter({ text: `Page ${page + 1} of ${totalPages} • ${totalCommands} commands available` })
      .setColor(0x7289da);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('help_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId('help_next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page + 1 >= totalPages)
    );
    await interaction.update({ embeds: [embed], components: [row] });
  },
  help_next: async (interaction) => {
    let page = parseInt(interaction.message.embeds[0].footer.text.match(/Page (\d+)/)[1], 10);
    const { cmdsOnPage, totalPages } = getPaginatedCommands(page);
    const totalCommands = getTotalCommandCount();
    
    const embed = new EmbedBuilder()
      .setTitle(`🤖 Bot Commands (${totalCommands} total)`)
      .setDescription(cmdsOnPage.map(cmd => `• **${cmd.name}** — ${cmd.desc}`).join('\n'))
      .setFooter({ text: `Page ${page + 1} of ${totalPages} • ${totalCommands} commands available` })
      .setColor(0x7289da);
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('help_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId('help_next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page + 1 >= totalPages)
    );
    await interaction.update({ embeds: [embed], components: [row] });
  },
};

// --- WATCHWORD SYSTEM ---

// Helper: fetch all watchwords for a guild
async function getWatchwords(guildId) {
  const { data, error } = await supabase.from('watchwords').select('*').eq('guild_id', guildId);
  if (error) return [];
  return data || [];
}

// Helper: add a watchword
async function addWatchword(guildId, word, actions, addedBy) {
  return await supabase.from('watchwords').upsert({
    guild_id: guildId,
    word: word.toLowerCase(),
    actions,
    added_by: addedBy
  });
}

// Helper: remove a watchword
async function removeWatchword(guildId, word) {
  return await supabase.from('watchwords').delete().eq('guild_id', guildId).eq('word', word.toLowerCase());
}

// Message monitoring for watchwords
async function monitorWatchwords(msg) {
  if (!msg.guild || msg.author.bot) return;
  const watchwords = await getWatchwords(msg.guild.id);
  if (!watchwords.length) return;
  const content = msg.content.toLowerCase();
  for (const w of watchwords) {
    if (content.includes(w.word)) {
      // Perform actions
      if (w.actions.includes('delete')) {
        await msg.delete().catch(() => {});
      }
      if (w.actions.includes('warn')) {
        await msg.reply({ content: `Watchword triggered: "${w.word}". Please avoid using this word.`, allowedMentions: { repliedUser: false } }).catch(() => {});
      }
      if (w.actions.includes('log')) {
        // Log to modlog channel if set
        const { data: config } = await supabase.from('guild_configs').select('log_channel').eq('guild_id', msg.guild.id).single();
        if (config && config.log_channel) {
          const channel = msg.guild.channels.cache.get(config.log_channel);
          if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [new EmbedBuilder()
              .setTitle('Watchword Triggered')
              .setDescription(`User: <@${msg.author.id}>\nWord: **${w.word}**\nMessage: ${msg.content}`)
              .setColor(0xe67e22)
              .setTimestamp()
            ] });
          }
        }
      }
      break; // Only trigger on first match per message
    }
  }
}

// --- BLACKLISTWORD SYSTEM ---

// Helper: fetch all blacklisted words for a guild
async function getBlacklistedWords(guildId) {
  const { data, error } = await supabase.from('blacklisted_words').select('*').eq('guild_id', guildId);
  if (error) return [];
  return data || [];
}

// Helper: add a blacklisted word
async function addBlacklistedWord(guildId, word, addedBy) {
  return await supabase.from('blacklisted_words').upsert({
    guild_id: guildId,
    word: word.toLowerCase(),
    added_by: addedBy
  });
}

// Helper: remove a blacklisted word
async function removeBlacklistedWord(guildId, word) {
  return await supabase.from('blacklisted_words').delete().eq('guild_id', guildId).eq('word', word.toLowerCase());
}

// Prefix command: &blacklistword add/remove/list <word>
prefixCommands.blacklistword = async (msg, args) => {
  if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
  const sub = args[0]?.toLowerCase();
  if (!sub || !['add','remove','list'].includes(sub)) {
    return msg.reply('Usage: &blacklistword add <word> | remove <word> | list');
  }
  if (sub === 'add') {
    const word = args[1];
    if (!word) return msg.reply('Usage: &blacklistword add <word>');
    await addBlacklistedWord(msg.guild.id, word, msg.author.id);
    return msg.reply(`Blacklisted word "${word}" added.`);
  } else if (sub === 'remove') {
    const word = args[1];
    if (!word) return msg.reply('Usage: &blacklistword remove <word>');
    await removeBlacklistedWord(msg.guild.id, word);
    return msg.reply(`Blacklisted word "${word}" removed.`);
  } else if (sub === 'list') {
    const list = await getBlacklistedWords(msg.guild.id);
    if (!list.length) return msg.reply('No blacklisted words set.');
    const desc = list.map(w => `• **${w.word}**`).join('\n');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Blacklisted Words').setDescription(desc).setColor(0xc0392b)] });
  }
};

// Add slash command definition
slashCommands.push(
  new SlashCommandBuilder()
    .setName('blacklistword')
    .setDescription('Manage blacklisted words (admin only)')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a blacklisted word')
        .addStringOption(opt => opt.setName('word').setDescription('Word to blacklist').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a blacklisted word')
        .addStringOption(opt => opt.setName('word').setDescription('Word to remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all blacklisted words'))
);

// Slash handler
slashHandlers.blacklistword = async (interaction) => {
  if (!await isAdmin(interaction.member)) return interaction.reply({ content: 'Admin only.', ephemeral: true });
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') {
    const word = interaction.options.getString('word');
    await addBlacklistedWord(interaction.guild.id, word, interaction.user.id);
    return interaction.reply({ content: `Blacklisted word "${word}" added.`, ephemeral: true });
  } else if (sub === 'remove') {
    const word = interaction.options.getString('word');
    await removeBlacklistedWord(interaction.guild.id, word);
    return interaction.reply({ content: `Blacklisted word "${word}" removed.`, ephemeral: true });
  } else if (sub === 'list') {
    const list = await getBlacklistedWords(interaction.guild.id);
    if (!list.length) return interaction.reply({ content: 'No blacklisted words set.', ephemeral: true });
    const desc = list.map(w => `• **${w.word}**`).join('\n');
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Blacklisted Words').setDescription(desc).setColor(0xc0392b)], ephemeral: true });
  }
};

// Message monitoring for blacklisted words
async function monitorBlacklistedWords(msg) {
  if (!msg.guild || msg.author.bot) return;
  const blacklisted = await getBlacklistedWords(msg.guild.id);
  if (!blacklisted.length) return;
  const content = msg.content.toLowerCase();
  for (const w of blacklisted) {
    if (content.includes(w.word)) {
      await msg.delete().catch(() => {});
      // Log to modlog channel if set
      const { data: config } = await supabase.from('guild_configs').select('log_channel').eq('guild_id', msg.guild.id).single();
      if (config && config.log_channel) {
        const channel = msg.guild.channels.cache.get(config.log_channel);
        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [new EmbedBuilder()
            .setTitle('Blacklisted Word Triggered')
            .setDescription(`User: <@${msg.author.id}>\nWord: **${w.word}**\nMessage: ${msg.content}`)
            .setColor(0xc0392b)
            .setTimestamp()
          ] });
        }
      }
      break; // Only trigger on first match per message
    }
  }
}

module.exports.monitorBlacklistedWords = monitorBlacklistedWords;

// --- CLOAK SYSTEM ---
async function cloakUser(guild, userId, nickname) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  // Store original nickname in memory (for demo; production should use DB)
  global.cloakedUsers = global.cloakedUsers || {};
  global.cloakedUsers[guild.id] = global.cloakedUsers[guild.id] || {};
  if (!global.cloakedUsers[guild.id][userId]) {
    global.cloakedUsers[guild.id][userId] = { nickname: member.nickname };
  }
  await member.setNickname(nickname).catch(() => {});
  return true;
}
async function uncloakUser(guild, userId) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return false;
  if (global.cloakedUsers && global.cloakedUsers[guild.id] && global.cloakedUsers[guild.id][userId]) {
    await member.setNickname(global.cloakedUsers[guild.id][userId].nickname || null).catch(() => {});
    delete global.cloakedUsers[guild.id][userId];
    return true;
  }
  return false;
}

prefixCommands.cloak = async (msg, args) => {
  if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
  const user = msg.mentions.users.first();
  const nickname = args.slice(1).join(' ');
  if (!user || !nickname) return msg.reply('Usage: &cloak @user <nickname>');
  const ok = await cloakUser(msg.guild, user.id, nickname);
  if (ok) return msg.reply(`User <@${user.id}> is now cloaked as "${nickname}".`);
  return msg.reply('Failed to cloak user.');
};

// --- CURSE SYSTEM ---
// DB helpers for curse
async function getCursedUsers(guildId) {
  const { data, error } = await supabase.from('cursed_users').select('*').eq('guild_id', guildId);
  if (error) return [];
  return data || [];
}
async function addCursedUser(guildId, userId, suffix, addedBy) {
  return await supabase.from('cursed_users').upsert({
    guild_id: guildId,
    user_id: userId,
    suffix,
    added_by: addedBy
  });
}
async function removeCursedUser(guildId, userId) {
  return await supabase.from('cursed_users').delete().eq('guild_id', guildId).eq('user_id', userId);
}

prefixCommands.curse = async (msg, args) => {
  if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
  const user = msg.mentions.users.first();
  const suffix = args.slice(1).join(' ') || '😈';
  if (!user) return msg.reply('Usage: &curse @user [suffix]');
  await addCursedUser(msg.guild.id, user.id, suffix, msg.author.id);
  return msg.reply(`User <@${user.id}> is now cursed. All their messages will end with "${suffix}".`);
};

// Message monitoring for curse
async function monitorCursedUsers(msg) {
  if (!msg.guild || msg.author.bot) return;
  const cursed = await getCursedUsers(msg.guild.id);
  if (!cursed.length) return;
  const entry = cursed.find(c => c.user_id === msg.author.id);
  if (entry) {
    // Edit the message (delete and resend as bot)
    await msg.delete().catch(() => {});
    await msg.channel.send({ content: msg.content + ' ' + entry.suffix });
  }
}

module.exports.monitorCursedUsers = monitorCursedUsers;

// --- NPCGEN SYSTEM ---
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function generateNPC() {
  const names = ['Arin', 'Borin', 'Ciri', 'Doran', 'Elira', 'Fenn', 'Garen', 'Hilda', 'Ilya', 'Joren'];
  const races = ['Human', 'Elf', 'Dwarf', 'Orc', 'Tiefling', 'Dragonborn', 'Halfling', 'Gnome'];
  const classes = ['Warrior', 'Mage', 'Rogue', 'Cleric', 'Ranger', 'Bard', 'Paladin', 'Monk'];
  const traits = ['Brave', 'Cunning', 'Wise', 'Charismatic', 'Stoic', 'Impulsive', 'Loyal', 'Greedy'];
  return {
    name: randomFrom(names),
    race: randomFrom(races),
    class: randomFrom(classes),
    trait: randomFrom(traits)
  };
}

prefixCommands.npcgen = async (msg, args) => {
  const npc = generateNPC();
  const desc = `**Name:** ${npc.name}\n**Race:** ${npc.race}\n**Class:** ${npc.class}\n**Trait:** ${npc.trait}`;
  return msg.reply({ embeds: [new EmbedBuilder().setTitle('Random NPC').setDescription(desc).setColor(0x8e44ad)] });
};

// --- WORLDSTATE SYSTEM ---
async function getWorldState(guildId) {
  const { data, error } = await supabase.from('worldstate').select('state').eq('guild_id', guildId).single();
  if (error || !data) return null;
  return data.state;
}
async function setWorldState(guildId, state) {
  return await supabase.from('worldstate').upsert({ guild_id: guildId, state });
}

prefixCommands.worldstate = async (msg, args) => {
  if (!args.length) {
    const state = await getWorldState(msg.guild.id);
    if (!state) return msg.reply('No world state set.');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('World State').setDescription(state).setColor(0x16a085)] });
  }
  if (!await isAdmin(msg.member)) return msg.reply('Admin only.');
  const state = args.join(' ');
  await setWorldState(msg.guild.id, state);
  return msg.reply('World state updated.');
};

module.exports = {
  prefixCommands,
  slashCommands,
  slashHandlers,
  buttonHandlers
}; 
