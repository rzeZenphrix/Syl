const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { isAdmin, logger } = require('./enhanced-setup');

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Dashboard URL
const DASHBOARD_URL = 'https://syl-cuiw.onrender.com/index.html';

// Helper function to create module disabled embed
function createModuleDisabledEmbed(moduleName, guildId) {
  return new EmbedBuilder()
    .setTitle('🚫 Module Disabled')
    .setDescription(`The ${moduleName} module is currently disabled for this server.`)
    .addFields({
      name: '🔧 Enable Module',
      value: `**[Open Dashboard](${DASHBOARD_URL}?guild=${guildId})**\n*Navigate to General Settings to enable goodbye messages*`,
      inline: false
    })
    .setColor(0xff5555)
    .setFooter({ text: 'You need admin permissions to access the dashboard' });
}

// Helper function to validate image URLs
function isValidImageUrl(url) {
  if (!url) return true; // No image is valid
  try {
    const parsedUrl = new URL(url);
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const hasValidExtension = validExtensions.some(ext =>
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );
    const isDiscordCdn =
      parsedUrl.hostname.includes('cdn.discordapp.com') ||
      parsedUrl.hostname.includes('media.discordapp.net') ||
      parsedUrl.hostname.includes('images-ext-1.discordapp.net');
    return hasValidExtension || isDiscordCdn;
  } catch {
    return false;
  }
}

// Get goodbye configuration
async function getGoodbyeConfig(guildId) {
  try {
    const { data, error } = await supabase
      .from('goodbye_configs')
      .select('*')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || {
      guild_id: guildId,
      enabled: false,
      channel_id: null,
      message: 'Goodbye {user}! We\'ll miss you! 😢',
      embed: true,
      color: '#ff0000',
      image: null
    };
  } catch (err) {
    console.error('Error getting goodbye config:', err);
    return null;
  }
}

// Check if goodbye module is enabled
async function isGoodbyeEnabled(guildId) {
  try {
    // Check both guild config and goodbye config
    const [guildConfigResult, goodbyeConfigResult] = await Promise.all([
      supabase.from('guild_configs').select('goodbye_enabled').eq('guild_id', guildId).single(),
      supabase.from('goodbye_configs').select('enabled').eq('guild_id', guildId).single()
    ]);

    const guildEnabled = guildConfigResult.data?.goodbye_enabled || false;
    const goodbyeEnabled = goodbyeConfigResult.data?.enabled || false;

    return guildEnabled && goodbyeEnabled;
  } catch (err) {
    console.error('Error checking goodbye enabled status:', err);
    return false;
  }
}

