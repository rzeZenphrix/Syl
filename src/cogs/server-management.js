const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

// Store confirmation states
const confirmationStates = new Map();
const lockdownStates = new Map();

// Helper function to check if user is admin
async function isAdmin(member) {
  if (!member || !member.guild) return false;
  if (member.guild.ownerId === member.id) return true;
  if (member.permissions.has('Administrator')) return true;
  return false;
}

// Helper function to validate emoji URLs
function isValidEmojiUrl(url) {
  if (!url) return false;
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

// Extract emoji URLs from a message
function extractEmojiUrls(message) {
  const emojiRegex = /<a?:(\w+):(\d+)>/g;
  const urls = [];
  let match;
  
  while ((match = emojiRegex.exec(message)) !== null) {
    const [, name, id] = match;
    const isAnimated = match[0].startsWith('<a:');
    const extension = isAnimated ? 'gif' : 'png';
    urls.push({
      name: name,
      url: `https://cdn.discordapp.com/emojis/${id}.${extension}`,
      animated: isAnimated
    });
  }
  
  return urls;
}

// Prefix commands
const prefixCommands = {
  // Server kill command - ADMINISTRATOR ONLY
  kill: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply('❌ You need administrator permissions to use this command.');
    }

    // Additional check: Only server owner or users with Administrator permission
    if (msg.guild.ownerId !== msg.author.id && !msg.member.permissions.has('Administrator')) {
      return msg.reply('❌ Only the server owner or users with Administrator permission can use this command.');
    }

    const confirmationId = `kill_${msg.guild.id}_${msg.author.id}_${Date.now()}`;
    confirmationStates.set(confirmationId, {
      userId: msg.author.id,
      guildId: msg.guild.id,
      step: 1,
      timestamp: Date.now()
    });

    const embed = new EmbedBuilder()
      .setTitle('💀 SERVER KILL CONFIRMATION')
      .setDescription(`**⚠️ THIS WILL PERMANENTLY DELETE THE ENTIRE SERVER!**\n\n🚨 **DANGER - THIS ACTION CANNOT BE UNDONE!**\n🚨 **THE SERVER WILL BE COMPLETELY DESTROYED!**\n🚨 **ALL CHANNELS, ROLES, AND DATA WILL BE LOST!**\n\n**Server:** ${msg.guild.name}\n**Members:** ${msg.guild.memberCount}\n**Channels:** ${msg.guild.channels.cache.size}\n**Roles:** ${msg.guild.roles.cache.size}`)
      .addFields(
        { name: '💥 Action', value: 'Delete entire server', inline: true },
        { name: '👥 Affected', value: `${msg.guild.memberCount} members`, inline: true },
        { name: '⏰ Step', value: '1 of 3', inline: true }
      )
      .setColor(0xff0000)
      .setFooter({ text: 'Type "CONFIRM KILL" to proceed (case sensitive)' });

    await msg.reply({ embeds: [embed] });

    // Clean up old confirmations
    setTimeout(() => {
      confirmationStates.delete(confirmationId);
    }, 60000); // 1 minute timeout
  },

  // SAFER ALTERNATIVE: Server lockdown instead of kill
  lockdown: async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply('❌ You need administrator permissions to use this command.');
    }

    const mode = args[0]?.toLowerCase();
    if (!mode || !['kick', 'ban'].includes(mode)) {
      return msg.reply('❌ Usage: `;lockdown kick` or `;lockdown ban`\n\n⚠️ **WARNING**: This will lock down the entire server and remove all members!');
    }

    const confirmationId = `lockdown_${msg.guild.id}_${msg.author.id}_${Date.now()}`;
    confirmationStates.set(confirmationId, {
      userId: msg.author.id,
      guildId: msg.guild.id,
      mode: mode,
      step: 1,
      timestamp: Date.now()
    });

    const embed = new EmbedBuilder()
      .setTitle('🚨 SERVER LOCKDOWN CONFIRMATION')
      .setDescription(`**This will ${mode.toUpperCase()} ALL MEMBERS and lock the server!**\n\n⚠️ **THIS IS IRREVERSIBLE!**\n⚠️ **ALL MEMBERS WILL BE REMOVED!**\n⚠️ **ONLY USE IN EMERGENCIES!**`)
      .addFields(
        { name: '🎯 Action', value: mode === 'kick' ? 'Kick all members' : 'Ban all members', inline: true },
        { name: '👥 Affected', value: `${msg.guild.memberCount} members`, inline: true },
        { name: '⏰ Step', value: '1 of 3', inline: true }
      )
      .setColor(0xff0000)
      .setFooter({ text: 'Type "CONFIRM LOCKDOWN" to proceed (case sensitive)' });

    await msg.reply({ embeds: [embed] });

    // Clean up old confirmations
    setTimeout(() => {
      confirmationStates.delete(confirmationId);
    }, 60000); // 1 minute timeout
  },

  // Bulk emoji stealing command
  'steal-emojis': async (msg, args) => {
    if (!await isAdmin(msg.member)) {
      return msg.reply('❌ You need administrator permissions to steal emojis.');
    }

    if (!msg.guild.members.me.permissions.has('ManageEmojisAndStickers')) {
      return msg.reply('❌ I need "Manage Emojis and Stickers" permission to add emojis.');
    }

    // Extract emojis from the message or replies
    let targetMessage = msg;
    if (msg.reference) {
      try {
        targetMessage = await msg.channel.messages.fetch(msg.reference.messageId);
      } catch (error) {
        return msg.reply('❌ Could not fetch the referenced message.');
      }
    }

    const emojis = extractEmojiUrls(targetMessage.content);
    
    if (emojis.length === 0) {
      return msg.reply('❌ No custom emojis found in the message. React to a message with emojis or reply to a message containing emojis.');
    }

    if (emojis.length > 20) {
      return msg.reply(`❌ Too many emojis found (${emojis.length}). Maximum is 20 per command.`);
    }

    const embed = new EmbedBuilder()
      .setTitle('🎭 Steal Emojis')
      .setDescription(`Found ${emojis.length} emoji(s) to steal:`)
      .addFields(
        emojis.slice(0, 10).map((emoji, index) => ({
          name: `${index + 1}. ${emoji.name}`,
          value: `${emoji.animated ? 'Animated' : 'Static'} emoji`,
          inline: true
        }))
      )
      .setColor(0x9b59b6)
      .setFooter({ text: emojis.length > 10 ? `Showing first 10 of ${emojis.length} emojis` : `${emojis.length} emoji(s) total` });

    const confirmMsg = await msg.reply({ embeds: [embed] });
    await confirmMsg.react('✅');
    await confirmMsg.react('❌');

    const filter = (reaction, user) => {
      return ['✅', '❌'].includes(reaction.emoji.name) && user.id === msg.author.id;
    };

    try {
      const collected = await confirmMsg.awaitReactions({ filter, max: 1, time: 30000, errors: ['time'] });
      const reaction = collected.first();

      if (reaction.emoji.name === '❌') {
        return confirmMsg.edit({ content: '❌ Emoji stealing cancelled.', embeds: [] });
      }

      // Proceed with stealing emojis
      await confirmMsg.edit({ content: '🔄 Stealing emojis...', embeds: [] });

      const results = [];
      let success = 0;
      let failed = 0;

      for (const emoji of emojis) {
        try {
          const newEmoji = await msg.guild.emojis.create({
            attachment: emoji.url,
            name: emoji.name
          });
          results.push(`✅ ${newEmoji} - ${emoji.name}`);
          success++;
        } catch (error) {
          results.push(`❌ ${emoji.name} - ${error.message}`);
          failed++;
        }

        // Add delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const resultEmbed = new EmbedBuilder()
        .setTitle('🎭 Emoji Stealing Results')
        .setDescription(results.join('\n'))
        .addFields(
          { name: '✅ Success', value: success.toString(), inline: true },
          { name: '❌ Failed', value: failed.toString(), inline: true },
          { name: '📊 Total', value: emojis.length.toString(), inline: true }
        )
        .setColor(success > failed ? 0x27ae60 : 0xe74c3c);

      await confirmMsg.edit({ content: '', embeds: [resultEmbed] });

    } catch (error) {
      await confirmMsg.edit({ content: '⏰ Confirmation timed out. Emoji stealing cancelled.', embeds: [] });
    }
  }
};

