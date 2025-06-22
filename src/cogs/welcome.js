const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { supabase } = require('../utils/supabase');

// Helper function to validate image URLs
function isValidImageUrl(url) {
  if (!url) return true; // No image is valid, so it's "correct"
  try {
    const parsedUrl = new URL(url);
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    // Check if the pathname ends with a valid extension
    const hasValidExtension = validExtensions.some(ext =>
      parsedUrl.pathname.toLowerCase().endsWith(ext)
    );
    // Also allow discord CDN links which might not have extensions
    const isDiscordCdn =
      parsedUrl.hostname.includes('cdn.discordapp.com') ||
      parsedUrl.hostname.includes('media.discordapp.net');
    return hasValidExtension || isDiscordCdn;
  } catch {
    // If new URL() fails, it's not a valid URL
    return false;
  }
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

// Available commands for this cog
const availableCommands = {
  welcomesetup: 'Setup welcome messages for new members',
  goodbyesetup: 'Setup goodbye messages for leaving members',
  viewwelcome: 'View the current welcome configuration',
  viewgoodbye: 'View the current goodbye configuration'
};

// Prefix commands
const prefixCommands = {
  welcomesetup: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';welcomesetup #channel [message] [color] [image_url]\n\nYou must mention a valid text channel.').setColor(0xe74c3c)] });
    }
    if (channel.type !== 0) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Channel').setDescription('Please mention a text channel, not a voice channel or category.').setColor(0xe74c3c)] });
    }
    
    const message = args.slice(1).join(' ') || 'Welcome {user} to {server}! 🎉';
    const color = args.find(arg => arg.startsWith('#')) || '#00ff00';
    const image = args.find(arg => arg.startsWith('http'));
    
    try {
      const { data, error } = await supabase.from('welcome_configs').upsert({
        guild_id: msg.guild.id,
        enabled: true,
        channel_id: channel.id,
        message,
        embed: true,
        color,
        image
      });
      console.log('[DEBUG] Welcome upsert result:', data, error);
      if (error) throw error;
      const embed = new EmbedBuilder()
        .setTitle('Welcome Message Setup Complete')
        .setDescription(`**Channel:** ${channel}\n**Message:** ${message}\n**Color:** ${color}\n**Image:** ${image || 'None'}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Welcome setup error:', e.message || JSON.stringify(e));
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to save welcome configuration.').setColor(0xe74c3c)] });
    }
  },

  goodbyesetup: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
    }
    const channel = msg.mentions.channels.first();
    if (!channel) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';goodbyesetup #channel [message] [color] [image_url]\n\nYou must mention a valid text channel.').setColor(0xe74c3c)] });
    }
    if (channel.type !== 0) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Invalid Channel').setDescription('Please mention a text channel, not a voice channel or category.').setColor(0xe74c3c)] });
    }
    
    const message = args.slice(1).join(' ') || 'Goodbye {user}! We\'ll miss you! 😢';
    const color = args.find(arg => arg.startsWith('#')) || '#ff0000';
    const image = args.find(arg => arg.startsWith('http'));
    
    try {
      const { data, error } = await supabase.from('goodbye_configs').upsert({
        guild_id: msg.guild.id,
        enabled: true,
        channel_id: channel.id,
        message,
        embed: true,
        color,
        image
      });
      console.log('[DEBUG] Goodbye upsert result:', data, error);
      if (error) throw error;
      const embed = new EmbedBuilder()
        .setTitle('Goodbye Message Setup Complete')
        .setDescription(`**Channel:** ${channel}\n**Message:** ${message}\n**Color:** ${color}\n**Image:** ${image || 'None'}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      return msg.reply({ embeds: [embed] });
    } catch (e) {
      console.error('Goodbye setup error:', e.message || JSON.stringify(e));
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to save goodbye configuration.').setColor(0xe74c3c)] });
    }
  },

  viewwelcome: async (msg) => {
    const { data, error } = await supabase.from('welcome_configs').select('*').eq('guild_id', msg.guild.id).single();
    if (error || !data) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Welcome Config').setDescription('No welcome config found.').setColor(0xe74c3c)] });
    }
    const embed = new EmbedBuilder()
      .setTitle('Welcome Config')
      .addFields(
        { name: 'Enabled', value: data.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Channel', value: data.channel_id ? `<#${data.channel_id}>` : 'Not set', inline: true },
        { name: 'Message', value: data.message || 'Not set', inline: false },
        { name: 'Embed', value: data.embed ? 'Yes' : 'No', inline: true },
        { name: 'Color', value: data.color || 'Default', inline: true },
        { name: 'Image', value: data.image || 'None', inline: false }
      )
      .setColor(0x1abc9c);
    return msg.reply({ embeds: [embed] });
  },

  viewgoodbye: async (msg) => {
    const { data, error } = await supabase.from('goodbye_configs').select('*').eq('guild_id', msg.guild.id).single();
    if (error || !data) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Goodbye Config').setDescription('No goodbye config found.').setColor(0xe74c3c)] });
    }
    const embed = new EmbedBuilder()
      .setTitle('Goodbye Config')
      .addFields(
        { name: 'Enabled', value: data.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Channel', value: data.channel_id ? `<#${data.channel_id}>` : 'Not set', inline: true },
        { name: 'Message', value: data.message || 'Not set', inline: false },
        { name: 'Embed', value: data.embed ? 'Yes' : 'No', inline: true },
        { name: 'Color', value: data.color || 'Default', inline: true },
        { name: 'Image', value: data.image || 'None', inline: false }
      )
      .setColor(0xe74c3c);
    return msg.reply({ embeds: [embed] });
  }
};

