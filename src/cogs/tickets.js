const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { supabase } = require('../utils/supabase');
const { isModuleEnabled } = require('../utils/modules');

// Error logging and notification helpers
const crypto = require('crypto');
async function sendErrorToLogChannel(guild, context, error, traceId) {
  try {
    // Get log channel from config
    const { data: config } = await supabase
      .from('guild_configs')
      .select('log_channel')
      .eq('guild_id', guild.id)
      .single();
    if (config?.log_channel) {
      const channel = guild.channels.cache.get(config.log_channel);
      if (channel && channel.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('Ticket System Error')
          .setDescription(`**Context:** ${context}\n**Trace ID:** \`${traceId}\`\n\n\`${error?.message || error}\`\``)
          .setColor(0xe74c3c)
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (e) {
    console.error('Failed to send error to log channel:', e);
  }
}
async function notifyOwner(guild, message) {
  try {
    const owner = await guild.fetchOwner().catch(() => null);
    if (owner) {
      await owner.send(message).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to notify owner:', e);
  }
}
function generateTraceId() {
  return crypto.randomBytes(4).toString('hex');
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

// Ticket types configuration
const TICKET_TYPES = {
  'general': {
    name: 'General Support',
    emoji: '❓',
    color: '#5865F2',
    description: 'Get help with general questions and issues',
    modalTitle: 'General Support Request',
    questions: [
      {
        id: 'issue_description',
        label: 'Describe your issue or question',
        placeholder: 'Please provide detailed information about what you need help with...',
        style: 'PARAGRAPH',
        required: true
      },
      {
        id: 'additional_info',
        label: 'Additional information (optional)',
        placeholder: 'Any other details that might help us assist you better',
        style: 'PARAGRAPH',
        required: false
      }
    ]
  },
  'bug_report': {
    name: 'Bug Report',
    emoji: '🐛',
    color: '#FFA500',
    description: 'Report a bug or technical issue',
    modalTitle: 'Bug Report',
    questions: [
      {
        id: 'bug_description',
        label: 'Describe the bug',
        placeholder: 'What happened? Be as detailed as possible.',
        style: 'PARAGRAPH',
        required: true
      },
      {
        id: 'steps_to_reproduce',
        label: 'Steps to reproduce',
        placeholder: 'How can we reproduce this issue?',
        style: 'PARAGRAPH',
        required: true
      },
      {
        id: 'expected_behavior',
        label: 'Expected behavior',
        placeholder: 'What did you expect to happen?',
        style: 'PARAGRAPH',
        required: false
      }
    ]
  },
  'user_report': {
    name: 'User Report',
    emoji: '🚨',
    color: '#FF0000',
    description: 'Report a user for breaking server rules',
    modalTitle: 'User Report',
    questions: [
      {
        id: 'reported_user',
        label: 'User being reported',
        placeholder: 'Username or ID of the user you want to report',
        style: 'SHORT',
        required: true
      },
      {
        id: 'report_reason',
        label: 'Reason for the report',
        placeholder: 'Explain what rule was broken and provide details...',
        style: 'PARAGRAPH',
        required: true
      },
      {
        id: 'evidence',
        label: 'Evidence (screenshots, message links, etc.)',
        placeholder: 'If applicable, include links to screenshots or messages',
        style: 'PARAGRAPH',
        required: false
      }
    ]
  }
};

/**
 * Get the next available ticket number
 */
async function getNextTicketNumber() {
  try {
    const { data, error } = await supabase
      .rpc('get_next_ticket_number');

    if (error) {
      console.error('Error getting ticket number:', error);
      // Fallback to timestamp-based number
      return Math.floor(Date.now() / 1000);
    }

    return data;
  } catch (error) {
    console.error('Error in getNextTicketNumber:', error);
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Save ticket to database
 */
async function saveTicket(ticketData) {
  const traceId = generateTraceId();
  try {
    const { error } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketData.ticketNumber,
        guild_id: ticketData.guildId,
        user_id: ticketData.userId,
        channel_id: ticketData.channelId,
        ticket_type: ticketData.type,
        status: 'OPEN',
        form_data: ticketData.formData || {}
      });

    if (error) {
      await sendErrorToLogChannel({ id: ticketData.guildId, channels: { cache: new Map() } }, 'saveTicket', error, traceId);
      throw { error, traceId };
    }
  } catch (error) {
    await sendErrorToLogChannel({ id: ticketData.guildId, channels: { cache: new Map() } }, 'saveTicket', error, traceId);
    throw { error, traceId };
  }
}

/**
 * Create ticket channel
 */
async function createTicketChannel(interaction, ticketType, formData) {
  const traceId = generateTraceId();
  try {
    const { guild, user } = interaction;
    const ticketConfig = TICKET_TYPES[ticketType];

    // Get ticket configuration
    const { data: config } = await supabase
      .from('ticket_configs')
      .select('*')
      .eq('guild_id', guild.id)
      .single();

    // Get next ticket number
    const ticketNumber = await getNextTicketNumber();

    // Create channel name
    const channelName = `ticket-${ticketNumber}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    // Set up permissions
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      {
        id: guild.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ];

    // Add staff role permissions if configured
    if (config?.staff_role_id) {
      permissionOverwrites.push({
        id: config.staff_role_id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory
        ]
      });
    }

    // Create the channel
    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: config?.category_id,
      permissionOverwrites: permissionOverwrites,
      topic: `Ticket #${ticketNumber} | Created by ${user.tag} | Type: ${ticketConfig.name}`
    });

    // Save ticket to database
    await saveTicket({
      ticketNumber,
      guildId: guild.id,
      userId: user.id,
      channelId: ticketChannel.id,
      type: ticketType,
      formData: formData
    });

    // Send initial message
    await sendInitialTicketMessage(ticketChannel, user, ticketType, ticketNumber, formData, config?.staff_role_id);

    return ticketChannel;
  } catch (error) {
    const { guild } = interaction;
    await sendErrorToLogChannel(guild, 'createTicketChannel', error, traceId);
    await notifyOwner(guild, `Critical error in ticket creation (Trace ID: ${traceId}): ${error?.message || error}`);
    throw { error, traceId };
  }
}

/**
 * Send initial ticket message
 */
async function sendInitialTicketMessage(channel, user, ticketType, ticketNumber, formData, staffRoleId) {
  const traceId = generateTraceId();
  try {
    const ticketConfig = TICKET_TYPES[ticketType];

    const embed = new EmbedBuilder()
      .setTitle(`${ticketConfig.emoji} Ticket #${ticketNumber}: ${ticketConfig.name}`)
      .setDescription(`Thank you for creating a ticket, <@${user.id}>.\n\nOur staff will assist you shortly. Please be patient and provide any additional information that might help us resolve your issue faster.`)
      .setColor(ticketConfig.color)
      .setFooter({
        text: `Ticket ID: ${ticketNumber} • Created at: ${new Date().toLocaleString()}`,
        iconURL: user.displayAvatarURL({ dynamic: true })
      })
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    // Add form data fields
    if (formData) {
      for (const field of ticketConfig.questions) {
        const value = formData[field.id] || 'Not provided';
        embed.addFields({
          name: field.label,
          value: value.length > 1024 ? value.substring(0, 1021) + '...' : value,
          inline: false
        });
      }
    }

    // Create action buttons
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketNumber}`)
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${ticketNumber}`)
          .setLabel('Claim Ticket')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✋'),
        new ButtonBuilder()
          .setCustomId(`ticket_delete_${ticketNumber}`)
          .setLabel('Delete Ticket')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗑️')
      );

    // Send message with staff ping
    await channel.send({
      content: `<@${user.id}> ${staffRoleId ? `<@&${staffRoleId}>` : ''}`,
      embeds: [embed],
      components: [row]
    });
  } catch (error) {
    await sendErrorToLogChannel(channel.guild, 'sendInitialTicketMessage', error, traceId);
    await notifyOwner(channel.guild, `Critical error sending initial ticket message (Trace ID: ${traceId}): ${error?.message || error}`);
  }
}

