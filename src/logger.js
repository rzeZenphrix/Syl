// Logger for moderation and system events
const { EmbedBuilder } = require('discord.js');

async function logEvent(guild, type, description, color = 0x7289da) {
  const config = require('../guildConfigs.json')[guild.id] || {};
  const logChannelId = config.logChannel;
  if (!logChannelId) return;
  const channel = guild.channels.cache.get(logChannelId);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setTitle(type)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
  await channel.send({ embeds: [embed] });
}

module.exports = { logEvent };
