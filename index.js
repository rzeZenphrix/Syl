// index.js
// Discord.js v14 Moderator Bot with Linux-like Commands, Multiple Prefixes & Guild Config

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require('discord.js');
const {
  checkCooldown,
  isBlacklisted,
  isWhitelisted,
  isUserRestricted,
  protectBot
} = require('./src/features');
const { logEvent } = require('./src/utils/logger');
const { supabase } = require('./src/utils/supabase');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const prefixes = [';', '&'];

// Load or initialize guild configs
const configPath = path.resolve(__dirname, 'guildConfigs.json');
let guildConfigs = {};
if (fs.existsSync(configPath)) {
  guildConfigs = JSON.parse(fs.readFileSync(configPath));
}

// Initialize client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

// Define slash commands with extended setup
const slashCommands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Initialize bot roles and restrictions')
    .addRoleOption(opt => opt.setName('adminrole').setDescription('Primary admin role').setRequired(true))
    .addStringOption(opt => opt.setName('extras').setDescription('Comma-separated additional roles'))
    .addStringOption(opt => opt.setName('disabled').setDescription('Comma-separated commands to disable')),
  new SlashCommandBuilder().setName('ls').setDescription('List text channels'),
  new SlashCommandBuilder().setName('ps').setDescription('List online members'),
  new SlashCommandBuilder()
    .setName('whois')
    .setDescription('Get user info')
    .addUserOption(opt => opt.setName('member').setDescription('Member to lookup')),
  new SlashCommandBuilder()
    .setName('kill')
    .setDescription('Ban a member')
    .addUserOption(opt => opt.setName('member').setDescription('Member to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for ban')),
  new SlashCommandBuilder()
    .setName('rm')
    .setDescription('Kick a member')
    .addUserOption(opt => opt.setName('member').setDescription('Member to kick').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for kick')),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages')
    .addIntegerOption(opt => opt.setName('limit').setDescription('Number of messages').setMinValue(1).setMaxValue(100).setRequired(true)),
  new SlashCommandBuilder()    .setName('mkdir')
    .setDescription('Create a role')
    .addStringOption(opt => opt.setName('name').setDescription('Name for the new role').setRequired(true)),
  new SlashCommandBuilder()
    .setName('rmdir')
    .setDescription('Delete a role')
    .addRoleOption(opt => opt.setName('role').setDescription('Role to delete').setRequired(true)),
  new SlashCommandBuilder()
    .setName('echo')
    .setDescription('Echo text')
    .addStringOption(opt => opt.setName('message').setDescription('Text to echo').setRequired(true)),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('View or edit guild configuration')
    .addStringOption(opt => opt.setName('action').setDescription('view or edit').setRequired(true))
    .addStringOption(opt => opt.setName('key').setDescription('Config key for editing'))
    .addStringOption(opt => opt.setName('value').setDescription('New value for the config key')),
  new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('Change the command prefix for the server')
    .addStringOption(opt => opt.setName('symbol').setDescription('New prefix symbol').setRequired(true)),
  new SlashCommandBuilder()
    .setName('reset-config')
    .setDescription('Reset the guild configuration to default'),
  new SlashCommandBuilder()
    .setName('logchannel')
    .setDescription('Set the channel for bot logs')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel to send logs')),
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something')
    .addStringOption(opt => opt.setName('message').setDescription('Message for the bot to say').setRequired(true))
].map(cmd => cmd.toJSON());

// Validate environment variables
if (!token || !clientId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID');
  process.exit(1);
}

// Register slash commands
const rest = new REST({ version: '10' }).setToken(token);
(async () => {
  try {
    await rest.put(Routes.applicationCommands(clientId), { body: slashCommands });
    console.log('Slash commands registered.');
  } catch (err) { console.error(err); }
})();

// Save configs helper
function saveConfigs() {
  fs.writeFileSync(configPath, JSON.stringify(guildConfigs, null, 2));
}

