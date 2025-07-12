# Asylum Discord Bot

A highly configurable, multi-server Discord moderation bot built with Discord.js v14, featuring Linux-style commands and a modular cog system.

## Features

- **Linux-style Commands**: Commands like `;ls`, `;ps`, `;kill` for a unique feel
- **Multiple Prefixes**: Supports both `;` and `&` prefixes
- **Slash Commands**: Modern Discord slash command integration
- **Modular Cog System**: Organized, maintainable code structure
- **Supabase Integration**: PostgreSQL database for persistent storage
- **Role-based Permissions**: Configurable admin roles and command restrictions
- **Comprehensive Moderation**: Ban, kick, warn, mute, purge, and more
- **Welcome/Goodbye Messages**: Customizable member join/leave messages
- **Ticket System**: Support ticket creation and management
- **Logging**: Detailed moderation action logging
- **🛡️ Raid Prevention**: Advanced raid detection and auto-lock protection
- **🛡️ Anti-Nuke Protection**: Protect against malicious server destruction
- **🎭 Avatar Stealing**: Fun utility to steal user avatars

## New Features

### 🛡️ Raid Prevention System

The bot now includes comprehensive raid prevention that monitors both member joins and message spam:

**Features:**
- **Join Raid Detection**: Monitors rapid member joins (default: 10 joins in 30 seconds)
- **Message Raid Detection**: Monitors message spam (default: 20 messages in 10 seconds)
- **Auto-Lock**: Automatically locks all channels during detected raids
- **Configurable Thresholds**: Adjust detection sensitivity per server
- **Logging**: Detailed raid logs with user lists and timestamps

**Commands:**
```bash
;raid on                    # Enable raid protection
;raid off                   # Disable raid protection
;raid threshold 15          # Set custom threshold
;raid autolock on          # Enable auto-lock during raids
/raid action:on            # Slash command version
```

### 🛡️ Anti-Nuke Protection

Protect your server from malicious administrators or compromised accounts:

**Features:**
- **Action Monitoring**: Tracks rapid channel deletions, role deletions, and mass bans
- **Whitelist System**: Trusted users can bypass protection
- **Auto-Ban**: Automatically ban violators (configurable)
- **Audit Log Integration**: Uses Discord's audit logs for accurate detection
- **Owner-Only Configuration**: Only server owners can configure anti-nuke

**Commands:**
```bash
;antinuke on                    # Enable anti-nuke protection
;antinuke off                   # Disable anti-nuke protection
;antinuke whitelist add @user   # Add user to whitelist
;antinuke whitelist remove @user # Remove user from whitelist
;antinuke autoban on           # Enable auto-ban for violators
/antinuke action:on            # Slash command version
```

### 🎭 Steal Command

A utility command to "steal" emojis from other servers:

**Usage:**
```bash
;steal 🎉 party          # Steal emoji and rename it to "party"
;steal 🚀                # Steal emoji with default name
/steal emoji:🎉 name:party # Slash command version
```

**Features:**
- Copy custom emojis from any server
- Rename emojis during import
- Supports both static and animated emojis
- Admin-only command for security

## Cog System

The bot uses a modular cog system for better organization and maintainability:

### Available Cogs

- **moderation.js**: Ban, kick, warn, purge, raid prevention, anti-nuke, and other moderation commands
- **utility.js**: Server info, user info, ping, uptime, steal, and general utilities
- **setup.js**: Server configuration, admin role setup, and bot settings

### Creating New Cogs

To create a new cog, create a file in `src/cogs/` with the following structure:

```javascript
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Prefix commands
const prefixCommands = {
  commandname: async (msg, args) => {
    // Command logic here
  }
};

// Slash commands
const slashCommands = [
  new SlashCommandBuilder()
    .setName('commandname')
    .setDescription('Command description')
    .addStringOption(opt => opt.setName('option').setDescription('Option description').setRequired(true))
];

// Slash command handlers
const slashHandlers = {
  commandname: async (interaction) => {
    // Slash command logic here
  }
};

module.exports = {
  name: 'cogname',
  prefixCommands,
  slashCommands,
  slashHandlers
};
```

## Database Schema

The bot uses Supabase PostgreSQL with the following tables:

### guild_configs
- `guild_id` (PK): Discord guild ID
- `admin_role_id`: Primary admin role ID
- `extra_role_ids`: Array of additional admin role IDs
- `disabled_commands`: Array of disabled command names
- `log_channel`: Channel ID for moderation logs
- `autorole`: Role ID for automatic assignment
- `custom_prefix`: Custom command prefix for this guild
- `raid_protection_enabled`: Whether raid protection is enabled
- `raid_protection_threshold`: Custom raid detection threshold
- `raid_auto_lock`: Whether to auto-lock channels during raids
- `anti_nuke_enabled`: Whether anti-nuke protection is enabled
- `anti_nuke_whitelist`: Array of whitelisted user IDs
- `anti_nuke_auto_ban`: Whether to auto-ban anti-nuke violators