/**
 * Update ticket status
 */
async function updateTicketStatus(ticketNumber, status, updatedBy) {
  const traceId = generateTraceId();
  try {
    const { error } = await supabase
      .from('tickets')
      .update({
        status: status,
        updated_at: new Date(),
        updated_by: updatedBy
      })
      .eq('ticket_number', ticketNumber);

    if (error) {
      await sendErrorToLogChannel(null, 'updateTicketStatus', error, traceId);
      throw { error, traceId };
    }
  } catch (error) {
    await sendErrorToLogChannel(null, 'updateTicketStatus', error, traceId);
    throw { error, traceId };
  }
}

/**
 * Update ticket claim
 */
async function updateTicketClaim(ticketNumber, claimedBy) {
  const traceId = generateTraceId();
  try {
    const { error } = await supabase
      .from('tickets')
      .update({
        claimed_by: claimedBy,
        claimed_at: new Date()
      })
      .eq('ticket_number', ticketNumber);

    if (error) {
      await sendErrorToLogChannel(null, 'updateTicketClaim', error, traceId);
      throw { error, traceId };
    }
  } catch (error) {
    await sendErrorToLogChannel(null, 'updateTicketClaim', error, traceId);
    throw { error, traceId };
  }
}

/**
 * Get ticket data
 */
