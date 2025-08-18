const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { EnhancedLogger } = require('../enhanced-logger');

// Initialize Supabase and Logger
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const logger = new EnhancedLogger(supabase);

// Dashboard URL
const DASHBOARD_URL = 'https://syl-cuiw.onrender.com/index.html';

// Available commands for disabling
const AVAILABLE_COMMANDS = {
  // Prefix commands
  prefix: {
    // Setup commands
    setup: 'Configure server settings (owner only). Affects server configuration, not user permissions.',
    config: 'Show server configuration. Only displays settings, does not change server or bot state.',
    logchannel: 'Set log channel for moderation actions. Affects where the bot logs actions, does not affect server permissions.',
    say: 'Make bot say something. Only affects bot output, does not affect server or user permissions.',
    'reset-config': 'Reset server configuration (owner only). Restores default settings for the bot in this server.',
    autorole: 'Set autorole for new members. Affects server role assignment for new users.',
    prefix: 'Set custom command prefix (owner only). Only affects how the bot is triggered in this server.',
    'disable-commands': 'Manage disabled commands (owner only). Only affects which bot commands are available in this server.',
    
    // Ticket System
    ticketsetup: 'Setup ticket system for support. Only affects bot ticket features, not server permissions.',
    
    // Moderation commands
    ban: 'Ban a user from the server (removes them from the server entirely). Usage: `;ban @user [reason]` (admin only)',
    kick: 'Kick a user from the server (removes them, but they can rejoin if invited). Usage: `;kick @user [reason]` (admin only)',
    warn: 'Warn a user. Only affects bot logging and warnings, does not affect server permissions. Usage: `;warn @user <reason>` (admin only)',
    warnings: 'Show warnings for a member. Only displays bot-logged warnings.',
    clearwarn: 'Clear warnings for a member. Only affects bot-logged warnings.',
    purge: 'Bulk delete messages. Affects server channel messages. Usage: `;purge <1-100>` (admin only)',
    nuke: 'Clone and delete the channel. Affects the server channel structure. Usage: `;nuke` (admin only)',
    blacklist: 'Add a user to the bot blacklist. This blocks the user from using any bot commands, but does NOT ban or kick them from the server. Usage: `;blacklist @user <reason>` (admin only)',
    unblacklist: 'Remove a user from the bot blacklist, restoring their access to bot commands. Usage: `;unblacklist @user` (admin only)',
    mute: 'Mute a user in the server (prevents them from sending messages/voice for a duration). Usage: `;mute @user <duration> [reason]` (admin only)',
    unmute: 'Unmute a user in the server (restores their ability to speak). Usage: `;unmute @user` (admin only)',
    timeout: 'Timeout a user in the server (temporarily restricts their ability to interact). Usage: `;timeout @user <duration> [reason]` (admin only)',
    
    // Utility commands
    ls: 'List all text channels in the server. Only displays information, does not affect server or bot state.',
    ps: 'List all online members in the server. Only displays information.',
    whoami: 'Show your user info. Only displays information.',
    ping: 'Check the bot\'s latency. Only affects bot output.',
    uptime: 'Show bot uptime. Only affects bot output.',
    server: 'Show server info. Only displays information.',
    roles: 'List all roles in the server. Only displays information.',
    avatar: 'Show a user avatar. Only displays information.',
    poll: 'Create a poll with reactions. Only affects bot output in the channel.',
    help: 'Show help message. Only affects bot output.',
    reset: 'Reset the command prefix to default (; and &)',
    spy: 'Secretly logs all messages from a specific user for moderation. Only affects bot logging, does not affect the user\'s server permissions. Usage: `&spy @user` (admin only)',
    ghostping: 'Sends and deletes a ping instantly for fun or to test mod reactions. Only affects bot output.',
    sniper: 'Logs and shows deleted messages (message sniping). Only affects bot logging, does not restore deleted messages in the server. Usage: `&sniper on` to enable, `&sniper off` to disable (admin only)',
    revert: 'Removes a user\'s last 10 messages in the current channel (like a soft purge, does not ban or mute the user). Usage: `&revert @user` (admin only)',
    modview: 'View and filter mod actions (bans, mutes, warns, etc) logged by the bot. Does not show server audit log. Usage: `&modview [action] [next|prev]` (admin only)',
    shadowban: 'Bans a user from the server without showing a ban message or logging (silent ban). Usage: `&shadowban @user` (admin only)',
    massban: 'Ban all users with a specific role from the server. Usage: `&massban @role` (admin only)',
    lock: 'Locks the current channel for everyone (prevents all users from sending messages in the channel, but does not affect the whole server). Usage: `;lock` (admin only)',
    unlock: 'Unlocks the current channel for everyone (restores ability to send messages in the channel). Usage: `;unlock` (admin only)',
    passwd: 'Set, get, list, or remove a user codeword for events or actions. Only affects bot features, not server permissions. Usage: `&passwd @user <codeword>` to set, `&passwd @user` to get, `&passwd list` to list all, `&passwd remove @user` to remove (admin only)',
    crontab: 'Schedule, list, or cancel commands to run after a delay. Only affects bot command scheduling. Usage: `&crontab <time> <command>` to schedule, `&crontab list` to list, `&crontab cancel <id>` to cancel (admin only)',
    top: 'Show top users by messages, infractions, or uptime. Only displays information.',
    sysinfo: 'Show system and bot info: CPU, RAM, uptime, Node.js version, OS, guild/user count. Only displays information.',
    'feedback-channel': 'Set the channel where anonymous feedback is sent. Usage: `&feedback-channel #channel` (admin only)',
    'modmail-channel': 'Set the channel where modmail threads are created. Usage: `&modmail-channel #channel` (admin only)',
    'mod-role': 'Set the role to ping during panic mode. Usage: `&mod-role @role` (admin only)',
    'report-channel': 'Set the channel where user reports are sent. Usage: `&report-channel #channel` (admin only)'
  },
  
  // Slash commands
  slash: {
    setup: 'Configure server settings and enable/disable commands',
    logchannel: 'Set the log channel for moderation actions',
    say: 'Make the bot say something as an embed',
    'reset-config': 'Reset server configuration to defaults (owner only)',
    autorole: 'Set the autorole for new members',
    prefix: 'Set custom command prefix for this server (owner only)',
    'disable-commands': 'Manage disabled commands for this server',
    ticketsetup: 'Setup ticket system for support',
    ping: 'Check the bot\'s latency',
    uptime: 'Show bot uptime',
    ban: 'Ban a user from the server',
    kick: 'Kick a user from the server',
    warn: 'Warn a user',
    warnings: 'Show warnings for a member',
    clearwarn: 'Clear warnings for a member',
    purge: 'Bulk delete messages',
    blacklist: 'Add user to blacklist',
    unblacklist: 'Remove user from blacklist',
    mute: 'Mute a user (with duration)',
    unmute: 'Unmute a user',
    timeout: 'Timeout a user (with duration)',
    server: 'Show server info',
    avatar: 'Show a user avatar',
    poll: 'Create a poll with reactions',
    dashboard: 'Get link to the web dashboard'
  }
};

