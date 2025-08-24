const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { EnhancedLogger } = require('../enhanced-logger.js');

// Initialize Supabase and Logger
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const logger = new EnhancedLogger(supabase);

// Dashboard URL
const DASHBOARD_URL = 'https://syl-cuiw.onrender.com/index.html';

// Permission checking function
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

// Helper function to create module disabled embed
function createModuleDisabledEmbed(moduleName, guildId) {
  return new EmbedBuilder()
    .setTitle('🚫 Module Disabled')
    .setDescription(`The ${moduleName} module is currently disabled for this server.`)
    .addFields({
      name: '🔧 Enable Module',
      value: `**[Open Dashboard](${DASHBOARD_URL}?guild=${guildId})**\n*Navigate to General Settings to enable welcome messages*`,
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

// Get welcome configuration
async function getWelcomeConfig(guildId) {
  try {
    const { data, error } = await supabase
      .from('welcome_configs')
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
      message: 'Welcome {user} to {server}! 🎉',
      embed: true,
      color: '#00ff00',
      image: null,
      show_avatar: true
    };
  } catch (err) {
    console.error('Error getting welcome config:', err);
    return null;
  }
}

// Check if welcome module is enabled
async function isWelcomeEnabled(guildId) {
  try {
    // Check both guild config and welcome config
    const [guildConfigResult, welcomeConfigResult] = await Promise.all([
      supabase.from('guild_configs').select('welcome_enabled').eq('guild_id', guildId).single(),
      supabase.from('welcome_configs').select('enabled').eq('guild_id', guildId).single()
    ]);

    const guildEnabled = guildConfigResult.data?.welcome_enabled || false;
    const welcomeEnabled = welcomeConfigResult.data?.enabled || false;

    return guildEnabled && welcomeEnabled;
  } catch (err) {
    console.error('Error checking welcome enabled status:', err);
    return false;
  }
}

// Update welcome configuration
async function updateWelcomeConfig(guildId, updates, userId, guild) {
  try {
    const { data, error } = await supabase
      .from('welcome_configs')
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
          welcome_enabled: updates.enabled,
          updated_at: new Date().toISOString()
        });
    }

    // Log the configuration change
    await logger.logConfigChange(
      guildId, 
      guild, 
      'welcome_config', 
      null, 
      updates, 
      userId
    );

    return data;
  } catch (err) {
    console.error('Error updating welcome config:', err);
    await logger.logError(guildId, guild, err, { context: 'updateWelcomeConfig', updates });
    throw err;
  }
}

// Process welcome message with placeholders
function processWelcomeMessage(message, user, guild) {
  return message
    .replace(/{user}/g, user.toString())
    .replace(/{username}/g, user.username)
    .replace(/{user\.tag}/g, user.tag)
    .replace(/{user\.mention}/g, user.toString())
    .replace(/{server}/g, guild.name)
    .replace(/{guild}/g, guild.name)
    .replace(/{membercount}/g, guild.memberCount.toString())
    .replace(/{member\.count}/g, guild.memberCount.toString());
}

