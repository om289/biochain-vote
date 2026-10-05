const { Client } = require('pg');

if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL) {
  console.error('ERROR: Set DATABASE_URL or SUPABASE_DB_URL env var before running this script.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
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
