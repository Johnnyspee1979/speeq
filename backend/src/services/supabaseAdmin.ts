const { createClient } = require('@supabase/supabase-js');
const { backendConfig, hasSupabaseConfig } = require('../config');

let supabaseAdminClient: any | null = null;

const getSupabaseAdminClient = () => {
  if (!hasSupabaseConfig()) {
    throw new Error('Supabase configuratie ontbreekt in .env');
  }

  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(
      backendConfig.supabaseUrl,
      backendConfig.supabaseServiceKey
    );
  }

  return supabaseAdminClient;
};

module.exports = {
  getSupabaseAdminClient,
};
