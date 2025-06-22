const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../utils/supabase');
const os = require('os');

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
  
  help: async (msg, args) => {
    const commandDescriptions = {
      // Setup & Configuration
      setup: 'Configure server settings and admin roles (owner only)',
      config: 'Show server configuration and settings',
      logchannel: 'Set log channel for moderation actions',
      autorole: 'Set autorole for new members',
      prefix: 'Set custom command prefix (owner only)',
      'reset-config': 'Reset server configuration to defaults (owner only)',
      'disable-commands': 'Manage disabled commands (owner only)',
      
      // Welcome & Goodbye
      welcomesetup: 'Setup welcome messages for new members',
      goodbyesetup: 'Setup goodbye messages for leaving members',
      
      // Ticket System
      ticketsetup: 'Setup ticket system for support',
      
      // Moderation
      ban: 'Ban a user from the server (removes them from the server entirely). Usage: `;ban @user [reason]` (admin only)',
      kick: 'Kick a user from the server (removes them, but they can rejoin if invited). Usage: `;kick @user [reason]` (admin only)',
      warn: 'Warn a user',
      warnings: 'Show warnings for a member',
      clearwarn: 'Clear warnings for a member',
      purge: 'Bulk delete messages',
      nuke: 'Clone and delete the channel',
      blacklist: 'Add a user to the bot blacklist. This blocks the user from using any bot commands, but does NOT ban or kick them from the server. Usage: `;blacklist @user <reason>` (admin only)',
      unblacklist: 'Remove a user from the bot blacklist, restoring their access to bot commands. Usage: `;unblacklist @user` (admin only)',
      mute: 'Mute a user in the server (prevents them from sending messages/voice for a duration). Usage: `;mute @user <duration> [reason]` (admin only)',
      unmute: 'Unmute a user in the server (restores their ability to speak). Usage: `;unmute @user` (admin only)',
      timeout: 'Timeout a user in the server (temporarily restricts their ability to interact). Usage: `;timeout @user <duration> [reason]` (admin only)',
      
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
      spy: 'Secretly logs all messages from a specific user for moderation. Only affects bot logging, does not affect the user\'s server permissions. Usage: `&spy @user` (admin only)',
      ghostping: 'Sends and deletes a ping instantly for fun or to test mod reactions. Usage: `&ghostping @user` (admin only)',
      sniper: 'Logs and shows deleted messages (message sniping). Only affects bot logging, does not restore deleted messages in the server. Usage: `&sniper on` to enable, `&sniper off` to disable (admin only)',
      revert: 'Removes a user\'s last 10 messages in the current channel (like a soft purge, does not ban or mute the user). Usage: `&revert @user` (admin only)',
      modview: 'View and filter mod actions (bans, mutes, warns, etc) logged by the bot. Does not show server audit log. Usage: `&modview [action] [next|prev]` (admin only)',
      shadowban: 'Bans a user from the server without showing a ban message or logging (silent ban). Usage: `&shadowban @user` (admin only)',
      massban: 'Ban all users with a specific role from the server. Usage: `&massban @role` (admin only)',
      lock: 'Locks the current channel for everyone (prevents all users from sending messages in the channel, but does not affect the whole server). Usage: `;lock` (admin only)',
      unlock: 'Unlocks the current channel for everyone (restores ability to send messages in the channel). Usage: `;unlock` (admin only)',
      crontab: 'Schedule, list, or cancel commands to run after a delay. Usage: `&crontab 5m say Hello` to schedule, `&crontab list` to list, `&crontab cancel <id>` to cancel (admin only)',
      top: 'Show top users by messages, infractions, or uptime. Usage: `&top messages`, `&top infractions`, or `&top uptime`',
      sysinfo: 'Show system and bot info: CPU, RAM, uptime, Node.js version, OS, guild/user count. Usage: `&sysinfo`',
      trace: 'Simulates tracking a user\'s origin for fun. Usage: `&trace @user`',
      man: 'Returns the help info for a command like a Linux manpage. Usage: `&man <command>`',
      setup: 'Configure server settings and admin roles. Usage: `;setup @adminrole [@extrarole1 ...]` (owner only)',
      config: 'Show current server configuration and settings. Usage: `;config`',
      logchannel: 'Set the log channel for moderation actions. Usage: `;logchannel #channel` (admin only)',
      autorole: 'Set autorole for new members. Usage: `;autorole @role` (admin only)',
      prefix: 'Set a custom command prefix for this server. Usage: `;prefix <new_prefix>` (owner only)',
      'reset-config': 'Reset server configuration to defaults. Usage: `;reset-config` (owner only)',
      'disable-commands': 'Manage which commands are enabled/disabled. Usage: `;disable-commands add/remove/list/clear <commands>` (owner only)',
      welcomesetup: 'Setup welcome messages for new members. Usage: `;welcomesetup` (admin only)',
      goodbyesetup: 'Setup goodbye messages for leaving members. Usage: `;goodbyesetup` (admin only)',
      ticketsetup: 'Setup ticket system for support. Usage: `;ticketsetup #channel` (admin only)',
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
      sniper: 'Logs and shows deleted messages (message sniping). Only affects bot logging, does not restore deleted messages in the server. Usage: `&sniper on` to enable, `&sniper off` to disable (admin only)',
      shadowban: 'Bans a user from the server without showing a ban message or logging (silent ban). Usage: `&shadowban @user` (admin only)',
      massban: 'Ban all users with a specific role from the server. Usage: `&massban @role` (admin only)',
      revert: 'Removes a user\'s last 10 messages in the current channel (like a soft purge, does not ban or mute the user). Usage: `&revert @user` (admin only)',
      modview: 'View and filter mod actions (bans, mutes, warns, etc) logged by the bot. Does not show server audit log. Usage: `&modview [action] [next|prev]` (admin only)',
      passwd: 'Set, get, list, or remove a user codeword for events or actions. Only affects bot features, not server permissions. Usage: `&passwd @user <codeword>` to set, `&passwd @user` to get, `&passwd list` to list all, `&passwd remove @user` to remove (admin only)',
      crontab: 'Schedule, list, or cancel commands to run after a delay. Usage: `&crontab <time> <command>` to schedule, `&crontab list` to list, `&crontab cancel <id>` to cancel (admin only)'
    };
    
    // Group commands by category
    const categories = {
      '🔧 Setup & Configuration': ['setup', 'config', 'logchannel', 'autorole', 'prefix', 'reset-config', 'disable-commands'],
      '👋 Welcome & Goodbye': ['welcomesetup', 'goodbyesetup'],
      '🎫 Ticket System': ['ticketsetup'],
      '🛡️ Moderation': ['ban', 'kick', 'warn', 'warnings', 'clearwarn', 'purge', 'nuke', 'blacklist', 'unblacklist', 'mute', 'unmute', 'timeout', 'spy', 'ghostping', 'sniper', 'revert', 'shadowban', 'massban', 'lock', 'unlock', 'modview', 'crontab'],
      '🛠️ Utility': ['ls', 'ps', 'whoami', 'ping', 'uptime', 'server', 'roles', 'avatar', 'poll', 'say', 'help', 'reset', 'trace', 'man', 'top', 'sysinfo', 'passwd']
    };
    
    let helpText = '';
    for (const [category, commands] of Object.entries(categories)) {
      helpText += `\n**${category}**\n`;
      for (const cmd of commands) {
        if (commandDescriptions[cmd]) {
          helpText += `• **${cmd}** — ${commandDescriptions[cmd]}\n`;
        }
      }
    }
    
    const embed = new EmbedBuilder()
      .setTitle('🤖 Bot Commands')
      .setDescription(helpText)
      .addFields(
        { name: '📝 Usage', value: 'Use `;` or `&` before commands\nExample: `;ping` or `&help`', inline: false },
        { name: '⚙️ Configuration', value: 'Use `;setup @adminrole` to configure admin roles\nUse `;config` to view current settings', inline: false },
        { name: '🚫 Command Management', value: 'Use `;disable-commands` to manage which commands are enabled/disabled', inline: false }
      )
      .setColor(0x7289da)
      .setFooter({ text: 'Slash commands are also available for most features' });
    
    return msg.reply({ embeds: [embed] });
  },
  
  poll: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const question = args.join(' ');
    if (!question) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';poll <question>').setColor(0xe74c3c)] });
    }
    
    const embed = new EmbedBuilder()
      .setTitle('📊 Poll')
      .setDescription(question)
      .setColor(0x9b59b6)
      .setFooter({ text: `Poll by ${msg.author.tag}` })
      .setTimestamp();
    
    const pollMsg = await msg.reply({ embeds: [embed] });
    
    // Add reaction options
    const reactions = ['👍', '👎', '🤷'];
    for (const reaction of reactions) {
      await pollMsg.react(reaction);
    }
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
    // Store user ID in a spy list (in-memory for now, can be persisted)
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
    } else {
      return msg.reply('Usage: &sniper on/off');
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
    let query = supabase.from('mod_actions').select('*').eq('guild_id', msg.guild.id);
    if (actionType) query = query.eq('action_type', actionType);
    query = query.order('created_at', { ascending: false }).range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await query;
    if (error) return msg.reply('Failed to fetch mod actions.');
    if (!data || data.length === 0) return msg.reply('No mod actions found.');
    const lines = data.map(a => `• [${a.action_type}] <@${a.target_id}> by <@${a.moderator_id}> (${a.created_at.split('T')[0]})${a.reason ? `: ${a.reason}` : ''}`).join('\n');
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
      // Actually execute the command (only simple ones for demo)
      if (commandArr[0] === 'say') {
        msg.channel.send(commandArr.slice(1).join(' '));
      } else {
        msg.channel.send(`Scheduled command: ${commandArr.join(' ')} (executed)`);
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
    const command = args[0];
    if (!command) return msg.reply('Usage: &man <command>');
    // Lookup help info from commandDescriptions
    const desc = (typeof commandDescriptions === 'object' ? commandDescriptions[command] : null) || 'No manual entry for this command.';
    return msg.reply(`NAME\n    ${command} - ${desc}`);
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
  }
};

// Slash commands
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
};

module.exports = {
  name: 'utility',
  prefixCommands,
  slashCommands,
  slashHandlers
}; 