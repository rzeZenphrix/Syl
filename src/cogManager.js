const fs = require('fs');
const path = require('path');

class CogManager {
  constructor(client) {
    this.client = client;
    this.cogs = new Map();
    this.prefixCommands = new Map();
    this.slashCommands = new Map();
    this.slashHandlers = new Map();
    this.buttonHandlers = new Map();
    this.modalHandlers = new Map();
    this.eventHandlers = new Map();
  }

  async loadCogs() {
    const cogsDir = path.join(__dirname, 'cogs');
    
    if (!fs.existsSync(cogsDir)) {
      console.log('Cogs directory not found, creating...');
      fs.mkdirSync(cogsDir, { recursive: true });
      return;
    }

    const cogFiles = fs.readdirSync(cogsDir).filter(file => file.endsWith('.js'));
    
    for (const file of cogFiles) {
      try {
        const cogPath = path.join(cogsDir, file);
        const cog = require(cogPath);
        
        if (cog.name && (cog.prefixCommands || cog.slashCommands)) {
          this.cogs.set(cog.name, cog);
          
          // Load prefix commands
          if (cog.prefixCommands) {
            for (const [name, handler] of Object.entries(cog.prefixCommands)) {
              this.prefixCommands.set(name, handler);
            }
          }
          
          // Load slash commands
          if (cog.slashCommands) {
            for (const command of cog.slashCommands) {
              this.slashCommands.set(command.name, command);
            }
          }
          
          // Load slash handlers
          if (cog.slashHandlers) {
            for (const [name, handler] of Object.entries(cog.slashHandlers)) {
              this.slashHandlers.set(name, handler);
            }
          }
          
          // Load button handlers
          if (cog.buttonHandlers) {
            for (const [name, handler] of Object.entries(cog.buttonHandlers)) {
              this.buttonHandlers.set(name, handler);
            }
          }
          
          // Load modal handlers
          if (cog.modalHandlers) {
            for (const [name, handler] of Object.entries(cog.modalHandlers)) {
              this.modalHandlers.set(name, handler);
            }
          }
          
          // Load event handlers
          if (cog.eventHandlers) {
            for (const [eventName, handler] of Object.entries(cog.eventHandlers)) {
              if (!this.eventHandlers.has(eventName)) {
                this.eventHandlers.set(eventName, []);
              }
              this.eventHandlers.get(eventName).push(handler);
            }
          }
          
          console.log(`Loaded cog: ${cog.name}`);
        }
      } catch (error) {
        console.error(`Failed to load cog ${file}:`, error);
      }
    }
    
    console.log(`Loaded ${this.cogs.size} cogs with ${this.prefixCommands.size} prefix commands and ${this.slashCommands.size} slash commands`);
  }

  getPrefixCommand(name) {
    return this.prefixCommands.get(name);
  }

  getSlashCommand(name) {
    return this.slashCommands.get(name);
  }

  getSlashHandler(name) {
    return this.slashHandlers.get(name);
  }

  getButtonHandler(name) {
    return this.buttonHandlers.get(name);
  }

  getModalHandler(name) {
    return this.modalHandlers.get(name);
  }

  getAllSlashCommands() {
    return Array.from(this.slashCommands.values());
  }

  getAllPrefixCommands() {
    return Array.from(this.prefixCommands.keys());
  }

  getEventHandlers(eventName) {
    return this.eventHandlers.get(eventName) || [];
  }

  getAllEventHandlers() {
    return this.eventHandlers;
  }
}

module.exports = CogManager; 