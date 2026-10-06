#!/usr/bin/env node
/**
 * Check Supabase elections for duplicates and corruption
 */

require('dotenv').config();
const https = require('https');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

async function fetchElections() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/elections?select=*&order=created_at.asc`);
    
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
  console.log('🔍 Checking Supabase elections for issues...\n');

  try {
    const elections = await fetchElections();
    
    console.log(`📊 Total elections: ${elections.length}\n`);
    
    // Group by ID to find duplicates
    const grouped = {};
    elections.forEach(e => {
      if (!grouped[e.id]) grouped[e.id] = [];
      grouped[e.id].push(e);
    });

    // Check for duplicates
    const duplicates = Object.entries(grouped).filter(([id, list]) => list.length > 1);
    
    if (duplicates.length > 0) {
      console.log('❌ DUPLICATES FOUND:\n');
      duplicates.forEach(([id, list]) => {
        console.log(`   Election ID: ${id}`);
        list.forEach((e, i) => {
          console.log(`     ${i + 1}. ${e.title || 'No title'} (${e.status}) - created: ${e.created_at}`);
        });
        console.log('');
      });
      console.log('⚠️  These duplicates will cause blockchain corruption!\n');
      console.log('🔧 Run this to fix:');
      console.log('   node fix_supabase_duplicates.cjs\n');
    } else {
      console.log('✅ No duplicate elections found\n');
    }

    // List all elections
    console.log('📋 All elections:\n');
    elections.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.id}`);
      console.log(`      Title: ${e.title || 'N/A'}`);
      console.log(`      Status: ${e.status}`);
      console.log(`      Created: ${new Date(e.created_at).toLocaleString()}`);
      console.log('');
    });

    // Check for missing fields
    const incomplete = elections.filter(e => !e.title || !e.status || !e.created_at);
    if (incomplete.length > 0) {
      console.log(`⚠️  ${incomplete.length} election(s) have missing fields\n`);
    }

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}`);
    process.exit(1);
  }
}

main();
