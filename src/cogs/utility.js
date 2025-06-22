const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { supabase } = require('../utils/supabase');

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
      help: 'Show this help message'
    };
    
    // Group commands by category
    const categories = {
      '🔧 Setup & Configuration': ['setup', 'config', 'logchannel', 'autorole', 'prefix', 'reset-config', 'disable-commands'],
      '👋 Welcome & Goodbye': ['welcomesetup', 'goodbyesetup'],
      '🎫 Ticket System': ['ticketsetup'],
      '🛡️ Moderation': ['ban', 'kick', 'warn', 'warnings', 'clearwarn', 'purge', 'nuke', 'blacklist', 'unblacklist', 'mute', 'unmute', 'timeout'],
      '🛠️ Utility': ['ls', 'ps', 'whoami', 'ping', 'uptime', 'server', 'roles', 'avatar', 'poll', 'say', 'help']
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
    .addStringOption(opt => opt.setName('question').setDescription('Poll question').setRequired(true))
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
  }
};

module.exports = {
  name: 'utility',
  prefixCommands,
  slashCommands,
  slashHandlers
}; 