// Handle confirmation messages
async function handleMessage(msg) {
  if (msg.author.bot) return;

  // Handle kill confirmations
  for (const [confirmationId, data] of confirmationStates.entries()) {
    if (data.userId === msg.author.id && data.guildId === msg.guild?.id) {
      if (Date.now() - data.timestamp > 60000) {
        confirmationStates.delete(confirmationId);
        continue;
      }

      // Handle kill command confirmations
      if (confirmationId.startsWith('kill_')) {
        if (data.step === 1 && msg.content === 'CONFIRM KILL') {
          data.step = 2;
          const embed = new EmbedBuilder()
            .setTitle('💀 FINAL SERVER KILL CONFIRMATION')
            .setDescription(`**⚠️ LAST CHANCE TO CANCEL!**\n\nThis will **PERMANENTLY DELETE** the server "${msg.guild.name}"!\n\n**🚨 THIS ACTION CANNOT BE UNDONE! 🚨**\n\n**TYPE "EXECUTE KILL" TO PROCEED**\n**TYPE ANYTHING ELSE TO CANCEL**`)
            .addFields({ name: '⏰ Step', value: '2 of 3', inline: true })
            .setColor(0xff0000)
            .setFooter({ text: 'The server will be permanently destroyed!' });

          await msg.reply({ embeds: [embed] });
        } else if (data.step === 2 && msg.content === 'EXECUTE KILL') {
          data.step = 3;
          confirmationStates.delete(confirmationId);

          const embed = new EmbedBuilder()
            .setTitle('💀 EXECUTING SERVER KILL')
            .setDescription(`Deleting server "${msg.guild.name}"...`)
            .setColor(0xff0000);

          const statusMsg = await msg.reply({ embeds: [embed] });
          await executeServerKill(msg.guild, statusMsg, msg.author);
        } else if (data.step === 2) {
          // Any other message cancels the kill
          confirmationStates.delete(confirmationId);
          const embed = new EmbedBuilder()
            .setTitle('💀 SERVER KILL CANCELLED')
            .setDescription('Server kill operation has been cancelled.')
            .setColor(0x27ae60);
          await msg.reply({ embeds: [embed] });
        }
      }
      // Handle lockdown confirmations
      else if (data.step === 1 && msg.content === 'CONFIRM LOCKDOWN') {
        data.step = 2;
        const embed = new EmbedBuilder()
          .setTitle('🚨 FINAL CONFIRMATION')
          .setDescription(`**LAST CHANCE TO CANCEL!**\n\nThis will ${data.mode.toUpperCase()} all ${msg.guild.memberCount} members from ${msg.guild.name}!\n\n**TYPE "EXECUTE LOCKDOWN" TO PROCEED**`)
          .addFields({ name: '⏰ Step', value: '2 of 3', inline: true })
          .setColor(0xff0000)
          .setFooter({ text: 'This action cannot be undone!' });

        await msg.reply({ embeds: [embed] });
      } else if (data.step === 2 && msg.content === 'EXECUTE LOCKDOWN') {
        data.step = 3;
        confirmationStates.delete(confirmationId);

        const embed = new EmbedBuilder()
          .setTitle('🚨 EXECUTING LOCKDOWN')
          .setDescription(`Beginning ${data.mode} of all members...`)
          .setColor(0xff0000);

        const statusMsg = await msg.reply({ embeds: [embed] });
        await executeLockdown(msg.guild, data.mode, statusMsg, msg.author);
      }
    }
  }
}

