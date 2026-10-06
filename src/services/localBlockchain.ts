/**
 * localBlockchain.ts — BioChain Distributed Ledger
 *
 * ARCHITECTURE
 * ────────────
 *
 *   MASTER CHAIN  (IndexedDB store: "blocks")
 *   ─────────────────────────────────────────
 *   Contains only structural blocks:
 *     • genesis
 *     • election_created
 *     • election_completed
 *     • booth_fork  — written when a booth is activated
 *     • merge       — written when results are published (contains
 *                     the Merkle root of every booth sub-chain)
 *
 *   BOOTH SUB-CHAINS  (IndexedDB store: "booth_chains", keyPath: "chainKey")
 *   ─────────────────────────────────────────────────────────────────────────
 *   One independent chain per booth.  chainKey = `${boothId}:${index}`.
 *   Contains:
 *     • fork_genesis  — first block, previousHash = master chain tip at fork time
 *     • vote          — one block per vote cast at that booth
 *
 *   MERGE FLOW (admin "Publish Results")
 *   ────────────────────────────────────
 *   1. For each booth that participated in the election:
 *      a. Verify the booth sub-chain integrity
 *      b. Compute the Merkle root of all vote blocks in that booth chain
 *   2. Write a MERGE block to the master chain:
 *      { type: 'merge', payload: { electionId, booths: [{ boothId, merkleRoot, voteCount, valid }], masterMerkleRoot } }
 *   3. Upload merge block + vote tallies to Supabase
 *
 * This ensures:
 *   • Booths can operate 100% offline and independently
 *   • The master chain is a tamper-proof audit log of every merge
 *   • Any third party can re-verify results by rebuilding Merkle roots
 *     from the raw booth sub-chain blocks
 */

import { blockDB } from './dbService';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BlockType =
  | 'genesis'
  | 'vote'
  | 'election_created'
  | 'election_completed'
  | 'booth_fork'
  | 'merge';

export interface Block {
  index: number;
  timestamp: string;
  data: {
    type: BlockType;
    payload: Record<string, any>;
  };
  previousHash: string;
  hash: string;
  nonce: number;
}

/** A block in a booth sub-chain */
export interface BoothBlock extends Block {
  /** Composite key stored in IDB: `${boothId}:${electionId}:${index}` */
  chainKey: string;
  boothId: string;
  electionId: string;
}

export interface MerkleProofStep {
  hash: string;
  position: 'left' | 'right';
}

export interface BoothChainSummary {
  boothId: string;
  electionId: string;
  blockCount: number;
  voteCount: number;
  merkleRoot: string;
  isValid: boolean;
  /** Hash of the last block — used as previousHash for the merge block */
  tipHash: string;
}

// ─── SHA-256 (Web Crypto API) ─────────────────────────────────────────────────

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function deterministicStringify(obj: any): string {
  if (typeof obj !== 'object' || obj === null) return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(deterministicStringify).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => `"${k}":${deterministicStringify(obj[k])}`).join(',')}}`;
}

async function calculateHash(block: Omit<Block, 'hash'>): Promise<string> {
  const str = `${block.index}${block.timestamp}${deterministicStringify(block.data)}${block.previousHash}${block.nonce}`;
  return sha256(str);
}

// ─── Merkle Tree ──────────────────────────────────────────────────────────────

async function buildMerkleTree(leafHashes: string[]): Promise<string[][]> {
  if (leafHashes.length === 0) return [['0'.repeat(64)]];
  let level = [...leafHashes];
  const tree: string[][] = [level];
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(await sha256(left + right));
    }
    tree.push(next);
    level = next;
  }
  return tree;
}

function getMerkleRoot(tree: string[][]): string {
  if (!tree.length) return '0'.repeat(64);
  return tree[tree.length - 1][0] || '0'.repeat(64);
}

function getMerkleProof(tree: string[][], leafIndex: number): MerkleProofStep[] {
  const proof: MerkleProofStep[] = [];
  let idx = leafIndex;
  for (let level = 0; level < tree.length - 1; level++) {
    const isRight = idx % 2 === 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    if (sibIdx < tree[level].length) {
      proof.push({ hash: tree[level][sibIdx], position: isRight ? 'left' : 'right' });
    }
    idx = Math.floor(idx / 2);
  }
  return proof;
}

async function verifyMerkleProof(leafHash: string, proof: MerkleProofStep[], expectedRoot: string): Promise<boolean> {
  let cur = leafHash;
  for (const step of proof) {
    cur = step.position === 'right' ? await sha256(cur + step.hash) : await sha256(step.hash + cur);
  }
  return cur === expectedRoot;
}

// ─── IndexedDB helpers for booth_chains store ─────────────────────────────────

async function _openDB(): Promise<IDBDatabase> {
  // Re-use the same DB opened by dbService — MUST match DB_VERSION in dbService.ts
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('biochain-vote', 8);
    req.onupgradeneeded = () => {
      // upgrade handled by dbService; if we get here, just resolve — stores will exist
    };
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function _boothGetAll(boothId: string, electionId?: string): Promise<BoothBlock[]> {
  const db = await _openDB();
  const all: BoothBlock[] = await new Promise((res, rej) => {
    const tx = db.transaction('booth_chains', 'readonly');
    const idx = tx.objectStore('booth_chains').index('boothId');
    const r = idx.getAll(boothId);
    r.onsuccess = () => res((r.result as BoothBlock[]).sort((a, b) => a.index - b.index));
    r.onerror = () => rej(r.error);
  });
  if (electionId) return all.filter(b => b.electionId === electionId);
  return all;
}

async function _boothGet(boothId: string, electionId: string, index: number): Promise<BoothBlock | undefined> {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('booth_chains', 'readonly');
    const r = tx.objectStore('booth_chains').get(`${boothId}:${electionId}:${index}`);
    r.onsuccess = () => res(r.result as BoothBlock | undefined);
    r.onerror = () => rej(r.error);
  });
}

async function _boothPut(block: BoothBlock): Promise<void> {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('booth_chains', 'readwrite');
    tx.objectStore('booth_chains').put(block);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function _boothCount(boothId: string): Promise<number> {
  const blocks = await _boothGetAll(boothId);
  return blocks.length;
}

// ─── Election master chain helpers ────────────────────────────────────────────
// Election master blocks live in booth_chains store with boothId = 'master'
// chainKey format: `master:${electionId}:${index}`

async function _electionGetAll(electionId: string): Promise<BoothBlock[]> {
  return _boothGetAll('master', electionId);
}

async function _electionGet(electionId: string, index: number): Promise<BoothBlock | undefined> {
  return _boothGet('master', electionId, index);
}

async function _electionPut(block: BoothBlock): Promise<void> {
  return _boothPut(block);
}

async function _electionGetLatest(electionId: string): Promise<BoothBlock | undefined> {
  const all = await _electionGetAll(electionId);
  return all.length > 0 ? all[all.length - 1] : undefined;
}

// ─── Master chain helpers ──────────────────────────────────────────────────────

async function _masterGetAll(): Promise<Block[]> {
  const blocks = await blockDB.getAll() as Block[];
  return blocks.sort((a, b) => a.index - b.index);
}

async function _masterGetLatest(): Promise<Block | undefined> {
  const result = await blockDB.getLast() as Promise<Block | undefined>;
  if (result) {
    console.log(`[_masterGetLatest] Found latest block #${result.index} hash=${result.hash.slice(0,16)}...`);
  } else {
    console.log(`[_masterGetLatest] No latest block found (empty chain)`);
  }
  return result;
}

