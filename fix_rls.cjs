const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:SiddharthOmLakshay@db.hbuxgqnbbheyuwxmquvp.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    
    // Disable RLS
    await client.query(`ALTER TABLE public.voters DISABLE ROW LEVEL SECURITY;`);
    console.log("Disabled RLS on voters table");

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}
run();