// Send welcome message
async function sendWelcomeMessage(member) {
  try {
    const guild = member.guild;
    const guildId = guild.id;

    console.log(`Enhanced-welcome: Processing welcome for ${member.user.tag} in ${guild.name}`);

    // Check if welcome is enabled
    if (!await isWelcomeEnabled(guildId)) {
      console.log(`Enhanced-welcome: Welcome disabled for ${guild.name}`);
      return;
    }

    const config = await getWelcomeConfig(guildId);
    if (!config || !config.channel_id) {
      console.log(`Enhanced-welcome: No config or channel for ${guild.name}`);
      return;
    }

    console.log(`Enhanced-welcome: Config found for ${guild.name}, channel: ${config.channel_id}, show_avatar: ${config.show_avatar}`);

    const channel = guild.channels.cache.get(config.channel_id);
    if (!channel || !channel.isTextBased()) {
      return;
    }

    const processedMessage = processWelcomeMessage(config.message, member.user, guild);

    if (config.embed) {
      const embed = new EmbedBuilder()
        .setTitle('👋 Welcome!')
        .setDescription(processedMessage)
        .setColor(config.color || '#00ff00')
        .addFields([
          {
            name: '👤 Member Info',
            value: `**Username:** ${member.user.tag}\n**Account Created:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            inline: true
          },
          {
            name: '🏠 Server Info',
            value: `**Member Count:** ${guild.memberCount}\n**You are member #${guild.memberCount}**`,
            inline: true
          }
        ])
        .setFooter({ text: `Welcome to ${guild.name}!`, iconURL: guild.iconURL() })
        .setTimestamp();

      // Only show avatar if enabled (defaults to true for backward compatibility)
      const shouldShowAvatar = config.show_avatar === undefined || config.show_avatar === true;
      console.log(`Enhanced Avatar setting for ${guild.name}: show_avatar=${config.show_avatar}, shouldShow=${shouldShowAvatar}`);
      
      if (shouldShowAvatar) {
        embed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));
        console.log(`Enhanced: Added avatar thumbnail for ${member.user.tag}`);
      } else {
        console.log(`Enhanced: Avatar disabled for ${member.user.tag}`);
      }

      if (config.image && isValidImageUrl(config.image)) {
        embed.setImage(config.image);
      }

      await channel.send({ embeds: [embed] });
    } else {
      await channel.send(processedMessage);
    }

    // Log the welcome message
    await logger.logMemberEvent(
      guildId,
      guild,
      'welcome_sent',
      member.id,
      {
        username: member.user.username,
        channelId: channel.id,
        memberCount: guild.memberCount
      }
    );

    console.log(`Enhanced-welcome: Successfully sent welcome message for ${member.user.tag} in ${guild.name}`);

  } catch (error) {
    console.error('Enhanced-welcome: Error sending welcome message:', error);
    await logger.logError(member.guild.id, member.guild, error, { 
      context: 'sendWelcomeMessage',
      memberId: member.id 
    });
  }
}

