# Command Management System

The Asylum Discord Bot now includes a comprehensive command management system that allows server owners to disable specific commands for their server.

## Features

### 1. Multiple Command Types Support
- **Prefix Commands**: Traditional commands using `;` or `&` prefix
- **Slash Commands**: Modern Discord slash commands
- **Both types can be disabled independently**

### 2. Available Commands for Disabling

#### Prefix Commands
- **Setup Commands**: `setup`, `config`, `logchannel`, `say`, `reset-config`, `autorole`, `prefix`
- **Moderation Commands**: `ban`, `kick`, `warn`, `warnings`, `clearwarn`, `purge`, `blacklist`, `unblacklist`, `mute`, `unmute`, `timeout`
- **Utility Commands**: `ls`, `ps`, `whoami`, `ping`, `uptime`, `server`, `roles`, `avatar`, `poll`, `help`

#### Slash Commands
- **Setup Commands**: `setup`, `logchannel`, `say`, `reset-config`, `autorole`, `prefix`
- **Moderation Commands**: `ban`, `kick`, `warn`, `warnings`, `clearwarn`, `purge`, `blacklist`, `unblacklist`, `mute`, `unmute`, `timeout`
- **Utility Commands**: `ping`, `uptime`, `server`, `avatar`, `poll`

## Usage

### During Initial Setup

#### Prefix Command
```bash
;setup @adminrole @extra1 @extra2 --disable ban,kick,warn,purge
```

#### Slash Command
```
/setup adminrole:@AdminRole extra1:@Moderator disabled:ban,kick,warn,purge
```

### Managing Disabled Commands

#### Prefix Commands

**Show current disabled commands:**
```bash
;disable-commands
```

**Add commands to disabled list:**
```bash
;disable-commands add ban,kick,warn
```

**Remove commands from disabled list:**
```bash
;disable-commands remove ban,kick
```

**Clear all disabled commands:**
```bash
;disable-commands clear
```

**List all available commands:**
```bash
;disable-commands list
```

#### Slash Commands

**Show current disabled commands:**
```
/disable-commands
```

**Add commands to disabled list:**
```
/disable-commands action:add commands:ban,kick,warn
```

**Remove commands from disabled list:**
```
/disable-commands action:remove commands:ban,kick
```

**Clear all disabled commands:**
```
/disable-commands action:clear
```

**List all available commands:**
```
/disable-commands action:list
```

**Show currently disabled commands:**
```
/disable-commands action:current
```

### Setup Command Options

The `/setup` command now includes additional options:

- **Full Setup**: Complete server configuration (default)
- **Show Available Commands**: List all commands that can be disabled
- **Show Current Config**: Display current server configuration

## Examples

### Example 1: Disable All Moderation Commands
```bash
;disable-commands add ban,kick,warn,warnings,clearwarn,purge,blacklist,unblacklist,mute,unmute,timeout
```

### Example 2: Disable Only Dangerous Commands
```bash
;disable-commands add ban,kick,purge
```

### Example 3: Enable Previously Disabled Commands
```bash
;disable-commands remove ban,kick
```

### Example 4: Setup with Command Disabling
```bash
;setup @Admin @Moderator --disable ban,kick,warn,purge,blacklist
```

## Validation

The system includes comprehensive validation:

1. **Command Validation**: Only valid commands can be disabled
2. **Permission Checks**: Only server owners can manage disabled commands
3. **Duplicate Prevention**: Commands are automatically deduplicated
4. **Error Handling**: Clear error messages for invalid commands

## Database Storage

Disabled commands are stored in the `guild_configs` table in the `disabled_commands` column as a JSON array.

## Benefits

1. **Security**: Disable dangerous commands in sensitive environments
2. **Customization**: Tailor the bot to your server's needs
3. **Flexibility**: Enable/disable commands without restarting the bot
4. **User-Friendly**: Easy-to-use commands with clear feedback
5. **Comprehensive**: Support for both prefix and slash commands

## Notes

- Only server owners can manage disabled commands
- Disabled commands are server-specific
- The system supports both old and new command formats for backward compatibility
- All changes are applied immediately without requiring bot restart 

## ⭐ Starboard Customization

The starboard system supports advanced customization:
- **Custom Embed Color**: Set a hex color for each starboard.
- **Image/Attachment Display Mode**: Show first image, all images, none, or thumbnail.
- **Whitelist Roles/Channels**: Only allow starring in certain roles/channels.
- **Minimum Message Length**: Only allow starring messages above a certain length.
- **Post Style**: Choose between embed, plain, or both.
- **Custom Placeholders**: Use `{user}`, `{count}`, `{channel}`, `{content}`, `{jump}`, `{author_avatar}`, `{message_link}` in custom message templates.

### Example `/starboard-set` usage:
```
/starboard-set name:starboard emoji:⭐ threshold:5 channel:#starboard embed_color:#FFD700 image_mode:all whitelist_roles:@Starboarder whitelist_channels:#memes min_length:20 post_style:embed custom_message:"{user} got {count} stars! [Jump]({jump})"
```

See `/starboard-info` for all options and current config. 