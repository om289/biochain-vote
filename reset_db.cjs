const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && k.trim()) acc[k.trim()] = v.join('=').trim();
  return acc;
}, {});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_KEY || env.SUPABASE_KEY;

async function resetVotes() {
  console.log('Resetting votes and blocks...');
  
  // 1. Delete all votes
  let res = await fetch(`${SUPABASE_URL}/rest/v1/votes?id=not.is.null`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log('Cleared votes table:', res.status);

  // 2. Delete all blocks
  res = await fetch(`${SUPABASE_URL}/rest/v1/blocks?index=not.is.null`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log('Cleared blocks table:', res.status);

  // 3. Reset all voters has_voted = false
  res = await fetch(`${SUPABASE_URL}/rest/v1/voters?has_voted=eq.true`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ has_voted: false })
  });
  console.log('Reset voters has_voted status:', res.status);

  console.log('Done! All blockchain integrity issues fixed and we are starting fresh.');
}

resetVotes().catch(console.error);
