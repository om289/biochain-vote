const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const { data: voters } = await supabase.from('voters').select('*').eq('name', 'x');
  if (voters && voters.length > 0) {
    const x = voters[0];
    const { error } = await supabase.from('booth_voters').upsert({ voter_id: x.id, booth_id: 'booth-delhi-01' });
    console.log("Assigned user x to delhi booth:", error || "Success");
  } else {
    console.log("User x not found");
  }
}
run();