### Additional Tables
- `raid_logs`: Records of detected raids
- `antinuke_logs`: Records of anti-nuke violations
- `warnings`: User warning records
- `modlogs`: Moderation action logs
- `mutes`: User mute records
- `blacklist`: Blacklisted users
- `ticket_types`: Ticket category definitions
- `tickets`: Active tickets
- `welcome_configs`: Welcome message settings
- `goodbye_configs`: Goodbye message settings

## Setup Instructions

### 1. Environment Setup

Create a `.env` file in the root directory:

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_client_id
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
BOT_OWNER_ID=your_discord_user_id
```

### 2. Supabase Setup

1. Create a new Supabase project
2. Run the following SQL to create the required tables:

```sql
-- Run the complete setup script
-- Use: sql/new_features.sql
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Bot

```bash
node index.js
```

## Bot Setup

### Initial Server Configuration

1. Invite the bot to your server with appropriate permissions
2. Run `/setup` as the server owner to configure:
   - Admin role (required)
   - Extra admin roles (optional)
   - Disabled commands (optional)

### Command Permissions

- **Server Owner**: Can run `/setup`, `/antinuke`, and all commands
- **Admin Role Members**: Can run all moderation and configuration commands
- **Extra Role Members**: Same permissions as admin role
- **Regular Members**: Can only run utility commands (unless disabled)

### Available Commands

#### Prefix Commands (use `;` or `&`)
- `ls` - List all text channels
- `ps` - List online members
- `whoami` - Show user info
- `ban @user [reason]` - Ban a user
- `kick @user [reason]` - Kick a user
- `warn @user <reason>` - Warn a user
- `warnings [@user]` - Show warnings
- `clearwarn @user` - Clear user warnings
- `purge <1-100>` - Bulk delete messages
- `blacklist @user <reason>` - Add user to blacklist
- `unblacklist @user` - Remove user from blacklist
- `mute @user <duration> [reason]` - Mute a user (30s, 5m, 2h, 1d)
- `unmute @user` - Unmute a user
- `timeout @user <duration> [reason]` - Timeout a user (30s, 5m, 2h, 1d)
- `raid <on/off/threshold/autolock>` - Configure raid prevention (admin only)
- `antinuke <on/off/whitelist/autoban>` - Configure anti-nuke protection (owner only)
- `steal [@user]` - Steal a user's avatar
- `ping` - Check bot latency
- `uptime` - Show bot uptime
- `server` - Show server info
- `roles` - List all roles
- `avatar [@user]` - Show user avatar
- `poll <question>` - Create a poll with reactions
- `setup @adminrole [extra roles...]` - Configure bot (owner only)
- `config` - Show server configuration
- `logchannel #channel` - Set log channel
- `say <message>` - Make bot say something
- `reset-config` - Reset server configuration (owner only)
- `autorole @role` - Set autorole for new members
- `prefix [new_prefix]` - Set custom command prefix (owner only)
- `help` - Show help message

#### Slash Commands
- `/setup` - Configure server settings (owner only)
- `/logchannel #channel` - Set log channel
- `/say <message>` - Make bot say something
- `/reset-config` - Reset server configuration (owner only)
- `/autorole [role]` - Set autorole for new members
- `/prefix [new_prefix]` - Set custom command prefix (owner only)
- `/ban @user [reason]` - Ban a user
- `/kick @user [reason]` - Kick a user
- `/warn @user <reason>` - Warn a user
- `/blacklist @user [reason]` - Add user to blacklist
- `/unblacklist @user` - Remove user from blacklist
- `/mute @user <duration> [reason]` - Mute a user
- `/unmute @user` - Unmute a user
- `/timeout @user <duration> [reason]` - Timeout a user
- `/raid` - Configure raid prevention (admin only)
- `/antinuke` - Configure anti-nuke protection (owner only)
- `/steal [user]` - Steal a user's avatar
- `/ping` - Check bot latency
- `/uptime` - Show bot uptime
- `/server` - Show server info
- `/avatar [user]` - Show user avatar
- `/poll <question>` - Create a poll with reactions

## Security Features

### Raid Prevention
- **Real-time Monitoring**: Continuously monitors member joins and message activity
- **Configurable Thresholds**: Adjust sensitivity based on server size and activity
- **Auto-Lock**: Automatically locks channels during detected raids
- **Detailed Logging**: Complete audit trail of all raid events

### Anti-Nuke Protection
- **Action Tracking**: Monitors channel deletions, role deletions, and mass bans
- **Whitelist System**: Trusted administrators can bypass protection
- **Auto-Ban**: Automatically ban malicious users
- **Audit Log Integration**: Uses Discord's native audit logs for accuracy

## Error Handling and Support

- All critical errors are logged to the configured log channel in your server.
- The server owner is notified via DM for major failures (e.g., ticket creation issues).
- User-facing error messages include a unique trace ID. Provide this ID to staff or the bot owner for faster troubleshooting.
- A web dashboard for error logs is available. Run `node scripts/log-dashboard.js` and visit `http://localhost:4000/logs` (set LOG_DASHBOARD_PASSWORD for security). You can search logs by trace ID, context, or date, and download the full log file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For support, please open an issue on GitHub or contact the bot owner. 