// Helper: fetch guild config from Supabase
async function getGuildConfig(guildId) {
  const { data, error } = await supabase.from('guild_configs').select('*').eq('guild_id', guildId).single();
  if (error && error.code !== 'PGRST116') console.error('Supabase fetch error:', error);
  return data || {};
}
// Helper: save guild config to Supabase
async function setGuildConfig(guildId, config) {
  const { error } = await supabase.from('guild_configs').upsert([{ guild_id: guildId, ...config }], { onConflict: ['guild_id'] });
  if (error) console.error('Supabase upsert error:', error);
}

// Check if member is admin per guild config
async function isAdmin(member) {
  const cfg = await getGuildConfig(member.guild.id);
  const roles = [cfg.admin_role, ...(cfg.extra_roles || [])].filter(Boolean);
  return member.permissions.has(PermissionsBitField.Flags.Administrator) ||
         roles.some(r => member.roles.cache.has(r));
}

// Check if command disabled
async function isDisabled(cmd, guildId) {
  const cfg = await getGuildConfig(guildId);
  return (cfg.disabled_commands || []).includes(cmd);
}

// Utility to send embed
async function sendEmbed(target, title, description, fields = []) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description || '\u200B')
    .setColor(0x3498db)
    .addFields(fields);
  await target.send({ embeds: [embed] });
}

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));

// Global error handler
client.on('error', (err) => {
  console.error('Discord client error:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection:', err);
});

