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
      if (member.guild.ownerId === member.id) {
        return true;
      }
      // Always allow users with Administrator permission
      if (member.permissions.has('Administrator')) {
        return true;
      }
      // Check if user is co-owner
      const { data: config, error: configError } = await supabase
        .from('guild_configs')
        .select('admin_role_id, extra_role_ids, co_owner_1_id, co_owner_2_id')
        .eq('guild_id', guildId)
        .single();
      if (!configError && config) {
        const adminRoles = [config.admin_role_id, ...(config.extra_role_ids || [])].filter(Boolean);
        if (member.roles.cache.some(role => adminRoles.includes(role.id))) {
          return true;
        }
        if ([config.co_owner_1_id, config.co_owner_2_id].includes(member.id)) {
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

// Add co-owner check function
async function isCoOwner(member) {
  if (!member || !member.guild) return false;
  
  try {
    const { data, error } = await supabase
      .from('guild_configs')
      .select('co_owner_1_id, co_owner_2_id')
      .eq('guild_id', member.guild.id)
      .single();
    
    if (error || !data) return false;
    
    return data.co_owner_1_id === member.id || data.co_owner_2_id === member.id;
  } catch (e) {
    console.error('Co-owner check error:', e);
    return false;
  }
}

// Update isAdmin function to include co-owners
async function isAdmin(member) {
  if (!member || !member.guild) return false;
  
  // Server owner is always admin
  if (member.id === member.guild.ownerId) return true;
  
  // Check if user is a co-owner
  if (await isCoOwner(member)) return true;
  
  try {
    const { data, error } = await supabase
      .from('guild_configs')
      .select('admin_role_id, extra_admin_role_1_id, extra_admin_role_2_id, extra_admin_role_3_id')
      .eq('guild_id', member.guild.id)
      .single();
    
    if (error || !data) return false;
    
    const adminRoles = [
      data.admin_role_id,
      data.extra_admin_role_1_id,
      data.extra_admin_role_2_id,
      data.extra_admin_role_3_id
    ].filter(Boolean);
    
    return adminRoles.some(roleId => member.roles.cache.has(roleId));
  } catch (e) {
    console.error('Admin check error:', e);
    return false;
  }
}

// Add function to check if user is server owner or co-owner (for owner-only commands)
async function isOwnerOrCoOwner(member) {
  if (!member || !member.guild) return false;
  
  // Server owner is always allowed
  if (member.id === member.guild.ownerId) return true;
  
  // Check if user is a co-owner
  return await isCoOwner(member);
}

module.exports = {
  isAdmin,
  isCoOwner,
  isOwnerOrCoOwner
};
