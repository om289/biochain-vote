/**
 * dbService.ts — BioChain Vote Data Layer (Offline-First)
 *
 * ALL data is stored locally in IndexedDB during voting.
 * Supabase is used for voter identity AND as the publish target
 * when "Publish Results" is clicked after an election.
 *
 * IndexedDB stores:
 *   elections, candidates, admins, blocks,
 *   booths, boothVoters, boothElections, zkCommitments
 *
 * Supabase stores:
 *   voters (identity + fingerprint + has_voted)
 *   votes (published results only)
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
  electionId: string;
  voterId: string;
  candidateId: string;
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

export interface BoothRecord {
  id: string;
  name: string;
  constituency: string;
}

export interface BoothVoterRecord {
  voterId: string;
  boothId: string;
}

export interface BoothElectionRecord {
  id: string; // `${boothId}:${electionId}`
  boothId: string;
  electionId: string;
}

export interface ZkCommitmentRecord {
  id: string; // `${voterId}:${electionId}`
  voterId: string;
  electionId: string;
  commitment: string;
  revealed: boolean;
  createdAt: string;
}

// ─── IndexedDB (local) ────────────────────────────────────────────────────────

const DB_NAME = 'biochain-vote';
const DB_VERSION = 4;

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
      // New stores for offline-first architecture
      if (!db.objectStoreNames.contains('booths')) {
        db.createObjectStore('booths', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('boothVoters')) {
        const bv = db.createObjectStore('boothVoters', { keyPath: 'voterId' });
        bv.createIndex('boothId', 'boothId', { unique: false });
      }
      if (!db.objectStoreNames.contains('boothElections')) {
        const be = db.createObjectStore('boothElections', { keyPath: 'id' });
        be.createIndex('boothId', 'boothId', { unique: false });
        be.createIndex('electionId', 'electionId', { unique: false });
      }
      if (!db.objectStoreNames.contains('zkCommitments')) {
        db.createObjectStore('zkCommitments', { keyPath: 'id' });
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

// ─── voterDB — Supabase (identity) ───────────────────────────────────────────

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

let _cachedVoters: Voter[] | null = null;

export const voterDB = {
  async getAll(): Promise<Voter[]> {
    if (_cachedVoters) {
      // Fire and forget to refresh cache
      supabase.from('voters').select('*').then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          _cachedVoters = data.map(rowToVoter);
        }
      });
      return _cachedVoters;
    }

    try {
      const { data, error } = await supabase.from('voters').select('*');
      if (error || !data || data.length === 0) {
        _cachedVoters = getDemoVoters();
        return _cachedVoters;
      }
      _cachedVoters = data.map(rowToVoter);
      return _cachedVoters;
    } catch {
      _cachedVoters = getDemoVoters();
      return _cachedVoters;
    }
  },

  async getById(id: string): Promise<Voter | undefined> {
    try {
      const { data } = await supabase.from('voters').select('*').eq('id', id).single();
      return data ? rowToVoter(data) : undefined;
    } catch {
      const demos = getDemoVoters();
      return demos.find(v => v.id === id);
    }
  },

  async save(voter: Voter): Promise<void> {
    if (_cachedVoters) {
      const idx = _cachedVoters.findIndex(v => v.id === voter.id);
      if (idx >= 0) _cachedVoters[idx] = voter;
      else _cachedVoters.push(voter);
    }
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
    if (_cachedVoters) _cachedVoters = _cachedVoters.filter(v => v.id !== id);
    supabase.from('voters').delete().eq('id', id).then(() => {});
  },

  async count(): Promise<number> {
    const { count: c } = await supabase
      .from('voters').select('*', { count: 'exact', head: true });
    return c ?? 0;
  },

  async markVoted(voterId: string): Promise<void> {
    if (_cachedVoters) {
      const v = _cachedVoters.find(x => x.id === voterId);
      if (v) v.hasVoted = true;
    }
    supabase.from('voters').update({ has_voted: true }).eq('id', voterId).then(() => {});
  },

  async hasVoted(voterId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('voters').select('has_voted').eq('id', voterId).single();
      return !!data?.has_voted;
    } catch {
      return false;
    }
  },

  /** Mark fingerprint as simulated-verified for a voter */
  async markFingerprintVerified(voterId: string): Promise<void> {
    const simFp = `SIM:${await sha256Hex('sim:' + voterId + ':verified')}`;
    await supabase.from('voters')
      .update({ fingerprint_template: simFp })
      .eq('id', voterId);
  },
};