async function getTicketData(ticketNumber) {
  const traceId = generateTraceId();
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('ticket_number', ticketNumber)
      .single();

    if (error) {
      await sendErrorToLogChannel(null, 'getTicketData', error, traceId);
      return null;
    }

    return data;
  } catch (error) {
    await sendErrorToLogChannel(null, 'getTicketData', error, traceId);
    return null;
  }
}

// Prefix commands
const prefixCommands = {
  ticketsetup: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    if (!await isModuleEnabled(msg.guild.id, 'tickets')) {
      const dashboardUrl = process.env.DASHBOARD_URL || `http://localhost:4000/`;
      const embed = new EmbedBuilder()
        .setTitle('Module Disabled')
        .setDescription('The Tickets module is currently disabled.')
        .addFields({
          name: '🔧 Enable Module',
          value: `[Click here to enable in the dashboard](${dashboardUrl})`,
          inline: false
        })
        .setColor(0xe74c3c)
        .setFooter({ text: 'You need "Manage Server" permission to access the dashboard' });
      return msg.reply({ embeds: [embed] });
    }
    
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';ticketsetup #channel\n\nThis will create a ticket panel in the specified channel.\n\nUse /ticketsetup for more detailed configuration.').setColor(0xe74c3c)] });
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
    .setName('ticketsetup')
    .setDescription('Setup ticket system for support')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for ticket panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(opt => opt.setName('title').setDescription('Ticket panel title').setRequired(false))
    .addStringOption(opt => opt.setName('description').setDescription('Ticket panel description').setRequired(false))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color for embed').setRequired(false))
    .addRoleOption(opt => opt.setName('staff_role').setDescription('Role to ping when tickets are created').setRequired(false))
    .addChannelOption(opt => opt.setName('category').setDescription('Category for ticket channels').addChannelTypes(ChannelType.GuildCategory).setRequired(false))
];

