/**
 * dbService.ts — BioChain Vote Data Layer
 *
 * Data split:
 *   Supabase  → voters, votes  (persistent, shared across devices)
 *   IndexedDB → elections, candidates, admins, blocks (local, fast)
 *
 * Supabase schema:
 *   voters(id uuid, name text, location text, voter_id text,
 *           fingerprint_template text, has_voted bool, created_at timestamp)
 *   votes(id uuid, voter_id uuid, candidate text, created_at timestamp)
 */

import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Voter {
  id: string;
  name: string;
  voterIdNumber: string;
  constituency: string;       // maps to Supabase "location"
  fingerprint: string;        // maps to Supabase "fingerprint_template"
  hasVoted: boolean;          // maps to Supabase "has_voted"
  // Optional extras (not in Supabase — kept for UI compatibility)
  aadhaarNumber?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  district?: string;
  state?: string;
  photoUrl?: string;
  did?: string;
  registeredAt?: string;
}

export interface VoteRecord {
  id: string;
  electionId: string;   // local only — not in Supabase
  voterId: string;      // Supabase voter_id
  candidateId: string;  // Supabase candidate (candidate name as text)
  blockHash: string;    // local blockchain
  blockIndex: number;   // local blockchain
  timestamp: string;
}

export interface ElectionRecord {
  id: string;
  title: string;
  description: string;
  type: 'lok-sabha' | 'vidhan-sabha' | 'municipal' | 'panchayat';
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  constituency: string;
  state: string;
  createdAt: string;
}

export interface CandidateRecord {
  id: string;
  electionId: string;
  name: string;
  partyName: string;
  partySymbol: string;
  age: number;
  qualification: string;
  manifesto: string;
  photoUrl: string;
}

export interface AdminRecord {
  id: string;
  name: string;
  pin: string;
}

// ─── IndexedDB (local) ────────────────────────────────────────────────────────