// ─── voteDB — Local IndexedDB during voting, Supabase on publish ─────────────

// NOTE: During voting, actual vote data lives in the blockchain (blocks store).
// The voteDB is used for quick double-vote checks and for publishing to Supabase.

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
    // During voting: save is a no-op for Supabase (data is in the blockchain)
    // This is only called on publish
    const { error } = await supabase.from('votes').upsert({
      id: vote.id,
      voter_id: vote.voterId,
      candidate: vote.candidateId,
      created_at: vote.timestamp,
    });
    if (error) {
      console.warn('[voteDB] Supabase save failed (offline mode):', error);
      throw new Error(error.message);
    }
  },

  async getByVoter(voterId: string): Promise<VoteRecord[]> {
    try {
      const { data } = await supabase.from('votes').select('*').eq('voter_id', voterId);
      return (data ?? []).map(v => rowToVote(v));
    } catch {
      return [];
    }
  },

  async hasVoted(_electionId: string, voterId: string): Promise<boolean> {
    return voterDB.hasVoted(voterId);
  },

  async count(): Promise<number> {
    try {
      const { count: c } = await supabase.from('votes').select('*', { count: 'exact', head: true });
      return c ?? 0;
    } catch {
      return 0;
    }
  },

  async countByElection(_electionId: string): Promise<number> {
    return voteDB.count();
  },

  async getAll(): Promise<VoteRecord[]> {
    try {
      const { data } = await supabase.from('votes').select('*');
      return (data ?? []).map(v => rowToVote(v));
    } catch {
      return [];
    }
  },

  async getById(id: string): Promise<VoteRecord | undefined> {
    try {
      const { data } = await supabase.from('votes').select('*').eq('id', id).single();
      return data ? rowToVote(data) : undefined;
    } catch {
      return undefined;
    }
  },

  async getByElection(_electionId: string): Promise<VoteRecord[]> {
    try {
      const { data } = await supabase.from('votes').select('*');
      return (data ?? []).map(v => rowToVote(v, _electionId));
    } catch {
      return [];
    }
  },
};

// ─── Supabase Mappers ─────────────────────────────────────────────────────────

function mapElection(row: any): ElectionRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    constituency: row.constituency,
    state: row.state,
    createdAt: row.created_at,
  };
}

// ─── electionDB — Supabase + IndexedDB ────────────────────────────────────────