async function _masterSave(block: Block): Promise<void> {
  console.log(`[_masterSave] Saving block #${block.index} to IndexedDB: hash=${block.hash.slice(0,16)}... type=${block.data.type}`);
  await blockDB.save(block);
  console.log(`[_masterSave] Block #${block.index} saved successfully`);
}

async function _masterCreateGenesis(): Promise<Block> {
  console.log('[_masterCreateGenesis] CALLED - Creating new genesis block');
  console.trace('[_masterCreateGenesis] Call stack:');
  
  const block: Omit<Block, 'hash'> = {
    index: 0,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    data: {
      type: 'genesis',
      payload: {
        message: 'BioChain Vote — Genesis Block — Distributed Polling Architecture',
        version: '2.0.0',
        architecture: 'booth-fork-merge',
      },
    },
    previousHash: '0'.repeat(64),
    nonce: 0,
  };
  const hash = await calculateHash(block);
  const genesis: Block = { ...block, hash };
  console.log(`[_masterCreateGenesis] Genesis created with hash: ${hash}`);
  await _masterSave(genesis);
  console.log(`[_masterCreateGenesis] Genesis saved to IndexedDB`);
  return genesis;
}

// ─── Initialization lock ───────────────────────────────────────────────────────

let _initializationInProgress = false;
let _initializationPromise: Promise<void> | null = null;

// ─── Main Service ─────────────────────────────────────────────────────────────