// Slash commands
const slashCommands = [
  new SlashCommandBuilder()
    .setName('welcomesetup')
    .setDescription('Setup welcome messages for new members')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for welcome messages').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(opt => opt.setName('message').setDescription('Welcome message (use {user}, {server}, {memberCount})').setRequired(false))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color for embed (e.g., #00ff00)').setRequired(false))
    .addStringOption(opt => opt.setName('image').setDescription('Image URL for embed').setRequired(false))
    .addBooleanOption(opt => opt.setName('embed').setDescription('Use embed format (default: true)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('goodbyesetup')
    .setDescription('Setup goodbye messages for leaving members')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for goodbye messages').addChannelTypes(ChannelType.GuildText).setRequired(false))
    .addStringOption(opt => opt.setName('message').setDescription('Goodbye message (use {user}, {server}, {memberCount})').setRequired(false))
    .addStringOption(opt => opt.setName('color').setDescription('Hex color for embed (e.g., #ff0000)').setRequired(false))
    .addStringOption(opt => opt.setName('image').setDescription('Image URL for embed').setRequired(false))
    .addBooleanOption(opt => opt.setName('embed').setDescription('Use embed format (default: true)').setRequired(false))
    .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable goodbye messages (default: true)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('viewwelcome')
    .setDescription('View the current welcome configuration'),

  new SlashCommandBuilder()
    .setName('viewgoodbye')
    .setDescription('View the current goodbye configuration')
];

// Slash command handlers
const slashHandlers = {
  welcomesetup: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Welcome {user} to {server}! 🎉';
    const color = interaction.options.getString('color') || '#00ff00';
    const image = interaction.options.getString('image');
    const useEmbed = interaction.options.getBoolean('embed') ?? true;

    // Validate image URL before saving
    if (image && !isValidImageUrl(image)) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Invalid Image URL')
        .setDescription('The URL you provided is not a direct link to an image. Please provide a link that ends in `.jpg`, `.png`, `.gif`, etc.')
        .addFields({ name: 'Example of a valid URL', value: '`https://i.imgur.com/some_image.gif`' })
        .setColor(0xe74c3c);
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
    
    try {
      await supabase.from('welcome_configs').upsert({
        guild_id: interaction.guild.id,
        enabled: true,
        channel_id: channel.id,
        message: message,
        embed: useEmbed,
        color: color,
        image: image
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Welcome Message Setup Complete')
        .setDescription(`**Channel:** ${channel}\n**Message:** ${message}\n**Color:** ${color}\n**Image:** ${image || 'None'}\n**Embed:** ${useEmbed ? 'Yes' : 'No'}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Welcome setup error:', e.message || JSON.stringify(e));
      return interaction.reply({ content: 'Failed to save welcome configuration.', ephemeral: true });
    }
  },

  goodbyesetup: async (interaction) => {
    if (!await isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
    }
    
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message') || 'Goodbye {user}! We\'ll miss you! 😢';
    const color = interaction.options.getString('color') || '#ff0000';
    const image = interaction.options.getString('image');
    const useEmbed = interaction.options.getBoolean('embed') ?? true;
    const enabled = interaction.options.getBoolean('enabled') ?? true;
    
    // Validate image URL before saving
    if (enabled && image && !isValidImageUrl(image)) {
      const errorEmbed = new EmbedBuilder()
        .setTitle('Invalid Image URL')
        .setDescription('The URL you provided is not a direct link to an image. Please provide a link that ends in `.jpg`, `.png`, `.gif`, etc.')
        .addFields({ name: 'Example of a valid URL', value: '`https://i.imgur.com/some_image.gif`' })
        .setColor(0xe74c3c);
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    if (!enabled) {
      try {
        await supabase.from('goodbye_configs').upsert({
          guild_id: interaction.guild.id,
          enabled: false
        }, { onConflict: ['guild_id'] });
        
        const embed = new EmbedBuilder()
          .setTitle('Goodbye Messages Disabled')
          .setDescription('Goodbye messages have been turned off for this server.')
          .setColor(0x2ecc71)
          .setTimestamp();
        
        return interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (e) {
        console.error('Goodbye disable error:', e);
        return interaction.reply({ content: 'Failed to disable goodbye messages.', ephemeral: true });
      }
    }
    
    try {
      await supabase.from('goodbye_configs').upsert({
        guild_id: interaction.guild.id,
        enabled: true,
        channel_id: channel.id,
        message: message,
        embed: useEmbed,
        color: color,
        image: image
      }, { onConflict: ['guild_id'] });
      
      const embed = new EmbedBuilder()
        .setTitle('Goodbye Message Setup Complete')
        .setDescription(`**Channel:** ${channel}\n**Message:** ${message}\n**Color:** ${color}\n**Image:** ${image || 'None'}\n**Embed:** ${useEmbed ? 'Yes' : 'No'}`)
        .setColor(0x2ecc71)
        .setTimestamp();
      
      return interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (e) {
      console.error('Goodbye setup error:', e);
      return interaction.reply({ content: 'Failed to save goodbye configuration.', ephemeral: true });
    }
  },

  viewwelcome: async (interaction) => {
    const { data, error } = await supabase.from('welcome_configs').select('*').eq('guild_id', interaction.guild.id).single();
    if (error || !data) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Welcome Config').setDescription('No welcome config found.').setColor(0xe74c3c)] });
    }
    const embed = new EmbedBuilder()
      .setTitle('Welcome Config')
      .addFields(
        { name: 'Enabled', value: data.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Channel', value: data.channel_id ? `<#${data.channel_id}>` : 'Not set', inline: true },
        { name: 'Message', value: data.message || 'Not set', inline: false },
        { name: 'Embed', value: data.embed ? 'Yes' : 'No', inline: true },
        { name: 'Color', value: data.color || 'Default', inline: true },
        { name: 'Image', value: data.image || 'None', inline: false }
      )
      .setColor(0x1abc9c);
    return interaction.reply({ embeds: [embed] });
  },

  viewgoodbye: async (interaction) => {
    const { data, error } = await supabase.from('goodbye_configs').select('*').eq('guild_id', interaction.guild.id).single();
    if (error || !data) {
      return interaction.reply({ embeds: [new EmbedBuilder().setTitle('Goodbye Config').setDescription('No goodbye config found.').setColor(0xe74c3c)] });
    }
    const embed = new EmbedBuilder()
      .setTitle('Goodbye Config')
      .addFields(
        { name: 'Enabled', value: data.enabled ? 'Yes' : 'No', inline: true },
        { name: 'Channel', value: data.channel_id ? `<#${data.channel_id}>` : 'Not set', inline: true },
        { name: 'Message', value: data.message || 'Not set', inline: false },
        { name: 'Embed', value: data.embed ? 'Yes' : 'No', inline: true },
        { name: 'Color', value: data.color || 'Default', inline: true },
        { name: 'Image', value: data.image || 'None', inline: false }
      )
      .setColor(0xe74c3c);
    return interaction.reply({ embeds: [embed] });
  }
};

module.exports = {
  name: 'welcome',
  prefixCommands,
  slashCommands,
  slashHandlers
}; 