// Update goodbye configuration
async function updateGoodbyeConfig(guildId, updates, userId, guild) {
  try {
    const { data, error } = await supabase
      .from('goodbye_configs')
      .upsert({
        guild_id: guildId,
        ...updates,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Also update guild config if enabling/disabling
    if (updates.hasOwnProperty('enabled')) {
      await supabase
        .from('guild_configs')
        .upsert({
          guild_id: guildId,
          goodbye_enabled: updates.enabled,
          updated_at: new Date().toISOString()
        });
    }

    // Log the configuration change
    await logger.logConfigChange(
      guildId, 
      guild, 
      'goodbye_config', 
      null, 
      updates, 
      userId
    );

    return data;
  } catch (err) {
    console.error('Error updating goodbye config:', err);
    await logger.logError(guildId, guild, err, { context: 'updateGoodbyeConfig', updates });
    throw err;
  }
}

// Process goodbye message with placeholders
function processGoodbyeMessage(message, user, guild) {
  return message
    .replace(/{user}/g, user.username) // Use username instead of mention for goodbye
    .replace(/{username}/g, user.username)
    .replace(/{user\.tag}/g, user.tag)
    .replace(/{user\.mention}/g, user.toString())
    .replace(/{server}/g, guild.name)
    .replace(/{guild}/g, guild.name)
    .replace(/{membercount}/g, guild.memberCount.toString())
    .replace(/{member\.count}/g, guild.memberCount.toString());
}

// Send goodbye message
async function sendGoodbyeMessage(member) {
  try {
    const guild = member.guild;
    const guildId = guild.id;

    // Check if goodbye is enabled
    if (!await isGoodbyeEnabled(guildId)) {
      return;
    }

    const config = await getGoodbyeConfig(guildId);
    if (!config || !config.channel_id) {
      return;
    }

    const channel = guild.channels.cache.get(config.channel_id);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const processedMessage = processGoodbyeMessage(config.message, member.user, guild);

    if (config.embed) {
      const embed = new EmbedBuilder()
        .setTitle('👋 Goodbye!')
        .setDescription(processedMessage)
        .setColor(config.color || '#ff0000')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields([
          {
            name: '👤 Member Info',
            value: `**Username:** ${member.user.tag}\n**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
            inline: true
          },
          {
            name: '🏠 Server Info',
            value: `**Members Remaining:** ${guild.memberCount}\n**Time in Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
            inline: true
          }
        ])
        .setFooter({ text: `Goodbye from ${guild.name}`, iconURL: guild.iconURL() })
        .setTimestamp();

      if (config.image && isValidImageUrl(config.image)) {
        embed.setImage(config.image);
      }

      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(processedMessage);
    }

    // Log the goodbye message
    await logger.logMemberEvent(
      guildId,
      guild,
      'goodbye_sent',
      member.id,
      {
        username: member.user.username,
        channelId: channel.id,
        memberCount: guild.memberCount,
        timeInServer: Date.now() - member.joinedTimestamp
      }
    );

  } catch (error) {
    console.error('Error sending goodbye message:', error);
    await logger.logError(member.guild.id, member.guild, error, { 
      context: 'sendGoodbyeMessage',
      memberId: member.id 
    });
  }
}

// Goodbye setup command
async function handleGoodbyeSetupCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;

    if (!await isAdmin(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('You need admin permissions to configure goodbye messages.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Goodbye {user}! We\'ll miss you! 😢';
    const color = interaction.options.getString('color') || '#ff0000';
    const image = interaction.options.getString('image');
    const embedEnabled = interaction.options.getBoolean('embed') ?? true;

    // Validate inputs
    if (channel && channel.type !== ChannelType.GuildText) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Invalid Channel')
        .setDescription('Please select a text channel for goodbye messages.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (image && !isValidImageUrl(image)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Invalid Image URL')
        .setDescription('Please provide a valid image URL (jpg, png, gif, webp).')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Color validation
    const colorRegex = /^#([0-9A-F]{3}|[0-9A-F]{6})$/i;
    if (!colorRegex.test(color)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Invalid Color')
        .setDescription('Please provide a valid hex color (e.g., #ff0000).')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await updateGoodbyeConfig(guild.id, {
      enabled: true,
      channel_id: channel?.id || null,
      message,
      embed: embedEnabled,
      color,
      image
    }, member.id, guild);

    const embed = new EmbedBuilder()
      .setTitle('✅ Goodbye Messages Configured')
      .setDescription('Goodbye message settings have been updated successfully!')
      .addFields([
        {
          name: '📍 Channel',
          value: channel ? channel.toString() : 'Not set',
          inline: true
        },
        {
          name: '💬 Message',
          value: message.length > 100 ? message.substring(0, 100) + '...' : message,
          inline: true
        },
        {
          name: '🎨 Settings',
          value: `**Format:** ${embedEnabled ? 'Embed' : 'Plain text'}\n**Color:** ${color}\n**Image:** ${image ? 'Set' : 'None'}`,
          inline: true
        },
        {
          name: '🌐 Advanced Configuration',
          value: `**[Open Dashboard](${DASHBOARD_URL}?guild=${guild.id})**\n*Configure more advanced goodbye settings*`,
          inline: false
        }
      ])
      .setColor(0x43b581)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logger.logCommand(guild.id, guild, 'goodbyesetup', member.id, true, { 
      channelId: channel?.id,
      embedEnabled 
    });

  } catch (error) {
    console.error('Error in goodbye setup:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'goodbyeSetupCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to configure goodbye messages.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// View goodbye configuration
async function handleViewGoodbyeCommand(interaction) {
  try {
    const guild = interaction.guild;
    const config = await getGoodbyeConfig(guild.id);
    const isEnabled = await isGoodbyeEnabled(guild.id);

    const embed = new EmbedBuilder()
      .setTitle('👋 Goodbye Configuration')
      .setDescription(isEnabled ? 'Goodbye messages are currently **enabled**' : 'Goodbye messages are currently **disabled**')
      .setColor(isEnabled ? 0x43b581 : 0xff5555)
      .addFields([
        {
          name: '📍 Channel',
          value: config.channel_id ? `<#${config.channel_id}>` : 'Not set',
          inline: true
        },
        {
          name: '💬 Message',
          value: config.message.length > 100 ? config.message.substring(0, 100) + '...' : config.message,
          inline: true
        },
        {
          name: '🎨 Format',
          value: config.embed ? 'Embed' : 'Plain text',
          inline: true
        },
        {
          name: '🌈 Color',
          value: config.color || '#ff0000',
          inline: true
        },
        {
          name: '🖼️ Image',
          value: config.image ? '[Set](' + config.image + ')' : 'None',
          inline: true
        },
        {
          name: '📝 Message Preview',
          value: processGoodbyeMessage(config.message, interaction.user, guild),
          inline: false
        }
      ])
      .setFooter({ text: `Configuration for ${guild.name}`, iconURL: guild.iconURL() })
      .setTimestamp();

    if (config.image && isValidImageUrl(config.image)) {
      embed.setThumbnail(config.image);
    }

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('Configure Goodbye')
          .setStyle(ButtonStyle.Primary)
          .setCustomId('configure_goodbye')
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setLabel('Test Goodbye')
          .setStyle(ButtonStyle.Secondary)
          .setCustomId('test_goodbye')
          .setEmoji('🧪')
          .setDisabled(!isEnabled),
        new ButtonBuilder()
          .setLabel('Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(`${DASHBOARD_URL}?guild=${guild.id}`)
          .setEmoji('🌐')
      );

    await interaction.reply({ embeds: [embed], components: [row] });
    await logger.logCommand(guild.id, guild, 'viewgoodbye', interaction.member.id, true);

  } catch (error) {
    console.error('Error viewing goodbye config:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'viewGoodbyeCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to load goodbye configuration.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// Toggle goodbye messages
async function handleToggleGoodbyeCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;

    if (!await isAdmin(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('You need admin permissions to toggle goodbye messages.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const currentStatus = await isGoodbyeEnabled(guild.id);
    const newStatus = !currentStatus;

    await updateGoodbyeConfig(guild.id, { enabled: newStatus }, member.id, guild);

    const embed = new EmbedBuilder()
      .setTitle(`✅ Goodbye Messages ${newStatus ? 'Enabled' : 'Disabled'}`)
      .setDescription(`Goodbye messages have been **${newStatus ? 'enabled' : 'disabled'}** for this server.`)
      .setColor(newStatus ? 0x43b581 : 0xff5555)
      .addFields([
        {
          name: '🌐 Full Configuration',
          value: `**[Open Dashboard](${DASHBOARD_URL}?guild=${guild.id})**\n*Configure advanced goodbye settings*`,
          inline: false
        }
      ])
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logger.logCommand(guild.id, guild, 'toggle-goodbye', member.id, true, { enabled: newStatus });

  } catch (error) {
    console.error('Error toggling goodbye:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'toggleGoodbyeCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to toggle goodbye messages.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// Slash command definitions
const slashCommands = [
  new SlashCommandBuilder()
    .setName('goodbyesetup')
    .setDescription('Configure goodbye messages for leaving members (admin only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send goodbye messages')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Goodbye message (use {user}, {server}, {membercount} as placeholders)')
        .setMaxLength(2000)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('embed')
        .setDescription('Send as embed (default: true)')
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Embed color (hex format, e.g., #ff0000)')
        .setMaxLength(7)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('image')
        .setDescription('Image URL for the goodbye embed')
        .setRequired(false)
    ),
  
  new SlashCommandBuilder()
    .setName('viewgoodbye')
    .setDescription('View current goodbye message configuration'),
  
  new SlashCommandBuilder()
    .setName('toggle-goodbye')
    .setDescription('Enable or disable goodbye messages (admin only)')
];

// Slash command handlers
const slashHandlers = {
  goodbyesetup: handleGoodbyeSetupCommand,
  viewgoodbye: handleViewGoodbyeCommand,
  'toggle-goodbye': handleToggleGoodbyeCommand
};

// Available commands for this cog
const availableCommands = {
  goodbyesetup: 'Setup goodbye messages for leaving members (admin only)',
  viewgoodbye: 'View the current goodbye configuration',
  'toggle-goodbye': 'Enable or disable goodbye messages (admin only)'
};

// Event handlers
const eventHandlers = {
  guildMemberRemove: sendGoodbyeMessage
};

module.exports = {
  name: 'goodbye',
  slashCommands,
  slashHandlers,
  availableCommands,
  eventHandlers,
  
  // Export functions for use by other modules
  sendGoodbyeMessage,
  getGoodbyeConfig,
  isGoodbyeEnabled,
  updateGoodbyeConfig
};