const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k) acc[k.trim()] = v.join('=').trim();
  return acc;
}, {});

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_KEY || env.SUPABASE_KEY;

async function upsert(table, data) {
  if (data.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to upsert to ${table}:`, res.status, text);
  } else {
    console.log(`Synced ${data.length} records to ${table}`);
  }
}

async function upsertNoId(table, data, conflictCols) {
  if (data.length === 0) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflictCols}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Failed to upsert to ${table}:`, res.status, text);
  } else {
    console.log(`Synced ${data.length} records to ${table}`);
  }
}

const elections = [
    { id: 'elec-001', title: '2026 Lok Sabha By-Election',           description: 'Parliamentary by-election for New Delhi.',       type: 'lok-sabha',     status: 'active',    start_date: '2026-02-10T00:00:00Z', end_date: '2026-02-15T23:59:59Z', constituency: 'New Delhi',      state: 'Delhi',         created_at: '2026-01-01T00:00:00Z' },
    { id: 'elec-002', title: 'Gujarat Vidhan Sabha Election',         description: 'State assembly election for Ahmedabad East.',    type: 'vidhan-sabha',  status: 'active',    start_date: '2026-02-10T00:00:00Z', end_date: '2026-02-20T23:59:59Z', constituency: 'Ahmedabad East', state: 'Gujarat',       created_at: '2026-01-05T00:00:00Z' },
    { id: 'elec-003', title: 'Mumbai Municipal Corporation Election', description: 'Municipal election for Mumbai South ward.',       type: 'municipal',     status: 'upcoming',  start_date: '2026-03-01T00:00:00Z', end_date: '2026-03-05T23:59:59Z', constituency: 'Mumbai South',   state: 'Maharashtra',   created_at: '2026-01-10T00:00:00Z' },
    { id: 'elec-004', title: '2025 UP State Assembly Election',       description: 'Concluded assembly election, Lucknow.',          type: 'vidhan-sabha',  status: 'completed', start_date: '2025-11-01T00:00:00Z', end_date: '2025-11-05T23:59:59Z', constituency: 'Lucknow',        state: 'Uttar Pradesh', created_at: '2025-10-01T00:00:00Z' },
    { id: 'elec-005', title: 'Hyderabad Municipal Election',          description: 'Municipal election for Hyderabad.',             type: 'municipal',     status: 'active',    start_date: '2026-02-10T00:00:00Z', end_date: '2026-02-15T23:59:59Z', constituency: 'Hyderabad',      state: 'Telangana',     created_at: '2026-01-01T00:00:00Z' },
    { id: 'elec-006', title: 'Kolkata North Lok Sabha',               description: 'Lok Sabha election for Kolkata North.',         type: 'lok-sabha',     status: 'completed', start_date: '2025-12-01T00:00:00Z', end_date: '2025-12-05T23:59:59Z', constituency: 'Kolkata North',  state: 'West Bengal',   created_at: '2025-11-01T00:00:00Z' },
    { id: 'elec-007', title: 'Kerala Assembly Election',              description: 'State assembly election for Kochi.',            type: 'vidhan-sabha',  status: 'active',    start_date: '2026-02-10T00:00:00Z', end_date: '2026-02-15T23:59:59Z', constituency: 'Kochi',          state: 'Kerala',        created_at: '2026-01-01T00:00:00Z' },
    { id: 'elec-008', title: 'Bhopal Panchayat Election',             description: 'Panchayat election for Bhopal rural.',          type: 'panchayat',     status: 'upcoming',  start_date: '2026-04-01T00:00:00Z', end_date: '2026-04-05T23:59:59Z', constituency: 'Bhopal',         state: 'Madhya Pradesh',created_at: '2026-01-01T00:00:00Z' },
    { id: 'elec-009', title: 'Chennai Central Lok Sabha Election',    description: 'Parliamentary election for Chennai Central.',   type: 'lok-sabha',     status: 'completed', start_date: '2025-10-01T00:00:00Z', end_date: '2025-10-05T23:59:59Z', constituency: 'Chennai Central',state: 'Tamil Nadu',    created_at: '2025-09-01T00:00:00Z' },
    { id: 'elec-010', title: 'Jaipur Assembly Election',              description: 'State assembly election for Jaipur.',           type: 'vidhan-sabha',  status: 'active',    start_date: '2026-02-10T00:00:00Z', end_date: '2026-02-15T23:59:59Z', constituency: 'Jaipur',         state: 'Rajasthan',     created_at: '2026-01-01T00:00:00Z' },
];

