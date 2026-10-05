const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data: voters } = await supabase.from('voters').select('*');
  console.log("Voters:", voters.map(v => v.name));
  const { data: bVoters } = await supabase.from('booth_voters').select('*');
  console.log("Booth Voters:", bVoters);
}
run();
