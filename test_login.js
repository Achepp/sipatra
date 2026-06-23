import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yatsujlrfyvtrxudvcnu.supabase.co';
const supabaseKey = 'sb_publishable_3qqlUxv9_ZgYT40f_bqbfg_cNvkM8VH';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = 'dosen02975@unpam.ac.id';
  const password = 'sisteminformasi';
  
  console.log(`Attempting login for ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) {
    console.error('Login failed:', error.message);
    return;
  }
  
  console.log('Login successful! User ID:', data.user.id);
  console.log('User metadata:', JSON.stringify(data.user.user_metadata, null, 2));

  // Query profiles and members now that we are authenticated
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();
    
  if (pErr) console.error('Profile fetch failed:', pErr.message);
  else console.log('Profile:', JSON.stringify(profile, null, 2));

  const { data: member, error: mErr } = await supabase
    .from('members')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle();
    
  if (mErr) console.error('Member fetch failed:', mErr.message);
  else console.log('Member:', JSON.stringify(member, null, 2));
}

run();