const candidates = [
    { id: 'cand-001', election_id: 'elec-001', name: 'Akhilesh Yadav',  party_name: 'Bharatiya Janata Party', party_symbol: '🪷', age: 52, qualification: 'MBA',    manifesto: 'Digital India, Smart Cities',         photo_url: '' },
    { id: 'cand-002', election_id: 'elec-001', name: 'Meera Banerjee',  party_name: 'Indian National Congress', party_symbol: '✋', age: 45, qualification: 'LLB',    manifesto: 'Employment guarantee',      photo_url: '' },
    { id: 'cand-003', election_id: 'elec-001', name: 'Arvind Gupta',    party_name: 'Aam Aadmi Party',         party_symbol: '🧹', age: 48, qualification: 'B.Tech', manifesto: 'Free electricity',             photo_url: '' },
    { id: 'cand-004', election_id: 'elec-001', name: 'Sunita Devi',     party_name: 'Independent',             party_symbol: '⭐', age: 39, qualification: 'MA',     manifesto: 'Anti-corruption',       photo_url: '' },
    { id: 'cand-005', election_id: 'elec-002', name: 'Hardik Shah',     party_name: 'Bharatiya Janata Party', party_symbol: '🪷', age: 44, qualification: 'B.Com',  manifesto: 'Industrial growth',       photo_url: '' },
    { id: 'cand-006', election_id: 'elec-002', name: 'Rashida Khan',    party_name: 'Indian National Congress', party_symbol: '✋', age: 50, qualification: 'MBBS',   manifesto: 'Public healthcare',            photo_url: '' },
    { id: 'cand-007', election_id: 'elec-002', name: 'Jayesh Patel',    party_name: 'Aam Aadmi Party',         party_symbol: '🧹', age: 36, qualification: 'MBA',    manifesto: 'Clean governance',          photo_url: '' },
    { id: 'cand-008', election_id: 'elec-004', name: 'Ramesh Mishra',   party_name: 'Bharatiya Janata Party', party_symbol: '🪷', age: 55, qualification: 'LLB',    manifesto: 'Law and order',                        photo_url: '' },
    { id: 'cand-009', election_id: 'elec-004', name: 'Neha Tiwari',     party_name: 'Samajwadi Party',         party_symbol: '🚲', age: 42, qualification: 'MA',     manifesto: 'Social justice',                     photo_url: '' },
    { id: 'cand-010', election_id: 'elec-004', name: 'Deepak Verma',    party_name: 'Bahujan Samaj Party',     party_symbol: '🐘', age: 47, qualification: 'B.Ed',   manifesto: 'Dalit rights',               photo_url: '' },
    { id: 'cand-011', election_id: 'elec-003', name: 'Arun Deshmukh',   party_name: 'Shiv Sena',               party_symbol: '🏹', age: 51, qualification: 'B.Sc',   manifesto: 'Mumbai infra',                   photo_url: '' },
    { id: 'cand-012', election_id: 'elec-003', name: 'Fatima Shaikh',   party_name: 'Indian National Congress', party_symbol: '✋', age: 38, qualification: 'MBA',    manifesto: 'Affordable housing',          photo_url: '' },
    { id: 'cand-013', election_id: 'elec-006', name: 'Mamata Das',      party_name: 'TMC', party_symbol: '🌸', age: 50, qualification: 'MA', manifesto: 'Welfare', photo_url: '' },
    { id: 'cand-014', election_id: 'elec-006', name: 'Rahul Bose',      party_name: 'BJP', party_symbol: '🪷', age: 45, qualification: 'BSc', manifesto: 'Development', photo_url: '' },
    { id: 'cand-015', election_id: 'elec-009', name: 'Stalin Kumar',    party_name: 'DMK', party_symbol: '☀️', age: 60, qualification: 'BA', manifesto: 'Rights', photo_url: '' },
    { id: 'cand-016', election_id: 'elec-009', name: 'Anbumani',        party_name: 'AIADMK', party_symbol: '🍃', age: 55, qualification: 'LLB', manifesto: 'Growth', photo_url: '' },
];

