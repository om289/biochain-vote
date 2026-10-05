const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data, error } = await supabase.from('booth_voters').select('*').eq('voter_id', 'b0b9da4f-1fa5-45b4-a827-0b56ba327699').single();
  console.log("b0b9...", data, error);
  const { data: d2, error: e2 } = await supabase.from('booth_voters').select('*').eq('voter_id', '22222222-2222-2222-2222-222222222222').single();
  console.log("2222...", d2, e2);
}
run();
