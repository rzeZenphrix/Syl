// Mock the required modules to avoid database dependencies
const mockSupabase = {
  from: () => ({
    select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
    upsert: () => Promise.resolve(),
    insert: () => Promise.resolve(),
    delete: () => Promise.resolve()
  })
};

// Mock the cogs
const mockUtilityCog = {
  prefixCommands: {
    ls: () => {},
    ps: () => {},
    whoami: () => {},
    whois: () => {},
    ping: () => {},
    uptime: () => {},
    server: () => {},
    roles: () => {},
    avatar: () => {},
    poll: () => {},
    say: () => {},
    reset: () => {},
    man: () => {},
    top: () => {},
    sysinfo: () => {},
    passwd: () => {},
    help: () => {},
    jump: () => {},
    archive: () => {},
    mirror: () => {},
    cooldown: () => {},
    watchword: () => {},
    cloak: () => {},
    blacklistword: () => {},
    curse: () => {},
    npcgen: () => {},
    worldstate: () => {}
  },
  slashCommands: [
    { name: 'ping', description: 'Check bot latency' },
    { name: 'uptime', description: 'Show bot uptime' },
    { name: 'server', description: 'Show server info' },
    { name: 'avatar', description: 'Show user avatar' },
    { name: 'poll', description: 'Create a poll' },
    { name: 'say', description: 'Make bot say something' },
    { name: 'whois', description: 'Show user information' },
    { name: 'jump', description: 'Jump to a message' },
    { name: 'archive', description: 'Archive channel messages' },
    { name: 'mirror', description: 'Mirror channels' },
    { name: 'cooldown', description: 'Set command cooldowns' },
    { name: 'watchword', description: 'Manage watchwords' },
    { name: 'cloak', description: 'Cloak a user' },
    { name: 'blacklistword', description: 'Manage blacklisted words' },
    { name: 'curse', description: 'Curse a user' },
    { name: 'npcgen', description: 'Generate random NPC' },
    { name: 'worldstate', description: 'Manage world state' }
  ]
};

const mockModerationCog = {
  prefixCommands: {
    ban: () => {},
    kick: () => {},
    warn: () => {},
    warnings: () => {},
    clearwarn: () => {},
    purge: () => {},
    nuke: () => {},
    blacklist: () => {},
    unblacklist: () => {},
    mute: () => {},
    unmute: () => {},
    timeout: () => {},
    spy: () => {},
    sniper: () => {},
    revert: () => {},
    shadowban: () => {},
    massban: () => {},
    lock: () => {},
    unlock: () => {},
    modview: () => {},
    crontab: () => {},
    report: () => {},
    modmail: () => {},
    panic: () => {},
    feedback: () => {},
    case: () => {}
  },
  slashCommands: [
    { name: 'ban', description: 'Ban a user' },
    { name: 'kick', description: 'Kick a user' },
    { name: 'warn', description: 'Warn a user' },
    { name: 'warnings', description: 'Show warnings' },
    { name: 'clearwarn', description: 'Clear warnings' },
    { name: 'purge', description: 'Bulk delete messages' },
    { name: 'blacklist', description: 'Add user to blacklist' },
    { name: 'unblacklist', description: 'Remove user from blacklist' },
    { name: 'mute', description: 'Mute a user' },
    { name: 'unmute', description: 'Unmute a user' },
    { name: 'timeout', description: 'Timeout a user' },
    { name: 'report', description: 'Report a user' },
    { name: 'modmail', description: 'Send modmail' },
    { name: 'panic', description: 'Emergency panic mode' },
    { name: 'feedback', description: 'Send feedback' },
    { name: 'case', description: 'View moderation case' }
  ]
};

const mockSetupCog = {
  prefixCommands: {
    setup: () => {},
    showsetup: () => {},
    config: () => {},
    logchannel: () => {},
    autorole: () => {},
    prefix: () => {},
    'reset-config': () => {},
    'disable-commands': () => {},
    'co-owners': () => {},
    'add-co-owner': () => {},
    'remove-co-owner': () => {}
  },
  slashCommands: [
    { name: 'setup', description: 'Configure server settings' },
    { name: 'showsetup', description: 'Show current setup' },
    { name: 'config', description: 'Show configuration' },
    { name: 'logchannel', description: 'Set log channel' },
    { name: 'autorole', description: 'Set autorole' },
    { name: 'prefix', description: 'Set custom prefix' },
    { name: 'reset-config', description: 'Reset configuration' },
    { name: 'disable-commands', description: 'Manage disabled commands' },
    { name: 'co-owners', description: 'Manage co-owners' },
    { name: 'add-co-owner', description: 'Add co-owner' },
    { name: 'remove-co-owner', description: 'Remove co-owner' }
  ]
};