const booths = [
    { id: 'booth-delhi-01',     name: 'New Delhi Polling Station #1',           constituency: 'New Delhi' },
    { id: 'booth-ahmedabad-01', name: 'Ahmedabad East Polling Station #1',      constituency: 'Ahmedabad East' },
    { id: 'booth-lucknow-01',   name: 'Lucknow Central Polling Station #1',     constituency: 'Lucknow' },
    { id: 'booth-lucknow-02',   name: 'Lucknow South Polling Station #2',       constituency: 'Lucknow' },
    { id: 'booth-mumbai-01',    name: 'Mumbai South Polling Station #1',        constituency: 'Mumbai South' },
    { id: 'booth-hyd-01',       name: 'Hyderabad Polling Station #1',           constituency: 'Hyderabad' },
    { id: 'booth-kolkata-01',   name: 'Kolkata North Polling Station #1',       constituency: 'Kolkata North' },
    { id: 'booth-kochi-01',     name: 'Kochi Polling Station #1',               constituency: 'Kochi' },
    { id: 'booth-bhopal-01',    name: 'Bhopal Polling Station #1',              constituency: 'Bhopal' },
    { id: 'booth-chennai-01',   name: 'Chennai Central Polling Station #1',     constituency: 'Chennai Central' },
    { id: 'booth-jaipur-01',    name: 'Jaipur Polling Station #1',              constituency: 'Jaipur' },
];

const voterBoothMap = {
    '11111111-1111-1111-1111-111111111111': 'booth-delhi-01',
    '22222222-2222-2222-2222-222222222222': 'booth-ahmedabad-01',
    '33333333-3333-3333-3333-333333333333': 'booth-lucknow-01',
    '44444444-4444-4444-4444-444444444444': 'booth-mumbai-01',
    '55555555-5555-5555-5555-555555555555': 'booth-hyd-01',
    '66666666-6666-6666-6666-666666666666': 'booth-kolkata-01',
    '77777777-7777-7777-7777-777777777777': 'booth-kochi-01',
    '88888888-8888-8888-8888-888888888888': 'booth-bhopal-01',
    '99999999-9999-9999-9999-999999999999': 'booth-chennai-01',
    '00000000-0000-0000-0000-000000000010': 'booth-jaipur-01',
};
const boothVoters = Object.entries(voterBoothMap).map(([v, b]) => ({ voter_id: v, booth_id: b }));

const boothElections = [
  { id: 'booth-delhi-01:elec-001', booth_id: 'booth-delhi-01', election_id: 'elec-001' },
  { id: 'booth-ahmedabad-01:elec-002', booth_id: 'booth-ahmedabad-01', election_id: 'elec-002' },
  { id: 'booth-mumbai-01:elec-003', booth_id: 'booth-mumbai-01', election_id: 'elec-003' },
  { id: 'booth-lucknow-01:elec-004', booth_id: 'booth-lucknow-01', election_id: 'elec-004' },
  { id: 'booth-lucknow-02:elec-004', booth_id: 'booth-lucknow-02', election_id: 'elec-004' },
  { id: 'booth-hyd-01:elec-005', booth_id: 'booth-hyd-01', election_id: 'elec-005' },
  { id: 'booth-kolkata-01:elec-006', booth_id: 'booth-kolkata-01', election_id: 'elec-006' },
  { id: 'booth-kochi-01:elec-007', booth_id: 'booth-kochi-01', election_id: 'elec-007' },
  { id: 'booth-bhopal-01:elec-008', booth_id: 'booth-bhopal-01', election_id: 'elec-008' },
  { id: 'booth-chennai-01:elec-009', booth_id: 'booth-chennai-01', election_id: 'elec-009' },
  { id: 'booth-jaipur-01:elec-010', booth_id: 'booth-jaipur-01', election_id: 'elec-010' },
];

async function sync() {
  await upsert('elections', elections);
  await upsert('candidates', candidates);
  await upsert('booths', booths);
  await upsertNoId('booth_voters', boothVoters, 'voter_id');
  await upsert('booth_elections', boothElections);
}
sync();