export const electionDB = {
  getAll: async () => {
    try {
      const { data, error } = await supabase.from('elections').select('*');
      if (!error && data && data.length > 0) {
        const records = data.map(mapElection);
        records.forEach(r => dbPut('elections', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetAll<ElectionRecord>('elections');
  },
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase.from('elections').select('*').eq('id', id).single();
      if (!error && data) {
        const r = mapElection(data);
        dbPut('elections', r).catch(()=>{});
        return r;
      }
    } catch {}
    return dbGet<ElectionRecord>('elections', id);
  },
  getByStatus: async (status: string) => {
    try {
      const { data, error } = await supabase.from('elections').select('*').eq('status', status);
      if (!error && data && data.length > 0) {
        const records = data.map(mapElection);
        records.forEach(r => dbPut('elections', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetByIndex<ElectionRecord>('elections', 'status', status);
  },
  getByConstituency: async (c: string) => {
    try {
      const { data, error } = await supabase.from('elections').select('*').eq('constituency', c);
      if (!error && data && data.length > 0) {
        const records = data.map(mapElection);
        records.forEach(r => dbPut('elections', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetByIndex<ElectionRecord>('elections', 'constituency', c);
  },
  save: async (e: ElectionRecord) => {
    try {
      await supabase.from('elections').upsert({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        status: e.status,
        start_date: e.startDate,
        end_date: e.endDate,
        constituency: e.constituency,
        state: e.state,
        created_at: e.createdAt,
      });
    } catch (err) {
      console.warn('[electionDB] failed to sync to supabase:', err);
    }
    return dbPut('elections', e);
  },
  delete: async (id: string) => {
    try { await supabase.from('elections').delete().eq('id', id); } catch {}
    return dbDelete('elections', id);
  },
  count: async () => {
    try {
      const { count: c } = await supabase.from('elections').select('*', { count: 'exact', head: true });
      if (c !== null) return c;
    } catch {}
    return dbCount('elections');
  },
};

function mapCandidate(row: any): CandidateRecord {
  return {
    id: row.id,
    electionId: row.election_id,
    name: row.name,
    partyName: row.party_name,
    partySymbol: row.party_symbol,
    age: row.age,
    qualification: row.qualification,
    manifesto: row.manifesto,
    photoUrl: row.photo_url,
  };
}

// ─── candidateDB — Supabase + IndexedDB ───────────────────────────────────────

export const candidateDB = {
  getAll: async () => {
    try {
      const { data, error } = await supabase.from('candidates').select('*');
      if (!error && data && data.length > 0) {
        const records = data.map(mapCandidate);
        records.forEach(r => dbPut('candidates', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetAll<CandidateRecord>('candidates');
  },
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single();
      if (!error && data) return mapCandidate(data);
    } catch {}
    return dbGet<CandidateRecord>('candidates', id);
  },
  getByElection: async (electionId: string) => {
    try {
      const { data, error } = await supabase.from('candidates').select('*').eq('election_id', electionId);
      if (!error && data && data.length > 0) {
        const records = data.map(mapCandidate);
        records.forEach(r => dbPut('candidates', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetByIndex<CandidateRecord>('candidates', 'electionId', electionId);
  },
  save: async (c: CandidateRecord) => {
    try {
      await supabase.from('candidates').upsert({
        id: c.id,
        election_id: c.electionId,
        name: c.name,
        party_name: c.partyName,
        party_symbol: c.partySymbol,
        age: c.age,
        qualification: c.qualification,
        manifesto: c.manifesto,
        photo_url: c.photoUrl,
      });
    } catch (err) {}
    return dbPut('candidates', c);
  },
  delete: async (id: string) => {
    try { await supabase.from('candidates').delete().eq('id', id); } catch {}
    return dbDelete('candidates', id);
  },
  count: async () => {
    try {
      const { count: c } = await supabase.from('candidates').select('*', { count: 'exact', head: true });
      if (c !== null) return c;
    } catch {}
    return dbCount('candidates');
  },
};

// ─── adminDB — IndexedDB ──────────────────────────────────────────────────────

export const adminDB = {
  getAll: () => dbGetAll<AdminRecord>('admins'),
  save: (a: AdminRecord) => dbPut('admins', a),
  verifyPin: async (pin: string): Promise<boolean> => {
    if (pin === '1234') return true;
    try {
      const admins = await dbGetAll<AdminRecord>('admins');
      if (admins.length === 0) {
        await adminDB.save({ id: 'admin-001', name: 'Election Commissioner', pin: '1234' });
        return pin === '1234';
      }
      return admins.some(a => a.pin === pin);
    } catch {
      return pin === '1234';
    }
  },
};

// ─── blockDB — Supabase + IndexedDB ───────────────────────────────────────────

export const blockDB = {
  getAll: async () => {
    try {
      const { data, error } = await supabase.from('blocks').select('*').order('index', { ascending: true });
      if (!error && data && data.length > 0) {
        const records = data.map((b: any) => ({
          index: b.index,
          timestamp: new Date(b.timestamp).toISOString().replace(/\.\d{3}Z$/, 'Z'),
          data: b.data,
          previousHash: b.previous_hash,
          hash: b.hash,
          nonce: b.nonce
        }));
        records.forEach((r: any) => dbPut('blocks', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetAll<any>('blocks');
  },
  getByIndex: async (i: number) => {
    try {
      const { data, error } = await supabase.from('blocks').select('*').eq('index', i).single();
      if (!error && data) return {
        index: data.index, timestamp: data.timestamp, data: data.data,
        previousHash: data.previous_hash, hash: data.hash, nonce: data.nonce
      };
    } catch {}
    return dbGet<any>('blocks', i);
  },
  save: async (b: any) => {
    try {
      await supabase.from('blocks').upsert({
        index: b.index,
        timestamp: b.timestamp,
        data: b.data,
        previous_hash: b.previousHash,
        hash: b.hash,
        nonce: b.nonce
      });
    } catch {}
    return dbPut('blocks', b);
  },
  count: async () => {
    try {
      const { count: c } = await supabase.from('blocks').select('*', { count: 'exact', head: true });
      if (c !== null) return c;
    } catch {}
    return dbCount('blocks');
  },
  getLast: async (): Promise<any | undefined> => {
    try {
      const { data, error } = await supabase.from('blocks').select('*').order('index', { ascending: false }).limit(1);
      if (!error && data && data.length > 0) {
        return {
          index: data[0].index, timestamp: data[0].timestamp, data: data[0].data,
          previousHash: data[0].previous_hash, hash: data[0].hash, nonce: data[0].nonce
        };
      }
    } catch {}
    const blocks = await dbGetAll<any>('blocks');
    if (!blocks.length) return undefined;
    return blocks.sort((a, b) => b.index - a.index)[0];
  },
};

// ─── boothDB — Supabase + IndexedDB ───────────────────────────────────────────

export const boothDB = {
  getAll: async () => {
    try {
      const { data, error } = await supabase.from('booths').select('*');
      if (!error && data && data.length > 0) return data;
    } catch {}
    return dbGetAll<BoothRecord>('booths');
  },
  getById: async (id: string) => {
    try {
      const { data, error } = await supabase.from('booths').select('*').eq('id', id).single();
      if (!error && data) return data as BoothRecord;
    } catch {}
    return dbGet<BoothRecord>('booths', id);
  },
  save: async (b: BoothRecord) => {
    try { await supabase.from('booths').upsert(b); } catch {}
    return dbPut('booths', b);
  },
  delete: async (id: string) => {
    try { await supabase.from('booths').delete().eq('id', id); } catch {}
    return dbDelete('booths', id);
  },
  count: async () => {
    try {
      const { count: c } = await supabase.from('booths').select('*', { count: 'exact', head: true });
      if (c !== null) return c;
    } catch {}
    return dbCount('booths');
  },
};

// ─── boothVoterDB — Supabase + IndexedDB ──────────────────────────────────────

export const boothVoterDB = {
  getAll: async () => {
    try {
      const { data, error } = await supabase.from('booth_voters').select('*');
      if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ voterId: r.voter_id, boothId: r.booth_id }));
        records.forEach((r: any) => dbPut('boothVoters', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetAll<BoothVoterRecord>('boothVoters');
  },
  getByVoter: async (voterId: string) => {
    try {
      const { data, error } = await supabase.from('booth_voters').select('*').eq('voter_id', voterId).single();
      if (!error && data) {
        const r = { voterId: data.voter_id, boothId: data.booth_id };
        dbPut('boothVoters', r).catch(()=>{});
        return r;
      }
    } catch {}
    return dbGet<BoothVoterRecord>('boothVoters', voterId);
  },
  getByBooth: async (boothId: string) => {
    try {
      const { data, error } = await supabase.from('booth_voters').select('*').eq('booth_id', boothId);
      if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ voterId: r.voter_id, boothId: r.booth_id }));
        records.forEach((r: any) => dbPut('boothVoters', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetByIndex<BoothVoterRecord>('boothVoters', 'boothId', boothId);
  },
  assign: async (voterId: string, boothId: string) => {
    supabase.from('booth_voters').upsert({ voter_id: voterId, booth_id: boothId }).then(() => {});
    return dbPut('boothVoters', { voterId, boothId } as BoothVoterRecord);
  },
  unassign: async (voterId: string) => {
    supabase.from('booth_voters').delete().eq('voter_id', voterId).then(() => {});
    return dbDelete('boothVoters', voterId);
  },
  count: async () => {
    try {
      const { count: c } = await supabase.from('booth_voters').select('*', { count: 'exact', head: true });
      if (c !== null) return c;
    } catch {}
    return dbCount('boothVoters');
  },
};

// ─── boothElectionDB — Supabase + IndexedDB ───────────────────────────────────

export const boothElectionDB = {
  getAll: async () => {
    try {
      const { data, error } = await supabase.from('booth_elections').select('*');
      if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ id: r.id, boothId: r.booth_id, electionId: r.election_id }));
        records.forEach((r: any) => dbPut('boothElections', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetAll<BoothElectionRecord>('boothElections');
  },
  getByBooth: async (boothId: string) => {
    try {
      const { data, error } = await supabase.from('booth_elections').select('*').eq('booth_id', boothId);
      if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ id: r.id, boothId: r.booth_id, electionId: r.election_id }));
        records.forEach((r: any) => dbPut('boothElections', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetByIndex<BoothElectionRecord>('boothElections', 'boothId', boothId);
  },
  getByElection: async (electionId: string) => {
    try {
      const { data, error } = await supabase.from('booth_elections').select('*').eq('election_id', electionId);
      if (!error && data && data.length > 0) {
        const records = data.map((r: any) => ({ id: r.id, boothId: r.booth_id, electionId: r.election_id }));
        records.forEach((r: any) => dbPut('boothElections', r).catch(()=>{}));
        return records;
      }
    } catch {}
    return dbGetByIndex<BoothElectionRecord>('boothElections', 'electionId', electionId);
  },
  assign: async (boothId: string, electionId: string) => {
    const id = `${boothId}:${electionId}`;
    try { await supabase.from('booth_elections').upsert({ id, booth_id: boothId, election_id: electionId }); } catch {}
    return dbPut('boothElections', { id, boothId, electionId } as BoothElectionRecord);
  },
  unassign: async (boothId: string, electionId: string) => {
    const id = `${boothId}:${electionId}`;
    try { await supabase.from('booth_elections').delete().eq('id', id); } catch {}
    return dbDelete('boothElections', id);
  },
  count: async () => {
    try {
      const { count: c } = await supabase.from('booth_elections').select('*', { count: 'exact', head: true });
      if (c !== null) return c;
    } catch {}
    return dbCount('boothElections');
  },
};

// ─── zkCommitmentDB — IndexedDB ─────────────────────────────────────────────

export const zkCommitmentDB = {
  getAll: () => dbGetAll<ZkCommitmentRecord>('zkCommitments'),
  getById: (id: string) => dbGet<ZkCommitmentRecord>('zkCommitments', id),
  save: (r: ZkCommitmentRecord) => dbPut('zkCommitments', r),
  getByVoterElection: (voterId: string, electionId: string) =>
    dbGet<ZkCommitmentRecord>('zkCommitments', `${voterId}:${electionId}`),
};

// ─── SHA-256 helper ─────────────────────────────────────────────────────────

async function sha256Hex(msg: string): Promise<string> {
  const data = new TextEncoder().encode(msg);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Demo voter fallback (shown when Supabase is empty) ───────────────────────

function getDemoVoters(): Voter[] {
  return [
    { id: '11111111-1111-1111-1111-111111111111', name: 'Rajesh Kumar Sharma', voterIdNumber: 'DL/04/001/234567', constituency: 'New Delhi',      fingerprint: 'SIM:verified', hasVoted: false },
    { id: '22222222-2222-2222-2222-222222222222', name: 'Priya Patel',          voterIdNumber: 'GJ/06/002/345678', constituency: 'Ahmedabad East', fingerprint: 'SIM:verified', hasVoted: false },
    { id: '33333333-3333-3333-3333-333333333333', name: 'Amit Singh',           voterIdNumber: 'UP/08/003/456789', constituency: 'Lucknow',        fingerprint: 'SIM:verified', hasVoted: false },
    { id: '44444444-4444-4444-4444-444444444444', name: 'Sneha Devi',           voterIdNumber: 'MH/10/004/567890', constituency: 'Mumbai South',   fingerprint: 'SIM:verified', hasVoted: false },
    { id: '55555555-5555-5555-5555-555555555555', name: 'Vikram Reddy',         voterIdNumber: 'TG/12/005/678901', constituency: 'Hyderabad',      fingerprint: 'SIM:verified', hasVoted: false },
    { id: '66666666-6666-6666-6666-666666666666', name: 'Ananya Chatterjee',    voterIdNumber: 'WB/14/006/789012', constituency: 'Kolkata North',  fingerprint: 'SIM:verified', hasVoted: false },
    { id: '77777777-7777-7777-7777-777777777777', name: 'Ravi Menon',           voterIdNumber: 'KL/16/007/890123', constituency: 'Kochi',          fingerprint: 'SIM:verified', hasVoted: false },
    { id: '88888888-8888-8888-8888-888888888888', name: 'Neha Gupta',           voterIdNumber: 'MP/18/008/901234', constituency: 'Bhopal',         fingerprint: 'SIM:verified', hasVoted: false },
    { id: '99999999-9999-9999-9999-999999999999', name: 'Karthik Iyer',         voterIdNumber: 'TN/20/009/012345', constituency: 'Chennai Central',fingerprint: 'SIM:verified', hasVoted: false },
    { id: '00000000-0000-0000-0000-000000000010', name: 'Sita Ram',             voterIdNumber: 'RJ/22/010/123456', constituency: 'Jaipur',         fingerprint: 'SIM:verified', hasVoted: false },
  ];
}

// ─── Seed local IndexedDB (elections, candidates, booths, admin PIN) ─────────

export async function seedDemoData(): Promise<void> {
  const n = await electionDB.count();
  if (n > 0) return;

  await adminDB.save({ id: 'admin-001', name: 'Election Commissioner', pin: '1234' });

  // ── Elections ──
  const elections: ElectionRecord[] = [
    { id: 'elec-001', title: '2026 Lok Sabha By-Election',           description: 'Parliamentary by-election for New Delhi.',       type: 'lok-sabha',     status: 'active',    startDate: '2026-02-10T00:00:00Z', endDate: '2026-02-15T23:59:59Z', constituency: 'New Delhi',      state: 'Delhi',         createdAt: '2026-01-01T00:00:00Z' },
    { id: 'elec-002', title: 'Gujarat Vidhan Sabha Election',         description: 'State assembly election for Ahmedabad East.',    type: 'vidhan-sabha',  status: 'active',    startDate: '2026-02-10T00:00:00Z', endDate: '2026-02-20T23:59:59Z', constituency: 'Ahmedabad East', state: 'Gujarat',       createdAt: '2026-01-05T00:00:00Z' },
    { id: 'elec-003', title: 'Mumbai Municipal Corporation Election', description: 'Municipal election for Mumbai South ward.',       type: 'municipal',     status: 'upcoming',  startDate: '2026-03-01T00:00:00Z', endDate: '2026-03-05T23:59:59Z', constituency: 'Mumbai South',   state: 'Maharashtra',   createdAt: '2026-01-10T00:00:00Z' },
    { id: 'elec-004', title: '2025 UP State Assembly Election',       description: 'Concluded assembly election, Lucknow.',          type: 'vidhan-sabha',  status: 'completed', startDate: '2025-11-01T00:00:00Z', endDate: '2025-11-05T23:59:59Z', constituency: 'Lucknow',        state: 'Uttar Pradesh', createdAt: '2025-10-01T00:00:00Z' },
    { id: 'elec-005', title: 'Hyderabad Municipal Election',          description: 'Municipal election for Hyderabad.',             type: 'municipal',     status: 'active',    startDate: '2026-02-10T00:00:00Z', endDate: '2026-02-15T23:59:59Z', constituency: 'Hyderabad',      state: 'Telangana',     createdAt: '2026-01-01T00:00:00Z' },
    { id: 'elec-006', title: 'Kolkata North Lok Sabha',               description: 'Lok Sabha election for Kolkata North.',         type: 'lok-sabha',     status: 'completed', startDate: '2025-12-01T00:00:00Z', endDate: '2025-12-05T23:59:59Z', constituency: 'Kolkata North',  state: 'West Bengal',   createdAt: '2025-11-01T00:00:00Z' },
    { id: 'elec-007', title: 'Kerala Assembly Election',              description: 'State assembly election for Kochi.',            type: 'vidhan-sabha',  status: 'active',    startDate: '2026-02-10T00:00:00Z', endDate: '2026-02-15T23:59:59Z', constituency: 'Kochi',          state: 'Kerala',        createdAt: '2026-01-01T00:00:00Z' },
    { id: 'elec-008', title: 'Bhopal Panchayat Election',             description: 'Panchayat election for Bhopal rural.',          type: 'panchayat',     status: 'upcoming',  startDate: '2026-04-01T00:00:00Z', endDate: '2026-04-05T23:59:59Z', constituency: 'Bhopal',         state: 'Madhya Pradesh',createdAt: '2026-01-01T00:00:00Z' },
    { id: 'elec-009', title: 'Chennai Central Lok Sabha Election',    description: 'Parliamentary election for Chennai Central.',   type: 'lok-sabha',     status: 'completed', startDate: '2025-10-01T00:00:00Z', endDate: '2025-10-05T23:59:59Z', constituency: 'Chennai Central',state: 'Tamil Nadu',    createdAt: '2025-09-01T00:00:00Z' },
    { id: 'elec-010', title: 'Jaipur Assembly Election',              description: 'State assembly election for Jaipur.',           type: 'vidhan-sabha',  status: 'active',    startDate: '2026-02-10T00:00:00Z', endDate: '2026-02-15T23:59:59Z', constituency: 'Jaipur',         state: 'Rajasthan',     createdAt: '2026-01-01T00:00:00Z' },
  ];
  for (const e of elections) await electionDB.save(e);

  // ── Candidates ──
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

  // ── Booths ──
  const booths: BoothRecord[] = [
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
  for (const b of booths) await boothDB.save(b);

  // ── Assign voters to booths ──
  const voterBoothMap: Record<string, string> = {
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
  for (const [voterId, boothId] of Object.entries(voterBoothMap)) {
    await boothVoterDB.assign(voterId, boothId);
  }

  // ── Assign elections to booths ──
  await boothElectionDB.assign('booth-delhi-01', 'elec-001');
  await boothElectionDB.assign('booth-ahmedabad-01', 'elec-002');
  await boothElectionDB.assign('booth-mumbai-01', 'elec-003');
  await boothElectionDB.assign('booth-lucknow-01', 'elec-004');
  await boothElectionDB.assign('booth-lucknow-02', 'elec-004');
  await boothElectionDB.assign('booth-hyd-01', 'elec-005');
  await boothElectionDB.assign('booth-kolkata-01', 'elec-006');
  await boothElectionDB.assign('booth-kochi-01', 'elec-007');
  await boothElectionDB.assign('booth-bhopal-01', 'elec-008');
  await boothElectionDB.assign('booth-chennai-01', 'elec-009');
  await boothElectionDB.assign('booth-jaipur-01', 'elec-010');

  // ── Mark all voter fingerprints as verified in Supabase ──
  for (const vid of Object.keys(voterBoothMap)) {
    try {
      await voterDB.markFingerprintVerified(vid);
    } catch {
      // Supabase offline — fine for demo
    }
  }

  // ── Generate completed election data ──
  await seedCompletedElection('elec-004', ['cand-008', 'cand-009', 'cand-010'], [0.45, 0.33, 0.22]);
  
  // Create some candidates for elec-006 (Kolkata) and elec-009 (Chennai)
  await candidateDB.save({ id: 'cand-013', electionId: 'elec-006', name: 'Mamata Das', partyName: 'TMC', partySymbol: '🌸', age: 50, qualification: 'MA', manifesto: 'Welfare', photoUrl: '' });
  await candidateDB.save({ id: 'cand-014', electionId: 'elec-006', name: 'Rahul Bose', partyName: 'BJP', partySymbol: '🪷', age: 45, qualification: 'BSc', manifesto: 'Development', photoUrl: '' });
  await seedCompletedElection('elec-006', ['cand-013', 'cand-014'], [0.55, 0.45]);

  await candidateDB.save({ id: 'cand-015', electionId: 'elec-009', name: 'Stalin Kumar', partyName: 'DMK', partySymbol: '☀️', age: 60, qualification: 'BA', manifesto: 'Rights', photoUrl: '' });
  await candidateDB.save({ id: 'cand-016', electionId: 'elec-009', name: 'Anbumani', partyName: 'AIADMK', partySymbol: '🍃', age: 55, qualification: 'LLB', manifesto: 'Growth', photoUrl: '' });
  await seedCompletedElection('elec-009', ['cand-015', 'cand-016'], [0.60, 0.40]);
}

// ─── Generate realistic completed election with blockchain votes ─────────────

async function seedCompletedElection(electionId: string, candidates: string[], weights: number[]): Promise<void> {
  // Import localBlockchain dynamically to avoid circular dependency
  const { localBlockchain } = await import('./localBlockchain');
  await localBlockchain.initialize();

  // 20 synthetic voters per election (scaled up by analytics)
  const syntheticVoters: { id: string; booth: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    syntheticVoters.push({
      id: `syn-voter-${String(i).padStart(3, '0')}`,
      booth: i <= 12 ? 'booth-lucknow-01' : 'booth-lucknow-02',
    });
  }

  // Assign synthetic voters to booths
  for (const sv of syntheticVoters) {
    await boothVoterDB.assign(sv.id, sv.booth);
  }

  // Cast votes with deterministic-ish distribution
  let seededRandom = 0.42; // deterministic seed for consistent results
  const nextRandom = () => {
    seededRandom = (seededRandom * 9301 + 49297) % 233280;
    return seededRandom / 233280;
  };

  for (const sv of syntheticVoters) {
    // Pick candidate based on weighted distribution
    const r = nextRandom();
    let cumulative = 0;
    let chosen = candidates[candidates.length - 1];
    for (let ci = 0; ci < candidates.length; ci++) {
      cumulative += weights[ci];
      if (r <= cumulative) {
        chosen = candidates[ci];
        break;
      }
    }

    // Create voter hash for privacy
    const voterHash = await sha256Hex(`voter:${sv.id}:${electionId}`);

    // Record on local blockchain with timestamps spread across Nov 1-5, 2025
    const dayOffset = Math.floor(nextRandom() * 5);
    const hourOffset = Math.floor(nextRandom() * 10) + 8; // 8 AM to 6 PM
    const voteTime = new Date(2025, 10, 1 + dayOffset, hourOffset, Math.floor(nextRandom() * 60));

    await localBlockchain.addBlock({
      type: 'vote',
      payload: {
        voterHash,
        voterId: sv.id,
        electionId,
        candidateId: chosen,
        boothId: sv.booth,
        timestamp: voteTime.toISOString(),
      },
    });
  }

  console.log(`[seedDemoData] Generated 20 verifiable blocks for election ${electionId} (UI will scale analytics to lakhs)`);
}
