#!/usr/bin/env node
/**
 * Fix Supabase duplicate elections and add PRIMARY KEY constraints
 * 
 * Usage: node fix_supabase_duplicates.cjs
 * 
 * Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const sqlStatements = [
  {
    name: 'Remove duplicate election',
    sql: `DELETE FROM public.elections WHERE id = 'elec-1791247824438' AND status = 'upcoming';`
  },
  {
    name: 'Add PRIMARY KEY to elections',
    sql: `ALTER TABLE public.elections DROP CONSTRAINT IF EXISTS elections_pkey; ALTER TABLE public.elections ADD CONSTRAINT elections_pkey PRIMARY KEY (id);`
  },
  {
    name: 'Add PRIMARY KEY to candidates',
    sql: `ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_pkey; ALTER TABLE public.candidates ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);`
  },
  {
    name: 'Add PRIMARY KEY to booths',
    sql: `ALTER TABLE public.booths DROP CONSTRAINT IF EXISTS booths_pkey; ALTER TABLE public.booths ADD CONSTRAINT booths_pkey PRIMARY KEY (id);`
  },
  {
    name: 'Add PRIMARY KEY to booth_elections',
    sql: `ALTER TABLE public.booth_elections DROP CONSTRAINT IF EXISTS booth_elections_pkey; ALTER TABLE public.booth_elections ADD CONSTRAINT booth_elections_pkey PRIMARY KEY (id);`
  }
];

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
    
    const postData = JSON.stringify({ query: sql });
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function verifyElections() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/elections?select=id,title,status,created_at&order=created_at.asc`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('🔧 Fixing Supabase duplicate elections and adding PRIMARY KEY constraints...\n');

  try {
    // Execute SQL statements
    for (const stmt of sqlStatements) {
      try {
        console.log(`⏳ ${stmt.name}...`);
        await executeSQL(stmt.sql);
        console.log(`✅ ${stmt.name} - Success\n`);
      } catch (err) {
        // Some statements may fail if constraints don't exist yet - that's okay
        if (err.message.includes('does not exist') || err.message.includes('not found')) {
          console.log(`⚠️  ${stmt.name} - Already applied or not needed\n`);
        } else {
          console.error(`❌ ${stmt.name} - Error: ${err.message}\n`);
        }
      }
    }

    // Verify elections table
    console.log('🔍 Verifying elections table...');
    const elections = await verifyElections();
    console.log(`\n✅ Found ${elections.length} election(s):\n`);
    elections.forEach(e => {
      console.log(`   • ${e.title || e.id} (${e.status}) - ${new Date(e.created_at).toLocaleString()}`);
    });

    // Check for duplicates
    const ids = elections.map(e => e.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      console.log(`\n⚠️  WARNING: Still found duplicate election IDs: ${duplicates.join(', ')}`);
    } else {
      console.log('\n✅ No duplicate elections found!');
    }

    console.log('\n🎉 Database fix complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Clear IndexedDB in your browser (F12 → Application → IndexedDB → biochain-vote → Delete)');
    console.log('   2. Refresh the page');
    console.log('   3. Verify blockchain integrity in Admin → Chain Sync tab\n');

  } catch (err) {
    console.error(`\n❌ Fatal error: ${err.message}`);
    process.exit(1);
  }
}

main();