// Permission checking functions
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

async function isOwnerOrCoOwner(member) {
  try {
    if (!member || !member.guild) return false;
    
    // Always allow the server owner
    if (member.guild.ownerId === member.id) return true;
    
    // Check for co-owner permission from new co_owners table
    const { data, error } = await supabase
      .from('co_owners')
      .select('user_id, permissions')
      .eq('guild_id', member.guild.id)
      .eq('user_id', member.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking co-owners:', error);
      return false;
    }
    
    // If found in co_owners table, check if they have configure permission
    if (data && data.permissions.includes('configure')) {
      return true;
    }
    
    return false;
  } catch (err) {
    console.error('Error in isOwnerOrCoOwner check:', err);
    return false;
  }
}

// Configuration management functions
async function getGuildConfig(guildId) {
  try {
    const { data, error } = await supabase
      .from('guild_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || getDefaultConfig(guildId);
  } catch (err) {
    console.error('Error getting guild config:', err);
    return getDefaultConfig(guildId);
  }
}

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

async function updateGuildConfig(guildId, updates, userId, guild) {
  try {
    // Get current config for logging
    const currentConfig = await getGuildConfig(guildId);
    
    // Update configuration
    const { data, error } = await supabase
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
      const oldValue = currentConfig[key];
      if (oldValue !== value) {
        await logger.logConfigChange(guildId, guild, key, oldValue, value, userId);
      }
    }

    return data;
  } catch (err) {
    console.error('Error updating guild config:', err);
    await logger.logError(guildId, guild, err, { context: 'updateGuildConfig', updates });
    throw err;
  }
}

