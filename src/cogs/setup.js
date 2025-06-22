const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const { supabase } = require('../utils/supabase');

// Available commands for disabling
const AVAILABLE_COMMANDS = {
  // Prefix commands
  prefix: {
    // Setup commands
    setup: 'Configure server settings (owner only)',
    config: 'Show server configuration',
    logchannel: 'Set log channel',
    say: 'Make bot say something',
    'reset-config': 'Reset server configuration (owner only)',
    autorole: 'Set autorole for new members',
    prefix: 'Set custom command prefix (owner only)',
    'disable-commands': 'Manage disabled commands (owner only)',
    
    // Ticket System
    ticketsetup: 'Setup ticket system for support',
    
    // Moderation commands
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
    
    // Utility commands
    ls: 'List all text channels',
    ps: 'List all online members',
    whoami: 'Show your user info',
    ping: 'Check the bot\'s latency',
    uptime: 'Show bot uptime',
    server: 'Show server info',
    roles: 'List all roles',
    avatar: 'Show a user avatar',
    poll: 'Create a poll with reactions',
    help: 'Show help message',
    reset: 'Reset the command prefix to default (; and &)',
    spy: 'Secretly logs all messages from a specific user (admin only)',
    ghostping: 'Sends and deletes a ping instantly (for fun/testing mods)',
    sniper: 'Logs and shows deleted messages (message sniping)',
    revert: 'Removes user\'s last 10 messages (like a soft purge)',
    modview: 'View and filter mod actions, paginate with next/prev',
    shadowban: 'Bans without showing a ban message or logging (silent ban)',
    massban: 'Ban all users with a specific role',
    lock: 'Locks the channel',
    unlock: 'Unlocks the channel',
    passwd: 'Set, get, list, or remove a user codeword (&passwd @user <codeword> | &passwd @user | &passwd list | &passwd remove @user)',
    crontab: 'Schedule, list, or cancel commands (e.g., &crontab 5m say Hello)',
    top: 'Show top users by messages, infractions, or uptime (&top messages|infractions|uptime)',
    sysinfo: 'Show system and bot info (CPU, RAM, uptime, etc)',
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
            { name: 'Usage', value: ';setup @adminrole @extrarole1 @extrarole2 --disable command1,command2,command3', inline: false }
          )
          .setColor(0xe74c3c);
        return msg.reply({ embeds: [embed] });
      }
    }
    
    // Also check for old format (commands without --disable flag)
    const oldFormatCommands = args.filter(arg => !arg.startsWith('<@&') && !arg.startsWith('@') && arg !== '--disable' && !disabledCommands.includes(arg));
    if (oldFormatCommands.length > 0) {
      disabledCommands = [...new Set([...disabledCommands, ...oldFormatCommands])];
    }
    
    try {
      await supabase.from('guild_configs').upsert({
        guild_id: msg.guild.id,
        admin_role_id: adminRole.id,
        extra_role_ids: extraRoles,
        disabled_commands: disabledCommands
      });
      
      const embed = new EmbedBuilder()
        .setTitle('Setup Complete')
        .setDescription(`**Admin Role:** ${adminRole}\n**Extra Roles:** ${extraRoles.map(r => `<@&${r}>`).join(', ') || 'None'}`)
        .addFields(
          { name: 'Disabled Commands', value: disabledCommands.length > 0 ? disabledCommands.join(', ') : 'None', inline: false },
          { name: 'Total Disabled', value: `${disabledCommands.length} commands`, inline: true },
          { name: 'Available Commands', value: `${Object.keys(AVAILABLE_COMMANDS.prefix).length + Object.keys(AVAILABLE_COMMANDS.slash).length} total`, inline: true }
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
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can reset configuration.').setColor(0xe74c3c)] });
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
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can change the command prefix.').setColor(0xe74c3c)] });
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
    if (msg.author.id !== msg.guild.ownerId) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Only the server owner can manage disabled commands.').setColor(0xe74c3c)] });
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
    .addStringOption(opt => opt.setName('disabled').setDescription('Comma-separated list of commands to disable').setRequired(false))
    .addStringOption(opt => opt.setName('action').setDescription('Setup action to perform').addChoices(
      { name: 'Full Setup', value: 'full' },
      { name: 'Show Available Commands', value: 'list' },
      { name: 'Show Current Config', value: 'config' }
    ).setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('disable-commands')
    .setDescription('Manage disabled commands for this server')
    .addStringOption(opt => opt.setName('action').setDescription('Action to perform').addChoices(
      { name: 'Add Commands', value: 'add' },
      { name: 'Remove Commands', value: 'remove' },
      { name: 'Clear All', value: 'clear' },
      { name: 'List All', value: 'list' },
      { name: 'Show Current', value: 'current' }
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
    .addChannelOption(opt => opt.setName('category').setDescription('Category for ticket channels').addChannelTypes(ChannelType.GuildCategory).setRequired(false))
];

// Slash command handlers
const slashHandlers = {
  setup: async (interaction) => {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can run this command.', ephemeral: true });
    }
    
    const action = interaction.options.getString('action') || 'full';
    
    if (action === 'list') {
      // Show all available commands
      const embed = new EmbedBuilder()
        .setTitle('Available Commands')
        .addFields(
          { name: 'Prefix Commands', value: Object.keys(AVAILABLE_COMMANDS.prefix).join(', '), inline: false },
          { name: 'Slash Commands', value: Object.keys(AVAILABLE_COMMANDS.slash).join(', '), inline: false },
          { name: 'Total Commands', value: `${Object.keys(AVAILABLE_COMMANDS.prefix).length + Object.keys(AVAILABLE_COMMANDS.slash).length}`, inline: true }
        )
        .setColor(0x3498db)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    
    if (action === 'config') {
      // Show current configuration
      try {
        const { data, error } = await supabase
          .from('guild_configs')
          .select('*')
          .eq('guild_id', interaction.guild.id)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        if (!data) {
          return interaction.reply({ content: 'No configuration found. Use `/setup` to configure the bot.', ephemeral: true });
        }
        
        const embed = new EmbedBuilder()
          .setTitle('Server Configuration')
          .addFields(
            { name: 'Admin Role', value: data.admin_role_id ? `<@&${data.admin_role_id}>` : 'Not set', inline: true },
            { name: 'Extra Roles', value: data.extra_role_ids?.length ? data.extra_role_ids.map(r => `<@&${r}>`).join(', ') : 'None', inline: true },
            { name: 'Disabled Commands', value: data.disabled_commands?.length ? data.disabled_commands.join(', ') : 'None', inline: false },
            { name: 'Total Disabled', value: `${data.disabled_commands?.length || 0} commands`, inline: true },
            { name: 'Log Channel', value: data.log_channel ? `<#${data.log_channel}>` : 'Not set', inline: true },
            { name: 'Autorole', value: data.autorole ? `<@&${data.autorole}>` : 'Not set', inline: true },
            { name: 'Custom Prefix', value: data.custom_prefix ? `**${data.custom_prefix}**` : '; or & (default)', inline: true }
          )
          .setColor(0x3498db)
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        console.error('Config error:', e);
        return interaction.reply({ content: 'Failed to fetch configuration.', ephemeral: true });
      }
    }
    
    // Full setup
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
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can reset configuration.', ephemeral: true });
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
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can manage disabled commands.', ephemeral: true });
    }
    
    const action = interaction.options.getString('action');
    const commands = interaction.options.getString('commands')?.split(',').map(cmd => cmd.trim()).filter(Boolean) || [];
    
    if (!action) {
      // Show current disabled commands
      try {
        const { data, error } = await supabase
          .from('guild_configs')
          .select('disabled_commands')
          .eq('guild_id', interaction.guild.id)
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
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        console.error('Disable-commands check error:', e);
        return interaction.reply({ content: 'Failed to check disabled commands.', ephemeral: true });
      }
    }
    
    try {
      const { data, error } = await supabase
        .from('guild_configs')
        .select('disabled_commands')
        .eq('guild_id', interaction.guild.id)
        .single();
      
      let currentDisabled = data?.disabled_commands || [];
      
      switch (action) {
        case 'add':
          if (commands.length === 0) {
            return interaction.reply({ content: 'Please provide commands to add.', ephemeral: true });
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
            return interaction.reply({ embeds: [embed], ephemeral: true });
          }
          
          currentDisabled = [...new Set([...currentDisabled, ...commands])];
          break;
          
        case 'remove':
          if (commands.length === 0) {
            return interaction.reply({ content: 'Please provide commands to remove.', ephemeral: true });
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
          
        case 'current':
          const currentEmbed = new EmbedBuilder()
            .setTitle('Currently Disabled Commands')
            .setDescription(currentDisabled.length > 0 ? currentDisabled.join(', ') : 'No commands are currently disabled')
            .addFields(
              { name: 'Total Disabled', value: `${currentDisabled.length} commands`, inline: true }
            )
            .setColor(0x3498db)
            .setTimestamp();
          return interaction.reply({ embeds: [currentEmbed], ephemeral: true });
      }
      
      // Save updated disabled commands
      await supabase.from('guild_configs').upsert({
        guild_id: interaction.guild.id,
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
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Disable-commands error:', e);
      return interaction.reply({ content: 'Failed to update disabled commands.', ephemeral: true });
    }
  },

  prefix: async (interaction) => {
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: 'Only the server owner can change the command prefix.', ephemeral: true });
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
          { name: 'Reset', value: `Use /prefix new_prefix:reset to use defaults`, inline: true }
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
  }
};

module.exports = {
  name: 'setup',
  prefixCommands,
  slashCommands,
  slashHandlers
}; 