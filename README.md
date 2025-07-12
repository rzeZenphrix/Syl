# Asylum Discord Bot

## 🚀 What’s New / Changelog

- **Starboard System**: Highly customizable starboard with multi-emoji, leaderboards, jump links, attachments, and more (`/starboard-set`, `/starboard-leaderboard`, etc.)
- **Advanced Logging**: All moderation, config, watchword, blacklist, snipe, and server actions are logged to the server’s log channel and error dashboard.
- **Co-Owner System**: Server owners can add up to 2 co-owners with full bot access (`/co-owners`, `;add-co-owner`).
- **Backup & Restore**: Automatic channel/role snapshot on startup, `/raid restore` and `;raid restore` to recover from nukes.
- **Enhanced Raid/Anti-Nuke**: Early detection, lockdown, safe role, audit logging, and auto-ban/whitelist.
- **Emoji Stealing**: `;steal <emoji> [name]` and `/steal emoji:<emoji> name:<name>` for custom emoji import.
- **Leaderboard**: Per-starboard and global leaderboards for most-starred messages/users.
- **Help & Dashboard**: `;help` and `/help` DM the full, updated guide. Web dashboard for error/log viewing.

---

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
- **🎭 Emoji Stealing**: Steal custom emojis from other servers
- **⭐ Starboard**: Highly customizable, multi-emoji, leaderboard, and more
- **Backup & Restore**: Channel/role snapshot and recovery
- **Co-Owner System**: Multiple trusted owners per server
- **Web Dashboard**: Error and log viewer

---

## 📝 Command Reference

| Command                | Type    | Description                                                      | Permissions         |
|------------------------|---------|------------------------------------------------------------------|---------------------|
| `;ban @user [reason]`  | Prefix  | Ban a user by mention or ID                                      | Admin               |
| `/ban user reason`     | Slash   | Ban a user by mention                                            | Admin               |
| `;kick @user [reason]` | Prefix  | Kick a user                                                      | Admin               |
| `/kick user reason`    | Slash   | Kick a user                                                      | Admin               |
| `;warn @user <reason>` | Prefix  | Warn a user                                                      | Admin               |
| `/warn user reason`    | Slash   | Warn a user                                                      | Admin               |
| `;warnings [@user]`    | Prefix  | Show warnings for a user                                         | Any                 |
| `/warnings [user]`     | Slash   | Show warnings for a user                                         | Any                 |
| `;clearwarn @user`     | Prefix  | Clear all warnings for a user                                    | Admin               |
| `/clearwarn user`      | Slash   | Clear all warnings for a user                                    | Admin               |
| `;purge <1-100>`       | Prefix  | Bulk delete messages                                             | Admin               |
| `/purge amount`        | Slash   | Bulk delete messages                                             | Admin               |
| `;nuke`                | Prefix  | Nuke a channel (clone & delete)                                  | Admin               |
| `/nuke`                | Slash   | Nuke a channel                                                   | Admin               |
| `;blacklist @user`     | Prefix  | Blacklist a user                                                 | Admin               |
| `/blacklist user`      | Slash   | Blacklist a user                                                 | Admin               |
| `;unblacklist @user`   | Prefix  | Remove user from blacklist                                       | Admin               |
| `/unblacklist user`    | Slash   | Remove user from blacklist                                       | Admin               |
| `;mute @user <dur>`    | Prefix  | Mute a user (30s, 5m, 2h, 1d)                                   | Admin               |
| `/mute user duration`  | Slash   | Mute a user                                                      | Admin               |
| `;unmute @user`        | Prefix  | Unmute a user                                                    | Admin               |
| `/unmute user`         | Slash   | Unmute a user                                                    | Admin               |
| `;timeout @user <dur>` | Prefix  | Timeout a user                                                   | Admin               |
| `/timeout user dur`    | Slash   | Timeout a user                                                   | Admin               |
| `;raid ...`            | Prefix  | Raid protection config, lockdown, restore                        | Admin               |
| `/raid ...`            | Slash   | Raid protection config, lockdown, restore                        | Admin               |
| `;antinuke ...`        | Prefix  | Anti-nuke config, whitelist, autoban                             | Owner/Co-Owner      |
| `/antinuke ...`        | Slash   | Anti-nuke config, whitelist, autoban                             | Owner/Co-Owner      |
| `;steal <emoji> [name]`| Prefix  | Steal a custom emoji from another server                         | Admin               |
| `/steal emoji name`    | Slash   | Steal a custom emoji from another server                         | Admin               |
| `;starboard-set ...`   | Prefix  | Configure starboard (see below)                                  | Admin               |
| `/starboard-set ...`   | Slash   | Configure starboard (see below)                                  | Admin               |
| `/starboard-leaderboard`| Slash  | Show starboard/global leaderboard                                | Any                 |
| `;help`                | Prefix  | DM the full bot guide                                            | Any                 |
| `/help`                | Slash   | DM the full bot guide                                            | Any                 |
| ...                    | ...     | ... (see below for full list)                                    | ...                 |