// Welcome setup command
async function handleWelcomeSetupCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;

    if (!await isAdmin(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('You need admin permissions to configure welcome messages.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Welcome {user} to {server}! 🎉';
    const color = interaction.options.getString('color') || '#00ff00';
    const image = interaction.options.getString('image');
    const embedEnabled = interaction.options.getBoolean('embed') ?? true;
    const showAvatar = interaction.options.getBoolean('show_avatar') ?? true;

    // Validate inputs
    if (channel && channel.type !== ChannelType.GuildText) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Invalid Channel')
        .setDescription('Please select a text channel for welcome messages.')
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
        .setDescription('Please provide a valid hex color (e.g., #00ff00).')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await updateWelcomeConfig(guild.id, {
      enabled: true,
      channel_id: channel?.id || null,
      message,
      embed: embedEnabled,
      color,
      image,
      show_avatar: showAvatar
    }, member.id, guild);

    const embed = new EmbedBuilder()
      .setTitle('✅ Welcome Messages Configured')
      .setDescription('Welcome message settings have been updated successfully!')
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
          value: `**Format:** ${embedEnabled ? 'Embed' : 'Plain text'}\n**Color:** ${color}\n**Image:** ${image ? 'Set' : 'None'}\n**Show Avatar:** ${showAvatar ? 'Yes' : 'No'}`,
          inline: true
        },
        {
          name: '🌐 Advanced Configuration',
          value: `**[Open Dashboard](${DASHBOARD_URL}?guild=${guild.id})**\n*Configure more advanced welcome settings*`,
          inline: false
        }
      ])
      .setColor(0x43b581)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logger.logCommand(guild.id, guild, 'welcome-config', member.id, true, { 
      channelId: channel?.id,
      embedEnabled 
    });

  } catch (error) {
    console.error('Error in welcome setup:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'welcomeSetupCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to configure welcome messages.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// View welcome configuration
async function handleViewWelcomeCommand(interaction) {
  try {
    const guild = interaction.guild;
    const config = await getWelcomeConfig(guild.id);
    const isEnabled = await isWelcomeEnabled(guild.id);

    const embed = new EmbedBuilder()
      .setTitle('👋 Welcome Configuration')
      .setDescription(isEnabled ? 'Welcome messages are currently **enabled**' : 'Welcome messages are currently **disabled**')
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
          value: config.color || '#00ff00',
          inline: true
        },
        {
          name: '🖼️ Image',
          value: config.image ? '[Set](' + config.image + ')' : 'None',
          inline: true
        },
        {
          name: '👤 Show Avatar',
          value: config.show_avatar !== false ? 'Yes' : 'No',
          inline: true
        },
        {
          name: '📝 Message Preview',
          value: processWelcomeMessage(config.message, interaction.user, guild),
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
          .setLabel('Configure Welcome')
          .setStyle(ButtonStyle.Primary)
          .setCustomId('configure_welcome')
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setLabel('Test Welcome')
          .setStyle(ButtonStyle.Secondary)
          .setCustomId('test_welcome')
          .setEmoji('🧪')
          .setDisabled(!isEnabled),
        new ButtonBuilder()
          .setLabel('Dashboard')
          .setStyle(ButtonStyle.Link)
          .setURL(`${DASHBOARD_URL}?guild=${guild.id}`)
          .setEmoji('🌐')
      );

    await interaction.reply({ embeds: [embed], components: [row] });
    await logger.logCommand(guild.id, guild, 'viewwelcome', interaction.member.id, true);

  } catch (error) {
    console.error('Error viewing welcome config:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'viewWelcomeCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to load welcome configuration.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// Toggle welcome messages
async function handleToggleWelcomeCommand(interaction) {
  try {
    const member = interaction.member;
    const guild = interaction.guild;

    if (!await isAdmin(member)) {
      const embed = new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('You need admin permissions to toggle welcome messages.')
        .setColor(0xff5555);
      
      return await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const currentStatus = await isWelcomeEnabled(guild.id);
    const newStatus = !currentStatus;

    await updateWelcomeConfig(guild.id, { enabled: newStatus }, member.id, guild);

    const embed = new EmbedBuilder()
      .setTitle(`✅ Welcome Messages ${newStatus ? 'Enabled' : 'Disabled'}`)
      .setDescription(`Welcome messages have been **${newStatus ? 'enabled' : 'disabled'}** for this server.`)
      .setColor(newStatus ? 0x43b581 : 0xff5555)
      .addFields([
        {
          name: '🌐 Full Configuration',
          value: `**[Open Dashboard](${DASHBOARD_URL}?guild=${guild.id})**\n*Configure advanced welcome settings*`,
          inline: false
        }
      ])
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logger.logCommand(guild.id, guild, 'toggle-welcome', member.id, true, { enabled: newStatus });

  } catch (error) {
    console.error('Error toggling welcome:', error);
    await logger.logError(interaction.guild?.id, interaction.guild, error, { 
      context: 'toggleWelcomeCommand',
      userId: interaction.user.id 
    });
    
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription('Failed to toggle welcome messages.')
      .setColor(0xff5555);

    await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
}

// Slash command definitions
const slashCommands = [
  new SlashCommandBuilder()
    .setName('welcome-config')
    .setDescription('Configure welcome messages for new members (admin only)')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Channel to send welcome messages')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Welcome message (use {user}, {server}, {membercount} as placeholders)')
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
        .setDescription('Embed color (hex format, e.g., #00ff00)')
        .setMaxLength(7)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('image')
        .setDescription('Image URL for the welcome embed')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('show_avatar')
        .setDescription('Show user avatar in welcome message (default: true)')
        .setRequired(false)
    ),
  
  new SlashCommandBuilder()
    .setName('viewwelcome')
    .setDescription('View current welcome message configuration'),
  
  new SlashCommandBuilder()
    .setName('toggle-welcome')
    .setDescription('Enable or disable welcome messages (admin only)')
];

// Slash command handlers
const slashHandlers = {
  'welcome-config': handleWelcomeSetupCommand,
  viewwelcome: handleViewWelcomeCommand,
  'toggle-welcome': handleToggleWelcomeCommand
};

// Available commands for this cog
const availableCommands = {
  'welcome-config': 'Configure welcome messages for new members (admin only)',
  viewwelcome: 'View the current welcome configuration',
  'toggle-welcome': 'Enable or disable welcome messages (admin only)'
};

// Event handlers
const eventHandlers = {
  guildMemberAdd: sendWelcomeMessage
};

module.exports = {
  name: 'enhanced-welcome',
  slashCommands,
  slashHandlers,
  availableCommands,
  eventHandlers,
  
  // Export functions for use by other modules
  sendWelcomeMessage,
  getWelcomeConfig,
  isWelcomeEnabled,
  updateWelcomeConfig
};