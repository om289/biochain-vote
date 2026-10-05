const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data, error } = await supabase.from('votes').upsert({
    id: '8ed28ffe-4269-9ec9-0780-be2516dd4bab',
    voter_id: '22222222-2222-2222-2222-222222222222',
    candidate: 'cand-001'
  });
  console.log("Upsert attempt:", error ? error.message : "Success");
}
run();
