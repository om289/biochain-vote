// IndexedDB Service — Offline-first data persistence for BioChain Vote

const DB_NAME = 'biochain-vote';
const DB_VERSION = 2;

export interface Voter {
  id: string;
  name: string;
  aadhaarNumber: string; // 12-digit
  voterIdNumber: string; // e.g. "ABC1234567"
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  constituency: string;
  district: string;
  state: string;
  photoUrl: string;
  fingerprint: string; // simulated fingerprint hash
  did: string;
  registeredAt: string;
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
  partySymbol: string; // emoji or icon identifier
  age: number;
  qualification: string;
  manifesto: string;
  photoUrl: string;
}

export interface VoteRecord {
  id: string;
  electionId: string;
  voterId: string;
  candidateId: string;
  blockHash: string;
  blockIndex: number;
  timestamp: string;
}

export interface AdminRecord {
  id: string;
  name: string;
  pin: string;
}

export interface WebAuthnCredential {
  credentialId: string;  // base64url-encoded credential ID
  voterId: string;
  publicKey: string;     // base64url-encoded public key
  createdAt: string;
}

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('voters')) {
        const voterStore = db.createObjectStore('voters', { keyPath: 'id' });
        voterStore.createIndex('aadhaarNumber', 'aadhaarNumber', { unique: true });
        voterStore.createIndex('voterIdNumber', 'voterIdNumber', { unique: true });
        voterStore.createIndex('fingerprint', 'fingerprint', { unique: false });
        voterStore.createIndex('constituency', 'constituency', { unique: false });
      }

      if (!db.objectStoreNames.contains('elections')) {
        const electionStore = db.createObjectStore('elections', { keyPath: 'id' });
        electionStore.createIndex('status', 'status', { unique: false });
        electionStore.createIndex('constituency', 'constituency', { unique: false });
      }

      if (!db.objectStoreNames.contains('candidates')) {
        const candidateStore = db.createObjectStore('candidates', { keyPath: 'id' });
        candidateStore.createIndex('electionId', 'electionId', { unique: false });
      }

      if (!db.objectStoreNames.contains('votes')) {
        const voteStore = db.createObjectStore('votes', { keyPath: 'id' });
        voteStore.createIndex('electionId', 'electionId', { unique: false });
        voteStore.createIndex('voterId', 'voterId', { unique: false });
        voteStore.createIndex('election_voter', ['electionId', 'voterId'], { unique: true });
      }

      if (!db.objectStoreNames.contains('blocks')) {
        db.createObjectStore('blocks', { keyPath: 'index' });
      }

      if (!db.objectStoreNames.contains('admins')) {
        db.createObjectStore('admins', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('webauthn-credentials')) {
        const credStore = db.createObjectStore('webauthn-credentials', { keyPath: 'credentialId' });
        credStore.createIndex('voterId', 'voterId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

// Generic CRUD helpers
async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getById<T>(storeName: string, id: string | number): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getByIndex<T>(storeName: string, indexName: string, value: IDBValidKey | IDBKeyRange): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put<T>(storeName: string, data: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function remove(storeName: string, id: string | number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function count(storeName: string): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Voter operations
export const voterDB = {
  getAll: () => getAll<Voter>('voters'),
  getById: (id: string) => getById<Voter>('voters', id),
  getByAadhaar: async (aadhaar: string): Promise<Voter | undefined> => {
    const results = await getByIndex<Voter>('voters', 'aadhaarNumber', aadhaar);
    return results[0];
  },
  getByVoterId: async (voterId: string): Promise<Voter | undefined> => {
    const results = await getByIndex<Voter>('voters', 'voterIdNumber', voterId);
    return results[0];
  },
  getByFingerprint: async (fp: string): Promise<Voter | undefined> => {
    const results = await getByIndex<Voter>('voters', 'fingerprint', fp);
    return results[0];
  },
  getByConstituency: (constituency: string) => getByIndex<Voter>('voters', 'constituency', constituency),
  save: (voter: Voter) => put('voters', voter),
  delete: (id: string) => remove('voters', id),
  count: () => count('voters'),
};

// Election operations
export const electionDB = {
  getAll: () => getAll<ElectionRecord>('elections'),
  getById: (id: string) => getById<ElectionRecord>('elections', id),
  getByStatus: (status: string) => getByIndex<ElectionRecord>('elections', 'status', status),
  getByConstituency: (constituency: string) => getByIndex<ElectionRecord>('elections', 'constituency', constituency),
  save: (election: ElectionRecord) => put('elections', election),
  delete: (id: string) => remove('elections', id),
  count: () => count('elections'),
};

// Candidate operations
export const candidateDB = {
  getAll: () => getAll<CandidateRecord>('candidates'),
  getById: (id: string) => getById<CandidateRecord>('candidates', id),
  getByElection: (electionId: string) => getByIndex<CandidateRecord>('candidates', 'electionId', electionId),
  save: (candidate: CandidateRecord) => put('candidates', candidate),
  delete: (id: string) => remove('candidates', id),
  count: () => count('candidates'),
};

// Vote operations
export const voteDB = {
  getAll: () => getAll<VoteRecord>('votes'),
  getById: (id: string) => getById<VoteRecord>('votes', id),
  getByElection: (electionId: string) => getByIndex<VoteRecord>('votes', 'electionId', electionId),
  getByVoter: (voterId: string) => getByIndex<VoteRecord>('votes', 'voterId', voterId),
  hasVoted: async (electionId: string, voterId: string): Promise<boolean> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('votes', 'readonly');
      const store = tx.objectStore('votes');
      const index = store.index('election_voter');
      const request = index.get([electionId, voterId]);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  },
  save: (vote: VoteRecord) => put('votes', vote),
  count: () => count('votes'),
  countByElection: async (electionId: string): Promise<number> => {
    const votes = await getByIndex<VoteRecord>('votes', 'electionId', electionId);
    return votes.length;
  },
};

// Block operations (for blockchain)
export const blockDB = {
  getAll: () => getAll<any>('blocks'),
  getByIndex: (index: number) => getById<any>('blocks', index),
  save: (block: any) => put('blocks', block),
  count: () => count('blocks'),
  getLast: async (): Promise<any | undefined> => {
    const blocks = await getAll<any>('blocks');
    if (blocks.length === 0) return undefined;
    return blocks.sort((a, b) => b.index - a.index)[0];
  },
};

// Admin operations
export const adminDB = {
  getAll: () => getAll<AdminRecord>('admins'),
  getById: (id: string) => getById<AdminRecord>('admins', id),
  save: (admin: AdminRecord) => put('admins', admin),
  verifyPin: async (pin: string): Promise<boolean> => {
    const admins = await getAll<AdminRecord>('admins');
    return admins.some(a => a.pin === pin);
  },
};

// WebAuthn credential operations
export const credentialDB = {
  save: (cred: WebAuthnCredential) => put('webauthn-credentials', cred),
  getByCredentialId: (credentialId: string) => getById<WebAuthnCredential>('webauthn-credentials', credentialId),
  getByVoterId: async (voterId: string): Promise<WebAuthnCredential[]> => {
    return getByIndex<WebAuthnCredential>('webauthn-credentials', 'voterId', voterId);
  },
  delete: (credentialId: string) => remove('webauthn-credentials', credentialId),
  getAll: () => getAll<WebAuthnCredential>('webauthn-credentials'),
};

// Seed demo data
export async function seedDemoData(): Promise<void> {
  const voterCount = await voterDB.count();
  if (voterCount > 0) return; // Already seeded

  // Default admin
  await adminDB.save({
    id: 'admin-001',
    name: 'Election Commissioner',
    pin: 'admin123',
  });

  // Demo voters
  const voters: Voter[] = [
    {
      id: 'voter-001',
      name: 'Rajesh Kumar Sharma',
      aadhaarNumber: '234567890123',
      voterIdNumber: 'DL/04/001/234567',
      dateOfBirth: '1990-05-15',
      gender: 'male',
      constituency: 'New Delhi',
      district: 'Central Delhi',
      state: 'Delhi',
      photoUrl: '',
      fingerprint: 'fp-rajesh-001',
      did: 'did:biochain:rajesh001',
      registeredAt: '2025-01-10T00:00:00Z',
    },
    {
      id: 'voter-002',
      name: 'Priya Patel',
      aadhaarNumber: '345678901234',
      voterIdNumber: 'GJ/06/002/345678',
      dateOfBirth: '1988-11-22',
      gender: 'female',
      constituency: 'Ahmedabad East',
      district: 'Ahmedabad',
      state: 'Gujarat',
      photoUrl: '',
      fingerprint: 'fp-priya-002',
      did: 'did:biochain:priya002',
      registeredAt: '2025-01-12T00:00:00Z',
    },
    {
      id: 'voter-003',
      name: 'Amit Singh',
      aadhaarNumber: '456789012345',
      voterIdNumber: 'UP/08/003/456789',
      dateOfBirth: '1995-03-08',
      gender: 'male',
      constituency: 'Lucknow',
      district: 'Lucknow',
      state: 'Uttar Pradesh',
      photoUrl: '',
      fingerprint: 'fp-amit-003',
      did: 'did:biochain:amit003',
      registeredAt: '2025-01-15T00:00:00Z',
    },
    {
      id: 'voter-004',
      name: 'Sneha Devi',
      aadhaarNumber: '567890123456',
      voterIdNumber: 'MH/10/004/567890',
      dateOfBirth: '1992-07-19',
      gender: 'female',
      constituency: 'Mumbai South',
      district: 'Mumbai',
      state: 'Maharashtra',
      photoUrl: '',
      fingerprint: 'fp-sneha-004',
      did: 'did:biochain:sneha004',
      registeredAt: '2025-01-18T00:00:00Z',
    },
    {
      id: 'voter-005',
      name: 'Vikram Reddy',
      aadhaarNumber: '678901234567',
      voterIdNumber: 'TG/12/005/678901',
      dateOfBirth: '1985-12-03',
      gender: 'male',
      constituency: 'Hyderabad',
      district: 'Hyderabad',
      state: 'Telangana',
      photoUrl: '',
      fingerprint: 'fp-vikram-005',
      did: 'did:biochain:vikram005',
      registeredAt: '2025-01-20T00:00:00Z',
    },
  ];

  for (const v of voters) {
    await voterDB.save(v);
  }

  // Demo elections
  const elections: ElectionRecord[] = [
    {
      id: 'elec-001',
      title: '2026 Lok Sabha By-Election',
      description: 'Parliamentary by-election for New Delhi constituency.',
      type: 'lok-sabha',
      status: 'active',
      startDate: '2026-02-10T00:00:00Z',
      endDate: '2026-02-15T23:59:59Z',
      constituency: 'New Delhi',
      state: 'Delhi',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'elec-002',
      title: 'Gujarat Vidhan Sabha Election',
      description: 'State assembly election for Ahmedabad East constituency.',
      type: 'vidhan-sabha',
      status: 'active',
      startDate: '2026-02-10T00:00:00Z',
      endDate: '2026-02-20T23:59:59Z',
      constituency: 'Ahmedabad East',
      state: 'Gujarat',
      createdAt: '2026-01-05T00:00:00Z',
    },
    {
      id: 'elec-003',
      title: 'Mumbai Municipal Corporation Election',
      description: 'Municipal corporation election for Mumbai South ward.',
      type: 'municipal',
      status: 'upcoming',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-05T23:59:59Z',
      constituency: 'Mumbai South',
      state: 'Maharashtra',
      createdAt: '2026-01-10T00:00:00Z',
    },
    {
      id: 'elec-004',
      title: '2025 UP State Assembly Election',
      description: 'State assembly election for Lucknow constituency — concluded.',
      type: 'vidhan-sabha',
      status: 'completed',
      startDate: '2025-11-01T00:00:00Z',
      endDate: '2025-11-05T23:59:59Z',
      constituency: 'Lucknow',
      state: 'Uttar Pradesh',
      createdAt: '2025-10-01T00:00:00Z',
    },
  ];

  for (const e of elections) {
    await electionDB.save(e);
  }

  // Demo candidates
  const candidates: CandidateRecord[] = [
    // Lok Sabha — New Delhi
    { id: 'cand-001', electionId: 'elec-001', name: 'Akhilesh Yadav', partyName: 'Bharatiya Janata Party', partySymbol: '🪷', age: 52, qualification: 'MBA', manifesto: 'Digital India, Smart Cities, Defence modernization', photoUrl: '' },
    { id: 'cand-002', electionId: 'elec-001', name: 'Meera Banerjee', partyName: 'Indian National Congress', partySymbol: '✋', age: 45, qualification: 'LLB', manifesto: 'Employment guarantee, farmer welfare, education reform', photoUrl: '' },
    { id: 'cand-003', electionId: 'elec-001', name: 'Arvind Gupta', partyName: 'Aam Aadmi Party', partySymbol: '🧹', age: 48, qualification: 'B.Tech', manifesto: 'Free electricity, water, healthcare, education', photoUrl: '' },
    { id: 'cand-004', electionId: 'elec-001', name: 'Sunita Devi', partyName: 'Independent', partySymbol: '⭐', age: 39, qualification: 'MA', manifesto: 'Anti-corruption, women safety, transparent governance', photoUrl: '' },

    // Gujarat Vidhan Sabha
    { id: 'cand-005', electionId: 'elec-002', name: 'Hardik Shah', partyName: 'Bharatiya Janata Party', partySymbol: '🪷', age: 44, qualification: 'B.Com', manifesto: 'Industrial growth, infra development, Vibrant Gujarat', photoUrl: '' },
    { id: 'cand-006', electionId: 'elec-002', name: 'Rashida Khan', partyName: 'Indian National Congress', partySymbol: '✋', age: 50, qualification: 'MBBS', manifesto: 'Public healthcare, minority rights, farmer loans', photoUrl: '' },
    { id: 'cand-007', electionId: 'elec-002', name: 'Jayesh Patel', partyName: 'Aam Aadmi Party', partySymbol: '🧹', age: 36, qualification: 'MBA', manifesto: 'Clean governance, free electricity, jobs for youth', photoUrl: '' },

    // UP Completed election
    { id: 'cand-008', electionId: 'elec-004', name: 'Ramesh Mishra', partyName: 'Bharatiya Janata Party', partySymbol: '🪷', age: 55, qualification: 'LLB', manifesto: 'Law and order, development, tourism', photoUrl: '' },
    { id: 'cand-009', electionId: 'elec-004', name: 'Neha Tiwari', partyName: 'Samajwadi Party', partySymbol: '🚲', age: 42, qualification: 'MA', manifesto: 'Social justice, OBC rights, employment', photoUrl: '' },
    { id: 'cand-010', electionId: 'elec-004', name: 'Deepak Verma', partyName: 'Bahujan Samaj Party', partySymbol: '🐘', age: 47, qualification: 'B.Ed', manifesto: 'Dalit rights, reservation, rural development', photoUrl: '' },

    // Mumbai Municipal upcoming
    { id: 'cand-011', electionId: 'elec-003', name: 'Arun Deshmukh', partyName: 'Shiv Sena', partySymbol: '🏹', age: 51, qualification: 'B.Sc', manifesto: 'Mumbai infra, Marathi rights, clean city', photoUrl: '' },
    { id: 'cand-012', electionId: 'elec-003', name: 'Fatima Shaikh', partyName: 'Indian National Congress', partySymbol: '✋', age: 38, qualification: 'MBA', manifesto: 'Affordable housing, public transport, women safety', photoUrl: '' },
  ];

  for (const c of candidates) {
    await candidateDB.save(c);
  }

  // Seed some votes for the completed election (elec-004)
  // These will also be added to the blockchain by the caller
}

export { openDB };