// Execute the lockdown (safer than deletion)
async function executeLockdown(guild, mode, statusMsg, executor) {
  try {
    const members = await guild.members.fetch();
    const targetMembers = members.filter(member => 
      !member.user.bot && 
      member.id !== guild.ownerId && 
      member.id !== executor.id
    );

    let processed = 0;
    let errors = 0;

    for (const [, member] of targetMembers) {
      try {
        if (mode === 'kick') {
          await member.kick(`Server lockdown executed by ${executor.tag}`);
        } else {
          await member.ban({ reason: `Server lockdown executed by ${executor.tag}` });
        }
        processed++;
        
        // Update status every 10 members
        if (processed % 10 === 0) {
          const embed = new EmbedBuilder()
            .setTitle('🚨 LOCKDOWN IN PROGRESS')
            .setDescription(`${mode}ed ${processed}/${targetMembers.size} members...`)
            .setColor(0xff9500);
          await statusMsg.edit({ embeds: [embed] });
        }

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        errors++;
        console.error(`Failed to ${mode} member ${member.user.tag}:`, error);
      }
    }

    const finalEmbed = new EmbedBuilder()
      .setTitle('🚨 LOCKDOWN COMPLETE')
      .setDescription(`Server lockdown finished!`)
      .addFields(
        { name: '✅ Processed', value: processed.toString(), inline: true },
        { name: '❌ Errors', value: errors.toString(), inline: true },
        { name: '👤 Executor', value: executor.tag, inline: true }
      )
      .setColor(0x27ae60)
      .setTimestamp();

    await statusMsg.edit({ embeds: [finalEmbed] });

  } catch (error) {
    console.error('Lockdown execution error:', error);
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ LOCKDOWN FAILED')
      .setDescription(`An error occurred during lockdown: ${error.message}`)
      .setColor(0xe74c3c);
    await statusMsg.edit({ embeds: [errorEmbed] });
  }
}

