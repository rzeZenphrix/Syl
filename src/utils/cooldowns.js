// Cooldown utility
const cooldowns = new Map();

function checkCooldown(userId, command, seconds) {
  const now = Date.now();
  if (!cooldowns.has(command)) cooldowns.set(command, new Map());
  const timestamps = cooldowns.get(command);
  if (timestamps.has(userId)) {
    const expire = timestamps.get(userId);
    if (now < expire) return (expire - now) / 1000;
  }
  timestamps.set(userId, now + seconds * 1000);
  return 0;
}

module.exports = { checkCooldown };
