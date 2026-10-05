const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);
async function run() {
  const { data, error } = await supabase.from('voters').delete().eq('id', 'b0b9da4f-1fa5-45b4-a827-0b56ba327699');
  console.log("Deleted duplicate Priya Patel", error);
}
run();
