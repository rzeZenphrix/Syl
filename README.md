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

## Cog System

The bot uses a modular cog system for better organization and maintainability:

### Available Cogs

- **moderation.js**: Ban, kick, warn, purge, and other moderation commands
- **utility.js**: Server info, user info, ping, uptime, and general utilities
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

### warnings
- `id` (PK): Auto-incrementing ID
- `guild_id`: Discord guild ID
- `user_id`: Discord user ID
- `reason`: Warning reason
- `warned_by`: Moderator user ID
- `date`: Timestamp

### modlogs
- `id` (PK): Auto-incrementing ID
- `guild_id`: Discord guild ID
- `user_id`: Target user ID
- `action`: Action type (ban, kick, warn, etc.)
- `moderator_id`: Moderator user ID
- `reason`: Action reason
- `date`: Timestamp

### Additional Tables
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
-- Create guild_configs table
CREATE TABLE guild_configs (
  guild_id BIGINT PRIMARY KEY,
  admin_role_id BIGINT,
  extra_role_ids BIGINT[],
  disabled_commands TEXT[],
  log_channel BIGINT,
  autorole BIGINT,
  custom_prefix TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create warnings table
CREATE TABLE warnings (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reason TEXT NOT NULL,
  warned_by BIGINT NOT NULL,
  date BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create modlogs table
CREATE TABLE modlogs (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  action TEXT NOT NULL,
  moderator_id BIGINT NOT NULL,
  reason TEXT,
  date BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create mutes table
CREATE TABLE mutes (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  muted_by BIGINT NOT NULL,
  reason TEXT,
  start_time BIGINT NOT NULL,
  end_time BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blacklist table
CREATE TABLE blacklist (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  added_by BIGINT NOT NULL,
  reason TEXT,
  date BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create ticket_types table
CREATE TABLE ticket_types (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  tags TEXT[],
  color TEXT,
  created_by BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tickets table
CREATE TABLE tickets (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  type_id INTEGER REFERENCES ticket_types(id),
  created_at BIGINT NOT NULL,
  closed_at BIGINT,
  closed_by BIGINT
);

-- Create welcome_configs table
CREATE TABLE welcome_configs (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  channel_id BIGINT,
  message TEXT,
  embed BOOLEAN DEFAULT true,
  color TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create goodbye_configs table
CREATE TABLE goodbye_configs (
  id SERIAL PRIMARY KEY,
  guild_id BIGINT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  channel_id BIGINT,
  message TEXT,
  embed BOOLEAN DEFAULT true,
  color TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_warnings_guild_user ON warnings(guild_id, user_id);
CREATE INDEX idx_modlogs_guild_user ON modlogs(guild_id, user_id);
CREATE INDEX idx_mutes_guild_user ON mutes(guild_id, user_id);
CREATE INDEX idx_blacklist_guild_user ON blacklist(guild_id, user_id);
CREATE INDEX idx_ticket_types_guild ON ticket_types(guild_id);
CREATE INDEX idx_tickets_guild ON tickets(guild_id);
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

- **Server Owner**: Can run `/setup` and all commands
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
- `/ping` - Check bot latency
- `/uptime` - Show bot uptime
- `/server` - Show server info
- `/avatar [user]` - Show user avatar
- `/poll <question>` - Create a poll with reactions

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