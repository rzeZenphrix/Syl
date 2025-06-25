const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { supabase } = require('../utils/supabase');

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
    poll: 'Create a poll with reactions'
  }
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

async function isOwnerOrCoOwner(member) {
  try {
    if (!member || !member.guild) return false;
    
    // Always allow the server owner
    if (member.guild.ownerId === member.id) return true;
    
    // Check for co-owner permission
    const { data, error } = await supabase
      .from('guild_configs')
      .select('co_owner_1_id, co_owner_2_id')
      .eq('guild_id', member.guild.id)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking co-owners:', error);
      return false;
    }
    
    if (!data) return false;
    
    const coOwners = [data.co_owner_1_id, data.co_owner_2_id].filter(Boolean);
    return coOwners.some(id => id === member.id);
  } catch (err) {
    console.error('Error in isOwnerOrCoOwner check:', err);
    return false;
  }
}

// Function to get accurate command count
function getCommandCount() {
  const allCommands = { ...AVAILABLE_COMMANDS.prefix, ...AVAILABLE_COMMANDS.slash };
  const prefixCount = Object.keys(AVAILABLE_COMMANDS.prefix).length;
  const slashCount = Object.keys(AVAILABLE_COMMANDS.slash).length;
  const totalCount = Object.keys(allCommands).length;
  
  return { prefixCount, slashCount, totalCount };
}

