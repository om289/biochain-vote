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
  /** Composite key stored in IDB: `${boothId}:${index}` */
  chainKey: string;
  boothId: string;
}

export interface MerkleProofStep {
  hash: string;
  position: 'left' | 'right';
}

export interface BoothChainSummary {
  boothId: string;
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
  // Re-use the same DB opened by dbService (same name + version)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('biochain-vote');
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror = () => reject(req.error);
  });
}

async function _boothGetAll(boothId: string): Promise<BoothBlock[]> {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('booth_chains', 'readonly');
    const idx = tx.objectStore('booth_chains').index('boothId');
    const r = idx.getAll(boothId);
    r.onsuccess = () => res((r.result as BoothBlock[]).sort((a, b) => a.index - b.index));
    r.onerror = () => rej(r.error);
  });
}

async function _boothGet(boothId: string, index: number): Promise<BoothBlock | undefined> {
  const db = await _openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('booth_chains', 'readonly');
    const r = tx.objectStore('booth_chains').get(`${boothId}:${index}`);
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

// ─── Master chain helpers ──────────────────────────────────────────────────────

async function _masterGetAll(): Promise<Block[]> {
  const blocks = await blockDB.getAll() as Block[];
  return blocks.sort((a, b) => a.index - b.index);
}

async function _masterGetLatest(): Promise<Block | undefined> {
  return blockDB.getLast() as Promise<Block | undefined>;
}

async function _masterSave(block: Block): Promise<void> {
  await blockDB.save(block);
}

async function _masterCreateGenesis(): Promise<Block> {
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
  await _masterSave(genesis);
  return genesis;
}

// ─── Main Service ─────────────────────────────────────────────────────────────

export const localBlockchain = {

  // ── Initialisation ──────────────────────────────────────────────────────────

  /** Create master genesis block if the chain is empty */
  async initialize(): Promise<void> {
    const count = await blockDB.count();
    if (count === 0) {
      await _masterCreateGenesis();
    }
  },

  // ── Master chain reads ───────────────────────────────────────────────────────

  async getChain(): Promise<Block[]> {
    return _masterGetAll();
  },

  async getLatestBlock(): Promise<Block> {
    const last = await _masterGetLatest();
    if (!last) return _masterCreateGenesis();
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

  async getBlockCount(): Promise<number> {
    return blockDB.count();
  },

  // ── Master chain writes ──────────────────────────────────────────────────────

  /** Append any block to the master chain */
  async addBlock(data: Block['data']): Promise<Block> {
    const prev = await this.getLatestBlock();
    const b: Omit<Block, 'hash'> = {
      index: prev.index + 1,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data,
      previousHash: prev.hash,
      nonce: Math.floor(Math.random() * 1_000_000),
    };
    const hash = await calculateHash(b);
    const block: Block = { ...b, hash };
    await _masterSave(block);
    return block;
  },

  async recordElectionEvent(
    type: 'election_created' | 'election_completed',
    payload: Record<string, any>
  ): Promise<Block> {
    return this.addBlock({ type, payload });
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
    // Check if already forked
    const existing = await _boothGetAll(boothId);
    const alreadyForked = existing.find(
      b => b.data.type === 'booth_fork' || (b.data as any).type === 'fork_genesis'
    );
    if (alreadyForked && alreadyForked.data.payload.electionId === electionId) {
      return alreadyForked;
    }

    // Capture master chain tip
    const masterTip = await this.getLatestBlock();

    // 1. Write booth_fork record on master chain (audit trail)
    await this.addBlock({
      type: 'booth_fork',
      payload: {
        boothId,
        electionId,
        masterTipHash: masterTip.hash,
        masterTipIndex: masterTip.index,
        forkedAt: new Date().toISOString(),
      },
    });

    // 2. Write fork_genesis to booth sub-chain
    const forkBlock: Omit<BoothBlock, 'hash'> = {
      index: 0,
      chainKey: `${boothId}:0`,
      boothId,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data: {
        type: 'booth_fork' as BlockType,
        payload: {
          boothId,
          electionId,
          masterTipHash: masterTip.hash,
          masterTipIndex: masterTip.index,
          message: `Booth ${boothId} forked from master at block #${masterTip.index}`,
        },
      },
      previousHash: masterTip.hash, // ← anchors to master chain!
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

    // Auto-fork if needed
    const existing = await _boothGetAll(boothId);
    if (existing.length === 0) {
      await this.forkForBooth(boothId, voteData.electionId);
    }

    // Get latest block on this booth's chain
    const boothBlocks = await _boothGetAll(boothId);
    const prev = boothBlocks[boothBlocks.length - 1];

    const b: Omit<BoothBlock, 'hash'> = {
      index: prev.index + 1,
      chainKey: `${boothId}:${prev.index + 1}`,
      boothId,
      timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      data: {
        type: 'vote',
        payload: {
          voterHash: voteData.voterHash,
          electionId: voteData.electionId,
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

  /** Get full booth sub-chain */
  async getBoothChain(boothId: string): Promise<BoothBlock[]> {
    return _boothGetAll(boothId);
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

  /** Verify integrity of a single booth sub-chain */
  async verifyBoothChain(boothId: string): Promise<{ valid: boolean; blockCount: number; error?: string }> {
    const chain = await _boothGetAll(boothId);
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
        return { valid: false, blockCount: chain.length, error: `Booth ${boothId} block #${i} hash mismatch — tampered!` };
      }

      // Verify chain link
      if (i > 0 && cur.previousHash !== chain[i - 1].hash) {
        return { valid: false, blockCount: chain.length, error: `Booth ${boothId} block #${i} broken link` };
      }
    }

    return { valid: true, blockCount: chain.length };
  },

  /** Verify the MASTER chain integrity */
  async verifyChain(): Promise<{ valid: boolean; totalBlocks: number; invalidBlockIndex?: number; error?: string }> {
    const chain = await _masterGetAll();
    if (chain.length === 0) return { valid: true, totalBlocks: 0 };

    for (let i = 0; i < chain.length; i++) {
      const cur = chain[i];
      const recalc = await calculateHash({
        index: cur.index, timestamp: cur.timestamp,
        data: cur.data, previousHash: cur.previousHash, nonce: cur.nonce,
      });
      if (recalc !== cur.hash) {
        return { valid: false, totalBlocks: chain.length, invalidBlockIndex: i, error: `Master block #${i} hash mismatch` };
      }
      if (i > 0 && cur.previousHash !== chain[i - 1].hash) {
        return { valid: false, totalBlocks: chain.length, invalidBlockIndex: i, error: `Master block #${i} broken chain link` };
      }
    }
    return { valid: true, totalBlocks: chain.length };
  },

  // ── Booth sub-chain — Merkle ──────────────────────────────────────────────────

  /** Build Merkle tree from all vote blocks in a booth sub-chain */
  async buildBoothMerkleTree(boothId: string): Promise<{ tree: string[][]; leafHashes: string[] }> {
    const blocks = await _boothGetAll(boothId);
    const voteBlocks = blocks.filter(b => b.data.type === 'vote');
    const leafHashes = await Promise.all(
      voteBlocks.map(b => sha256(JSON.stringify(b.data.payload)))
    );
    const tree = await buildMerkleTree(leafHashes);
    return { tree, leafHashes };
  },

  /** Compute summary for a booth chain (used during merge) */
  async getBoothChainSummary(boothId: string): Promise<BoothChainSummary> {
    const chain = await _boothGetAll(boothId);
    const voteBlocks = chain.filter(b => b.data.type === 'vote');
    const { tree, leafHashes } = await this.buildBoothMerkleTree(boothId);
    const verification = await this.verifyBoothChain(boothId);
    const tip = chain[chain.length - 1];

    return {
      boothId,
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

    // 2 & 3. Verify + summarise each booth
    const boothSummaries: BoothChainSummary[] = [];
    for (const bid of boothIds) {
      const summary = await this.getBoothChainSummary(bid);
      boothSummaries.push(summary);
    }

    // 4. Master Merkle root = Merkle tree over all booth Merkle roots
    const boothRoots = boothSummaries.map(s => s.merkleRoot);
    const masterTree = await buildMerkleTree(boothRoots);
    const masterMerkleRoot = getMerkleRoot(masterTree);
    const totalVotes = boothSummaries.reduce((sum, s) => sum + s.voteCount, 0);

    // 5. Write MERGE block to master chain
    const mergeBlock = await this.addBlock({
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

    // Master chain + booth chain status
    const masterVerification = await this.verifyChain();
    const merkle = await this.getMerkleRoot();
    const boothSummaries: BoothChainSummary[] = [];
    for (const bid of boothIds) {
      boothSummaries.push(await this.getBoothChainSummary(bid));
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
        masterBlocks: (await _masterGetAll()).length,
        masterValid: masterVerification.valid,
        merkleRoot: merkle.merkleRoot,
        leafCount: merkle.leafCount,
        totalBooths: boothIds.length,
        boothSummaries,
      },
    };
  },

  // ── Air-Gapped Physical USB Export & Import ────────────────────────────────
  /**
   * Export an air-gapped booth sub-chain package (.biochain) for physical transfer.
   */
  async exportBoothPackage(boothId: string): Promise<{
    format: string;
    version: string;
    exportedAt: string;
    boothId: string;
    blockCount: number;
    voteCount: number;
    merkleRoot: string;
    tipHash: string;
    blocks: BoothBlock[];
    digitalSeal: string;
  }> {
    const chain = await _boothGetAll(boothId);
    const summary = await this.getBoothChainSummary(boothId);
    const blocksJson = JSON.stringify(chain);
    const digitalSeal = await sha256(`BIOCHAIN_AIRGAP_SEAL:${boothId}:${summary.merkleRoot}:${blocksJson}`);

    return {
      format: 'BIOCHAIN_AIRGAP_PACKAGE',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      boothId,
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
