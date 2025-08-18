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
      const dashboardUrl = 'https://syl-cuiw.onrender.com/index.html';
      const botInviteUrl = "https://discord.com/oauth2/authorize?client_id=1385547161269440573";
      const guild = interaction.guild;
      const member = interaction.member;
      
      // Check if user has manage server permission
      const hasPermission = member.permissions.has('ManageGuild');

      const embed = {
        color: 0x6c7fff,
        title: '🌐 SYL Bot Dashboard',
        description: '**Manage your server with ease using our comprehensive web dashboard!**\n\n' +
          '✨ **Features Available:**\n' +
          '• 🔧 **Server Configuration** - Customize bot settings and preferences\n' +
          '• 🛡️ **Security Settings** - Anti-nuke and anti-raid protection\n' +
          '• 👥 **Permission Management** - Admin roles and co-owner system\n' +
          '• 📊 **Real-time Analytics** - Member counts and activity tracking\n' +
          '• 📝 **Comprehensive Logging** - Track all server activities\n' +
          '• 💾 **Backup System** - Save and restore server configurations\n' +
          '• 🚫 **Blacklist Management** - Control access to bot features\n' +
          '• ⚡ **Live Updates** - Real-time synchronization with Discord',
        thumbnail: {
          url: guild.iconURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        fields: [
          {
            name: '🚀 Access Dashboard',
            value: hasPermission 
              ? `**[🔗 Open Dashboard](${dashboardUrl}?guild=${guild.id})**\n*Direct link to your server's configuration*`
              : '❌ You need **Manage Server** permission or admin role to access the dashboard',
            inline: false
          },
          {
            name: '📱 Quick Setup',
            value: '• Use `/setup` command for basic configuration\n' +
                   '• Use `/logchannel` to set logging channel\n' +
                   '• Use `/autorole` to set new member role\n' +
                   '• Use `/prefix` to change command prefix',
            inline: true
          },
          {
            name: '🔧 Advanced Features',
            value: '• Co-owner management system\n' +
                   '• Command disable functionality\n' +
                   '• Anti-raid and anti-nuke protection\n' +
                   '• Comprehensive activity logging',
            inline: true
          },
          {
            name: '🤖 Invite Bot',
            value: `[Add SYL Bot to your server](${botInviteUrl})`,
            inline: false
          }
        ],
        footer: {
          text: `${guild.name} • ${guild.memberCount} members`,
          icon_url: guild.iconURL({ dynamic: true, size: 32 })
        },
        timestamp: new Date().toISOString()
      };
      
      // Create action row with buttons
      const components = [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 2, // BUTTON
              style: 5, // LINK
              label: 'Open Dashboard',
              url: `${dashboardUrl}?guild=${guild.id}`,
              emoji: { name: '🌐' }
            },
            {
              type: 2, // BUTTON
              style: 1, // PRIMARY
              label: 'Quick Setup',
              custom_id: 'quick_setup',
              emoji: { name: '⚡' },
              disabled: !hasPermission
            },
            {
              type: 2, // BUTTON
              style: 2, // SECONDARY
              label: 'View Config',
              custom_id: 'view_config',
              emoji: { name: '📋' }
            }
          ]
        }
      ];
      
      await interaction.reply({
        embeds: [embed],
        components: components,
        ephemeral: false
      });
    }
  },
  // For future: add API endpoints for real-time sync if needed
  // e.g., app.post('/api/update-config', ...)
}; 