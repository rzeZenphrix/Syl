// Advanced features: cooldowns, command restrictions, and logging
const { isAdmin, isCommandEnabled, isBotProtected } = require('./utils/permissions');
const cooldowns = new Map();

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

module.exports = {
  checkCooldown,
  isAdmin,
  isCommandEnabled,
  isBotProtected
};