// PREFIX COMMANDS
// Modular command registry for prefix commands
const prefixCommands = {
  ls: async (msg, args) => {
    const names = msg.guild.channels.cache.filter(c => c.isTextBased()).map(c => c.name).join(', ');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Channels').setDescription(names || 'None').setColor(0x3498db)] });
  },
  ps: async (msg, args) => {
    const online = msg.guild.members.cache.filter(m => m.presence?.status === 'online').map(m => m.user.tag).join(', ');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Online Members').setDescription(online || 'None').setColor(0x3498db)] });
  },
  whoami: async (msg, args) => {
    const member = msg.member;
    return msg.reply({ embeds: [new EmbedBuilder()
      .setTitle('User Info')
      .addFields(
        { name: 'Username', value: member.user.tag, inline: true },
        { name: 'ID', value: member.id, inline: true },
        { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`, inline: true }
      )
      .setColor(0x3498db)
    ] });
  },
  echo: async (msg, args) => {
    const text = args.join(' ');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Echo').setDescription(text).setColor(0x3498db)] });
  },
  ban: async (msg, args) => {
    const target = msg.mentions.members.first();
    const reason = args.slice(1).join(' ') || 'No reason';
    if (!target) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Mention a user to ban.').setColor(0xe74c3c)] });
    await target.ban({ reason });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Ban Executed').setDescription(`${target.user.tag} banned\nReason: ${reason}`).setColor(0xe74c3c)] });
  },
  kick: async (msg, args) => {
    const target = msg.mentions.members.first();
    const reason = args.slice(1).join(' ') || 'No reason';
    if (!target) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Mention a user to kick.').setColor(0xe67e22)] });
    await target.kick(reason);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Kick Executed').setDescription(`${target.user.tag} kicked\nReason: ${reason}`).setColor(0xe67e22)] });
  },
  warn: async (msg, args) => {
    const target = msg.mentions.members.first();
    const reason = args.slice(1).join(' ');
    if (!target || !reason) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Usage: ;warn @user <reason>').setColor(0xf1c40f)] });
    const warns = guildConfigs[msg.guild.id]?.warnings || {};
    warns[target.id] = warns[target.id] || [];
    warns[target.id].push({ reason, by: msg.author.id, date: Date.now() });
    guildConfigs[msg.guild.id] = { ...guildConfigs[msg.guild.id], warnings: warns };
    saveConfigs();
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Warned').setDescription(`${target.user.tag} warned: ${reason}`).setColor(0xf1c40f)] });
  },
  warnings: async (msg, args) => {
    const target = msg.mentions.members.first();
    if (!target) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Mention a user.').setColor(0xf1c40f)] });
    const warns = guildConfigs[msg.guild.id]?.warnings?.[target.id] || [];
    if (!warns.length) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Warnings').setDescription('No warnings.').setColor(0xf1c40f)] });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Warnings').setDescription(warns.map((w, i) => `${i+1}. ${w.reason} (<@${w.by}>, <t:${Math.floor(w.date/1000)}:R>)`).join('\n')).setColor(0xf1c40f)] });
  },
  clearwarn: async (msg, args) => {
    const target = msg.mentions.members.first();
    if (!target) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Mention a user.').setColor(0xf1c40f)] });
    if (guildConfigs[msg.guild.id]?.warnings) {
      delete guildConfigs[msg.guild.id].warnings[target.id];
      saveConfigs();
    }
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Warnings Cleared').setDescription(`Cleared warnings for ${target.user.tag}`).setColor(0xf1c40f)] });
  },
  mute: async (msg, args) => {
    const target = msg.mentions.members.first();
    if (!target) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Mention a user.').setColor(0x95a5a6)] });
    let muteRole = msg.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (!muteRole) muteRole = await msg.guild.roles.create({ name: 'Muted', color: 0x95a5a6 });
    await target.roles.add(muteRole);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Muted').setDescription(`${target.user.tag} has been muted.`).setColor(0x95a5a6)] });
  },
  unmute: async (msg, args) => {
    const target = msg.mentions.members.first();
    if (!target) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Mention a user.').setColor(0x95a5a6)] });
    let muteRole = msg.guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
    if (muteRole) await target.roles.remove(muteRole);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unmuted').setDescription(`${target.user.tag} has been unmuted.`).setColor(0x95a5a6)] });
  },
  purge: async (msg, args) => {
    let limit = parseInt(args[0]) || 10;
    if (isNaN(limit) || limit < 1 || limit > 100) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Limit must be between 1 and 100.').setColor(0xe74c3c)] });
    try {
      const deleted = await msg.channel.bulkDelete(limit, true);
      return msg.channel.send({ embeds: [new EmbedBuilder().setTitle('Purge').setDescription(`${deleted.size} messages deleted`).setColor(0x3498db)] });
    } catch (e) {
      console.error('Prefix command error (purge):', e);
      return msg.channel.send({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Failed to purge messages.').setColor(0xe74c3c)] });
    }
  },
  lock: async (msg, args) => {
    const channel = msg.mentions.channels.first() || msg.channel;
    await channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: false });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Channel Locked').setDescription(`${channel} is now locked.`).setColor(0x34495e)] });
  },
  unlock: async (msg, args) => {
    const channel = msg.mentions.channels.first() || msg.channel;
    await channel.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: true });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Channel Unlocked').setDescription(`${channel} is now unlocked.`).setColor(0x2ecc71)] });
  },
  slowmode: async (msg, args) => {
    const seconds = parseInt(args[0]);
    if (isNaN(seconds) || seconds < 0 || seconds > 21600) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Provide a valid number of seconds (0-21600).').setColor(0xe67e22)] });
    await msg.channel.setRateLimitPerUser(seconds);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Slowmode').setDescription(`Set slowmode to ${seconds} seconds.`).setColor(0xe67e22)] });
  },
  timeout: async (msg, args) => {
    const target = msg.mentions.members.first();
    const duration = args[1];
    if (!target || !duration) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Usage: ;timeout @user <duration>').setColor(0xe67e22)] });
    const ms = require('ms')(duration);
    if (!ms) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Invalid duration.').setColor(0xe67e22)] });
    await target.timeout(ms);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Timeout').setDescription(`${target.user.tag} timed out for ${duration}.`).setColor(0xe67e22)] });
  },
  nuke: async (msg, args) => {
    try {
      const channel = msg.mentions.channels.first() || msg.channel;
      const newChannel = await channel.clone();
      await channel.delete();
      await newChannel.send({ embeds: [new EmbedBuilder().setTitle('Nuked').setDescription(`${newChannel} has been created and old messages cleared.`).setColor(0xe74c3c)] });
    } catch (e) {
      console.error('Prefix command error (nuke):', e);
      // Can't reply in deleted channel, so log only
    }
  },
  useradd: async (msg, args) => {
    const target = msg.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    const role = msg.guild.roles.cache.find(r => r.name === roleName) || msg.mentions.roles.first();
    if (!target || !role) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Usage: ;useradd @user <role>').setColor(0x9b59b6)] });
    await target.roles.add(role);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Role Added').setDescription(`${role.name} added to ${target.user.tag}.`).setColor(0x9b59b6)] });
  },
  userdel: async (msg, args) => {
    const target = msg.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    const role = msg.guild.roles.cache.find(r => r.name === roleName) || msg.mentions.roles.first();
    if (!target || !role) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Usage: ;userdel @user <role>').setColor(0x9b59b6)] });
    await target.roles.remove(role);
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Role Removed').setDescription(`${role.name} removed from ${target.user.tag}.`).setColor(0x9b59b6)] });
  },
  server: async (msg, args) => {
    const g = msg.guild;
    return msg.reply({ embeds: [new EmbedBuilder()
      .setTitle('Server Info')
      .addFields(
        { name: 'Name', value: g.name, inline: true },
        { name: 'Members', value: `${g.memberCount}`, inline: true },
        { name: 'Roles', value: `${g.roles.cache.size}`, inline: true }
      )
      .setColor(0x1abc9c)
    ] });
  },
  roles: async (msg, args) => {
    const roles = msg.guild.roles.cache.map(r => r.name).join(', ');
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Roles').setDescription(roles || 'None').setColor(0x1abc9c)] });
  },
  avatar: async (msg, args) => {
    const target = msg.mentions.users.first() || msg.author;
    return msg.reply({ embeds: [new EmbedBuilder().setTitle(`${target.tag}'s Avatar`).setImage(target.displayAvatarURL({ dynamic: true, size: 512 })).setColor(0x7289da)] });
  },
  ping: async (msg, args) => {
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Pong!').setDescription(`Latency: ${Date.now() - msg.createdTimestamp}ms`).setColor(0x7289da)] });
  },
  uptime: async (msg, args) => {
    const ms = require('ms');
    const uptime = ms(process.uptime() * 1000, { long: true });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Uptime').setDescription(uptime).setColor(0x7289da)] });
  },
  poll: async (msg, args) => {
    const match = msg.content.match(/"([^"]+)"/g);
    if (!match || match.length < 2) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';poll "Question?" "Option1" "Option2" ...').setColor(0x7289da)] });
    const question = match[0].replace(/"/g, '');
    const options = match.slice(1).map(s => s.replace(/"/g, ''));
    if (options.length < 2 || options.length > 10) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Provide 2-10 options.').setColor(0xe74c3c)] });
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    let desc = options.map((opt, i) => `${emojis[i]} ${opt}`).join('\n');
    const pollMsg = await msg.channel.send({ embeds: [new EmbedBuilder().setTitle('Poll').setDescription(`**${question}**\n\n${desc}`).setColor(0x7289da)] });
    for (let i = 0; i < options.length; i++) await pollMsg.react(emojis[i]);
    return msg.reply({ content: 'Poll created!', allowedMentions: { repliedUser: true } });
  },
  embed: async (msg, args) => {
    const content = args.join(' ').split('|');
    if (content.length < 2) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';embed <title> | <description>').setColor(0x7289da)] });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle(content[0].trim()).setDescription(content[1].trim()).setColor(0x7289da)] });
  },
  emoji: async (msg, args) => {
    const name = args[0];
    if (!name) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';emoji <name>').setColor(0x7289da)] });
    const emoji = msg.guild.emojis.cache.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!emoji) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Not Found').setDescription('No emoji found.').setColor(0xe74c3c)] });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Emoji').setDescription(`${emoji} \\:${emoji.name}\\:`).setColor(0x7289da)] });
  },
  translate: async (msg, args) => {
    const lang = args[0];
    const text = args.slice(1).join(' ');
    if (!lang || !text) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';translate <lang> <text>').setColor(0x7289da)] });
    // Placeholder: Integrate with a translation API for real translation
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Translate').setDescription(`(Pretend this is "${text}" in ${lang})`).setColor(0x7289da)] });
  },
  createrole: async (msg, args) => {
    const name = args[0];
    const color = args[1] || undefined;
    if (!name) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';createrole <name> [color]').setColor(0x1abc9c)] });
    const role = await msg.guild.roles.create({ name, color });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Role Created').setDescription(`Created role: ${role.name}`).setColor(0x1abc9c)] });
  },
  deleterole: async (msg, args) => {
    const name = args[0];
    if (!name) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription(';deleterole <name>').setColor(0x1abc9c)] });
    const role = msg.guild.roles.cache.find(r => r.name === name);
    if (!role) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Not Found').setDescription('Role not found.').setColor(0xe74c3c)] });
    await role.delete();
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Role Deleted').setDescription(`Deleted role: ${name}`).setColor(0x1abc9c)] });
  },
  roleinfo: async (msg, args) => {
    const name = args[0];
    const role = msg.guild.roles.cache.find(r => r.name === name) || msg.mentions.roles.first();
    if (!role) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Not Found').setDescription('Role not found.').setColor(0xe74c3c)] });
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Role Info').addFields(
      { name: 'Name', value: role.name, inline: true },
      { name: 'ID', value: role.id, inline: true },
      { name: 'Color', value: role.hexColor, inline: true },
      { name: 'Members', value: `${role.members.size}`, inline: true }
    ).setColor(role.color || 0x1abc9c)] });
  },
  autorole: async (msg, args) => {
    const name = args[0];
    const role = msg.guild.roles.cache.find(r => r.name === name) || msg.mentions.roles.first();
    if (!role) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Not Found').setDescription('Role not found.').setColor(0xe74c3c)] });
    if (!guildConfigs[msg.guild.id]) guildConfigs[msg.guild.id] = {};
    guildConfigs[msg.guild.id].autorole = role.id;
    saveConfigs();
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Autorole Set').setDescription(`New users will get ${role.name}.`).setColor(0x1abc9c)] });
  },
  eval: async (msg, args) => {
    if (msg.author.id !== process.env.BOT_OWNER_ID) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Owner only.').setColor(0xe74c3c)] });
    try {
      const code = args.join(' ');
      let evaled = eval(code);
      if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Eval Result').setDescription('```js\n' + evaled + '\n```').setColor(0x7289da)] });
    } catch (e) {
      return msg.reply({ embeds: [new EmbedBuilder().setTitle('Eval Error').setDescription('```js\n' + e + '\n```').setColor(0xe74c3c)] });
    }
  },
  reload: async (msg, args) => {
    if (msg.author.id !== process.env.BOT_OWNER_ID) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Owner only.').setColor(0xe74c3c)] });
    // In a real bot, reload command modules dynamically
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Reload').setDescription('Command handlers reloaded (placeholder).').setColor(0x7289da)] });
  },
  shutdown: async (msg, args) => {
    if (msg.author.id !== process.env.BOT_OWNER_ID) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Owner only.').setColor(0xe74c3c)] });
    await msg.reply({ embeds: [new EmbedBuilder().setTitle('Shutdown').setDescription('Bot is shutting down...').setColor(0xe74c3c)] });
    process.exit(0);
  },
  logs: async (msg, args) => {
    if (msg.author.id !== process.env.BOT_OWNER_ID) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('Owner only.').setColor(0xe74c3c)] });
    // Placeholder: send latest logs as file or DM
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Logs').setDescription('Log sending not implemented.').setColor(0x7289da)] });
  },
  help: async (msg, args) => {
    const helpText = `**Available Commands:**\n\n` +
      Object.keys(prefixCommands).map(cmd => `;${cmd}`).join(', ') +
      `\n\nUse / for slash command versions where available.`;
    return msg.reply({ embeds: [new EmbedBuilder().setTitle('Help').setDescription(helpText).setColor(0x7289da)] });
  },
  // --- Security features (scaffolded) ---
  // To implement: blacklist/whitelist, cooldowns, user restrictions, bot self-protection
};

