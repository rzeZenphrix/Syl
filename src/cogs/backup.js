// src/cogs/backup.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isModuleEnabled } = require('../utils/modules');

async function isAdmin(member) {
	try {
		if (!member || !member.guild) return false;
		if (member.guild.ownerId === member.id) return true;
		if (member.permissions.has('Administrator')) return true;
		return false;
	} catch { return false; }
}

const prefixCommands = {
	backup: async (msg) => {
		if (!await isAdmin(msg.member)) {
			return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
		}
		if (!await isModuleEnabled(msg.guild.id, 'backup')) {
			return msg.reply({ embeds: [new EmbedBuilder().setTitle('Module Disabled').setDescription('The Backup module is disabled in the dashboard.').setColor(0xe74c3c)] });
		}
		return msg.reply('Use the dashboard to download a full backup.');
	},
	restore: async (msg) => {
		if (!await isAdmin(msg.member)) {
			return msg.reply({ embeds: [new EmbedBuilder().setTitle('Unauthorized').setDescription('You need admin permissions.').setColor(0xe74c3c)] });
		}
		if (!await isModuleEnabled(msg.guild.id, 'backup')) {
			return msg.reply({ embeds: [new EmbedBuilder().setTitle('Module Disabled').setDescription('The Backup module is disabled in the dashboard.').setColor(0xe74c3c)] });
		}
		return msg.reply('Open the Backup module in the dashboard to upload and restore a backup file.');
	}
};

const slashCommands = [
	new SlashCommandBuilder().setName('backup').setDescription('Get a link to download a backup from the dashboard'),
	new SlashCommandBuilder().setName('restore').setDescription('Get a link to restore from the dashboard')
];

const slashHandlers = {
	backup: async (interaction) => {
		if (!await isAdmin(interaction.member)) {
			return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
		}
		if (!await isModuleEnabled(interaction.guild.id, 'backup')) {
			return interaction.reply({ content: 'The Backup module is disabled in the dashboard.', ephemeral: true });
		}
		return interaction.reply({ content: 'Use the dashboard Backup module to download your server backup.', ephemeral: true });
	},
	restore: async (interaction) => {
		if (!await isAdmin(interaction.member)) {
			return interaction.reply({ content: 'You need admin permissions.', ephemeral: true });
		}
		if (!await isModuleEnabled(interaction.guild.id, 'backup')) {
			return interaction.reply({ content: 'The Backup module is disabled in the dashboard.', ephemeral: true });
		}
		return interaction.reply({ content: 'Use the dashboard Backup module to upload and restore a backup JSON.', ephemeral: true });
	}
};

module.exports = {
	name: 'backup',
	prefixCommands,
	slashCommands,
	slashHandlers
};