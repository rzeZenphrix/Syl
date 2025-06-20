// Permission and blacklist/whitelist utility
const fs = require('fs');
const configPath = require('path').resolve(__dirname, '../../guildConfigs.json');

function isBlacklisted(guildId, userId, command) {
  const configs = JSON.parse(fs.readFileSync(configPath));
  const bl = configs[guildId]?.blacklist || {};
  return bl[command]?.includes(userId);
}

function isWhitelisted(guildId, userId, command) {
  const configs = JSON.parse(fs.readFileSync(configPath));
  const wl = configs[guildId]?.whitelist || {};
  return wl[command]?.includes(userId);
}

function isBotProtected(targetId, clientId) {
  return targetId === clientId;
}

module.exports = { isBlacklisted, isWhitelisted, isBotProtected };