client.on('messageCreate', async msg => {
  try {
    if (!msg.guild || msg.author.bot) return;
    const prefix = (guildConfigs[msg.guild.id]?.prefixes || prefixes).find(p => msg.content.startsWith(p));
    if (!prefix) return;
    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    if (cmd === 'setup') return; // handled elsewhere
    if (!isAdmin(msg.member) || isDisabled(cmd, msg.guild.id)) return;
    if (protectBot(msg.member)) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('You cannot use this command on the bot.').setColor(0xe74c3c)] });
    if (isBlacklisted(msg.guild.id, msg.author.id, cmd)) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Blacklisted').setDescription('You are blacklisted from this command.').setColor(0xe74c3c)] });
    if (isUserRestricted(msg.guild.id, msg.author.id, cmd)) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Restricted').setDescription('You are restricted from this command.').setColor(0xe74c3c)] });
    const cooldown = checkCooldown(msg.author.id, cmd, 3000);
    if (cooldown) return msg.reply({ embeds: [new EmbedBuilder().setTitle('Cooldown').setDescription(`Wait ${Math.ceil(cooldown/1000)}s before using this command again.`).setColor(0xf1c40f)] });
    if (prefixCommands[cmd]) {
      try {
        await prefixCommands[cmd](msg, args);
        logEvent(msg.guild, 'Command Used', `${msg.author.tag} used \`${cmd}\` in ${msg.channel}`);
      } catch (e) {
        console.error(`Prefix command error (${cmd}):`, e);
        await msg.reply({ content: `Error: ${e.message}` });
      }
      return;
    }
  } catch (e) {
    console.error('messageCreate handler error:', e);
  }
});

