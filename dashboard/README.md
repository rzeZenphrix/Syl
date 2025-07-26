# Asylum Bot Dashboard

This dashboard is a modern React + Vite + Tailwind CSS web UI for managing your Asylum Discord Bot configuration in real time.

- **Live Sync:** Connects directly to your Supabase backend for real-time config updates.
- **Bot Integration:** The dashboard is served by a dedicated Discord bot cog (`dashboard.js`), so it loads automatically when the bot is deployed.
- **Features:**
  - Boost message editor (WYSIWYG, embed/markdown preview)
  - Ticket system config
  - Welcome/goodbye message config
  - Command management (enable/disable, prefix, etc)
  - Starboard, logging, and more
- **Auth:** Supabase Auth (Discord OAuth or email)
- **Extensible:** Easily add new config pages for any bot feature.

## Getting Started

1. `npm install`
2. `npm run dev` (for local dev)
3. Deploy the bot with the new `dashboard.js` cog to serve the dashboard in production.

---

**Note:** This dashboard is designed to replace or supplement the Discord modal setup flows, providing a more powerful and user-friendly experience for server admins.
