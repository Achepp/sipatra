import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yatsujlrfyvtrxudvcnu.supabase.co';
const supabaseKey = 'sb_publishable_3qqlUxv9_ZgYT40f_bqbfg_cNvkM8VH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  const { data: profiles } = await supabase.from('profiles').select('*');
  console.log('All Profiles:', JSON.stringify(profiles, null, 2));

  const { data: members } = await supabase.from('members').select('*');
  console.log('All Members:', JSON.stringify(members, null, 2));
}

checkUser();
