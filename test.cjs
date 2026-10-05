const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data, error } = await supabase.from('booth_voters').select('*').eq('voter_id', '22222222-2222-2222-2222-222222222222').single();
  console.log("Priya Patel 2222...", data, error);
}
run();