// Slash command handlers
const slashHandlers = {
  ticketsetup: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    if (!await isModuleEnabled(interaction.guild.id, 'tickets')) {
      const dashboardUrl = process.env.DASHBOARD_URL || `http://localhost:4000/`;
      const embed = new EmbedBuilder()
        .setTitle('Module Disabled')
        .setDescription('The Tickets module is currently disabled.')
        .addFields({
          name: '🔧 Enable Module',
          value: `[Click here to enable in the dashboard](${dashboardUrl})`,
          inline: false
        })
        .setColor(0xe74c3c)
        .setFooter({ text: 'You need "Manage Server" permission to access the dashboard' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
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

// Button interaction handlers
const buttonHandlers = {
  create_ticket: async (interaction) => {
    try {
      // Create modal for ticket creation
      const modal = new ModalBuilder()
        .setCustomId('ticket_modal')
        .setTitle('Create Support Ticket');

      const ticketTypeInput = new TextInputBuilder()
        .setCustomId('ticket_type')
        .setLabel('What type of ticket do you need?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('general, bug_report, user_report')
        .setRequired(true);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel('Please describe your issue')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Provide detailed information about your issue...')
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(ticketTypeInput);
      const secondActionRow = new ActionRowBuilder().addComponents(descriptionInput);

      modal.addComponents(firstActionRow, secondActionRow);
      await interaction.showModal(modal);
    } catch (error) {
      console.error('Error showing ticket modal:', error);
      await interaction.reply({ content: 'An error occurred while creating the ticket form.', ephemeral: true });
    }
  },

  ticket_close: async (interaction) => {
    const traceId = generateTraceId();
    try {
      const ticketNumber = parseInt(interaction.customId.split('_')[2]);
      
      // Get ticket data to find the creator
      const ticketData = await getTicketData(ticketNumber);
      if (!ticketData) {
        await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
        return;
      }
      
      // Update ticket status
      await updateTicketStatus(ticketNumber, 'CLOSED', interaction.user.id);
      
      // Remove the ticket creator from the channel
      try {
        const channel = interaction.channel;
        const ticketCreator = await interaction.guild.members.fetch(ticketData.user_id);
        
        // Remove view permissions for the ticket creator
        await channel.permissionOverwrites.edit(ticketCreator, {
          ViewChannel: false,
          SendMessages: false,
          AttachFiles: false,
          EmbedLinks: false,
          ReadMessageHistory: false
        });
      } catch (removeError) {
        console.error('Error removing ticket creator from channel:', removeError);
        // Continue with closing even if removal fails
      }
      
      // Create close confirmation embed
      const embed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setDescription(`This ticket has been closed by <@${interaction.user.id}>.\n\nThe ticket creator has been removed from this channel. Only staff members can now access it.`)
        .setColor(0xFF5555)
        .setFooter({
          text: `Ticket #${ticketNumber} • Closed at: ${new Date().toLocaleString()}`
        })
        .setTimestamp();

      // Create action buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_delete_${ticketNumber}`)
            .setLabel('Delete Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️'),
          new ButtonBuilder()
            .setCustomId(`ticket_reopen_${ticketNumber}`)
            .setLabel('Reopen Ticket')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔓')
        );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: 'Ticket closed successfully.', ephemeral: true });
    } catch (error) {
      await sendErrorToLogChannel(interaction.guild, 'ticket_close', error, traceId);
      await notifyOwner(interaction.guild, `Critical error closing ticket (Trace ID: ${traceId}): ${error?.message || error}`);
      await interaction.reply({ content: `An error occurred while closing the ticket. (Trace ID: ${traceId})`, ephemeral: true });
    }
  },

  ticket_delete: async (interaction) => {
    const traceId = generateTraceId();
    try {
      const ticketNumber = parseInt(interaction.customId.split('_')[2]);
      
      // Update ticket status
      await updateTicketStatus(ticketNumber, 'DELETED', interaction.user.id);
      
      // Send deletion notification
      const embed = new EmbedBuilder()
        .setTitle('🗑️ Ticket Deletion')
        .setDescription(`This ticket will be deleted <t:${Math.floor(Date.now() / 1000) + 6}:R>.\n\nThank you for using our ticket system.`)
        .setColor(0xFF0000)
        .setFooter({
          text: `Ticket #${ticketNumber} • Deleted by: ${interaction.user.tag}`
        })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });

      // Wait 5 seconds then delete
      setTimeout(async () => {
        try {
          await interaction.channel.delete(`Ticket #${ticketNumber} deleted by ${interaction.user.tag}`);
        } catch (error) {
          console.error('Error deleting ticket channel:', error);
        }
      }, 5000);
      
      await interaction.reply({ content: 'Ticket will be deleted in 5 seconds.', ephemeral: true });
    } catch (error) {
      await sendErrorToLogChannel(interaction.guild, 'ticket_delete', error, traceId);
      await notifyOwner(interaction.guild, `Critical error deleting ticket (Trace ID: ${traceId}): ${error?.message || error}`);
      await interaction.reply({ content: `An error occurred while deleting the ticket. (Trace ID: ${traceId})`, ephemeral: true });
    }
  },

  ticket_reopen: async (interaction) => {
    const traceId = generateTraceId();
    try {
      const ticketNumber = parseInt(interaction.customId.split('_')[2]);
      
      // Get ticket data to find the creator
      const ticketData = await getTicketData(ticketNumber);
      if (!ticketData) {
        await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
        return;
      }
      
      // Update ticket status
      await updateTicketStatus(ticketNumber, 'OPEN', interaction.user.id);
      
      // Re-add the ticket creator to the channel
      try {
        const channel = interaction.channel;
        const ticketCreator = await interaction.guild.members.fetch(ticketData.user_id);
        
        // Restore view permissions for the ticket creator
        await channel.permissionOverwrites.edit(ticketCreator, {
          ViewChannel: true,
          SendMessages: true,
          AttachFiles: true,
          EmbedLinks: true,
          ReadMessageHistory: true
        });
      } catch (addError) {
        console.error('Error re-adding ticket creator to channel:', addError);
        // Continue with reopening even if addition fails
      }
      
      // Create reopen confirmation embed
      const embed = new EmbedBuilder()
        .setTitle('🔓 Ticket Reopened')
        .setDescription(`This ticket has been reopened by <@${interaction.user.id}>.\n\nThe ticket creator has been re-added to this channel. Our staff will continue to assist you with your issue.`)
        .setColor(0x77DD77)
        .setFooter({
          text: `Ticket #${ticketNumber} • Reopened at: ${new Date().toLocaleString()}`
        })
        .setTimestamp();

      // Create action buttons
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_close_${ticketNumber}`)
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒'),
          new ButtonBuilder()
            .setCustomId(`ticket_claim_${ticketNumber}`)
            .setLabel('Claim Ticket')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✋')
        );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: 'Ticket reopened successfully.', ephemeral: true });
    } catch (error) {
      await sendErrorToLogChannel(interaction.guild, 'ticket_reopen', error, traceId);
      await notifyOwner(interaction.guild, `Critical error reopening ticket (Trace ID: ${traceId}): ${error?.message || error}`);
      await interaction.reply({ content: `An error occurred while reopening the ticket. (Trace ID: ${traceId})`, ephemeral: true });
    }
  },

  ticket_claim: async (interaction) => {
    const traceId = generateTraceId();
    try {
      const ticketNumber = parseInt(interaction.customId.split('_')[2]);
      
      // Get ticket data to check who created it
      const ticketData = await getTicketData(ticketNumber);
      if (!ticketData) {
        await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
        return;
      }
      
      // Prevent ticket creator from claiming their own ticket
      if (ticketData.user_id === interaction.user.id) {
        await interaction.reply({ content: 'You cannot claim your own ticket. Only staff members can claim tickets.', ephemeral: true });
        return;
      }
      
      // Update ticket claim
      await updateTicketClaim(ticketNumber, interaction.user.id);
      
      // Create claim confirmation embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Ticket Claimed')
        .setDescription(`This ticket has been claimed by <@${interaction.user.id}>.\n\nThey will be handling this issue and will respond as soon as possible.`)
        .setColor(0x5865F2)
        .setFooter({
          text: `Ticket #${ticketNumber} • Claimed at: ${new Date().toLocaleString()}`
        })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });
      await interaction.reply({ content: 'Ticket claimed successfully.', ephemeral: true });
    } catch (error) {
      await sendErrorToLogChannel(interaction.guild, 'ticket_claim', error, traceId);
      await notifyOwner(interaction.guild, `Critical error claiming ticket (Trace ID: ${traceId}): ${error?.message || error}`);
      await interaction.reply({ content: `An error occurred while claiming the ticket. (Trace ID: ${traceId})`, ephemeral: true });
    }
  }
};

