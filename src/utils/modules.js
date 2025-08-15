// src/utils/modules.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function isModuleEnabled(guildId, moduleKey) {
	try {
		const { data, error } = await supabase
			.from('guild_modules')
			.select('enabled')
			.eq('guild_id', guildId)
			.eq('module_key', moduleKey)
			.single();
		if (error && error.code !== 'PGRST116') {
			return false;
		}
		return !!data?.enabled;
	} catch {
		return false;
	}
}

module.exports = { isModuleEnabled };