### **Starboard Example**
```
/starboard-set emoji:⭐ threshold:5 channel:#starboard allow-bots:false allow-selfstar:false blacklist-roles:@Muted blacklist-channels:#off-topic custom-message:"{user} got {count} stars!" name:starboard
```

### **Other Categories**
- **Utility**: `ls`, `ps`, `whoami`, `ping`, `uptime`, `server`, `roles`, `avatar`, `poll`, `say`, `reset`, `jump`, `archive`, `mirror`, `cooldown`, `translate`, `cloak`, `npcgen`, `worldstate`, etc.
- **Setup/Config**: `setup`, `config`, `logchannel`, `autorole`, `prefix`, `reset-config`, `disable-commands`, `co-owners`, `add-co-owner`, `remove-co-owner`
- **Tickets**: `ticket`, `close`, `claim`, `reopen`, `delete`, `modmail`, etc.
- **Moderation**: `ban`, `kick`, `warn`, `mute`, `timeout`, `purge`, `nuke`, `blacklist`, `unblacklist`, `case`, `report`, `panic`, `feedback`, etc.
- **Fun/Extras**: `npcgen`, `cloak`, `curse`, `spy`, `sniper`, `watchword`, `blacklistword`, etc.

---

## 🛡️ Security Features

- **Raid Prevention**: Real-time join/message spam detection, auto-lock, safe role, audit logging, restore.
- **Anti-Nuke**: Channel/role/emoji/webhook/mass ban detection, whitelist, auto-ban, audit logging.
- **Backup & Restore**: Channel/role snapshot and `/raid restore`/`;raid restore`.
- **Co-Owner**: Up to 2 co-owners per server with full bot access.
- **Comprehensive Logging**: All actions, config changes, and moderation events are logged to the server’s log channel and error dashboard.

---

## 📖 Help & Dashboard

- Use `;help` or `/help` to DM the full, up-to-date bot guide (this README).
- Web dashboard: Run `node scripts/log-dashboard.js` and visit `http://localhost:4000/logs` to view/search/download logs. Set `LOG_DASHBOARD_PASSWORD` for security.

---

## 🛠️ Setup & Configuration

1. **Environment**: Create a `.env` file with your Discord and Supabase credentials.
2. **Database**: Run the provided SQL scripts in `/sql` to set up all required tables and features.
3. **Install**: `npm install`
4. **Run**: `node index.js`
5. **Initial Setup**: `/setup` or `;setup` as server owner to configure admin roles, log channel, etc.

---

## 🧩 Cog System & Extending

- Add new cogs in `src/cogs/` following the provided template.
- All commands and features are modular and easy to extend.

---

## 🗂️ Full Command List

See the [COMMAND_MANAGEMENT.md](./COMMAND_MANAGEMENT.md) for a detailed list of all commands, disabling/enabling, and permissions.

---

## 📝 Contributing & Support

- Fork, branch, and PR as usual.
- For support, open an issue or contact the bot owner.

---

## 📜 License

ISC License. 