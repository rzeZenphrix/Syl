const path = require('path');
const fs = require('fs');
const express = require('express');

const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 4000;
const DASHBOARD_DIST = path.resolve(__dirname, '../../dashboard/dist');

let server = null;

module.exports = {
  name: 'dashboard',
  setup: async (client) => {
    // Only start the dashboard server if the build exists
    if (!fs.existsSync(DASHBOARD_DIST)) {
      console.warn('[Dashboard] dashboard/dist not found. Build the dashboard before deploying.');
      return;
    }
    const app = express();
    app.use(express.static(DASHBOARD_DIST));
    app.get('*', (req, res) => {
      res.sendFile(path.join(DASHBOARD_DIST, 'index.html'));
    });
    server = app.listen(DASHBOARD_PORT, () => {
      console.log(`[Dashboard] Dashboard is running at http://localhost:${DASHBOARD_PORT}/`);
    });
  },
  // Optionally, add a /dashboard slash command
  slashCommands: [
    {
      name: 'dashboard',
      description: 'Get the link to the web dashboard',
    }
  ],
  slashHandlers: {
    dashboard: async (interaction) => {
      const dashboardUrl = process.env.DASHBOARD_URL || `http://localhost:${DASHBOARD_PORT}/`;
      const botInviteUrl = "https://discord.com/oauth2/authorize?client_id=1385547161269440573";
      
      const embed = {
        color: 0x5865f2,
        title: '🌐 SYL Bot Dashboard',
        description: 'Manage your server settings and configure modules through our web dashboard.',
        fields: [
          {
            name: '📊 Dashboard',
            value: `[Click here to open the dashboard](${dashboardUrl})`,
            inline: true
          },
          {
            name: '🤖 Invite Bot',
            value: `[Add SYL Bot to your server](${botInviteUrl})`,
            inline: true
          }
        ],
        footer: {
          text: 'You need "Manage Server" permission to access the dashboard'
        },
        timestamp: new Date().toISOString()
      };
      
      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    }
  },
  // For future: add API endpoints for real-time sync if needed
  // e.g., app.post('/api/update-config', ...)
}; 