// Execute server kill (permanent deletion)
async function executeServerKill(guild, statusMsg, executor) {
  try {
    // Log the server kill attempt
    console.log(`[SERVER KILL] ${executor.tag} (${executor.id}) is deleting server "${guild.name}" (${guild.id})`);
    
    // Update status
    const embed = new EmbedBuilder()
      .setTitle('💀 DELETING SERVER')
      .setDescription(`**Server "${guild.name}" is being permanently deleted...**\n\n⚠️ This action cannot be undone!`)
      .addFields(
        { name: '👤 Executor', value: executor.tag, inline: true },
        { name: '📅 Date', value: new Date().toLocaleString(), inline: true }
      )
      .setColor(0xff0000)
      .setTimestamp();

    await statusMsg.edit({ embeds: [embed] });

    // Small delay before deletion to ensure the message is sent
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Delete the server
    await guild.delete();
    
    // Note: We can't send a success message because the server no longer exists
    console.log(`[SERVER KILL] Server "${guild.name}" (${guild.id}) has been successfully deleted by ${executor.tag}`);

  } catch (error) {
    console.error('Server kill execution error:', error);
    
    // Try to send error message if the guild still exists
    try {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ SERVER KILL FAILED')
        .setDescription(`An error occurred while deleting the server: ${error.message}`)
        .addFields(
          { name: '🔍 Error Details', value: error.code ? `Error Code: ${error.code}` : 'Unknown error', inline: true },
          { name: '👤 Executor', value: executor.tag, inline: true }
        )
        .setColor(0xe74c3c)
        .setTimestamp();
      
      await statusMsg.edit({ embeds: [errorEmbed] });
    } catch (editError) {
      console.error('Failed to send error message:', editError);
    }
  }
}

module.exports = {
  name: 'server-management',
  prefixCommands,
  
  // Export message handler for confirmations
  handleMessage,
  
  // Available commands
  availableCommands: {
    kill: 'PERMANENTLY DELETE the entire server (ADMINISTRATOR ONLY - EXTREMELY DANGEROUS). Usage: `;kill` - Requires server owner or Administrator permission',
    lockdown: 'Emergency server lockdown - kicks/bans all members (DANGEROUS). Usage: `;lockdown kick` or `;lockdown ban`',
    'steal-emojis': 'Steal up to 20 emojis from a message. Reply to a message with emojis or use in a channel with emoji messages. Usage: `;steal-emojis`'
  }
};