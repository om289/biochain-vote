const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:SiddharthOmLakshay@db.hbuxgqnbbheyuwxmquvp.supabase.co:5432/postgres'
});
async function run() {
  try {
    await client.connect();
    const tables = ['voters', 'votes', 'booth_voters', 'booth_elections', 'booths', 'elections', 'candidates'];
    for (const table of tables) {
      await client.query(`ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY;`);
      console.log("Disabled RLS on", table);
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}
run();