// SLASH COMMANDS
// Modular slash command registry
const slashCommandHandlers = {
  setup: async (inter) => {
    // Only allow server owner
    if (inter.guild.ownerId !== inter.user.id) {
      return inter.reply({ content: 'Only the server owner can run /setup.', ephemeral: true });
    }
    // Prompt for admin role, extra roles, and disabled commands
    const adminRole = inter.options.getRole('adminrole');
    const extras = inter.options.getString('extras')?.split(',').map(r => r.trim()).filter(Boolean) || [];
    const disabled = inter.options.getString('disabled')?.split(',').map(c => c.trim()).filter(Boolean) || [];
    const config = { admin_role: adminRole.id, extra_roles: extras, disabled_commands: disabled };
    await setGuildConfig(inter.guild.id, config);
    return inter.reply({ content: `✅ Config Saved\nAdmin: <@&${adminRole.id}>\nExtras: ${extras.map(r => `<@&${r}>`).join(', ') || 'None'}\nDisabled: ${disabled.join(', ') || 'None'}`, ephemeral: true });
  },
  ls: async (inter) => {
    const names = inter.guild.channels.cache.filter(c => c.isTextBased()).map(c => c.name).join(', ');
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Channels').setDescription(`📂 ${names || 'None'}`)] });
  },
  ps: async (inter) => {
    const online = inter.guild.members.cache.filter(m => m.presence?.status === 'online').map(m => m.user.tag).join(', ');
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Online Members').setDescription(`👥 ${online || 'None'}`)] });
  },
  whois: async (inter) => {
    const member = inter.options.getMember('member') || inter.member;
    return inter.reply({ embeds: [new EmbedBuilder()
      .setTitle('User Info')
      .addFields(
        { name: 'Username', value: member.user.tag, inline: true },
        { name: 'ID', value: member.id, inline: true },
        { name: 'Joined', value: `<t:${Math.floor(member.joinedTimestamp/1000)}:R>`, inline: true }
      )
    ] });
  },
  kill: async (inter) => {
    const target = inter.options.getMember('member');
    const reason = inter.options.getString('reason') || 'No reason';
    await target.ban({ reason });
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Ban Executed').setDescription(`${target.user.tag} banned
Reason: ${reason}`)] });
  },
  rm: async (inter) => {
    const target = inter.options.getMember('member');
    const reason = inter.options.getString('reason') || 'No reason';
    await target.kick(reason);
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Kick Executed').setDescription(`${target.user.tag} kicked
Reason: ${reason}`)] });
  },
  purge: async (inter) => {
    const limit = inter.options.getInteger('limit');
    const deleted = await inter.channel.bulkDelete(limit, true);
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Purge').setDescription(`${deleted.size} messages deleted`)] });
  },
  mkdir: async (inter) => {
    const name = inter.options.getString('name');
    const role = await inter.guild.roles.create({ name });
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Role Created').setDescription(`Role: ${role.name}`)] });
  },
  rmdir: async (inter) => {
    const role = inter.options.getRole('role');
    await role.delete();
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Role Deleted').setDescription(role.name)] });
  },
  echo: async (inter) => {
    const text = inter.options.getString('message');
    return inter.reply({ embeds: [new EmbedBuilder().setTitle('Echo').setDescription(text)] });
  },
  config: async (inter) => {
    const action = inter.options.getString('action');
    if (action === 'view') {
      const cfg = guildConfigs[inter.guild.id] || {};
      return inter.reply({ embeds: [new EmbedBuilder().setTitle('Guild Config').setDescription('```json\n' + JSON.stringify(cfg, null, 2) + '\n```').setColor(0x95a5a6)] });
    } else if (action === 'edit') {
      const key = inter.options.getString('key');
      const value = inter.options.getString('value');
      if (!key || !value) return inter.reply({ embeds: [new EmbedBuilder().setTitle('Error').setDescription('Key and value are required.').setColor(0xe74c3c)] });
      guildConfigs[inter.guild.id] = { ...guildConfigs[inter.guild.id], [key]: value };
      saveConfigs();
      return inter.reply({ embeds: [new EmbedBuilder().setTitle('Config Updated').setDescription(`${key} set to ${value}`).setColor(0x2ecc71)] });
    } else {
      return inter.reply({ embeds: [new EmbedBuilder().setTitle('Usage').setDescription('/config view | /config edit <key> <value>').setColor(0x95a5a6)] });
    }
  },
  logchannel: async (inter) => {
    try {
      const channel = inter.options.getChannel('channel');
      if (!channel) return await inter.reply({ content: 'Please specify a channel.', ephemeral: true });
      guildConfigs[inter.guild.id] = guildConfigs[inter.guild.id] || {};
      guildConfigs[inter.guild.id].logChannel = channel.id;
      saveConfigs();
      await inter.reply({ content: `Log channel set to <#${channel.id}>.`, ephemeral: true });
    } catch (e) {
      console.error('Slash command error (logchannel):', e);
      if (!inter.replied) await inter.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
  prefix: async (inter) => {
    try {
      const symbol = inter.options.getString('symbol');
      if (!symbol) return await inter.reply({ content: 'Please provide a prefix symbol.', ephemeral: true });
      guildConfigs[inter.guild.id] = guildConfigs[inter.guild.id] || {};
      guildConfigs[inter.guild.id].prefixes = [symbol];
      saveConfigs();
      await inter.reply({ content: `Prefix set to \`${symbol}\``, ephemeral: true });
    } catch (e) {
      console.error('Slash command error (prefix):', e);
      if (!inter.replied) await inter.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
  'reset-config': async (inter) => {
    try {
      guildConfigs[inter.guild.id] = {};
      saveConfigs();
      await inter.reply({ content: 'All settings reset to default.', ephemeral: true });
    } catch (e) {
      console.error('Slash command error (reset-config):', e);
      if (!inter.replied) await inter.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
  say: async (inter) => {
    try {
      const text = inter.options.getString('message');
      if (!text) return await inter.reply({ content: 'Please provide a message.', ephemeral: true });
      await inter.reply({ content: text });
    } catch (e) {
      console.error('Slash command error (say):', e);
      if (!inter.replied) await inter.reply({ content: `Error: ${e.message}`, ephemeral: true });
    }
  },
  help: async (inter) => {
    const helpText = `**Available Commands:**\n\n` +
      Object.keys(prefixCommands).map(cmd => `;${cmd}`).join(', ') +
      `\n\nUse / for slash command versions where available.`;
    await inter.reply({ embeds: [new EmbedBuilder().setTitle('Help').setDescription(helpText).setColor(0x7289da)], ephemeral: true });
  },
};

client.on('interactionCreate', async inter => {
  try {
    if (!inter.isCommand()) return;
    const cmd = inter.commandName;
    if (!isAdmin(inter.member) || isDisabled(cmd, inter.guild.id))
      return inter.reply({ content: '🚫 Not authorized or command disabled', ephemeral: true });
    if (protectBot(inter.member)) return inter.reply({ content: 'You cannot use this command on the bot.', ephemeral: true });
    if (isBlacklisted(inter.guild.id, inter.user.id, cmd)) return inter.reply({ content: 'You are blacklisted from this command.', ephemeral: true });
    if (isUserRestricted(inter.guild.id, inter.user.id, cmd)) return inter.reply({ content: 'You are restricted from this command.', ephemeral: true });
    const cooldown = checkCooldown(inter.user.id, cmd, 3000);
    if (cooldown) return inter.reply({ content: `Wait ${Math.ceil(cooldown/1000)}s before using this command again.`, ephemeral: true });
    if (slashCommandHandlers[cmd]) {
      try {
        await slashCommandHandlers[cmd](inter);
        logEvent(inter.guild, 'Slash Command Used', `${inter.user.tag} used /${cmd} in <#${inter.channel.id}>`);
      } catch (e) {
        console.error(`Slash command error (${cmd}):`, e);
        if (!inter.replied) await inter.reply({ content: `Error: ${e.message}`, ephemeral: true });
      }
      return;
    }
  } catch (e) {
    console.error('interactionCreate handler error:', e);
    if (inter && !inter.replied) await inter.reply({ content: `Error: ${e.message}`, ephemeral: true });
  }
});

client.login(token);

// --- Event listeners for logging moderation events ---
client.on('guildBanAdd', ban => {
  logEvent(ban.guild, 'Ban', `${ban.user.tag} was banned.`);
});
client.on('guildMemberRemove', member => {
  logEvent(member.guild, 'Member Left', `${member.user.tag} left or was kicked.`);
});
client.on('messageDelete', msg => {
  logEvent(msg.guild, 'Message Deleted', `A message by ${msg.author?.tag || 'unknown'} was deleted in <#${msg.channel.id}>.`);
});
client.on('messageUpdate', (oldMsg, newMsg) => {
  logEvent(newMsg.guild, 'Message Edited', `A message by ${newMsg.author?.tag || 'unknown'} was edited in <#${newMsg.channel.id}>.`);
});
// ...add more as needed...