export const localBlockchain = {

  // ── Initialisation ──────────────────────────────────────────────────────────

  /** Create master genesis block if the chain is empty */
  async initialize(): Promise<void> {
    // Prevent concurrent initialization
    if (_initializationInProgress) {
      if (_initializationPromise) return _initializationPromise;
      return;
    }

    _initializationInProgress = true;
    _initializationPromise = (async () => {
      try {
        const count = await blockDB.count();
        if (count === 0) {
          console.log('[localBlockchain] Empty chain - creating genesis');
          await _masterCreateGenesis();
          return;
        }

        // Verify chain integrity on startup
        const verification = await this.verifyChain();
        if (!verification.valid) {
          console.error(`[localBlockchain] CORRUPTED CHAIN DETECTED on startup - attempting auto-repair`);
          console.error(`[localBlockchain] Error: ${verification.error}`);
          
          // Auto-repair: delete all blocks and rebuild from genesis
          try {
            console.warn('[localBlockchain] Clearing corrupted blocks...');
            const db = await _openDB();
            
            // First, manually delete all blocks
            const allBlocks = await new Promise<Block[]>((resolve) => {
              const tx = db.transaction('blocks', 'readonly');
              const req = tx.objectStore('blocks').getAll();
              req.onsuccess = () => resolve(req.result as Block[]);
            });
            console.log(`[localBlockchain] Found ${allBlocks.length} blocks to delete`);
            
            // Delete each block individually
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction('blocks', 'readwrite');
              const store = tx.objectStore('blocks');
              allBlocks.forEach(b => store.delete(b.index));
              tx.oncomplete = () => {
                console.log('[localBlockchain] All blocks deleted');
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            });
            
            // Also clear booth chains
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction('booth_chains', 'readwrite');
              tx.objectStore('booth_chains').clear();
              tx.oncomplete = () => {
                console.log('[localBlockchain] Booth chains cleared');
                resolve();
              };
              tx.onerror = () => reject(tx.error);
            });
            
            // Wait a moment for IndexedDB to settle
            await new Promise(r => setTimeout(r, 100));
            
            // Verify everything is gone
            const remaining = await blockDB.count();
            console.log(`[localBlockchain] Blocks remaining after clear: ${remaining}`);
            
            if (remaining > 0) {
              console.error(`[localBlockchain] WARNING: ${remaining} blocks still exist after clear!`);
            }
            
            // Recreate genesis
            await _masterCreateGenesis();
            console.log('[localBlockchain] Chain repaired successfully - genesis recreated');
          } catch (e) {
            console.error('[localBlockchain] Auto-repair failed:', e);
            throw e;
          }
        } else {
          console.log('[localBlockchain] Chain integrity verified OK');
        }
      } finally {
        _initializationInProgress = false;
        _initializationPromise = null;
      }
    })();

    return _initializationPromise;
  },

  // ── Master chain reads ───────────────────────────────────────────────────────

  async getChain(electionId?: string): Promise<Block[] | BoothBlock[]> {
    if (electionId) return _electionGetAll(electionId);
    return _masterGetAll();
  },

  async getLatestBlock(): Promise<Block> {
    const last = await _masterGetLatest();
    if (!last) {
      console.warn('[getLatestBlock] No latest block found - creating genesis');
      return _masterCreateGenesis();
    }
    console.log(`[getLatestBlock] Latest block #${last.index} hash: ${last.hash.slice(0, 16)}...`);
    return last;
  },

  async getBlockByHash(hash: string): Promise<Block | BoothBlock | undefined> {
    const master = await _masterGetAll();
    const found = master.find(b => b.hash === hash);
    if (found) return found;
    // Also search all booth chains
    const db = await _openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('booth_chains', 'readonly');
      const r = tx.objectStore('booth_chains').getAll();
      r.onsuccess = () => {
        const booth = (r.result as BoothBlock[]).find(b => b.hash === hash);
        res(booth);
      };
      r.onerror = () => rej(r.error);
    });
  },

  async getBlockByIndex(index: number): Promise<Block | undefined> {
    return blockDB.getByIndex(index) as Promise<Block | undefined>;
  },

  async getBlockCount(electionId?: string): Promise<number> {
    if (electionId) {
      const chain = await _electionGetAll(electionId);
      return chain.length;
    }
    return blockDB.count();
  },

  // ── Master chain writes ──────────────────────────────────────────────────────

  /** Append any block to the master chain */
  async addBlock(data: Block['data']): Promise<Block> {
    // Wait for initialization to complete
    if (_initializationInProgress && _initializationPromise) {
      await _initializationPromise;
    }

    // Check for duplicate election_created in global audit chain
    if (data.type === 'election_created' && data.payload?.electionId) {
      const chain = await _masterGetAll();
      const exists = chain.find(
        b => b.data.type === 'election_created' && 
             b.data.payload?.electionId === data.payload.electionId
      );
      if (exists) {
        console.warn(`[localBlockchain] addBlock skipped duplicate election_created for ${data.payload.electionId} at block #${exists.index}`);
        return exists;
      }
    }

    const prev = await this.getLatestBlock();
    console.log(`[addBlock] Building new block #${prev.index + 1} on top of block #${prev.index} (hash: ${prev.hash.slice(0, 16)}...)`);
    
    const b: Omit<Block, 'hash'> = {
      index: prev.index + 1,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data,
      previousHash: prev.hash,
      nonce: Math.floor(Math.random() * 1_000_000),
    };
    const hash = await calculateHash(b);
    const block: Block = { ...b, hash };
    
    console.log(`[addBlock] New block #${block.index} created: hash=${hash.slice(0, 16)}... prevHash=${block.previousHash.slice(0, 16)}... type=${data.type}`);
    
    await _masterSave(block);
    console.log(`[addBlock] Block #${block.index} saved to IndexedDB`);
    return block;
  },

  async recordElectionEvent(
    type: 'election_created' | 'election_completed',
    payload: Record<string, any>
  ): Promise<Block> {
    // Auto-create per-election master chain when a new election is born
    if (type === 'election_created' && payload.electionId) {
      // Check whether the election chain already exists BEFORE creating it.
      // If it does, the global audit chain already has an election_created block for
      // this election — skip addBlock to prevent duplicate audit entries.
      const existingChain = await _electionGetAll(payload.electionId);
      const alreadyRecorded = existingChain.length > 0;

      if (!alreadyRecorded) {
        try {
          await this.createElectionChain(
            payload.electionId,
            payload.title || payload.electionId
          );
        } catch (e) {
          console.warn('[localBlockchain] createElectionChain failed (non-fatal):', e);
        }
        // Only write to global audit chain the first time
        return this.addBlock({ type, payload });
      }

      // Election chain already exists — skip the duplicate global audit write
      console.info(`[localBlockchain] recordElectionEvent skipped duplicate election_created for ${payload.electionId}`);
      // Return a synthetic block-like object so callers do not break
      const existingTip = existingChain[existingChain.length - 1];
      return {
        index: existingTip.index,
        timestamp: existingTip.timestamp,
        data: { type, payload },
        previousHash: existingTip.previousHash,
        hash: existingTip.hash,
        nonce: existingTip.nonce,
      } as Block;
    }
    return this.addBlock({ type, payload });
  },

  // ── Election master chain ─────────────────────────────────────────────────────

  /**
   * Create genesis block for an election's master chain.
   * Idempotent: if the chain already has a genesis block, returns the existing one.
   * chainKey format: `master:${electionId}:0`
   */
  async createElectionChain(electionId: string, electionTitle: string): Promise<BoothBlock> {
    const existing = await _electionGetAll(electionId);
    if (existing.length > 0) return existing[0];

    const genesisData: Omit<BoothBlock, 'hash'> = {
      index: 0,
      chainKey: `master:${electionId}:0`,
      boothId: 'master',
      electionId,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data: {
        type: 'genesis',
        payload: {
          message: 'Election master chain genesis',
          electionId,
          title: electionTitle,
          createdAt: new Date().toISOString(),
        },
      },
      previousHash: '0'.repeat(64),
      nonce: 0,
    };
    const hash = await calculateHash(genesisData);
    const genesis: BoothBlock = { ...genesisData, hash };
    await _electionPut(genesis);
    console.info(`[localBlockchain] Election master chain created for ${electionId}`);
    return genesis;
  },

  /** Return all blocks in an election's master chain (sorted ascending). */
  async getElectionChain(electionId: string): Promise<BoothBlock[]> {
    return _electionGetAll(electionId);
  },

  /** Return last block of an election's master chain, or undefined if it doesn't exist yet. */
  async getElectionMasterTip(electionId: string): Promise<BoothBlock | undefined> {
    return _electionGetLatest(electionId);
  },

  /** Append a block to an election's master chain. Auto-creates genesis if missing. */
  async addElectionBlock(electionId: string, data: Block['data']): Promise<BoothBlock> {
    let tip = await _electionGetLatest(electionId);
    if (!tip) {
      await this.createElectionChain(electionId, `Election ${electionId}`);
      tip = await _electionGetLatest(electionId);
    }
    const prev = tip!;
    const blockData: Omit<BoothBlock, 'hash'> = {
      index: prev.index + 1,
      chainKey: `master:${electionId}:${prev.index + 1}`,
      boothId: 'master',
      electionId,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data,
      previousHash: prev.hash,
      nonce: Math.floor(Math.random() * 1_000_000),
    };
    const hash = await calculateHash(blockData);
    const block: BoothBlock = { ...blockData, hash };
    await _electionPut(block);
    return block;
  },

  // ── Booth sub-chain — FORK ───────────────────────────────────────────────────

  /**
   * Fork the master chain for a booth/election pair.
   * - Writes a `booth_fork` block to the MASTER chain (audit trail)
   * - Writes a `fork_genesis` block to the BOOTH sub-chain
   *
   * Idempotent: if the booth already has a fork_genesis for this election,
   * does nothing and returns the existing fork block.
   */
  async forkForBooth(boothId: string, electionId: string): Promise<BoothBlock> {
    // Check if already forked for this specific election
    const existing = await _boothGetAll(boothId, electionId);
    const alreadyForked = existing.find(
      b => b.data.type === 'booth_fork' || (b.data as any).type === 'fork_genesis'
    );
    if (alreadyForked) return alreadyForked;

    // Capture election master chain tip (create chain if it doesn't exist yet)
    let masterTip: Block | BoothBlock;
    const electionTip = await this.getElectionMasterTip(electionId);
    if (electionTip) {
      masterTip = electionTip;
    } else {
      // Election chain not yet created — auto-create it now with electionId as placeholder title
      // (will be overwritten when recordElectionEvent fires with the real title)
      masterTip = await this.createElectionChain(electionId, `Election ${electionId}`);
    }

    // 1. Write booth_fork record on master chain (audit trail)
    await this.addBlock({
      type: 'booth_fork',
      payload: {
        boothId,
        electionId,
        electionMasterTipHash: masterTip.hash,
        electionMasterTipIndex: masterTip.index,
        forkedAt: new Date().toISOString(),
      },
    });

    // 2. Write fork_genesis to booth sub-chain — keyed by boothId + electionId
    const forkBlock: Omit<BoothBlock, 'hash'> = {
      index: 0,
      chainKey: `${boothId}:${electionId}:0`,
      boothId,
      electionId,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data: {
        type: 'booth_fork' as BlockType,
        payload: {
          boothId,
          electionId,
          electionMasterTipHash: masterTip.hash,
          electionMasterTipIndex: masterTip.index,
          message: `Booth ${boothId} forked from election ${electionId} master chain at block #${masterTip.index}`,
        },
      },
      previousHash: masterTip.hash,
      nonce: 0,
    };
    const hash = await calculateHash(forkBlock);
    const genesis: BoothBlock = { ...forkBlock, hash };
    await _boothPut(genesis);
    return genesis;
  },

  // ── Booth sub-chain — VOTE ───────────────────────────────────────────────────

  /**
   * Record a vote on the booth's sub-chain.
   * Auto-forks if the booth has not been forked yet.
   */
  async recordVote(voteData: {
    voterId: string;
    electionId: string;
    candidateId: string;
    voterHash: string;
    boothId?: string;
  }): Promise<BoothBlock> {
    const boothId = voteData.boothId || 'master';
    const { electionId } = voteData;

    // Auto-fork if this booth hasn't been forked for this election yet
    const existing = await _boothGetAll(boothId, electionId);
    if (existing.length === 0) {
      await this.forkForBooth(boothId, electionId);
    }

    // Get latest block on this booth+election chain
    const boothBlocks = await _boothGetAll(boothId, electionId);
    const prev = boothBlocks[boothBlocks.length - 1];

    const b: Omit<BoothBlock, 'hash'> = {
      index: prev.index + 1,
      chainKey: `${boothId}:${electionId}:${prev.index + 1}`,
      boothId,
      electionId,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data: {
        type: 'vote',
        payload: {
          voterHash: voteData.voterHash,
          electionId,
          candidateId: voteData.candidateId,
          boothId,
          timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        },
      },
      previousHash: prev.hash,
      nonce: Math.floor(Math.random() * 1_000_000),
    };

    const hash = await calculateHash(b);
    const block: BoothBlock = { ...b, hash };
    await _boothPut(block);
    return block;
  },

  // ── Booth sub-chain — reads ───────────────────────────────────────────────────

  /** Get full booth sub-chain for a specific election */
  async getBoothChain(boothId: string, electionId?: string): Promise<BoothBlock[]> {
    return _boothGetAll(boothId, electionId);
  },

  /** Get all vote blocks across ALL booth chains for an election */
  async getVoteBlocksByElection(electionId: string): Promise<BoothBlock[]> {
    const db = await _openDB();
    const all: BoothBlock[] = await new Promise((res, rej) => {
      const tx = db.transaction('booth_chains', 'readonly');
      const r = tx.objectStore('booth_chains').getAll();
      r.onsuccess = () => res(r.result as BoothBlock[]);
      r.onerror = () => rej(r.error);
    });
    return all
      .filter(b => b.data.type === 'vote' && b.data.payload.electionId === electionId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  },

  /** Get all vote blocks across ALL booth chains */
  async getVoteBlocks(): Promise<BoothBlock[]> {
    const db = await _openDB();
    const all: BoothBlock[] = await new Promise((res, rej) => {
      const tx = db.transaction('booth_chains', 'readonly');
      const r = tx.objectStore('booth_chains').getAll();
      r.onsuccess = () => res(r.result as BoothBlock[]);
      r.onerror = () => rej(r.error);
    });
    return all.filter(b => b.data.type === 'vote');
  },

  async hasVoterVoted(voterId: string, electionId: string): Promise<boolean> {
    const voterHash = await sha256(`voter:${voterId}:${electionId}`);
    const blocks = await this.getVoteBlocksByElection(electionId);
    return blocks.some(b => b.data.payload.voterHash === voterHash);
  },

  async getVotersByElection(electionId: string): Promise<string[]> {
    const blocks = await this.getVoteBlocksByElection(electionId);
    return Array.from(new Set(blocks.map(b => String(b.data.payload.voterHash))));
  },

  // ── Booth sub-chain — verification ───────────────────────────────────────────

  /** Verify integrity of a single booth sub-chain for a specific election */
  async verifyBoothChain(boothId: string, electionId?: string): Promise<{ valid: boolean; blockCount: number; error?: string }> {
    const chain = await _boothGetAll(boothId, electionId);
    if (chain.length === 0) return { valid: true, blockCount: 0 };

    for (let i = 0; i < chain.length; i++) {
      const cur = chain[i];

      // Verify hash
      const recalc = await calculateHash({
        index: cur.index,
        timestamp: cur.timestamp,
        data: cur.data,
        previousHash: cur.previousHash,
        nonce: cur.nonce,
      });
      if (recalc !== cur.hash) {
        console.error(`[CHAIN INTEGRITY] Booth ${boothId} election ${electionId} block #${i} HASH MISMATCH:`, {
          chainKey: cur.chainKey,
          blockIndex: cur.index,
          blockType: cur.data.type,
          expected: recalc,
          actual: cur.hash,
        });
        return { valid: false, blockCount: chain.length, error: `Booth ${boothId} block #${i} hash mismatch — tampered!` };
      }

      // Verify chain link
      if (i > 0 && cur.previousHash !== chain[i - 1].hash) {
        console.error(`[CHAIN INTEGRITY] Booth ${boothId} election ${electionId} block #${i} BROKEN LINK:`, {
          chainKey: cur.chainKey,
          blockIndex: cur.index,
          previousHashInBlock: cur.previousHash,
          expectedPrevHash: chain[i - 1].hash,
          prevBlockIndex: chain[i - 1].index,
        });
        return { valid: false, blockCount: chain.length, error: `Booth ${boothId} block #${i} broken link` };
      }
    }

    return { valid: true, blockCount: chain.length };
  },

  /** Verify the MASTER chain integrity (global audit chain, or election chain if electionId given) */
  async verifyChain(electionId?: string): Promise<{ valid: boolean; totalBlocks: number; invalidBlockIndex?: number; error?: string }> {
    if (electionId) {
      // Verify the election's own master chain
      const chain = await _electionGetAll(electionId);
      if (chain.length === 0) return { valid: true, totalBlocks: 0 };
      for (let i = 0; i < chain.length; i++) {
        const cur = chain[i];
        const recalc = await calculateHash({
          index: cur.index, timestamp: cur.timestamp,
          data: cur.data, previousHash: cur.previousHash, nonce: cur.nonce,
        });
        if (recalc !== cur.hash) {
          console.error(`[CHAIN INTEGRITY] Election ${electionId} block #${i} HASH MISMATCH:`, {
            blockIndex: cur.index,
            chainKey: cur.chainKey,
            expected: recalc,
            actual: cur.hash,
            blockData: cur.data
          });
          return { valid: false, totalBlocks: chain.length, invalidBlockIndex: i, error: `Election ${electionId} master block #${i} hash mismatch` };
        }
        if (i > 0 && cur.previousHash !== chain[i - 1].hash) {
          console.error(`[CHAIN INTEGRITY] Election ${electionId} block #${i} BROKEN LINK:`, {
            blockIndex: cur.index,
            chainKey: cur.chainKey,
            previousHashInBlock: cur.previousHash,
            expectedPrevHash: chain[i - 1].hash,
            prevBlockIndex: chain[i - 1].index
          });
          return { valid: false, totalBlocks: chain.length, invalidBlockIndex: i, error: `Election ${electionId} master block #${i} broken chain link` };
        }
      }
      return { valid: true, totalBlocks: chain.length };
    }

    // Original global audit chain verification
    const chain = await _masterGetAll();
    if (chain.length === 0) return { valid: true, totalBlocks: 0 };

    for (let i = 0; i < chain.length; i++) {
      const cur = chain[i];
      const recalc = await calculateHash({
        index: cur.index, timestamp: cur.timestamp,
        data: cur.data, previousHash: cur.previousHash, nonce: cur.nonce,
      });
      if (recalc !== cur.hash) {
        console.error(`[CHAIN INTEGRITY] Master block #${i} HASH MISMATCH:`, {
          blockIndex: cur.index,
          blockType: cur.data.type,
          expected: recalc,
          actual: cur.hash,
          timestamp: cur.timestamp,
          payload: cur.data.payload
        });
        return { valid: false, totalBlocks: chain.length, invalidBlockIndex: i, error: `Master block #${i} hash mismatch` };
      }
      if (i > 0 && cur.previousHash !== chain[i - 1].hash) {
        console.error(`[CHAIN INTEGRITY] Master block #${i} BROKEN LINK:`, {
          blockIndex: cur.index,
          blockType: cur.data.type,
          previousHashInBlock: cur.previousHash,
          expectedPrevHash: chain[i - 1].hash,
          prevBlockType: chain[i - 1].data.type
        });
        return { valid: false, totalBlocks: chain.length, invalidBlockIndex: i, error: `Master block #${i} broken chain link` };
      }
    }
    return { valid: true, totalBlocks: chain.length };
  },

  /** Return all master chain blocks (alias for getChain) */
  async getMasterChain(): Promise<Block[]> {
    return _masterGetAll();
  },

  /** Verify master chain integrity — returns same shape as verifyChain */
  async verifyMasterChain(): Promise<{ valid: boolean; totalBlocks: number; invalidBlockIndex?: number; error?: string }> {
    return this.verifyChain();
  },

  // ── Booth sub-chain — Merkle ──────────────────────────────────────────────────

  /** Build Merkle tree from all vote blocks in a booth sub-chain for a specific election */
  async buildBoothMerkleTree(boothId: string, electionId?: string): Promise<{ tree: string[][]; leafHashes: string[] }> {
    const blocks = await _boothGetAll(boothId, electionId);
    const voteBlocks = blocks.filter(b => b.data.type === 'vote');
    const leafHashes = await Promise.all(
      voteBlocks.map(b => sha256(JSON.stringify(b.data.payload)))
    );
    const tree = await buildMerkleTree(leafHashes);
    return { tree, leafHashes };
  },

  /** Compute summary for a booth+election chain (used during merge) */
  async getBoothChainSummary(boothId: string, electionId?: string): Promise<BoothChainSummary> {
    const chain = await _boothGetAll(boothId, electionId);
    const voteBlocks = chain.filter(b => b.data.type === 'vote');
    const { tree } = await this.buildBoothMerkleTree(boothId, electionId);
    const verification = await this.verifyBoothChain(boothId, electionId);
    const tip = chain[chain.length - 1];
    const resolvedElectionId = electionId || chain[0]?.electionId || '';

    return {
      boothId,
      electionId: resolvedElectionId,
      blockCount: chain.length,
      voteCount: voteBlocks.length,
      merkleRoot: getMerkleRoot(tree),
      isValid: verification.valid,
      tipHash: tip?.hash || '0'.repeat(64),
    };
  },

  // ── MERGE ────────────────────────────────────────────────────────────────────

  /**
   * Merge all booth sub-chains for an election into the master chain.
   *
   * Steps:
   *  1. Collect all booths that have vote blocks for this election
   *  2. Verify each booth chain
   *  3. Compute per-booth Merkle root
   *  4. Compute master Merkle root over all booth Merkle roots
   *  5. Append MERGE block to master chain
   *
   * @returns the MERGE block written to the master chain
   */
  async mergeBoothChains(electionId: string): Promise<Block & { boothSummaries: BoothChainSummary[] }> {
    // 1. Find all booths that have votes for this election
    const allVoteBlocks = await this.getVoteBlocksByElection(electionId);
    const boothIds = [...new Set(allVoteBlocks.map(b => b.boothId))];

    if (boothIds.length === 0) {
      throw new Error(`No booth vote blocks found for election ${electionId}`);
    }

    // 2 & 3. Verify + summarise each booth (scoped to this election)
    const boothSummaries: BoothChainSummary[] = [];
    for (const bid of boothIds) {
      const summary = await this.getBoothChainSummary(bid, electionId);
      boothSummaries.push(summary);
    }

    // 4. Master Merkle root = Merkle tree over all booth Merkle roots
    const boothRoots = boothSummaries.map(s => s.merkleRoot);
    const masterTree = await buildMerkleTree(boothRoots);
    const masterMerkleRoot = getMerkleRoot(masterTree);
    const totalVotes = boothSummaries.reduce((sum, s) => sum + s.voteCount, 0);

    // 5a. Write MERGE block to election's master chain
    const mergeBoothBlock = await this.addElectionBlock(electionId, {
      type: 'merge',
      payload: {
        electionId,
        mergedAt: new Date().toISOString(),
        totalVotes,
        masterMerkleRoot,
        booths: boothSummaries.map(s => ({
          boothId: s.boothId,
          voteCount: s.voteCount,
          blockCount: s.blockCount,
          merkleRoot: s.merkleRoot,
          isValid: s.isValid,
          tipHash: s.tipHash,
        })),
      },
    });

    // 5b. Also write a lightweight audit record on the global chain (keeps audit log complete)
    const mergeBlock = await this.addBlock({
      type: 'merge',
      payload: {
        electionId,
        mergedAt: mergeBoothBlock.timestamp,
        totalVotes,
        masterMerkleRoot,
        electionMasterChainHash: mergeBoothBlock.hash,
      },
    });

    console.info(
      `[localBlockchain] MERGE complete — election ${electionId} — ` +
      `${boothIds.length} booth(s) — ${totalVotes} votes — masterMerkleRoot: ${masterMerkleRoot.slice(0, 16)}…`
    );

    return { ...mergeBlock, boothSummaries };
  },

  // ── Master Merkle (across all vote blocks globally) ───────────────────────────

  async buildMerkleTree(): Promise<{ tree: string[][]; leafHashes: string[] }> {
    const voteBlocks = await this.getVoteBlocks();
    const leafHashes = await Promise.all(
      voteBlocks.map(b => sha256(JSON.stringify(b.data.payload)))
    );
    const tree = await buildMerkleTree(leafHashes);
    return { tree, leafHashes };
  },

  async getMerkleRoot(): Promise<{ merkleRoot: string; leafCount: number; chainLength: number }> {
    const { tree, leafHashes } = await this.buildMerkleTree();
    const masterChain = await _masterGetAll();
    return {
      merkleRoot: getMerkleRoot(tree),
      leafCount: leafHashes.length,
      chainLength: masterChain.length,
    };
  },

  async getMerkleProof(searchKey: string): Promise<{
    found: boolean;
    leafHash: string;
    merkleRoot: string;
    proof: MerkleProofStep[];
    verified: boolean;
    boothId?: string;
  }> {
    const voteBlocks = await this.getVoteBlocks();
    const { tree, leafHashes } = await this.buildMerkleTree();
    const root = getMerkleRoot(tree);

    let leafIndex = -1;
    let foundBoothId: string | undefined;

    for (let i = 0; i < voteBlocks.length; i++) {
      const block = voteBlocks[i];
      const leafHash = await sha256(JSON.stringify(block.data.payload));
      if (
        leafHash === searchKey ||
        block.hash === searchKey ||
        block.data.payload.voterHash === searchKey
      ) {
        leafIndex = i;
        foundBoothId = block.boothId;
        break;
      }
    }

    if (leafIndex === -1) {
      return { found: false, leafHash: searchKey, merkleRoot: root, proof: [], verified: false };
    }

    const proof = getMerkleProof(tree, leafIndex);
    const verified = await verifyMerkleProof(leafHashes[leafIndex], proof, root);

    return { found: true, leafHash: leafHashes[leafIndex], merkleRoot: root, proof, verified, boothId: foundBoothId };
  },

  async verifyMerkleProofLocal(leafHash: string, proof: MerkleProofStep[], expectedRoot: string): Promise<boolean> {
    return verifyMerkleProof(leafHash, proof, expectedRoot);
  },

  // ── Analytics ─────────────────────────────────────────────────────────────────

  async getElectionResults(electionId: string): Promise<{ candidateId: string; voteCount: number; percentage: number }[]> {
    const voteBlocks = await this.getVoteBlocksByElection(electionId);
    const totals: Record<string, number> = {};
    for (const block of voteBlocks) {
      const cid = block.data.payload.candidateId;
      totals[cid] = (totals[cid] || 0) + 1;
    }
    const total = voteBlocks.length || 1;
    return Object.entries(totals)
      .map(([candidateId, voteCount]) => ({
        candidateId, voteCount,
        percentage: Math.round((voteCount / total) * 10000) / 100,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);
  },

  async getElectionAnalytics(electionId: string): Promise<any> {
    const voteBlocks = await this.getVoteBlocksByElection(electionId);
    const total = voteBlocks.length;

    // Candidate tallies
    const candidateCounts: Record<string, number> = {};
    for (const b of voteBlocks) {
      const cid = b.data.payload.candidateId;
      candidateCounts[cid] = (candidateCounts[cid] || 0) + 1;
    }
    const results = Object.entries(candidateCounts)
      .map(([candidateId, voteCount]) => ({
        candidateId, voteCount,
        percentage: total > 0 ? Math.round((voteCount / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.voteCount - a.voteCount);

    const winner = results[0] || null;
    const runnerUp = results[1] || null;
    const margin = winner && runnerUp ? winner.voteCount - runnerUp.voteCount : 0;

    // Time series (hourly buckets)
    const timeBuckets: Record<string, number> = {};
    for (const b of voteBlocks) {
      const ts = b.data.payload.timestamp || b.timestamp;
      const dt = new Date(ts);
      const bucket = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:00`;
      timeBuckets[bucket] = (timeBuckets[bucket] || 0) + 1;
    }
    const timeSeries = Object.entries(timeBuckets)
      .map(([time, votes]) => ({ time, votes }))
      .sort((a, b) => a.time.localeCompare(b.time));

    // Booth breakdown — now from actual per-booth sub-chains
    const boothIds = [...new Set(voteBlocks.map(b => b.boothId))];
    const boothBreakdownArr: any[] = [];
    for (const bid of boothIds) {
      const boothVotes = voteBlocks.filter(b => b.boothId === bid);
      const boothCandidates: Record<string, number> = {};
      for (const b of boothVotes) {
        const cid = b.data.payload.candidateId;
        boothCandidates[cid] = (boothCandidates[cid] || 0) + 1;
      }
      boothBreakdownArr.push({
        boothId: bid,
        boothName: bid,
        voteCount: boothVotes.length,
        candidates: boothCandidates,
      });
    }

    // Election master chain + booth chain status
    const electionChainVerification = await this.verifyChain(electionId);
    const electionChain = await _electionGetAll(electionId);
    const merkle = await this.getMerkleRoot();
    const boothSummaries: BoothChainSummary[] = [];
    for (const bid of boothIds) {
      boothSummaries.push(await this.getBoothChainSummary(bid, electionId));
    }

    return {
      electionId,
      totalVotes: total,
      results,
      winner,
      runnerUp,
      margin,
      timeSeries,
      boothBreakdown: boothBreakdownArr,
      blockchain: {
        masterBlocks: electionChain.length,
        masterValid: electionChainVerification.valid,
        merkleRoot: merkle.merkleRoot,
        leafCount: merkle.leafCount,
        totalBooths: boothIds.length,
        boothSummaries,
        auditChainBlocks: (await _masterGetAll()).length,
      },
    };
  },

  // ── Air-Gapped Physical USB Export & Import ────────────────────────────────
  /**
   * Export an air-gapped booth sub-chain package (.biochain) for physical transfer.
   */
  async exportBoothPackage(boothId: string, electionId?: string): Promise<{
    format: string;
    version: string;
    exportedAt: string;
    boothId: string;
    electionId: string;
    blockCount: number;
    voteCount: number;
    merkleRoot: string;
    tipHash: string;
    blocks: BoothBlock[];
    digitalSeal: string;
  }> {
    const chain = await _boothGetAll(boothId, electionId);
    const summary = await this.getBoothChainSummary(boothId, electionId);
    const blocksJson = JSON.stringify(chain);
    const digitalSeal = await sha256(`BIOCHAIN_AIRGAP_SEAL:${boothId}:${summary.merkleRoot}:${blocksJson}`);

    return {
      format: 'BIOCHAIN_AIRGAP_PACKAGE',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      boothId,
      electionId: summary.electionId,
      blockCount: chain.length,
      voteCount: summary.voteCount,
      merkleRoot: summary.merkleRoot,
      tipHash: summary.tipHash,
      blocks: chain,
      digitalSeal,
    };
  },

  /**
   * Import an air-gapped booth sub-chain package into local IndexedDB.
   */
  async importBoothPackage(pkg: any): Promise<{
    success: boolean;
    boothId: string;
    importedBlocks: number;
    voteCount: number;
    merkleRoot: string;
  }> {
    if (!pkg || pkg.format !== 'BIOCHAIN_AIRGAP_PACKAGE' || !pkg.boothId || !Array.isArray(pkg.blocks)) {
      throw new Error('Invalid or corrupted BioChain air-gap package format');
    }

    // 1. Verify cryptographic seal
    const blocksJson = JSON.stringify(pkg.blocks);
    const expectedSeal = await sha256(`BIOCHAIN_AIRGAP_SEAL:${pkg.boothId}:${pkg.merkleRoot}:${blocksJson}`);
    if (pkg.digitalSeal !== expectedSeal) {
      throw new Error('Tamper detection alert: Digital seal mismatch on imported booth package!');
    }

    // 2. Validate chain integrity of every block
    for (let i = 0; i < pkg.blocks.length; i++) {
      const cur = pkg.blocks[i];
      const recalc = await calculateHash({
        index: cur.index,
        timestamp: cur.timestamp,
        data: cur.data,
        previousHash: cur.previousHash,
        nonce: cur.nonce,
      });
      if (recalc !== cur.hash) {
        throw new Error(`Block #${cur.index} hash mismatch in imported package for booth ${pkg.boothId}`);
      }
      if (i > 0 && cur.previousHash !== pkg.blocks[i - 1].hash) {
        throw new Error(`Block #${cur.index} previousHash broken chain link in imported package for booth ${pkg.boothId}`);
      }
    }

    // 3. Write blocks into booth_chains IndexedDB store
    for (const block of pkg.blocks) {
      await _boothPut(block);
    }

    const summary = await this.getBoothChainSummary(pkg.boothId);
    return {
      success: true,
      boothId: pkg.boothId,
      importedBlocks: pkg.blocks.length,
      voteCount: summary.voteCount,
      merkleRoot: summary.merkleRoot,
    };
  },
};