// Prefix commands
const prefixCommands = {
  setup: async (msg, args) => {
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can run this command.').setColor(0xe74c3c)] });
    }
    
    const mentionedRoles = msg.mentions.roles;
    if (mentionedRoles.size === 0) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';setup @adminrole [@extrarole1 @extrarole2...] [--disable command1,command2,...]\n\nYou can mention multiple roles for admin permissions.').setColor(0xe74c3c)] });
    }
    
    const adminRole = mentionedRoles.first();
    const extraRoles = Array.from(mentionedRoles.values()).filter(r => r.id !== adminRole.id).map(r => r.id);
    
    // Parse disabled commands
    let disabledCommands = [];
    const disableIndex = args.findIndex(arg => arg === '--disable');
    if (disableIndex !== -1 && args[disableIndex + 1]) {
      const disabledString = args[disableIndex + 1];
      disabledCommands = disabledString.split(',').map(cmd => cmd.trim()).filter(Boolean);
      
      // Validate commands
      const allCommands = { ...AVAILABLE_COMMANDS.prefix, ...AVAILABLE_COMMANDS.slash };
      const invalidCommands = disabledCommands.filter(cmd => !allCommands[cmd]);
      
      if (invalidCommands.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('Invalid Commands')
          .setDescription(`The following commands are not valid:\n**${invalidCommands.join(', ')}**`)
          .addFields(
            { name: 'Available Commands', value: Object.keys(allCommands).slice(0, 20).join(', ') + (Object.keys(allCommands).length > 20 ? '...' : ''), inline: false },
            { name: 'Usage', value: 'Use `/disable-commands list` to see all available commands', inline: false }
          )
          .setColor(0xe74c3c);
        return msg.reply({ embeds: [embed] });
      }
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        admin_role_id: adminRole.id,
        extra_role_ids: extraRoles,
        disabled_commands: disabledCommands
      });
      
      const { prefixCount, slashCount, totalCount } = getCommandCount();
      
      const embed = new EmbedBuilder()
        .setTitle('Setup Complete')
        .setDescription(`**Admin Role:** <@&${adminRole.id}>\n**Extra Roles:** ${extraRoles.map(r => `<@&${r}>`).join(', ') || 'None'}`)
        .addFields(
          { name: 'Disabled Commands', value: disabledCommands.length > 0 ? disabledCommands.join(', ') : 'None', inline: false },
          { name: 'Total Disabled', value: `${disabledCommands.length} commands`, inline: true },
          { name: 'Available Commands', value: `${totalCount} total (${prefixCount} prefix, ${slashCount} slash)`, inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Setup error:', e.message || JSON.stringify(e));
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to save configuration.').setColor(0xe74c3c)] });
    }
  },
  
  config: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    try {
      // Get main guild config
      const { data, error } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', msg.guild.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      // Get welcome config
      const { data: welcome } = await supabase
        .from('welcome_configs')
        .select('*')
        .eq('guild_id', msg.guild.id)
        .single();
      
      // Get goodbye config
      const { data: goodbye } = await supabase
        .from('goodbye_configs')
        .select('*')
        .eq('guild_id', msg.guild.id)
        .single();
      
      // Get ticket config
      const { data: ticket } = await supabase
        .from('ticket_configs')
        .select('*')
        .eq('guild_id', msg.guild.id)
        .single();
      
      if (!data && !welcome && !goodbye && !ticket) {
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('No Config').setDescription('No configuration found. Use `/setup` to configure the bot.').setColor(0xe74c3c)] });
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`Server Configuration - ${msg.guild.name}`)
        .setColor(0x3498db)
        .setTimestamp();
      
      // Basic Settings - Combine into fewer fields
      if (data) {
        const adminRole = data.admin_role_id ? `<@&${data.admin_role_id}>` : 'Not set';
        const extraRoles = data.extra_role_ids?.length ? data.extra_role_ids.map(r => `<@&${r}>`).join(', ') : 'None';
        const logChannel = data.log_channel ? `<#${data.log_channel}>` : 'Not set';
        const autorole = data.autorole ? `<@&${data.autorole}>` : 'Not set';
        const prefix = data.custom_prefix ? `**${data.custom_prefix}**` : '; or & (default)';
        
        embed.addFields(
          { name: '🔧 Basic Settings', value: 'Server configuration and permissions', inline: false },
          { name: 'Admin Role', value: adminRole, inline: true },
          { name: 'Extra Roles', value: extraRoles, inline: true },
          { name: 'Log Channel', value: logChannel, inline: true },
          { name: 'Autorole', value: autorole, inline: true },
          { name: 'Custom Prefix', value: prefix, inline: true }
        );
        
        if (data.disabled_commands?.length) {
          embed.addFields(
            { name: '🚫 Disabled Commands', value: `${data.disabled_commands.length} commands: ${data.disabled_commands.join(', ')}`, inline: false }
          );
        }
      }
      
      // Welcome & Goodbye Settings - Combine into one section
      const welcomeStatus = welcome && welcome.enabled ? '✅ Enabled' : '❌ Disabled';
      const goodbyeStatus = goodbye && goodbye.enabled ? '✅ Enabled' : '❌ Disabled';
      
      embed.addFields(
        { name: '👋 Welcome & Goodbye', value: 'Message system status', inline: false },
        { name: 'Welcome', value: welcomeStatus, inline: true },
        { name: 'Goodbye', value: goodbyeStatus, inline: true }
      );
      
      // Ticket Settings - Simplified
      if (ticket) {
        embed.addFields(
          { name: '🎫 Ticket System', value: 'Support ticket configuration', inline: false },
          { name: 'Panel Channel', value: ticket.channel_id ? `<#${ticket.channel_id}>` : 'Not set', inline: true },
          { name: 'Staff Role', value: ticket.staff_role_id ? `<@&${ticket.staff_role_id}>` : 'None', inline: true }
        );
      } else {
        embed.addFields({ name: '🎫 Ticket System', value: '❌ Not configured', inline: false });
      }
      
      // Server Info - Combine into one field
      embed.addFields(
        { name: '📊 Server Statistics', value: `Members: ${msg.guild.memberCount} | Channels: ${msg.guild.channels.cache.size} | Roles: ${msg.guild.roles.cache.size}`, inline: false }
      );
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Config error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to fetch configuration.').setColor(0xe74c3c)] });
    }
  },
  
  logchannel: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';logchannel #channel').setColor(0xe74c3c)] });
    }
    
    // Check if it's a text channel
    if (channel.type !== 0) { // 0 = GUILD_TEXT
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Channel').setDescription('Please select a text channel, not a voice channel or category.').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        log_channel: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Log Channel Set')
        .setDescription(`Log channel set to ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Logchannel error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to set log channel.').setColor(0xe74c3c)] });
    }
  },
  
  say: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const message = args.join(' ');
    if (!message) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';say <message>').setColor(0xe74c3c)] });
    }
    
    const embed = new EmbedBuilder()
      .setDescription(message)
      .setColor(0x7289da)
      .setTimestamp();
    
    return msg.reply({ embeds: [embed] });
  },

  'reset-config': async (msg, args) => {
    if (!await isOwnerOrCoOwner(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner or co-owners can reset the configuration.').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').delete().eq('guild_id', msg.guild.id);
      
      const embed = new EmbedBuilder()
        .setTitle('Configuration Reset')
        .setDescription('Server configuration has been reset to defaults.')
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Reset-config error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to reset configuration.').setColor(0xe74c3c)] });
    }
  },

  autorole: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const role = msg.mentions.roles.first();
    if (!role) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';autorole @role\nUse ;autorole to disable').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        autorole: role.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Autorole Set')
        .setDescription(`Autorole set to ${role}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Autorole error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to set autorole.').setColor(0xe74c3c)] });
    }
  },

  prefix: async (msg, args) => {
    if (!await isOwnerOrCoOwner(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner or co-owners can change the command prefix.').setColor(0xe74c3c)] });
    }
    
    const newPrefix = args[0];
    if (!newPrefix) {
      // Show current prefix
      try {
        const { data, error } = await supabase
          .from('guild_configs')
          .select('custom_prefix')
          .eq('guild_id', msg.guild.id)
          .single();
        
        const currentPrefix = data?.custom_prefix || '; or & (default)';
        
        const embed = new EmbedBuilder()
          .setTitle('Current Prefix')
          .setDescription(`Current command prefix: **${currentPrefix}**`)
          .addFields(
            { name: 'Usage', value: ';prefix <new_prefix>\nExample: ;prefix !\nUse ;prefix reset to use defaults', inline: false }
          )
          .setColor(0x3498db)
          .setTimestamp();
        
        return msg.reply({ embeds: [embed] });
      } catch (e) {
        console.error('Prefix check error:', e);
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to check current prefix.').setColor(0xe74c3c)] });
      }
    }
    
    if (newPrefix === 'reset') {
      // Reset to default prefixes
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
    }
    
    // Validate prefix
    if (newPrefix.length > 5) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Prefix').setDescription('Prefix must be 5 characters or less.').setColor(0xe74c3c)] });
    }
    
    if (newPrefix.includes(' ')) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Prefix').setDescription('Prefix cannot contain spaces.').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        custom_prefix: newPrefix
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Prefix Updated')
        .setDescription(`Command prefix set to: **${newPrefix}**`)
        .addFields(
          { name: 'Example', value: `${newPrefix}ping`, inline: true },
          { name: 'Reset', value: `Use ${newPrefix}prefix reset to use defaults`, inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Prefix set error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to set prefix.').setColor(0xe74c3c)] });
    }
  },

  'disable-commands': async (msg, args) => {
    if (!await isOwnerOrCoOwner(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner or co-owners can manage disabled commands.').setColor(0xe74c3c)] });
    }
    
    if (args.length === 0) {
      // Show current disabled commands
      try {
        const { data, error } = await supabase
          .from('guild_configs')
          .select('disabled_commands')
          .eq('guild_id', msg.guild.id)
          .single();
        
        const disabledCommands = data?.disabled_commands || [];
        const allCommands = { ...AVAILABLE_COMMANDS.prefix, ...AVAILABLE_COMMANDS.slash };
        
        const embed = new EmbedBuilder()
          .setTitle('Disabled Commands')
          .setDescription(disabledCommands.length > 0 ? disabledCommands.join(', ') : 'No commands are currently disabled')
          .addFields(
            { name: 'Total Disabled', value: `${disabledCommands.length} commands`, inline: true },
            { name: 'Available Commands', value: `${Object.keys(allCommands).length} total`, inline: true },
            { name: 'Usage', value: ';disable-commands add command1,command2,reset', inline: false }
          )
          .setColor(0x3498db)
          .setTimestamp();
        
        return msg.reply({ embeds: [embed] });
      } catch (e) {
        console.error('Disable-commands check error:', e);
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to check disabled commands.').setColor(0xe74c3c)] });
      }
    }
    
    const action = args[0].toLowerCase();
    const commands = args.slice(1).join(' ').split(',').map(cmd => cmd.trim()).filter(Boolean);
    
    if (!['add', 'remove', 'list', 'clear'].includes(action)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Action').setDescription('Valid actions: add, remove, list, clear').setColor(0xe74c3c)] });
    }
    
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('disabled_commands')
        .eq('guild_id', msg.guild.id)
        .single();
      
      let currentDisabled = data?.disabled_commands || [];
      
      switch (action) {
        case 'add':
          if (commands.length === 0) {
            return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';disable-commands add command1,command2,command3').setColor(0xe74c3c)] });
          }
          
          // Validate commands
          const allCommands = { ...AVAILABLE_COMMANDS.prefix, ...AVAILABLE_COMMANDS.slash };
          const invalidCommands = commands.filter(cmd => !allCommands[cmd]);
          
          if (invalidCommands.length > 0) {
            const embed = new EmbedBuilder()
              .setTitle('Invalid Commands')
              .setDescription(`The following commands are not valid:\n**${invalidCommands.join(', ')}**`)
              .addFields(
                { name: 'Available Commands', value: Object.keys(allCommands).slice(0, 20).join(', ') + (Object.keys(allCommands).length > 20 ? '...' : ''), inline: false },
                { name: 'Usage', value: ';disable-commands add command1,command2,reset', inline: false }
              )
              .setColor(0xe74c3c);
            return msg.reply({ embeds: [embed] });
          }
          
          currentDisabled = [...new Set([...currentDisabled, ...commands])];
          break;
          
        case 'remove':
          if (commands.length === 0) {
            return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';disable-commands remove command1,command2,command3').setColor(0xe74c3c)] });
          }
          
          currentDisabled = currentDisabled.filter(cmd => !commands.includes(cmd));
          break;
          
        case 'clear':
          currentDisabled = [];
          break;
          
        case 'list':
          const embed = new EmbedBuilder()
            .setTitle('All Available Commands')
            .addFields(
              { name: 'Prefix Commands', value: Object.keys(AVAILABLE_COMMANDS.prefix).join(', '), inline: false },
              { name: 'Slash Commands', value: Object.keys(AVAILABLE_COMMANDS.slash).join(', '), inline: false }
            )
            .setColor(0x3498db)
            .setTimestamp();
          return msg.reply({ embeds: [embed] });
      }
      
      // Save updated disabled commands
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        disabled_commands: currentDisabled
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Commands Updated')
        .setDescription(`**Action:** ${action}`)
        .addFields(
          { name: 'Disabled Commands', value: currentDisabled.length > 0 ? currentDisabled.join(', ') : 'None', inline: false },
          { name: 'Total Disabled', value: `${currentDisabled.length} commands`, inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Disable-commands error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to update disabled commands.').setColor(0xe74c3c)] });
    }
  },

  ticketsetup: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';ticketsetup #channel\n\nThis will create a ticket panel in the specified channel where users can click buttons to open tickets.\n\nUse /ticketsetup for more detailed configuration.').setColor(0xe74c3c)] });
    }
    
    try {
      // Save basic ticket configuration
      await supabase.from('ticket_configs').upsert({
        guild_id: msg.guild.id,
        channel_id: channel.id,
        title: '🎫 Support Tickets',
        description: 'Click the button below to create a support ticket.\nOur staff will assist you as soon as possible.',
        color: '#5865f2'
      }, { onConflict: ['guild_id'] });
      
      // Create ticket panel embed
      const embed = new EmbedBuilder()
        .setTitle('🎫 Support Tickets')
        .setDescription('Click the button below to create a support ticket.\nOur staff will assist you as soon as possible.')
        .setColor(0x5865f2)
        .setFooter({ text: 'Support Ticket System' })
        .setTimestamp();
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );
      
      await channel.send({ embeds: [embed], components: [row] });
      
      const successEmbed = new EmbedBuilder()
        .setTitle('Ticket Panel Created')
        .setDescription(`Ticket panel has been created in ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [successEmbed] });
    } catch (e) {
      console.error('Ticket setup error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to create ticket panel.').setColor(0xe74c3c)] });
    }
  },

  'co-owners': async (msg, args) => {
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can manage co-owners.').setColor(0xe74c3c)] });
    }
    
    if (args.length === 0) {
      // Show current co-owners
      try {
        const { data, error } = await supabase
          .from('guild_configs')
          .select('co_owner_1_id, co_owner_2_id')
          .eq('guild_id', msg.guild.id)
          .single();
        
        if (error) throw error;
        
        const coOwners = [];
        if (data?.co_owner_1_id) coOwners.push(data.co_owner_1_id);
        if (data?.co_owner_2_id) coOwners.push(data.co_owner_2_id);
        
        const embed = new EmbedBuilder()
          .setTitle('Co-Owners')
          .setDescription(coOwners.length > 0 ? coOwners.map(id => `<@${id}> (${id})`).join('\n') : 'No co-owners set')
          .addFields(
            { name: 'Total Co-Owners', value: `${coOwners.length}/2`, inline: true },
            { name: 'Usage', value: '&co-owners add/remove @user\n&add-co-owner @user\n&remove-co-owner @user', inline: false }
          )
          .setColor(0x3498db)
          .setTimestamp();
        
        return msg.reply({ embeds: [embed] });
      } catch (e) {
        console.error('Co-owners check error:', e);
        return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to check co-owners.').setColor(0xe74c3c)] });
      }
    }
    
    const action = args[0].toLowerCase();
    const user = msg.mentions.users.first();
    
    if (!['add', 'remove', 'list'].includes(action)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Action').setDescription('Valid actions: add, remove, list').setColor(0xe74c3c)] });
    }
    
    if (action !== 'list' && !user) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a user.\nUsage: `&co-owners add/remove @user`').setColor(0xe74c3c)] });
    }
    
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('co_owner_1_id, co_owner_2_id')
        .eq('guild_id', msg.guild.id)
        .single();
      
      if (error) throw error;
      
      let coOwner1 = data?.co_owner_1_id || null;
      let coOwner2 = data?.co_owner_2_id || null;
      
      switch (action) {
        case 'add':
          if (coOwner1 === user.id || coOwner2 === user.id) {
            return msg.reply({ embeds: [new EmbedBuilder().setTitle('Already Co-Owner').setDescription(`${user} is already a co-owner.`).setColor(0xe74c3c)] });
          }
          
          if (coOwner1 && coOwner2) {
            return msg.reply({ embeds: [new EmbedBuilder().setTitle('Limit Reached').setDescription('Maximum of 2 co-owners allowed. Remove one first.').setColor(0xe74c3c)] });
          }
          
          if (!coOwner1) {
            coOwner1 = user.id;
          } else {
            coOwner2 = user.id;
          }
          break;
          
        case 'remove':
          if (coOwner1 === user.id) {
            coOwner1 = null;
          } else if (coOwner2 === user.id) {
            coOwner2 = null;
          } else {
            return msg.reply({ embeds: [new EmbedBuilder().setTitle('Not Co-Owner').setDescription(`${user} is not a co-owner.`).setColor(0xe74c3c)] });
          }
          break;
          
        case 'list':
          const coOwners = [];
          if (coOwner1) coOwners.push(coOwner1);
          if (coOwner2) coOwners.push(coOwner2);
          
          const listEmbed = new EmbedBuilder()
            .setTitle('Current Co-Owners')
            .setDescription(coOwners.length > 0 ? coOwners.map(id => `<@${id}> (${id})`).join('\n') : 'No co-owners set')
            .addFields(
              { name: 'Total Co-Owners', value: `${coOwners.length}/2`, inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp();
          
          return msg.reply({ embeds: [listEmbed] });
      }
      
      // Save updated co-owners
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        co_owner_1_id: coOwner1,
        co_owner_2_id: coOwner2
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Co-Owners Updated')
        .setDescription(`**Action:** ${action}${user ? ` ${user}` : ''}`)
        .addFields(
          { name: 'Co-Owner 1', value: coOwner1 ? `<@${coOwner1}> (${coOwner1})` : 'None', inline: true },
          { name: 'Co-Owner 2', value: coOwner2 ? `<@${coOwner2}> (${coOwner2})` : 'None', inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Co-owners error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to update co-owners.').setColor(0xe74c3c)] });
    }
  },

  'add-co-owner': async (msg, args) => {
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can add co-owners.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a user to add as co-owner.\nUsage: `&add-co-owner @user`').setColor(0xe74c3c)] });
    }
    
    // Call the co-owners command with add action
    return prefixCommands['co-owners'](msg, ['add', user.id]);
  },

  'remove-co-owner': async (msg, args) => {
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can remove co-owners.').setColor(0xe74c3c)] });
    }
    
    const user = msg.mentions.users.first();
    if (!user) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a user to remove as co-owner.\nUsage: `&remove-co-owner @user`').setColor(0xe74c3c)] });
    }
    
    // Call the co-owners command with remove action
    return prefixCommands['co-owners'](msg, ['remove', user.id]);
  },

  'feedback-channel': async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a channel.\nUsage: `&feedback-channel #channel`').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        feedback_channel_id: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Feedback Channel Set')
        .setDescription(`Anonymous feedback will now be sent to ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Feedback channel error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to set feedback channel.').setColor(0xe74c3c)] });
    }
  },

  'modmail-channel': async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a channel.\nUsage: `&modmail-channel #channel`').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        modmail_channel_id: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Modmail Channel Set')
        .setDescription(`Modmail threads will now be created in ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Modmail channel error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to set modmail channel.').setColor(0xe74c3c)] });
    }
  },

  'mod-role': async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const role = msg.mentions.roles.first();
    if (!role) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a role.\nUsage: `&mod-role @role`').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        mod_role_id: role.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Mod Role Set')
        .setDescription(`${role} will be pinged during panic mode`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Mod role error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to set mod role.').setColor(0xe74c3c)] });
    }
  },

  'report-channel': async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('Please mention a channel.\nUsage: `&report-channel #channel`').setColor(0xe74c3c)] });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        report_channel_id: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Report Channel Set')
        .setDescription(`User reports will now be sent to ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Report channel error:', e);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to set report channel.').setColor(0xe74c3c)] });
    }
  }
};

// Slash commands
const slashCommands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure server settings and enable/disable commands')
    .addRoleOption(opt => opt.setName('adminrole').setDescription('Primary admin role').setRequired(true))
    .addRoleOption(opt => opt.setName('extra1').setDescription('Extra admin role 1').setRequired(false))
    .addRoleOption(opt => opt.setName('extra2').setDescription('Extra admin role 2').setRequired(false))
    .addRoleOption(opt => opt.setName('extra3').setDescription('Extra admin role 3').setRequired(false))
    .addStringOption(opt => opt.setName('disabled').setDescription('Comma-separated list of commands to disable').setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('disable-commands')
    .setDescription('Manage disabled commands for this server')
    .addStringOption(opt => opt.setName('action').setDescription('Action to perform').addChoices(
      { name: 'Add Commands', value: 'add' },
      { name: 'Remove Commands', value: 'remove' },
      { name: 'Clear All', value: 'clear' },
      { name: 'List All', value: 'list' },
      { name: 'Show Current', value: 'current' },
      { name: 'Show Enabled', value: 'enabled' }
    ).setRequired(false))
    .addStringOption(opt => opt.setName('commands').setDescription('Comma-separated list of commands').setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('logchannel')
    .setDescription('Set the log channel for moderation actions')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for logs').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something as an embed')
    .addStringOption(opt => opt.setName('message').setDescription('Message to say').setRequired(true))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color (optional)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('reset-config')
    .setDescription('Reset server configuration to defaults (owner only)'),

  new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Set the autorole for new members')
    .addRoleOption(opt => opt.setName('role').setDescription('Role to assign to new members').setRequired(false)),

  new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Set custom command prefix for this server (owner only)')
    .addStringOption(opt => opt.setName('new_prefix').setDescription('New prefix (max 5 chars, no spaces)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Show comprehensive server configuration'),

  new SlashCommandBuilder()
    .setName('ticketsetup')
    .setDescription('Setup ticket system')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for ticket panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Ticket panel title').setRequired(false))
    .addStringOption(opt => opt.setName('description').setDescription('Ticket panel description').setRequired(false))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color for embed').setRequired(false))
    .addRoleOption(opt => opt.setName('staff_role').setDescription('Role to ping when tickets are created').setRequired(false))
    .addChannelOption(opt => opt.setName('category').setDescription('Category for ticket channels').addChannelTypes(ChannelType.GuildCategory).setRequired(false)),

  new SlashCommandBuilder()
    .setName('showsetup')
    .setDescription('Show available setup actions and current configuration'),

  new SlashCommandBuilder()
    .setName('co-owners')
    .setDescription('Manage co-owners for bot setup and management')
    .addStringOption(opt => opt.setName('action').setDescription('Action to perform').addChoices(
      { name: 'Add Co-Owner', value: 'add' },
      { name: 'Remove Co-Owner', value: 'remove' },
      { name: 'List Co-Owners', value: 'list' }
    ).setRequired(false))
    .addUserOption(opt => opt.setName('user').setDescription('User to add/remove as co-owner').setRequired(false)),

  new SlashCommandBuilder()
    .setName('add-co-owner')
    .setDescription('Add a co-owner to help with bot management')
    .addUserOption(opt => opt.setName('user').setDescription('User to add as co-owner').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove-co-owner')
    .setDescription('Remove a co-owner')
    .addUserOption(opt => opt.setName('user').setDescription('User to remove as co-owner').setRequired(true)),

  new SlashCommandBuilder()
    .setName('feedback-channel')
    .setDescription('Set the channel where anonymous feedback is sent')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for feedback').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('modmail-channel')
    .setDescription('Set the channel where modmail threads are created')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for modmail').addChannelTypes(ChannelType.GuildText).setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('mod-role')
    .setDescription('Set the role to ping during panic mode')
    .addRoleOption(opt => opt.setName('role').setDescription('Role to ping').setRequired(true)),
  
  new SlashCommandBuilder()
    .setName('report-channel')
    .setDescription('Set the channel where user reports are sent')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for reports').addChannelTypes(ChannelType.GuildText).setRequired(true))
];

// Slash command handlers
const slashHandlers = {
  setup: async (interaction) => {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can run this command.', ephemeral: true });
    }
    
    const adminRole = interaction.options.getRole('adminrole').id;
    const extraRoles = [
      interaction.options.getRole('extra1')?.id,
      interaction.options.getRole('extra2')?.id,
      interaction.options.getRole('extra3')?.id
    ].filter(Boolean);
    
    const disabledCommands = interaction.options.getString('disabled')?.split(',').map(c => c.trim()).filter(Boolean) || [];
    
    // Validate commands if provided
    if (disabledCommands.length > 0) {
      const allCommands = { ...AVAILABLE_COMMANDS.prefix, ...AVAILABLE_COMMANDS.slash };
      const invalidCommands = disabledCommands.filter(cmd => !allCommands[cmd]);
      
      if (invalidCommands.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle('Invalid Commands')
          .setDescription(`The following commands are not valid:\n**${invalidCommands.join(', ')}**`)
          .addFields(
            { name: 'Available Commands', value: Object.keys(allCommands).slice(0, 20).join(', ') + (Object.keys(allCommands).length > 20 ? '...' : ''), inline: false },
            { name: 'Usage', value: 'Use `/disable-commands list` to see all available commands', inline: false }
          )
          .setColor(0xe74c3c);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        admin_role_id: adminRole,
        extra_role_ids: extraRoles,
        disabled_commands: disabledCommands
      });
      
      const embed = new EmbedBuilder()
        .setTitle('Setup Complete')
        .setDescription(`**Admin Role:** <@&${adminRole}>\n**Extra Roles:** ${extraRoles.map(r => `<@&${r}>`).join(', ') || 'None'}`)
        .addFields(
          { name: 'Disabled Commands', value: disabledCommands.length > 0 ? disabledCommands.join(', ') : 'None', inline: false },
          { name: 'Total Disabled', value: `${disabledCommands.length} commands`, inline: true },
          { name: 'Available Commands', value: `${Object.keys(AVAILABLE_COMMANDS.prefix).length + Object.keys(AVAILABLE_COMMANDS.slash).length} total`, inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Setup error:', e.message || JSON.stringify(e));
      return interaction.reply({ content: 'Failed to save configuration.', ephemeral: true });
    }
  },
  
  logchannel: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        log_channel: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Log Channel Set')
        .setDescription(`Log channel set to ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Logchannel error:', e);
      return interaction.reply({ content: 'Failed to set log channel.', ephemeral: true });
    }
  },
  
  say: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    const message = interaction.options.getString('message');
    let color = interaction.options.getString('color') || '7289da';
    if (color.startsWith('#')) color = color.slice(1);
    let colorInt = parseInt(color, 16);
    if (isNaN(colorInt)) colorInt = 0x7289da;
    const embed = new EmbedBuilder()
      .setDescription(message)
      .setColor(colorInt)
      .setTimestamp();
    return interaction.reply({ embeds: [embed] });
  },

  'reset-config': async (interaction) => {
    if (!await isOwnerOrCoOwner(interaction.member)) {
      return interaction.reply({ content: 'Only the server owner or co-owners can reset the configuration.', ephemeral: true });
    }
    
    try {
      await supabase.from('guild_configs').delete().eq('guild_id', interaction.guild.id);
      
      const embed = new EmbedBuilder()
        .setTitle('Configuration Reset')
        .setDescription('Server configuration has been reset to defaults.')
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Reset-config error:', e);
      return interaction.reply({ content: 'Failed to reset configuration.', ephemeral: true });
    }
  },

  autorole: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const role = interaction.options.getRole('role');
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        autorole: role?.id || null
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Autorole Updated')
        .setDescription(role ? `Autorole set to ${role}` : 'Autorole disabled')
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Autorole error:', e);
      return interaction.reply({ content: 'Failed to update autorole.', ephemeral: true });
    }
  },

  'disable-commands': async (interaction) => {
    if (!await isOwnerOrCoOwner(interaction.member)) {
      return interaction.reply({ content: 'Only the server owner or co-owners can manage disabled commands.', ephemeral: true });
    }
    
    const action = interaction.options.getString('action');
    const commands = interaction.options.getString('commands')?.split(',').map(cmd => cmd.trim()).filter(Boolean) || [];
    
    if (!['add', 'remove', 'list', 'clear'].includes(action)) {
      return interaction.reply({ content: 'Invalid action. Valid actions: add, remove, list, clear', ephemeral: true });
    }
    
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('disabled_commands')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      if (error) throw error;
      
      let currentDisabled = data?.disabled_commands || [];
      
      switch (action) {
        case 'add':
          if (commands.length === 0) {
            return interaction.reply({ content: 'Please provide commands to add', ephemeral: true });
          }
          
          // Validate commands
          const allCommands = { ...AVAILABLE_COMMANDS.prefix, ...AVAILABLE_COMMANDS.slash };
          const invalidCommands = commands.filter(cmd => !allCommands[cmd]);
          
          if (invalidCommands.length > 0) {
            const embed = new EmbedBuilder()
              .setTitle('Invalid Commands')
              .setDescription(`The following commands are not valid:\n**${invalidCommands.join(', ')}**`)
              .addFields(
                { name: 'Available Commands', value: Object.keys(allCommands).slice(0, 20).join(', ') + (Object.keys(allCommands).length > 20 ? '...' : ''), inline: false },
                { name: 'Usage', value: 'Use `/disable-commands add command1,command2,reset` to add commands', inline: false }
              )
              .setColor(0xe74c3c);
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          
          currentDisabled = [...new Set([...currentDisabled, ...commands])];
          break;
          
        case 'remove':
          if (commands.length === 0) {
            return interaction.reply({ content: 'Please provide commands to remove', ephemeral: true });
          }
          
          currentDisabled = currentDisabled.filter(cmd => !commands.includes(cmd));
          break;
          
        case 'clear':
          currentDisabled = [];
          break;
          
        case 'list':
          const embed = new EmbedBuilder()
            .setTitle('All Available Commands')
            .addFields(
              { name: 'Prefix Commands', value: Object.keys(AVAILABLE_COMMANDS.prefix).join(', '), inline: false },
              { name: 'Slash Commands', value: Object.keys(AVAILABLE_COMMANDS.slash).join(', '), inline: false }
            )
            .setColor(0x3498db)
            .setTimestamp();
          return interaction.reply({ embeds: [embed], ephemeral: true });
      }
      
      // Save updated disabled commands
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        disabled_commands: currentDisabled
      }, { onConflict: ['guild_id'] });
      
      const updatedEmbed = new EmbedBuilder()
        .setTitle('Commands Updated')
        .setDescription(`**Action:** ${action}`)
        .addFields(
          { name: 'Disabled Commands', value: currentDisabled.length > 0 ? currentDisabled.join(', ') : 'None', inline: false },
          { name: 'Total Disabled', value: `${currentDisabled.length} commands`, inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [updatedEmbed], ephemeral: true });
    } catch (e) {
      console.error('Disable-commands error:', e);
      return interaction.reply({ content: 'Failed to update disabled commands.', ephemeral: true });
    }
  },

  prefix: async (interaction) => {
    if (!await isOwnerOrCoOwner(interaction.member)) {
      return interaction.reply({ content: 'Only the server owner or co-owners can change the command prefix.', ephemeral: true });
    }
    
    const newPrefix = interaction.options.getString('new_prefix');
    
    if (!newPrefix) {
      // Show current prefix
      try {
        const { data, error } = await supabase
          .from('guild_configs')
          .select('custom_prefix')
          .eq('guild_id', interaction.guild.id)
          .single();
        
        const currentPrefix = data?.custom_prefix || '; or & (default)';
        
        const embed = new EmbedBuilder()
          .setTitle('Current Prefix')
          .setDescription(`Current command prefix: **${currentPrefix}**`)
          .addFields(
            { name: 'Usage', value: '/prefix new_prefix:<prefix>\nExample: /prefix new_prefix:!\nUse /prefix new_prefix:reset to use defaults', inline: false }
          )
          .setColor(0x3498db)
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        console.error('Prefix check error:', e);
        return interaction.reply({ content: 'Failed to check current prefix.', ephemeral: true });
      }
    }
    
    if (newPrefix === 'reset') {
      // Reset to default prefixes
      try {
        await supabase.from('guild_configs').upsert({
          guild_id: interaction.guild.id,
          custom_prefix: null
        }, { onConflict: ['guild_id'] });
        
        const embed = new EmbedBuilder()
          .setTitle('Prefix Reset')
          .setDescription('Command prefix reset to defaults (; and &)')
          .setColor(0x2ecc71)
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        console.error('Prefix reset error:', e);
        return interaction.reply({ content: 'Failed to reset prefix.', ephemeral: true });
      }
    }
    
    // Validate prefix
    if (newPrefix.length > 5) {
      return interaction.reply({ content: 'Prefix must be 5 characters or less.', ephemeral: true });
    }
    
    if (newPrefix.includes(' ')) {
      return interaction.reply({ content: 'Prefix cannot contain spaces.', ephemeral: true });
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        custom_prefix: newPrefix
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Prefix Updated')
        .setDescription(`Command prefix set to: **${newPrefix}**`)
        .addFields(
          { name: 'Example', value: `${newPrefix}ping`, inline: true },
          { name: 'Reset', value: 'Use /prefix new_prefix:reset to use defaults', inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Prefix set error:', e);
      return interaction.reply({ content: 'Failed to set prefix.', ephemeral: true });
    }
  },

  config: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    try {
      // Get main guild config
      const { data, error } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      // Get welcome config
      const { data: welcome } = await supabase
        .from('welcome_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      // Get goodbye config
      const { data: goodbye } = await supabase
        .from('goodbye_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      // Get ticket config
      const { data: ticket } = await supabase
        .from('ticket_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      if (!data && !welcome && !goodbye && !ticket) {
        return interaction.reply({ content: 'No configuration found. Use `/setup` to configure the bot.', ephemeral: true });
      }
      
      const embed = new EmbedBuilder()
        .setTitle(`Server Configuration - ${interaction.guild.name}`)
        .setColor(0x3498db)
        .setTimestamp();
      
      // Basic Settings - Combine into fewer fields
      if (data) {
        const adminRole = data.admin_role_id ? `<@&${data.admin_role_id}>` : 'Not set';
        const extraRoles = data.extra_role_ids?.length ? data.extra_role_ids.map(r => `<@&${r}>`).join(', ') : 'None';
        const logChannel = data.log_channel ? `<#${data.log_channel}>` : 'Not set';
        const autorole = data.autorole ? `<@&${data.autorole}>` : 'Not set';
        const prefix = data.custom_prefix ? `**${data.custom_prefix}**` : '; or & (default)';
        
        embed.addFields(
          { name: '🔧 Basic Settings', value: 'Server configuration and permissions', inline: false },
          { name: 'Admin Role', value: adminRole, inline: true },
          { name: 'Extra Roles', value: extraRoles, inline: true },
          { name: 'Log Channel', value: logChannel, inline: true },
          { name: 'Autorole', value: autorole, inline: true },
          { name: 'Custom Prefix', value: prefix, inline: true }
        );
        
        if (data.disabled_commands?.length) {
          embed.addFields(
            { name: '🚫 Disabled Commands', value: `${data.disabled_commands.length} commands: ${data.disabled_commands.join(', ')}`, inline: false }
          );
        }
      }
      
      // Welcome & Goodbye Settings - Combine into one section
      const welcomeStatus = welcome && welcome.enabled ? '✅ Enabled' : '❌ Disabled';
      const goodbyeStatus = goodbye && goodbye.enabled ? '✅ Enabled' : '❌ Disabled';
      
      embed.addFields(
        { name: '👋 Welcome & Goodbye', value: 'Message system status', inline: false },
        { name: 'Welcome', value: welcomeStatus, inline: true },
        { name: 'Goodbye', value: goodbyeStatus, inline: true }
      );
      
      // Ticket Settings - Simplified
      if (ticket) {
        embed.addFields(
          { name: '🎫 Ticket System', value: 'Support ticket configuration', inline: false },
          { name: 'Panel Channel', value: ticket.channel_id ? `<#${ticket.channel_id}>` : 'Not set', inline: true },
          { name: 'Staff Role', value: ticket.staff_role_id ? `<@&${ticket.staff_role_id}>` : 'None', inline: true }
        );
      } else {
        embed.addFields({ name: '🎫 Ticket System', value: '❌ Not configured', inline: false });
      }
      
      // Server Info - Combine into one field
      embed.addFields(
        { name: '📊 Server Statistics', value: `Members: ${interaction.guild.memberCount} | Channels: ${interaction.guild.channels.cache.size} | Roles: ${interaction.guild.roles.cache.size}`, inline: false }
      );
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Config error:', e);
      return interaction.reply({ content: 'Failed to fetch configuration.', ephemeral: true });
    }
  },

  ticketsetup: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title') || '🎫 Support Tickets';
    const description = interaction.options.getString('description') || 'Click the button below to create a support ticket.\nOur staff will assist you as soon as possible.';
    const color = interaction.options.getString('color') || '#5865f2';
    const staffRole = interaction.options.getRole('staff_role');
    const category = interaction.options.getChannel('category');
    
    try {
      // Save ticket configuration
      await supabase.from('ticket_configs').upsert({
        guild_id: interaction.guild.id,
        channel_id: channel.id,
        title: title,
        description: description,
        color: color,
        staff_role_id: staffRole?.id,
        category_id: category?.id
      }, { onConflict: ['guild_id'] });
      
      // Create ticket panel embed
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setFooter({ text: 'Support Ticket System' })
        .setTimestamp();
      
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Ticket')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎫')
        );
      
      await channel.send({ embeds: [embed], components: [row] });
      
      const successEmbed = new EmbedBuilder()
        .setTitle('Ticket Panel Created')
        .setDescription(`Ticket panel has been created in ${channel}`)
        .addFields(
          { name: 'Staff Role', value: staffRole ? staffRole.toString() : 'None', inline: true },
          { name: 'Category', value: category ? category.name : 'None', inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (e) {
      console.error('Ticket setup error:', e);
      return interaction.reply({ content: 'Failed to create ticket panel.', ephemeral: true });
    }
  },

  showsetup: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    try {
      // Get main guild config
      const { data, error } = await supabase
        .from('guild_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      // Get welcome config
      const { data: welcome } = await supabase
        .from('welcome_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      // Get goodbye config
      const { data: goodbye } = await supabase
        .from('goodbye_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      // Get ticket config
      const { data: ticket } = await supabase
        .from('ticket_configs')
        .select('*')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      const { prefixCount, slashCount, totalCount } = getCommandCount();
      
      const embed = new EmbedBuilder()
        .setTitle('Server Configuration')
        .addFields(
          { name: 'Admin Role', value: data?.admin_role_id ? `<@&${data.admin_role_id}>` : 'Not set', inline: true },
          { name: 'Extra Roles', value: data?.extra_role_ids?.length > 0 ? data.extra_role_ids.map(r => `<@&${r}>`).join(', ') : 'None', inline: true },
          { name: 'Custom Prefix', value: data?.custom_prefix || 'Default (; and &)', inline: true },
          { name: 'Log Channel', value: data?.log_channel ? `<#${data.log_channel}>` : 'Not set', inline: true },
          { name: 'Autorole', value: data?.autorole_id ? `<@&${data.autorole_id}>` : 'Not set', inline: true },
          { name: 'Disabled Commands', value: data?.disabled_commands?.length > 0 ? `${data.disabled_commands.length} commands` : 'None', inline: true },
          { name: 'Feedback Channel', value: data?.feedback_channel_id ? `<#${data.feedback_channel_id}>` : 'Not set', inline: true },
          { name: 'Modmail Channel', value: data?.modmail_channel_id ? `<#${data.modmail_channel_id}>` : 'Not set', inline: true },
          { name: 'Report Channel', value: data?.report_channel_id ? `<#${data.report_channel_id}>` : 'Not set', inline: true },
          { name: 'Mod Role', value: data?.mod_role_id ? `<@&${data.mod_role_id}>` : 'Not set', inline: true },
          { name: 'Welcome Channel', value: welcome?.channel_id ? `<#${welcome.channel_id}>` : 'Not set', inline: true },
          { name: 'Goodbye Channel', value: goodbye?.channel_id ? `<#${goodbye.channel_id}>` : 'Not set', inline: true },
          { name: 'Ticket Channel', value: ticket?.channel_id ? `<#${ticket.channel_id}>` : 'Not set', inline: true },
          { name: 'Total Commands', value: `${totalCount} (${prefixCount} prefix, ${slashCount} slash)`, inline: true },
          { name: 'Available Setup Actions', value: '`/setup`, `/disable-commands`, `/logchannel`, `/autorole`, `/prefix`, `/reset-config`, `/ticketsetup`, `/feedback-channel`, `/modmail-channel`, `/mod-role`, `/report-channel`', inline: false }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Showsetup error:', e);
      return interaction.reply({ content: 'Failed to fetch setup configuration.', ephemeral: true });
    }
  },

  'co-owners': async (interaction) => {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can manage co-owners.', ephemeral: true });
    }
    
    const action = interaction.options.getString('action');
    const user = interaction.options.getUser('user');
    
    if (!action) {
      // Show current co-owners
      try {
        const { data, error } = await supabase
          .from('guild_configs')
          .select('co_owner_1_id, co_owner_2_id')
          .eq('guild_id', interaction.guild.id)
          .single();
        
        if (error) throw error;
        
        const coOwners = [];
        if (data?.co_owner_1_id) coOwners.push(data.co_owner_1_id);
        if (data?.co_owner_2_id) coOwners.push(data.co_owner_2_id);
        
        const embed = new EmbedBuilder()
          .setTitle('Co-Owners')
          .setDescription(coOwners.length > 0 ? coOwners.map(id => `<@${id}> (${id})`).join('\n') : 'No co-owners set')
          .addFields(
            { name: 'Total Co-Owners', value: `${coOwners.length}/2`, inline: true },
            { name: 'Usage', value: 'Use the action dropdown to add/remove co-owners', inline: false }
          )
          .setColor(0x3498db)
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        console.error('Co-owners check error:', e);
        return interaction.reply({ content: 'Failed to check co-owners.', ephemeral: true });
      }
    }
    
    if (!user) {
      return interaction.reply({ content: 'Please select a user.', ephemeral: true });
    }
    
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('co_owner_1_id, co_owner_2_id')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      if (error) throw error;
      
      let coOwner1 = data?.co_owner_1_id || null;
      let coOwner2 = data?.co_owner_2_id || null;
      
      switch (action) {
        case 'add':
          if (coOwner1 === user.id || coOwner2 === user.id) {
            return interaction.reply({ content: `${user} is already a co-owner.`, ephemeral: true });
          }
          
          if (coOwner1 && coOwner2) {
            return interaction.reply({ content: 'Maximum of 2 co-owners allowed. Remove one first.', ephemeral: true });
          }
          
          if (!coOwner1) {
            coOwner1 = user.id;
          } else {
            coOwner2 = user.id;
          }
          break;
          
        case 'remove':
          if (coOwner1 === user.id) {
            coOwner1 = null;
          } else if (coOwner2 === user.id) {
            coOwner2 = null;
          } else {
            return interaction.reply({ content: `${user} is not a co-owner.`, ephemeral: true });
          }
          break;
          
        case 'list':
          const coOwners = [];
          if (coOwner1) coOwners.push(coOwner1);
          if (coOwner2) coOwners.push(coOwner2);
          
          const listEmbed = new EmbedBuilder()
            .setTitle('Current Co-Owners')
            .setDescription(coOwners.length > 0 ? coOwners.map(id => `<@${id}> (${id})`).join('\n') : 'No co-owners set')
            .addFields(
              { name: 'Total Co-Owners', value: `${coOwners.length}/2`, inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp();
          
          return interaction.reply({ embeds: [listEmbed], ephemeral: true });
      }
      
      // Save updated co-owners
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        co_owner_1_id: coOwner1,
        co_owner_2_id: coOwner2
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Co-Owners Updated')
        .setDescription(`**Action:** ${action} ${user}`)
        .addFields(
          { name: 'Co-Owner 1', value: coOwner1 ? `<@${coOwner1}> (${coOwner1})` : 'None', inline: true },
          { name: 'Co-Owner 2', value: coOwner2 ? `<@${coOwner2}> (${coOwner2})` : 'None', inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Co-owners error:', e);
      return interaction.reply({ content: 'Failed to update co-owners.', ephemeral: true });
    }
  },

  'add-co-owner': async (interaction) => {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can add co-owners.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('co_owner_1_id, co_owner_2_id')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      if (error) throw error;
      
      let coOwner1 = data?.co_owner_1_id || null;
      let coOwner2 = data?.co_owner_2_id || null;
      
      if (coOwner1 === user.id || coOwner2 === user.id) {
        return interaction.reply({ content: `${user} is already a co-owner.`, ephemeral: true });
      }
      
      if (coOwner1 && coOwner2) {
        return interaction.reply({ content: 'Maximum of 2 co-owners allowed. Remove one first.', ephemeral: true });
      }
      
      if (!coOwner1) {
        coOwner1 = user.id;
      } else {
        coOwner2 = user.id;
      }
      
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        co_owner_1_id: coOwner1,
        co_owner_2_id: coOwner2
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Co-Owner Added')
        .setDescription(`${user} has been added as a co-owner.`)
        .addFields(
          { name: 'Co-Owner 1', value: coOwner1 ? `<@${coOwner1}> (${coOwner1})` : 'None', inline: true },
          { name: 'Co-Owner 2', value: coOwner2 ? `<@${coOwner2}> (${coOwner2})` : 'None', inline: true }
        )
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Add co-owner error:', e);
      return interaction.reply({ content: 'Failed to add co-owner.', ephemeral: true });
    }
  },

  'remove-co-owner': async (interaction) => {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can remove co-owners.', ephemeral: true });
    }
    
    const user = interaction.options.getUser('user');
    
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('co_owner_1_id, co_owner_2_id')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      if (error) throw error;
      
      let coOwner1 = data?.co_owner_1_id || null;
      let coOwner2 = data?.co_owner_2_id || null;
      
      if (coOwner1 === user.id) {
        coOwner1 = null;
      } else if (coOwner2 === user.id) {
        coOwner2 = null;
      } else {
        return interaction.reply({ content: `${user} is not a co-owner.`, ephemeral: true });
      }
      
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        co_owner_1_id: coOwner1,
        co_owner_2_id: coOwner2
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Co-Owner Removed')
        .setDescription(`${user} has been removed as a co-owner.`)
        .addFields(
          { name: 'Co-Owner 1', value: coOwner1 ? `<@${coOwner1}> (${coOwner1})` : 'None', inline: true },
          { name: 'Co-Owner 2', value: coOwner2 ? `<@${coOwner2}> (${coOwner2})` : 'None', inline: true }
        )
        .setColor(0xe74c3c)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Remove co-owner error:', e);
      return interaction.reply({ content: 'Failed to remove co-owner.', ephemeral: true });
    }
  },

  'feedback-channel': async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        feedback_channel_id: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Feedback Channel Set')
        .setDescription(`Anonymous feedback will now be sent to ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Feedback channel error:', e);
      return interaction.reply({ content: 'Failed to set feedback channel.', ephemeral: true });
    }
  },

  'modmail-channel': async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        modmail_channel_id: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Modmail Channel Set')
        .setDescription(`Modmail threads will now be created in ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Modmail channel error:', e);
      return interaction.reply({ content: 'Failed to set modmail channel.', ephemeral: true });
    }
  },

  'mod-role': async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const role = interaction.options.getRole('role');
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        mod_role_id: role.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Mod Role Set')
        .setDescription(`${role} will be pinged during panic mode`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Mod role error:', e);
      return interaction.reply({ content: 'Failed to set mod role.', ephemeral: true });
    }
  },

  'report-channel': async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
        report_channel_id: channel.id
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Report Channel Set')
        .setDescription(`User reports will now be sent to ${channel}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Report channel error:', e);
      return interaction.reply({ content: 'Failed to set report channel.', ephemeral: true });
    }
  }
};

module.exports = {
  name: 'setup',
  prefixCommands,
  slashCommands,
  slashHandlers
}; 