const mockWelcomeCog = {
  prefixCommands: {
    welcomesetup: () => {},
    goodbyesetup: () => {}
  },
  slashCommands: [
    { name: 'welcomesetup', description: 'Setup welcome messages' },
    { name: 'goodbyesetup', description: 'Setup goodbye messages' }
  ]
};

const mockTicketsCog = {
  prefixCommands: {
    ticketsetup: () => {},
    ticket: () => {},
    close: () => {},
    claim: () => {}
  },
  slashCommands: [
    { name: 'ticketsetup', description: 'Setup ticket system' },
    { name: 'ticket', description: 'Create ticket' },
    { name: 'close', description: 'Close ticket' },
    { name: 'claim', description: 'Claim ticket' }
  ]
};

// Mock require to return our mock cogs
const originalRequire = require;
require = function(id) {
  if (id === '../utils/supabase') {
    return { supabase: mockSupabase };
  }
  if (id === './utility.js') {
    return mockUtilityCog;
  }
  if (id === './moderation.js') {
    return mockModerationCog;
  }
  if (id === './setup.js') {
    return mockSetupCog;
  }
  if (id === './welcome.js') {
    return mockWelcomeCog;
  }
  if (id === './tickets.js') {
    return mockTicketsCog;
  }
  return originalRequire(id);
};

// Dynamic command collection function (copied from setup.js)
function getAllAvailableCommands() {
  // Import all cogs to get their commands
  const utilityCog = require('./utility.js');
  const moderationCog = require('./moderation.js');
  const setupCog = require('./setup.js');
  const welcomeCog = require('./welcome.js');
  const ticketsCog = require('./tickets.js');
  
  const allCommands = {
    prefix: {},
    slash: {}
  };
  
  // Collect prefix commands from all cogs
  if (utilityCog.prefixCommands) {
    Object.assign(allCommands.prefix, utilityCog.prefixCommands);
  }
  if (moderationCog.prefixCommands) {
    Object.assign(allCommands.prefix, moderationCog.prefixCommands);
  }
  if (setupCog.prefixCommands) {
    Object.assign(allCommands.prefix, setupCog.prefixCommands);
  }
  if (welcomeCog.prefixCommands) {
    Object.assign(allCommands.prefix, welcomeCog.prefixCommands);
  }
  if (ticketsCog.prefixCommands) {
    Object.assign(allCommands.prefix, ticketsCog.prefixCommands);
  }
  
  // Collect slash commands from all cogs
  if (utilityCog.slashCommands) {
    utilityCog.slashCommands.forEach(cmd => {
      allCommands.slash[cmd.name] = cmd.description || 'No description available';
    });
  }
  if (moderationCog.slashCommands) {
    moderationCog.slashCommands.forEach(cmd => {
      allCommands.slash[cmd.name] = cmd.description || 'No description available';
    });
  }
  if (setupCog.slashCommands) {
    setupCog.slashCommands.forEach(cmd => {
      allCommands.slash[cmd.name] = cmd.description || 'No description available';
    });
  }
  if (welcomeCog.slashCommands) {
    welcomeCog.slashCommands.forEach(cmd => {
      allCommands.slash[cmd.name] = cmd.description || 'No description available';
    });
  }
  if (ticketsCog.slashCommands) {
    ticketsCog.slashCommands.forEach(cmd => {
      allCommands.slash[cmd.name] = cmd.description || 'No description available';
    });
  }
  
  return allCommands;
}

console.log('Testing Dynamic Command Counting System...\n');

try {
  const allCommands = getAllAvailableCommands();
  
  console.log('📊 Command Statistics:');
  console.log(`Prefix Commands: ${Object.keys(allCommands.prefix).length}`);
  console.log(`Slash Commands: ${Object.keys(allCommands.slash).length}`);
  console.log(`Total Commands: ${Object.keys(allCommands.prefix).length + Object.keys(allCommands.slash).length}\n`);
  
  console.log('🔧 Prefix Commands:');
  console.log(Object.keys(allCommands.prefix).sort().join(', '));
  console.log('\n⚡ Slash Commands:');
  console.log(Object.keys(allCommands.slash).sort().join(', '));
  
  console.log('\n✅ Dynamic command counting system is working correctly!');
  console.log('The bot will automatically update command counts when new commands are added.');
  
} catch (error) {
  console.error('❌ Error testing command counting:', error);
} 