# Welcome Commands Summary

## Available Commands

### 1. `/welcomesetup` (Basic Welcome Module)
**Source**: `src/cogs/welcome.js`

**Options**:
- `channel` (required) - Channel to send welcome messages
- `message` (optional) - Welcome message with placeholders
- `color` (optional) - Hex color for embed (e.g., #00ff00)
- `image` (optional) - Image URL for embed
- `embed` (optional) - Use embed format (default: true)
- **`show_avatar` (optional) - Show user avatar in welcome message (default: true)** ✅

### 2. `/welcome-config` (Enhanced Welcome Module)
**Source**: `src/cogs/enhanced-welcome.js`

**Options**:
- `channel` (required) - Channel to send welcome messages
- `message` (optional) - Welcome message with placeholders
- `embed` (optional) - Send as embed (default: true)
- `color` (optional) - Embed color (hex format, e.g., #00ff00)
- `image` (optional) - Image URL for the welcome embed
- **`show_avatar` (optional) - Show user avatar in welcome message (default: true)** ✅

## Other Welcome Commands

### 3. `/viewwelcome`
- View current welcome message configuration
- Shows avatar setting in the configuration display

### 4. `/toggle-welcome` (Enhanced Module Only)
- Enable or disable welcome messages (admin only)

## Command Conflict Resolution

**Issue**: Both modules originally had `/welcomesetup` which caused conflicts.

**Solution**: Renamed enhanced module command to `/welcome-config` to avoid conflicts.

## Avatar Feature Details

### Database Schema
- Added `show_avatar` column to `welcome_configs` table
- Defaults to `true` for backward compatibility

### Functionality
- When `show_avatar` is `true` (default): User avatar appears as thumbnail in embed
- When `show_avatar` is `false`: No avatar is displayed
- Only applies to embed format messages (not plain text)

### Migration Required
Run this SQL on existing databases:
```sql
ALTER TABLE public.welcome_configs 
ADD COLUMN IF NOT EXISTS show_avatar boolean DEFAULT true;
```

## Usage Examples

### Basic Setup with Avatar (Default)
```
/welcomesetup channel:#welcome message:"Welcome {user} to {server}!"
```

### Setup without Avatar
```
/welcomesetup channel:#welcome message:"Welcome {user}!" show_avatar:false
```

### Enhanced Setup with All Options
```
/welcome-config channel:#welcome message:"Welcome {user}!" embed:true color:#00ff00 show_avatar:true
```

## Next Steps

1. **Restart the bot** to register the new command options with Discord
2. **Run the database migration** if using an existing database
3. **Test both commands** to ensure avatar toggle works properly

The avatar option should now be visible in Discord's command autocomplete after the bot restarts and re-registers the commands.