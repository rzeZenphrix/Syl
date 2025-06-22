const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../utils/supabase');

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
      ban: 'Ban a user from the server',
      kick: 'Kick a user from the server',
      warn: 'Warn a user',
      warnings: 'Show warnings for a member',
      clearwarn: 'Clear warnings for a member',
      purge: 'Bulk delete messages',
      nuke: 'Clone and delete the channel',
      blacklist: 'Add user to blacklist',
      unblacklist: 'Remove user from blacklist',
      mute: 'Mute a user (with duration)',
      unmute: 'Unmute a user',
      timeout: 'Timeout a user (with duration)',
      
      // Utility
      ls: 'List all text channels',
      ps: 'List all online members',
      whoami: 'Show your user info',
      ping: 'Check the bot\'s latency',
      uptime: 'Show bot uptime',
      server: 'Show server info',
      roles: 'List all roles',
      avatar: 'Show a user avatar',
      poll: 'Create a poll with reactions',
      say: 'Make bot say something',
      help: 'Show this help message',
      reset: 'Reset the command prefix to default (; and &)',
      spy: 'Secretly logs all messages from a specific user (admin only)',
      ghostping: 'Sends and deletes a ping instantly (for fun/testing mods)',
      sniper: 'Logs and shows deleted messages (message sniping)',
      revert: 'Removes user\'s last 10 messages (like a soft purge)',
      modview: 'See all hidden mod actions in the server',
      shadowban: 'Bans without showing a ban message or logging (silent ban)',
      massban: 'Ban all users with a specific role',
      lock: 'Locks the channel',
      unlock: 'Unlocks the channel',
      crontab: 'Schedule a command (e.g., ban @user in 5m)',
      top: 'Show top users by message count, infractions, or uptime',
      trace: 'Simulates tracking a user\'s origin (fun visual output)',
      man: 'Returns the help info like a Linux manpage',
      sysinfo: 'Shows CPU/RAM use, total guilds, users (mimics htop)',
      passwd: 'Sets a secret "codeword" for an event or action'
    };
    
    // Group commands by category
    const categories = {
      '🔧 Setup & Configuration': ['setup', 'config', 'logchannel', 'autorole', 'prefix', 'reset-config', 'disable-commands'],
      '👋 Welcome & Goodbye': ['welcomesetup', 'goodbyesetup'],
      '🎫 Ticket System': ['ticketsetup'],
      '🛡️ Moderation': ['ban', 'kick', 'warn', 'warnings', 'clearwarn', 'purge', 'nuke', 'blacklist', 'unblacklist', 'mute', 'unmute', 'timeout'],
      '🛠️ Utility': ['ls', 'ps', 'whoami', 'ping', 'uptime', 'server', 'roles', 'avatar', 'poll', 'say', 'help', 'reset']
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
    // This would show a log of all mod actions (stub for now)
    return msg.reply('Modview: (stub) All hidden mod actions would be shown here.');
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
    const [time, ...commandArr] = args;
    if (!time || commandArr.length === 0) return msg.reply('Usage: &crontab <time> <command>');
    // For demo: just acknowledge scheduling
    return msg.reply(`Scheduled command \`${commandArr.join(' ')}\` to run in ${time}. (Stub)`);
  },

  top: async (msg, args) => {
    // For demo: show a fake leaderboard
    return msg.reply('Top users by message count (stub):\n1. @UserA (1234 msgs)\n2. @UserB (1100 msgs)\n3. @UserC (900 msgs)');
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
    // For demo: show fake system info
    return msg.reply('System Info (stub):\nCPU: 12%\nRAM: 512MB/2GB\nGuilds: 5\nUsers: 1234');
  },

  passwd: async (msg, args) => {
    if (!await isAdmin(msg.member)) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only admins can use this command.').setColor(0xe74c3c)] });
    const user = msg.mentions.users.first();
    const codeword = args.slice(1).join(' ');
    if (!user || !codeword) return msg.reply('Usage: &passwd @user <codeword>');
    // For demo: just acknowledge
    return msg.reply(`Set a secret codeword for <@${user.id}>. (Stub)`);
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