// Modal submission handlers
const modalHandlers = {
  ticket_modal: async (interaction) => {
    const traceId = generateTraceId();
    try {
      const ticketType = interaction.fields.getTextInputValue('ticket_type').toLowerCase();
      const description = interaction.fields.getTextInputValue('ticket_description');

      // Map ticket type to internal type
      let internalType = 'general';
      if (ticketType.includes('bug')) {
        internalType = 'bug_report';
      } else if (ticketType.includes('user') || ticketType.includes('report')) {
        internalType = 'user_report';
      }

      const formData = {
        issue_description: description
      };

      // Create the ticket channel
      const ticketChannel = await createTicketChannel(interaction, internalType, formData);

      if (ticketChannel) {
        await interaction.reply({ 
          content: `Your ticket has been created! Please check ${ticketChannel}`, 
          ephemeral: true 
        });
      } else {
        await interaction.reply({ 
          content: `Failed to create ticket. Please try again later. (Trace ID: ${traceId})`, 
          ephemeral: true 
        });
      }
    } catch (error) {
      await sendErrorToLogChannel(interaction.guild, 'ticket_modal', error, traceId);
      await notifyOwner(interaction.guild, `Critical error in ticket modal (Trace ID: ${traceId}): ${error?.message || error}`);
      await interaction.reply({ 
        content: `An error occurred while creating your ticket. (Trace ID: ${traceId})`, 
        ephemeral: true 
      });
    }
  }
};

module.exports = {
  name: 'tickets',
  prefixCommands,
  slashCommands,
  slashHandlers,
  buttonHandlers,
  modalHandlers
}; 