// Enhanced dashboard command
async function handleDashboardCommand(interaction) {
  try {
    const guild = interaction.guild;
    const member = interaction.member;
    
    // Check if user has manage server permission or is admin/co-owner
    const hasPermission = member.permissions.has(PermissionFlagsBits.ManageGuild) || 
                         await isAdmin(member) || 
                         await isOwnerOrCoOwner(member);

    const embed = new EmbedBuilder()
      .setTitle('🌐 SYL Bot Dashboard')
      .setDescription('**Manage your server with ease using our comprehensive web dashboard!**\n\n' +
        '✨ **Features Available:**\n' +
        '• 🔧 **Server Configuration** - Customize bot settings and preferences\n' +
        '• 🛡️ **Security Settings** - Anti-nuke and anti-raid protection\n' +
        '• 👥 **Permission Management** - Admin roles and co-owner system\n' +
        '• 📊 **Real-time Analytics** - Member counts and activity tracking\n' +
        '• 📝 **Comprehensive Logging** - Track all server activities\n' +
        '• 💾 **Backup System** - Save and restore server configurations\n' +
        '• 🚫 **Blacklist Management** - Control access to bot features\n' +
        '• ⚡ **Live Updates** - Real-time synchronization with Discord')
      .setColor(0x6c7fff)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png')
      .addFields([
        {
          name: '🚀 Access Dashboard',
          value: hasPermission 
            ? `**[🔗 Open Dashboard](${DASHBOARD_URL}?guild=${guild.id})**\n*Direct link to your server's configuration*`
            : '❌ You need **Manage Server** permission or admin role to access the dashboard',
          inline: false
        },
        {
          name: '📱 Quick Setup',
          value: '• Use `/setup` command for basic configuration\n' +
                 '• Use `/logchannel` to set logging channel\n' +
                 '• Use `/autorole` to set new member role\n' +
                 '• Use `/prefix` to change command prefix',
          inline: true
        },
        {
          name: '🔧 Advanced Features',
          value: '• Co-owner management system\n' +
                 '• Command disable functionality\n' +
                 '• Anti-raid and anti-nuke protection\n' +
                 '• Comprehensive activity logging',
          inline: true
        }
      ])
      .setFooter({ 
        text: `${guild.name} • ${guild.memberCount} members`, 
        iconURL: guild.iconURL({ dynamic: true, size: 32 }) 
      })
      .setTimestamp();

    // Add action row with buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Open Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(`${DASHBOARD_URL}?guild=${guild.id}`)
          .setEmoji('🌐'),
        new ButtonBuilder()
          .setLabel('Quick Setup')
          .setCustomId('quick_setup')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡')
          .setDisabled(!hasPermission),
        new ButtonBuilder()
          .setLabel('View Config')
          .setCustomId('view_config')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📋')
      );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: false
    });

    // Log command usage
    await logger.logCommand(guild.id, guild, 'dashboard', member.id, true, {
      hasPermission,
      memberCount: guild.memberCount
    });

  } catch (error) {
    console.error('Error in dashboard command:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'dashboardCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('An error occurred while loading the dashboard information.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// Enhanced setup command
async function handleSetupCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;

    if (!await isOwnerOrCoOwner(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('Only server owners and co-owners can use this command.\n\n' +
          `**[🌐 Use the Dashboard Instead](${DASHBOARD_URL}?guild=${guild.id})**\n` +
          '*Admins can access the dashboard with Manage Server permission*')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const config = await getGuildConfig(guild.id);

    const embed = new EmbedBuilder()
      .setTitle('🔧 Server Configuration')
      .setDescription('Configure your server settings using the options below or use the web dashboard for more advanced features.')
      .setColor(0x6c7fff)
      .addFields([
        {
          name: '📊 Current Configuration',
          value: `**Prefix:** \`${config.custom_prefix || ';'}\`\n` +
                 `**Log Channel:** ${config.log_channel ? `<#${config.log_channel}>` : 'Not set'}\n` +
                 `**Auto Role:** ${config.autorole ? `<@&${config.autorole}>` : 'Not set'}\n` +
                 `**Admin Role:** ${config.admin_role_id ? `<@&${config.admin_role_id}>` : 'Not set'}`,
          inline: true
        },
        {
          name: '🛡️ Security Status',
          value: `**Anti-Nuke:** ${config.anti_nuke_enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                 `**Anti-Raid:** ${config.anti_raid_enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                 `**Auto Mod:** ${config.auto_mod_enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                 `**Logging:** ${config.logging_enabled ? '✅ Enabled' : '❌ Disabled'}`,
          inline: true
        },
        {
          name: '🌐 Advanced Configuration',
          value: `**[Open Full Dashboard](${DASHBOARD_URL}?guild=${guild.id})**\n` +
                 '*Access all advanced features, security settings, and analytics*',
          inline: false
        }
      ])
      .setFooter({ text: 'Use the buttons below for quick setup or open the dashboard for full control' });

    const row1 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_logchannel')
          .setLabel('Set Log Channel')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝'),
        new ButtonBuilder()
          .setCustomId('setup_autorole')
          .setLabel('Set Auto Role')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎭'),
        new ButtonBuilder()
          .setCustomId('setup_prefix')
          .setLabel('Change Prefix')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚡')
      );

    const row2 = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('setup_security')
          .setLabel('Security Settings')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🛡️'),
        new ButtonBuilder()
          .setCustomId('setup_commands')
          .setLabel('Manage Commands')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setLabel('Full Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(`${DASHBOARD_URL}?guild=${guild.id}`)
          .setEmoji('🌐')
      );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2],
      ephemeral: false
    });

    await logger.logCommand(guild.id, guild, 'setup', member.id, true);

  } catch (error) {
    console.error('Error in setup command:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'setupCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('An error occurred while loading the setup interface.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// Configuration commands
async function handleLogChannelCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;
    const channel = interaction.options.getChannel('channel');

    if (!await isAdmin(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('You need admin permissions to set the log channel.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (channel && channel.type !== ChannelType.GuildText) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Invalid Channel')
        .setDescription('Please select a text channel for logging.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await updateGuildConfig(guild.id, { log_channel: channel?.id || null }, member.id, guild);

    const embed = new EmbedBuilder()
      .setTitle('✅ Log Channel Updated')
      .setDescription(channel 
        ? `Log channel has been set to ${channel}`
        : 'Log channel has been disabled')
      .setColor(0x43b581)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logger.logCommand(guild.id, guild, 'logchannel', member.id, true, { channelId: channel?.id });

  } catch (error) {
    console.error('Error setting log channel:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'logChannelCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to update log channel.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handleAutoRoleCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;
    const role = interaction.options.getRole('role');

    if (!await isAdmin(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('You need admin permissions to set the auto role.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (role && (role.managed || role.id === guild.id)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Invalid Role')
        .setDescription('Cannot use managed roles or @everyone as auto role.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await updateGuildConfig(guild.id, { autorole: role?.id || null }, member.id, guild);

    const embed = new EmbedBuilder()
      .setTitle('✅ Auto Role Updated')
      .setDescription(role 
        ? `Auto role has been set to ${role}`
        : 'Auto role has been disabled')
      .setColor(0x43b581)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logger.logCommand(guild.id, guild, 'autorole', member.id, true, { roleId: role?.id });

  } catch (error) {
    console.error('Error setting auto role:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'autoRoleCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to update auto role.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

async function handlePrefixCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;
    const prefix = interaction.options.getString('prefix');

    if (!await isOwnerOrCoOwner(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('Only server owners and co-owners can change the command prefix.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (prefix && (prefix.length > 5 || prefix.includes(' '))) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Invalid Prefix')
        .setDescription('Prefix must be 5 characters or less and cannot contain spaces.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await updateGuildConfig(guild.id, { custom_prefix: prefix || ';' }, member.id, guild);

    const embed = new EmbedBuilder()
      .setTitle('✅ Prefix Updated')
      .setDescription(`Command prefix has been set to: \`${prefix || ';'}\``)
      .setColor(0x43b581)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logger.logCommand(guild.id, guild, 'prefix', member.id, true, { newPrefix: prefix || ';' });

  } catch (error) {
    console.error('Error setting prefix:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'prefixCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to update command prefix.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// Slash command definitions
const slashCommands = [
  new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Get the link to the web dashboard and server information'),
  
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure server settings (owner/co-owner only)'),
  
  new SlashCommandBuilder()
    .setName('logchannel')
    .setDescription('Set the log channel for moderation actions (admin only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The channel to use for logging (leave empty to disable)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),
  
  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Set the auto role for new members (admin only)')
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('The role to assign to new members (leave empty to disable)')
        .setRequired(false)
    ),
  
  new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Set custom command prefix for this server (owner/co-owner only)')
    .addStringOption(option =>
      option.setName('prefix')
        .setDescription('The new command prefix (max 5 characters, no spaces)')
        .setMaxLength(5)
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('View current server configuration')
];

// Slash command handlers
const slashHandlers = {
  dashboard: handleDashboardCommand,
  setup: handleSetupCommand,
  logchannel: handleLogChannelCommand,
  autorole: handleAutoRoleCommand,
  prefix: handlePrefixCommand,
  config: async (interaction) => {
    try {
      const guild = interaction.guild;
      const config = await getGuildConfig(guild.id);
      
      const embed = new EmbedBuilder()
        .setTitle('📋 Server Configuration')
        .setDescription('Current bot configuration for this server')
        .setColor(0x6c7fff)
        .addFields([
          {
            name: '⚙️ Basic Settings',
            value: `**Prefix:** \`${config.custom_prefix || ';'}\`\n` +
                   `**Log Channel:** ${config.log_channel ? `<#${config.log_channel}>` : 'Not set'}\n` +
                   `**Auto Role:** ${config.autorole ? `<@&${config.autorole}>` : 'Not set'}`,
            inline: true
          },
          {
            name: '👥 Administration',
            value: `**Admin Role:** ${config.admin_role_id ? `<@&${config.admin_role_id}>` : 'Not set'}\n` +
                   `**Extra Admin Roles:** ${config.extra_role_ids?.length || 0}\n` +
                   `**Disabled Commands:** ${config.disabled_commands?.length || 0}`,
            inline: true
          },
          {
            name: '🛡️ Security & Features',
            value: `**Anti-Nuke:** ${config.anti_nuke_enabled ? '✅' : '❌'}\n` +
                   `**Anti-Raid:** ${config.anti_raid_enabled ? '✅' : '❌'}\n` +
                   `**Auto Mod:** ${config.auto_mod_enabled ? '✅' : '❌'}\n` +
                   `**Logging:** ${config.logging_enabled ? '✅' : '❌'}`,
            inline: true
          },
          {
            name: '📊 Module Status',
            value: `**Welcome:** ${config.welcome_enabled ? '✅' : '❌'}\n` +
                   `**Goodbye:** ${config.goodbye_enabled ? '✅' : '❌'}\n` +
                   `**Backup:** ${config.backup_enabled ? '✅' : '❌'}`,
            inline: true
          },
          {
            name: '🌐 Full Configuration',
            value: `**[Open Dashboard](${DASHBOARD_URL}?guild=${guild.id})**\n` +
                   '*Access all settings and advanced features*',
            inline: false
          }
        ])
        .setFooter({ text: `Configuration for ${guild.name}`, iconURL: guild.iconURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      await logger.logCommand(guild.id, guild, 'config', interaction.member.id, true);

    } catch (error) {
      console.error('Error showing config:', error);
      await logger.logError(interaction.guild?.id, interaction.guild, error, { 
        context: 'configCommand',
        userId: interaction.user.id 
      });
      
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('Failed to load server configuration.')
        .setColor(0xff5555);

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
};

// Available commands export
const availableCommands = {
  setup: 'Configure server settings (owner/co-owner only)',
  dashboard: 'Get link to the web dashboard',
  logchannel: 'Set log channel for moderation actions (admin only)',
  autorole: 'Set autorole for new members (admin only)',
  prefix: 'Set custom command prefix (owner/co-owner only)',
  config: 'View current server configuration'
};

module.exports = {
  name: 'enhanced-setup',
  slashCommands,
  slashHandlers,
  availableCommands,
  AVAILABLE_COMMANDS,
  
  // Export utility functions for use by other cogs
  isAdmin,
  isOwnerOrCoOwner,
  getGuildConfig,
  updateGuildConfig,
  logger
};