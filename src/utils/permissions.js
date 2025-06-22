// Permission and role checks utility
const { supabase } = require('./supabase');

async function isAdmin(guildId, userId, member) {
  try {
    // Always allow the server owner
    if (member.guild && member.guild.ownerId === userId) return true;

    const { data, error } = await supabase
      .from('guild_configs')
      .select('admin_role_id, extra_role_ids')
      .eq('guild_id', guildId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking admin roles:', error);
      return false;
    }

    if (!data) {
      return member.permissions.has('Administrator');
    }

    const adminRoles = [data.admin_role_id, ...(data.extra_role_ids || [])].filter(Boolean);
    return member.roles.cache.some(role => adminRoles.includes(role.id));
  } catch (err) {
    console.error('Error in isAdmin check:', err);
    return false;
  }
}

async function isCommandEnabled(guildId, commandName, member = null) {
  try {
    // If we have member info, check if they should bypass disabled commands
    if (member) {
      // Always allow server owner
      if (member.guild.ownerId === member.id) return true;
      // Always allow users with Administrator permission
      if (member.permissions.has('Administrator')) return true;
      // Check guild config for admin roles
      const { data, error } = await supabase
        .from('guild_configs')
        .select('admin_role_id, extra_role_ids')
        .eq('guild_id', guildId)
        .single();
      if (!error && data) {
        const adminRoles = [data.admin_role_id, ...(data.extra_role_ids || [])].filter(Boolean);
        if (member.roles.cache.some(role => adminRoles.includes(role.id))) {
          return true;
        }
      }
    }
    // Check if command is disabled
    const { data, error } = await supabase
      .from('guild_configs')
      .select('disabled_commands')
      .eq('guild_id', guildId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error checking disabled commands:', error);
      return true; // Allow command if can't check
    }
    if (!data || !data.disabled_commands) {
      return true; // No disabled commands list means all commands are enabled
    }
    return !data.disabled_commands.includes(commandName);
  } catch (err) {
    console.error('Error in isCommandEnabled check:', err);
    return true; // Allow command if can't check
  }
}

function isBotProtected(targetId, clientId) {
  return targetId === clientId;
}

module.exports = { isAdmin, isCommandEnabled, isBotProtected };
