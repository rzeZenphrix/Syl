// Setup Module JavaScript
class SetupModule {
  constructor() {
    this.guildId = this.getGuildIdFromURL();
    this.token = localStorage.getItem('asylum_token');
    this.config = {};
    this.coOwners = [];
    this.blacklist = [];
    this.roles = [];
    this.channels = [];
    
    this.init();
  }

  getGuildIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('guild');
  }

  async init() {
    if (!this.guildId || !this.token) {
      this.showError('Missing authentication or guild information');
      return;
    }

    this.setupEventListeners();
    await this.loadData();
  }

  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.setup-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
      });
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.setup-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update sections
    document.querySelectorAll('.setup-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`${tabName}Section`).classList.add('active');
  }

  async loadData() {
    this.showLoading(true);
    
    try {
      await Promise.all([
        this.loadConfiguration(),
        this.loadRolesAndChannels(),
        this.loadGuildInfo()
      ]);
      
      this.populateUI();
    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load configuration data');
    } finally {
      this.showLoading(false);
    }
  }

  async loadConfiguration() {
    const response = await fetch(`/api/setup/config/${this.guildId}`, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (!response.ok) {
      throw new Error('Failed to load configuration');
    }

    const data = await response.json();
    this.config = data.config;
    this.coOwners = data.coOwners || [];
    this.blacklist = data.blacklist || [];
  }

  async loadRolesAndChannels() {
    const [rolesResponse, channelsResponse] = await Promise.all([
      fetch(`/api/setup/roles/${this.guildId}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      }),
      fetch(`/api/setup/channels/${this.guildId}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      })
    ]);

    if (rolesResponse.ok) {
      const rolesData = await rolesResponse.json();
      this.roles = rolesData.roles || [];
    }

    if (channelsResponse.ok) {
      const channelsData = await channelsResponse.json();
      this.channels = channelsData.channels || [];
    }
  }

  async loadGuildInfo() {
    try {
      const response = await fetch(`/api/realtime/guild-info/${this.guildId}`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });

      if (response.ok) {
        const guildInfo = await response.json();
        document.getElementById('serverName').textContent = guildInfo.name;
        if (guildInfo.icon) {
          document.getElementById('serverIcon').src = guildInfo.icon;
        }
      }
    } catch (error) {
      console.error('Error loading guild info:', error);
    }
  }

  populateUI() {
    this.populateGeneralSettings();
    this.populatePermissionSettings();
    this.populateSecuritySettings();
    this.populateCoOwners();
    this.populateBlacklist();
    this.populateAdvancedSettings();
    this.populateDropdowns();
  }

  populateGeneralSettings() {
    document.getElementById('customPrefix').value = this.config.custom_prefix || ';';
    document.getElementById('welcomeEnabled').checked = this.config.welcome_enabled || false;
    document.getElementById('goodbyeEnabled').checked = this.config.goodbye_enabled || false;
    document.getElementById('backupEnabled').checked = this.config.backup_enabled || false;
    document.getElementById('loggingEnabled').checked = this.config.logging_enabled || false;
  }

  populatePermissionSettings() {
    // Populate disabled commands
    const disabledCommandsList = document.getElementById('disabledCommandsList');
    disabledCommandsList.innerHTML = '';
    
    (this.config.disabled_commands || []).forEach(command => {
      const item = document.createElement('div');
      item.className = 'blacklist-item';
      item.innerHTML = `
        <div class="blacklist-info">
          <strong>${command}</strong>
        </div>
        <button class="btn btn-danger" onclick="setupModule.removeDisabledCommand('${command}')">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;
      disabledCommandsList.appendChild(item);
    });
  }

  populateSecuritySettings() {
    // Anti-nuke settings
    document.getElementById('antiNukeEnabled').checked = this.config.anti_nuke_enabled || false;
    document.getElementById('maxKicks').value = this.config.max_kicks_per_minute || 5;
    document.getElementById('maxBans').value = this.config.max_bans_per_minute || 3;
    document.getElementById('nukePunishment').value = this.config.nuke_punishment_type || 'ban';

    // Anti-raid settings
    document.getElementById('antiRaidEnabled').checked = this.config.anti_raid_enabled || false;
    document.getElementById('maxJoins').value = this.config.max_joins_per_minute || 10;
    document.getElementById('minAccountAge').value = this.config.min_account_age_days || 7;
    document.getElementById('raidPunishment').value = this.config.raid_punishment_type || 'kick';
  }

  populateCoOwners() {
    const coOwnersList = document.getElementById('coOwnersList');
    coOwnersList.innerHTML = '';

    this.coOwners.forEach(coOwner => {
      const item = document.createElement('div');
      item.className = 'co-owner-item';
      item.innerHTML = `
        <div class="co-owner-info">
          <div class="co-owner-avatar"></div>
          <div>
            <div><strong>User ID: ${coOwner.user_id}</strong></div>
            <div style="font-size: var(--font-size-sm); color: var(--text-secondary);">
              Permissions: ${coOwner.permissions.join(', ')}
            </div>
          </div>
        </div>
        <button class="btn btn-danger" onclick="setupModule.removeCoOwner('${coOwner.user_id}')">Remove</button>
      `;
      coOwnersList.appendChild(item);
    });
  }

  populateBlacklist() {
    const blacklistList = document.getElementById('blacklistList');
    blacklistList.innerHTML = '';

    this.blacklist.forEach(entry => {
      const item = document.createElement('div');
      item.className = 'blacklist-item';
      item.innerHTML = `
        <div class="blacklist-info">
          <div>
            <strong>${entry.target_type}: ${entry.target_id}</strong>
            <span class="blacklist-type">${entry.blacklist_type}</span>
          </div>
          ${entry.reason ? `<div style="font-size: var(--font-size-sm); color: var(--text-secondary);">${entry.reason}</div>` : ''}
        </div>
        <button class="btn btn-danger" onclick="setupModule.removeBlacklistEntry('${entry.id}')">Remove</button>
      `;
      blacklistList.appendChild(item);
    });
  }

  populateAdvancedSettings() {
    document.getElementById('maxMentions').value = this.config.max_mentions || 5;
    document.getElementById('autoModEnabled').checked = this.config.auto_mod_enabled || false;
  }

  populateDropdowns() {
    // Populate channels dropdown
    const logChannelSelect = document.getElementById('logChannel');
    logChannelSelect.innerHTML = '<option value="">Select a channel...</option>';
    
    this.channels.forEach(channel => {
      const option = document.createElement('option');
      option.value = channel.id;
      option.textContent = `#${channel.name}`;
      if (channel.id === this.config.log_channel) {
        option.selected = true;
      }
      logChannelSelect.appendChild(option);
    });

    // Populate roles dropdowns
    const roleSelects = ['adminRole', 'extraRoles', 'autoRole'];
    roleSelects.forEach(selectId => {
      const select = document.getElementById(selectId);
      const isMultiple = selectId === 'extraRoles';
      
      if (!isMultiple) {
        select.innerHTML = '<option value="">Select a role...</option>';
      } else {
        select.innerHTML = '';
      }
      
      this.roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role.id;
        option.textContent = role.name;
        
        if (selectId === 'adminRole' && role.id === this.config.admin_role_id) {
          option.selected = true;
        } else if (selectId === 'extraRoles' && this.config.extra_role_ids?.includes(role.id)) {
          option.selected = true;
        } else if (selectId === 'autoRole' && role.id === this.config.autorole) {
          option.selected = true;
        }
        
        select.appendChild(option);
      });
    });
  }

  // Save functions
  async saveGeneralSettings() {
    const settings = {
      custom_prefix: document.getElementById('customPrefix').value,
      log_channel: document.getElementById('logChannel').value || null,
      autorole: document.getElementById('autoRole').value || null,
      welcome_enabled: document.getElementById('welcomeEnabled').checked,
      goodbye_enabled: document.getElementById('goodbyeEnabled').checked,
      backup_enabled: document.getElementById('backupEnabled').checked,
      logging_enabled: document.getElementById('loggingEnabled').checked
    };

    await this.saveSettings(settings, 'General settings saved successfully');
  }

  async savePermissionSettings() {
    const adminRole = document.getElementById('adminRole').value || null;
    const extraRoles = Array.from(document.getElementById('extraRoles').selectedOptions)
      .map(option => option.value);

    const settings = {
      admin_role_id: adminRole,
      extra_role_ids: extraRoles
    };

    await this.saveSettings(settings, 'Permission settings saved successfully');
  }

  async saveSecuritySettings() {
    const antiNukeSettings = {
      enabled: document.getElementById('antiNukeEnabled').checked,
      max_kicks_per_minute: parseInt(document.getElementById('maxKicks').value),
      max_bans_per_minute: parseInt(document.getElementById('maxBans').value),
      punishment_type: document.getElementById('nukePunishment').value
    };

    const antiRaidSettings = {
      enabled: document.getElementById('antiRaidEnabled').checked,
      max_joins_per_minute: parseInt(document.getElementById('maxJoins').value),
      min_account_age_days: parseInt(document.getElementById('minAccountAge').value),
      punishment_type: document.getElementById('raidPunishment').value
    };

    try {
      await Promise.all([
        fetch(`/api/setup/anti-nuke/${this.guildId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`
          },
          body: JSON.stringify(antiNukeSettings)
        }),
        fetch(`/api/setup/anti-raid/${this.guildId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.token}`
          },
          body: JSON.stringify(antiRaidSettings)
        })
      ]);

      this.showSuccess('Security settings saved successfully');
    } catch (error) {
      console.error('Error saving security settings:', error);
      this.showError('Failed to save security settings');
    }
  }

  async saveAdvancedSettings() {
    const settings = {
      max_mentions: parseInt(document.getElementById('maxMentions').value),
      auto_mod_enabled: document.getElementById('autoModEnabled').checked
    };

    await this.saveSettings(settings, 'Advanced settings saved successfully');
  }

  async saveSettings(settings, successMessage) {
    try {
      const response = await fetch(`/api/setup/config/${this.guildId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify(settings)
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      const result = await response.json();
      this.config = { ...this.config, ...settings };
      this.showSuccess(successMessage);
    } catch (error) {
      console.error('Error saving settings:', error);
      this.showError('Failed to save settings');
    }
  }

  // Co-owner management
  async addCoOwner() {
    const userId = document.getElementById('coOwnerUserId').value.trim();
    const permissions = Array.from(document.getElementById('coOwnerPermissions').selectedOptions)
      .map(option => option.value);

    if (!userId || permissions.length === 0) {
      this.showError('Please enter a user ID and select permissions');
      return;
    }

    try {
      const response = await fetch(`/api/setup/co-owners/${this.guildId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({ userId, permissions })
      });

      if (!response.ok) {
        throw new Error('Failed to add co-owner');
      }

      const result = await response.json();
      this.coOwners.push(result.coOwner);
      this.populateCoOwners();
      
      // Clear form
      document.getElementById('coOwnerUserId').value = '';
      document.getElementById('coOwnerPermissions').selectedIndex = -1;
      
      this.showSuccess('Co-owner added successfully');
    } catch (error) {
      console.error('Error adding co-owner:', error);
      this.showError('Failed to add co-owner');
    }
  }

  async removeCoOwner(userId) {
    if (!confirm('Are you sure you want to remove this co-owner?')) {
      return;
    }

    try {
      const response = await fetch(`/api/setup/co-owners/${this.guildId}/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to remove co-owner');
      }

      this.coOwners = this.coOwners.filter(co => co.user_id !== userId);
      this.populateCoOwners();
      this.showSuccess('Co-owner removed successfully');
    } catch (error) {
      console.error('Error removing co-owner:', error);
      this.showError('Failed to remove co-owner');
    }
  }

  // Blacklist management
  async addBlacklistEntry() {
    const targetId = document.getElementById('blacklistTargetId').value.trim();
    const targetType = document.getElementById('blacklistTargetType').value;
    const blacklistType = document.getElementById('blacklistType').value;
    const reason = document.getElementById('blacklistReason').value.trim();

    if (!targetId) {
      this.showError('Please enter a target ID');
      return;
    }

    try {
      const response = await fetch(`/api/setup/blacklist/${this.guildId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({ targetId, targetType, blacklistType, reason })
      });

      if (!response.ok) {
        throw new Error('Failed to add blacklist entry');
      }

      const result = await response.json();
      this.blacklist.push(result.entry);
      this.populateBlacklist();
      
      // Clear form
      document.getElementById('blacklistTargetId').value = '';
      document.getElementById('blacklistReason').value = '';
      
      this.showSuccess('Blacklist entry added successfully');
    } catch (error) {
      console.error('Error adding blacklist entry:', error);
      this.showError('Failed to add blacklist entry');
    }
  }

  async removeBlacklistEntry(entryId) {
    if (!confirm('Are you sure you want to remove this blacklist entry?')) {
      return;
    }

    try {
      const response = await fetch(`/api/setup/blacklist/${this.guildId}/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to remove blacklist entry');
      }

      this.blacklist = this.blacklist.filter(entry => entry.id !== entryId);
      this.populateBlacklist();
      this.showSuccess('Blacklist entry removed successfully');
    } catch (error) {
      console.error('Error removing blacklist entry:', error);
      this.showError('Failed to remove blacklist entry');
    }
  }

  // Command management
  addDisabledCommand() {
    const command = document.getElementById('commandToDisable').value.trim();
    if (!command) {
      this.showError('Please enter a command name');
      return;
    }

    if (!this.config.disabled_commands) {
      this.config.disabled_commands = [];
    }

    if (this.config.disabled_commands.includes(command)) {
      this.showError('Command is already disabled');
      return;
    }

    this.config.disabled_commands.push(command);
    this.saveSettings({ disabled_commands: this.config.disabled_commands }, 'Command disabled successfully');
    this.populatePermissionSettings();
    document.getElementById('commandToDisable').value = '';
  }

  removeDisabledCommand(command) {
    this.config.disabled_commands = this.config.disabled_commands.filter(cmd => cmd !== command);
    this.saveSettings({ disabled_commands: this.config.disabled_commands }, 'Command enabled successfully');
    this.populatePermissionSettings();
  }

  // Utility functions
  async syncServerData() {
    this.showLoading(true);
    
    try {
      const response = await fetch(`/api/realtime/sync/${this.guildId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to sync server data');
      }

      const result = await response.json();
      this.showSuccess(`Server data synced: ${result.synced.roles} roles, ${result.synced.channels} channels, ${result.synced.members} members`);
      
      // Reload roles and channels
      await this.loadRolesAndChannels();
      this.populateDropdowns();
    } catch (error) {
      console.error('Error syncing server data:', error);
      this.showError('Failed to sync server data');
    } finally {
      this.showLoading(false);
    }
  }

  async exportConfiguration() {
    try {
      const configData = {
        config: this.config,
        coOwners: this.coOwners,
        blacklist: this.blacklist,
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `guild-config-${this.guildId}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.showSuccess('Configuration exported successfully');
    } catch (error) {
      console.error('Error exporting configuration:', error);
      this.showError('Failed to export configuration');
    }
  }

  // UI utility functions
  showLoading(show) {
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';
  }

  showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
      alert.remove();
    }, 5000);
  }

  showSuccess(message) {
    this.showAlert(message, 'success');
  }

  showError(message) {
    this.showAlert(message, 'error');
  }

  showWarning(message) {
    this.showAlert(message, 'warning');
  }
}

// Global functions for HTML onclick handlers
let setupModule;

window.addCoOwner = () => setupModule.addCoOwner();
window.removeCoOwner = (userId) => setupModule.removeCoOwner(userId);
window.addBlacklistEntry = () => setupModule.addBlacklistEntry();
window.removeBlacklistEntry = (entryId) => setupModule.removeBlacklistEntry(entryId);
window.addDisabledCommand = () => setupModule.addDisabledCommand();
window.removeDisabledCommand = (command) => setupModule.removeDisabledCommand(command);
window.saveGeneralSettings = () => setupModule.saveGeneralSettings();
window.savePermissionSettings = () => setupModule.savePermissionSettings();
window.saveSecuritySettings = () => setupModule.saveSecuritySettings();
window.saveAdvancedSettings = () => setupModule.saveAdvancedSettings();
window.syncServerData = () => setupModule.syncServerData();
window.exportConfiguration = () => setupModule.exportConfiguration();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  setupModule = new SetupModule();
});