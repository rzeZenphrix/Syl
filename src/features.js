// Advanced features: cooldowns, blacklists, whitelists, user restrictions, bot self-protection, logging

const cooldowns = new Map();
const blacklists = new Map();
const whitelists = new Map();
const userRestrictions = new Map();

function checkCooldown(userId, command, cooldown = 3000) {
  if (!cooldowns.has(command)) cooldowns.set(command, new Map());
  const now = Date.now();
  const timestamps = cooldowns.get(command);
  if (timestamps.has(userId)) {
    const expiration = timestamps.get(userId) + cooldown;
    if (now < expiration) return expiration - now;
  }
  timestamps.set(userId, now);
  return 0;
}

function isBlacklisted(guildId, userId, command) {
  const guild = blacklists.get(guildId) || {};
  return guild[command]?.includes(userId);
}

function isWhitelisted(guildId, userId, command) {
  const guild = whitelists.get(guildId) || {};
  return guild[command]?.includes(userId);
}

function isUserRestricted(guildId, userId, command) {
  const guild = userRestrictions.get(guildId) || {};
  return guild[command]?.includes(userId);
}

function protectBot(member) {
  // Prevent banning/kicking the bot
  return member.id === member.client.user.id;
}

module.exports = {
  checkCooldown,
  isBlacklisted,
  isWhitelisted,
  isUserRestricted,
  protectBot
};