const DB_NAME = 'biochain-vote';
const DB_VERSION = 3;

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('elections')) {
        const es = db.createObjectStore('elections', { keyPath: 'id' });
        es.createIndex('status', 'status', { unique: false });
        es.createIndex('constituency', 'constituency', { unique: false });
      }
      if (!db.objectStoreNames.contains('candidates')) {
        const cs = db.createObjectStore('candidates', { keyPath: 'id' });
        cs.createIndex('electionId', 'electionId', { unique: false });
      }
      if (!db.objectStoreNames.contains('admins')) {
        db.createObjectStore('admins', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('blocks')) {
        db.createObjectStore('blocks', { keyPath: 'index' });
      }
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll<T>(store: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbGet<T>(store: string, id: string | number): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).get(id);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbGetByIndex<T>(store: string, idx: string, value: IDBValidKey | IDBKeyRange): Promise<T[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).index(idx).getAll(value);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbPut<T>(store: string, data: T): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(data);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function dbDelete(store: string, id: string | number): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function dbCount(store: string): Promise<number> {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    const r = tx.objectStore(store).count();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// ─── voterDB — Supabase ───────────────────────────────────────────────────────

function rowToVoter(v: any): Voter {
  return {
    id: v.id,
    name: v.name,
    voterIdNumber: v.voter_id ?? '',
    constituency: v.location ?? '',
    fingerprint: v.fingerprint_template ?? '',
    hasVoted: v.has_voted ?? false,
    registeredAt: v.created_at ?? '',
  };
}

export const voterDB = {
  async getAll(): Promise<Voter[]> {
    try {
      const { data, error } = await supabase.from('voters').select('*');
      if (error || !data || data.length === 0) return getDemoVoters();
      return data.map(rowToVoter);
    } catch {
      return getDemoVoters();
    }
  },

  async getById(id: string): Promise<Voter | undefined> {
    const { data } = await supabase.from('voters').select('*').eq('id', id).single();
    return data ? rowToVoter(data) : undefined;
  },

  async save(voter: Voter): Promise<void> {
    const { error } = await supabase.from('voters').upsert({
      id: voter.id,
      name: voter.name,
      voter_id: voter.voterIdNumber,
      location: voter.constituency,
      fingerprint_template: voter.fingerprint || null,
    });
    if (error) {
      console.error('[dbService] Error saving voter:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    await supabase.from('voters').delete().eq('id', id);
  },

  async count(): Promise<number> {
    const { count: c } = await supabase
      .from('voters').select('*', { count: 'exact', head: true });
    return c ?? 0;
  },

  async markVoted(voterId: string): Promise<void> {
    await supabase.from('voters').update({ has_voted: true }).eq('id', voterId);
  },

  async hasVoted(voterId: string): Promise<boolean> {
    const { data } = await supabase
      .from('voters').select('has_voted').eq('id', voterId).single();
    return !!data?.has_voted;
  },
};

// ─── voteDB — Supabase ────────────────────────────────────────────────────────

function rowToVote(v: any, electionId = ''): VoteRecord {
  return {
    id: v.id,
    electionId,
    voterId: v.voter_id,
    candidateId: v.candidate,
    blockHash: v.id,
    blockIndex: 0,
    timestamp: v.created_at,
  };
}

export const voteDB = {
  async save(vote: VoteRecord): Promise<void> {
    await supabase.from('votes').upsert({
      id: vote.id,
      voter_id: vote.voterId,
      candidate: vote.candidateId,
      created_at: vote.timestamp,
    });
  },

  async getByVoter(voterId: string): Promise<VoteRecord[]> {
    const { data } = await supabase.from('votes').select('*').eq('voter_id', voterId);
    return (data ?? []).map(v => rowToVote(v));
  },

  async hasVoted(_electionId: string, voterId: string): Promise<boolean> {
    return voterDB.hasVoted(voterId);
  },

  async count(): Promise<number> {
    const { count: c } = await supabase.from('votes').select('*', { count: 'exact', head: true });
    return c ?? 0;
  },

  async countByElection(_electionId: string): Promise<number> {
    // Supabase votes table doesn't have electionId — return total count
    return voteDB.count();
  },

  async getAll(): Promise<VoteRecord[]> {
    const { data } = await supabase.from('votes').select('*');
    return (data ?? []).map(v => rowToVote(v));
  },

  async getById(id: string): Promise<VoteRecord | undefined> {
    const { data } = await supabase.from('votes').select('*').eq('id', id).single();
    return data ? rowToVote(data) : undefined;
  },

  async getByElection(_electionId: string): Promise<VoteRecord[]> {
    // Supabase votes table doesn't have electionId — return all and filter by caller
    const { data } = await supabase.from('votes').select('*');
    return (data ?? []).map(v => rowToVote(v, _electionId));
  },
};

// ─── electionDB — IndexedDB ───────────────────────────────────────────────────

export const electionDB = {
  getAll: () => dbGetAll<ElectionRecord>('elections'),
  getById: (id: string) => dbGet<ElectionRecord>('elections', id),
  getByStatus: (status: string) => dbGetByIndex<ElectionRecord>('elections', 'status', status),
  getByConstituency: (c: string) => dbGetByIndex<ElectionRecord>('elections', 'constituency', c),
  save: (e: ElectionRecord) => dbPut('elections', e),
  delete: (id: string) => dbDelete('elections', id),
  count: () => dbCount('elections'),
};

// ─── candidateDB — IndexedDB ──────────────────────────────────────────────────

export const candidateDB = {
  getAll: () => dbGetAll<CandidateRecord>('candidates'),
  getById: (id: string) => dbGet<CandidateRecord>('candidates', id),
  getByElection: (electionId: string) => dbGetByIndex<CandidateRecord>('candidates', 'electionId', electionId),
  save: (c: CandidateRecord) => dbPut('candidates', c),
  delete: (id: string) => dbDelete('candidates', id),
  count: () => dbCount('candidates'),
};

// ─── adminDB — IndexedDB ──────────────────────────────────────────────────────

export const adminDB = {
  getAll: () => dbGetAll<AdminRecord>('admins'),
  save: (a: AdminRecord) => dbPut('admins', a),
  verifyPin: async (pin: string): Promise<boolean> => {
    const admins = await dbGetAll<AdminRecord>('admins');
    return admins.some(a => a.pin === pin);
  },
};

// ─── blockDB — IndexedDB ──────────────────────────────────────────────────────

export const blockDB = {
  getAll: () => dbGetAll<any>('blocks'),
  getByIndex: (i: number) => dbGet<any>('blocks', i),
  save: (b: any) => dbPut('blocks', b),
  count: () => dbCount('blocks'),
  getLast: async (): Promise<any | undefined> => {
    const blocks = await dbGetAll<any>('blocks');
    if (!blocks.length) return undefined;
    return blocks.sort((a, b) => b.index - a.index)[0];
  },
};

// ─── Demo voter fallback (shown when Supabase is empty) ───────────────────────

function getDemoVoters(): Voter[] {
  return [
    { id: 'voter-001', name: 'Rajesh Kumar Sharma', voterIdNumber: 'DL/04/001/234567', constituency: 'New Delhi',      fingerprint: '', hasVoted: false },
    { id: 'voter-002', name: 'Priya Patel',          voterIdNumber: 'GJ/06/002/345678', constituency: 'Ahmedabad East', fingerprint: '', hasVoted: false },
    { id: 'voter-003', name: 'Amit Singh',           voterIdNumber: 'UP/08/003/456789', constituency: 'Lucknow',        fingerprint: '', hasVoted: false },
    { id: 'voter-004', name: 'Sneha Devi',           voterIdNumber: 'MH/10/004/567890', constituency: 'Mumbai South',   fingerprint: '', hasVoted: false },
    { id: 'voter-005', name: 'Vikram Reddy',         voterIdNumber: 'TG/12/005/678901', constituency: 'Hyderabad',      fingerprint: '', hasVoted: false },
  ];
}

// ─── Seed local IndexedDB (elections, candidates, admin PIN) ─────────────────

export async function seedDemoData(): Promise<void> {
  const n = await dbCount('elections');
  if (n > 0) return; // already seeded

  await adminDB.save({ id: 'admin-001', name: 'Election Commissioner', pin: 'admin123' });

  const elections: ElectionRecord[] = [
    { id: 'elec-001', title: '2026 Lok Sabha By-Election',           description: 'Parliamentary by-election for New Delhi.',       type: 'lok-sabha',     status: 'active',    startDate: '2026-02-10T00:00:00Z', endDate: '2026-02-15T23:59:59Z', constituency: 'New Delhi',      state: 'Delhi',         createdAt: '2026-01-01T00:00:00Z' },
    { id: 'elec-002', title: 'Gujarat Vidhan Sabha Election',         description: 'State assembly election for Ahmedabad East.',    type: 'vidhan-sabha',  status: 'active',    startDate: '2026-02-10T00:00:00Z', endDate: '2026-02-20T23:59:59Z', constituency: 'Ahmedabad East', state: 'Gujarat',       createdAt: '2026-01-05T00:00:00Z' },
    { id: 'elec-003', title: 'Mumbai Municipal Corporation Election', description: 'Municipal election for Mumbai South ward.',       type: 'municipal',     status: 'upcoming',  startDate: '2026-03-01T00:00:00Z', endDate: '2026-03-05T23:59:59Z', constituency: 'Mumbai South',   state: 'Maharashtra',   createdAt: '2026-01-10T00:00:00Z' },
    { id: 'elec-004', title: '2025 UP State Assembly Election',       description: 'Concluded assembly election, Lucknow.',          type: 'vidhan-sabha',  status: 'completed', startDate: '2025-11-01T00:00:00Z', endDate: '2025-11-05T23:59:59Z', constituency: 'Lucknow',        state: 'Uttar Pradesh', createdAt: '2025-10-01T00:00:00Z' },
  ];
  for (const e of elections) await electionDB.save(e);

  const candidates: CandidateRecord[] = [
    { id: 'cand-001', electionId: 'elec-001', name: 'Akhilesh Yadav',  partyName: 'Bharatiya Janata Party', partySymbol: '🪷', age: 52, qualification: 'MBA',    manifesto: 'Digital India, Smart Cities, Defence modernization',         photoUrl: '' },
    { id: 'cand-002', electionId: 'elec-001', name: 'Meera Banerjee',  partyName: 'Indian National Congress', partySymbol: '✋', age: 45, qualification: 'LLB',    manifesto: 'Employment guarantee, farmer welfare, education reform',      photoUrl: '' },
    { id: 'cand-003', electionId: 'elec-001', name: 'Arvind Gupta',    partyName: 'Aam Aadmi Party',         partySymbol: '🧹', age: 48, qualification: 'B.Tech', manifesto: 'Free electricity, water, healthcare, education',             photoUrl: '' },
    { id: 'cand-004', electionId: 'elec-001', name: 'Sunita Devi',     partyName: 'Independent',             partySymbol: '⭐', age: 39, qualification: 'MA',     manifesto: 'Anti-corruption, women safety, transparent governance',       photoUrl: '' },
    { id: 'cand-005', electionId: 'elec-002', name: 'Hardik Shah',     partyName: 'Bharatiya Janata Party', partySymbol: '🪷', age: 44, qualification: 'B.Com',  manifesto: 'Industrial growth, infra development, Vibrant Gujarat',       photoUrl: '' },
    { id: 'cand-006', electionId: 'elec-002', name: 'Rashida Khan',    partyName: 'Indian National Congress', partySymbol: '✋', age: 50, qualification: 'MBBS',   manifesto: 'Public healthcare, minority rights, farmer loans',            photoUrl: '' },
    { id: 'cand-007', electionId: 'elec-002', name: 'Jayesh Patel',    partyName: 'Aam Aadmi Party',         partySymbol: '🧹', age: 36, qualification: 'MBA',    manifesto: 'Clean governance, free electricity, jobs for youth',          photoUrl: '' },
    { id: 'cand-008', electionId: 'elec-004', name: 'Ramesh Mishra',   partyName: 'Bharatiya Janata Party', partySymbol: '🪷', age: 55, qualification: 'LLB',    manifesto: 'Law and order, development, tourism',                        photoUrl: '' },
    { id: 'cand-009', electionId: 'elec-004', name: 'Neha Tiwari',     partyName: 'Samajwadi Party',         partySymbol: '🚲', age: 42, qualification: 'MA',     manifesto: 'Social justice, OBC rights, employment',                     photoUrl: '' },
    { id: 'cand-010', electionId: 'elec-004', name: 'Deepak Verma',    partyName: 'Bahujan Samaj Party',     partySymbol: '🐘', age: 47, qualification: 'B.Ed',   manifesto: 'Dalit rights, reservation, rural development',               photoUrl: '' },
    { id: 'cand-011', electionId: 'elec-003', name: 'Arun Deshmukh',   partyName: 'Shiv Sena',               partySymbol: '🏹', age: 51, qualification: 'B.Sc',   manifesto: 'Mumbai infra, Marathi rights, clean city',                   photoUrl: '' },
    { id: 'cand-012', electionId: 'elec-003', name: 'Fatima Shaikh',   partyName: 'Indian National Congress', partySymbol: '✋', age: 38, qualification: 'MBA',    manifesto: 'Affordable housing, public transport, women safety',          photoUrl: '' },
  ];
  for (const c of candidates) await candidateDB.save(c);
}


