// Local Blockchain — SHA-256-linked tamper-proof ledger stored in IndexedDB
// Fully offline. All computation happens client-side.

import { blockDB } from './dbService';

export interface Block {
    index: number;
    timestamp: string;
    data: {
        type: 'genesis' | 'vote' | 'election_created' | 'election_completed';
        payload: Record<string, any>;
    };
    previousHash: string;
    hash: string;
    nonce: number;
}

// ─── SHA-256 hash using Web Crypto API ──────────────────────────────────────

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
    const parts = keys.map(k => `"${k}":${deterministicStringify(obj[k])}`);
    return `{${parts.join(',')}}`;
}

async function calculateHash(block: Omit<Block, 'hash'>): Promise<string> {
    const blockString = `${block.index}${block.timestamp}${deterministicStringify(block.data)}${block.previousHash}${block.nonce}`;
    return sha256(blockString);
}

// Create the genesis block
async function createGenesisBlock(): Promise<Block> {
    const block: Omit<Block, 'hash'> = {
        index: 0,
        timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        data: {
            type: 'genesis',
            payload: {
                message: 'BioChain Vote — Genesis Block — Decentralized Voting System for India',
                version: '1.0.0',
            },
        },
        previousHash: '0'.repeat(64),
        nonce: 0,
    };

    const hash = await calculateHash(block);
    const genesisBlock: Block = { ...block, hash };
    await blockDB.save(genesisBlock);
    return genesisBlock;
}

// ─── Merkle Tree (Client-Side SHA-256) ──────────────────────────────────────

export interface MerkleProofStep {
    hash: string;
    position: 'left' | 'right';
}

/** Build a Merkle tree from an array of leaf hashes. Returns array of levels. */
async function buildMerkleTree(leafHashes: string[]): Promise<string[][]> {
    if (leafHashes.length === 0) return [['0'.repeat(64)]];

    let currentLevel = [...leafHashes];
    const tree: string[][] = [currentLevel];

    while (currentLevel.length > 1) {
        const nextLevel: string[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left; // duplicate last if odd
            const parent = await sha256(left + right);
            nextLevel.push(parent);
        }
        tree.push(nextLevel);
        currentLevel = nextLevel;
    }

    return tree;
}

/** Get the Merkle root from a tree */
function getMerkleRoot(tree: string[][]): string {
    if (tree.length === 0) return '0'.repeat(64);
    const topLevel = tree[tree.length - 1];
    return topLevel[0] || '0'.repeat(64);
}

/** Get Merkle proof for a specific leaf */
function getMerkleProof(tree: string[][], leafIndex: number): MerkleProofStep[] {
    const proof: MerkleProofStep[] = [];
    let idx = leafIndex;

    for (let level = 0; level < tree.length - 1; level++) {
        const currentLevel = tree[level];
        const isRight = idx % 2 === 1;
        const siblingIdx = isRight ? idx - 1 : idx + 1;

        if (siblingIdx < currentLevel.length) {
            proof.push({
                hash: currentLevel[siblingIdx],
                position: isRight ? 'left' : 'right',
            });
        }

        idx = Math.floor(idx / 2);
    }

    return proof;
}

/** Verify a Merkle proof locally */
async function verifyMerkleProof(leafHash: string, proof: MerkleProofStep[], expectedRoot: string): Promise<boolean> {
    let current = leafHash;
    for (const step of proof) {
        if (step.position === 'right') {
            current = await sha256(current + step.hash);
        } else {
            current = await sha256(step.hash + current);
        }
    }
    return current === expectedRoot;
}

// ─── Main Service ───────────────────────────────────────────────────────────

export const localBlockchain = {
    /** Initialize the blockchain (create genesis if empty) */
    async initialize(): Promise<void> {
        const blockCount = await blockDB.count();
        if (blockCount === 0) {
            await createGenesisBlock();
        }
    },

    /** Get the full chain */
    async getChain(): Promise<Block[]> {
        const blocks = await blockDB.getAll() as Block[];
        return blocks.sort((a, b) => a.index - b.index);
    },

    /** Get the latest block */
    async getLatestBlock(): Promise<Block> {
        const last = await blockDB.getLast();
        if (!last) {
            return createGenesisBlock();
        }
        return last as Block;
    },

    /** Add a new block to the chain */
    async addBlock(data: Block['data']): Promise<Block> {
        const previousBlock = await this.getLatestBlock();

        const newBlock: Omit<Block, 'hash'> = {
            index: previousBlock.index + 1,
            timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            data,
            previousHash: previousBlock.hash,
            nonce: Math.floor(Math.random() * 1000000),
        };

        const hash = await calculateHash(newBlock);
        const block: Block = { ...newBlock, hash };
        await blockDB.save(block);
        return block;
    },

    /** Record a vote on the blockchain */
    async recordVote(voteData: {
        voterId: string;
        electionId: string;
        candidateId: string;
        voterHash: string; // hashed voter identity for privacy
        boothId?: string;
    }): Promise<Block> {
        return this.addBlock({
            type: 'vote',
            payload: {
                voterHash: voteData.voterHash,
                voterId: voteData.voterId,
                electionId: voteData.electionId,
                candidateId: voteData.candidateId,
                boothId: voteData.boothId || 'master',
                timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            },
        });
    },

    /** Record an election event */
    async recordElectionEvent(type: 'election_created' | 'election_completed', electionData: Record<string, any>): Promise<Block> {
        return this.addBlock({
            type,
            payload: electionData,
        });
    },

    /** Verify the integrity of the entire chain */
    async verifyChain(): Promise<{
        valid: boolean;
        totalBlocks: number;
        invalidBlockIndex?: number;
        error?: string;
    }> {
        const chain = await this.getChain();

        if (chain.length === 0) {
            return { valid: true, totalBlocks: 0 };
        }

        // Verify genesis block
        const genesisHash = await calculateHash({
            index: chain[0].index,
            timestamp: chain[0].timestamp,
            data: chain[0].data,
            previousHash: chain[0].previousHash,
            nonce: chain[0].nonce,
        });

        if (genesisHash !== chain[0].hash) {
            return {
                valid: false,
                totalBlocks: chain.length,
                invalidBlockIndex: 0,
                error: 'Genesis block hash mismatch — chain has been tampered!',
            };
        }

        // Verify each subsequent block
        for (let i = 1; i < chain.length; i++) {
            const currentBlock = chain[i];
            const previousBlock = chain[i - 1];

            // Check previous hash link
            if (currentBlock.previousHash !== previousBlock.hash) {
                return {
                    valid: false,
                    totalBlocks: chain.length,
                    invalidBlockIndex: i,
                    error: `Block #${i} previousHash does not match Block #${i - 1} hash — chain link broken!`,
                };
            }

            // Re-calculate and verify current block's hash
            const recalculatedHash = await calculateHash({
                index: currentBlock.index,
                timestamp: currentBlock.timestamp,
                data: currentBlock.data,
                previousHash: currentBlock.previousHash,
                nonce: currentBlock.nonce,
            });

            if (recalculatedHash !== currentBlock.hash) {
                return {
                    valid: false,
                    totalBlocks: chain.length,
                    invalidBlockIndex: i,
                    error: `Block #${i} hash mismatch — block data has been tampered!`,
                };
            }
        }

        return { valid: true, totalBlocks: chain.length };
    },

    /** Get a specific block by hash */
    async getBlockByHash(hash: string): Promise<Block | undefined> {
        const chain = await this.getChain();
        return chain.find(b => b.hash === hash);
    },

    /** Get a specific block by index */
    async getBlockByIndex(index: number): Promise<Block | undefined> {
        return blockDB.getByIndex(index) as Promise<Block | undefined>;
    },

    /** Get total block count */
    async getBlockCount(): Promise<number> {
        return blockDB.count();
    },

    /** Get all vote blocks */
    async getVoteBlocks(): Promise<Block[]> {
        const chain = await this.getChain();
        return chain.filter(b => b.data.type === 'vote');
    },

    /** Get vote blocks for a specific election */
    async getVoteBlocksByElection(electionId: string): Promise<Block[]> {
        const voteBlocks = await this.getVoteBlocks();
        return voteBlocks.filter(b => b.data.payload.electionId === electionId);
    },

    /** Check if a voter has already voted in an election (scanning the chain) */
    async hasVoterVoted(voterId: string, electionId: string): Promise<boolean> {
        const voteBlocks = await this.getVoteBlocksByElection(electionId);
        return voteBlocks.some(b => b.data.payload.voterId === voterId);
    },

    /** Get all unique voter IDs who voted in an election */
    async getVotersByElection(electionId: string): Promise<string[]> {
        const voteBlocks = await this.getVoteBlocksByElection(electionId);
        return [...new Set(voteBlocks.map(b => b.data.payload.voterId))];
    },

    // ─── Merkle Tree Operations ──────────────────────────────────────────────

    /** Build a Merkle tree from all vote transactions in the chain */
    async buildMerkleTree(): Promise<{ tree: string[][]; leafHashes: string[] }> {
        const voteBlocks = await this.getVoteBlocks();
        const leafHashes: string[] = [];

        for (const block of voteBlocks) {
            const txString = JSON.stringify(block.data.payload);
            const leafHash = await sha256(txString);
            leafHashes.push(leafHash);
        }

        const tree = await buildMerkleTree(leafHashes);
        return { tree, leafHashes };
    },

    /** Get the Merkle root of the entire chain */
    async getMerkleRoot(): Promise<{ merkleRoot: string; leafCount: number; chainLength: number }> {
        const { tree, leafHashes } = await this.buildMerkleTree();
        const chain = await this.getChain();
        return {
            merkleRoot: getMerkleRoot(tree),
            leafCount: leafHashes.length,
            chainLength: chain.length,
        };
    },

    /** Get Merkle proof for a transaction (by voter ID, tx hash, or block hash) */
    async getMerkleProof(searchKey: string): Promise<{
        found: boolean;
        leafHash: string;
        merkleRoot: string;
        proof: MerkleProofStep[];
        verified: boolean;
    }> {
        const voteBlocks = await this.getVoteBlocks();
        const { tree, leafHashes } = await this.buildMerkleTree();
        const root = getMerkleRoot(tree);

        // Search by voter ID, leaf hash, or block hash — in ALL chain blocks
        // (not just voteBlocks so we can always find by block.hash)
        const allBlocks = await this.getChain();
        let leafIndex = -1;
        for (let i = 0; i < voteBlocks.length; i++) {
            const block = voteBlocks[i];
            const txString = JSON.stringify(block.data.payload);
            const leafHash = await sha256(txString);

            if (
                leafHash === searchKey ||
                block.data.payload.voterId === searchKey ||
                block.hash === searchKey ||
                block.data.payload.voterHash === searchKey
            ) {
                leafIndex = i;
                break;
            }
        }

        // Also try matching against ANY block by hash (edge case: non-vote blocks)
        if (leafIndex === -1) {
            const byHash = allBlocks.findIndex(b => b.hash === searchKey);
            if (byHash !== -1 && allBlocks[byHash].data.type === 'vote') {
                leafIndex = voteBlocks.findIndex(b => b.hash === searchKey);
            }
        }

        if (leafIndex === -1) {
            return {
                found: false,
                leafHash: searchKey,
                merkleRoot: root,
                proof: [],
                verified: false,
            };
        }

        const proof = getMerkleProof(tree, leafIndex);
        const verified = await verifyMerkleProof(leafHashes[leafIndex], proof, root);

        return {
            found: true,
            leafHash: leafHashes[leafIndex],
            merkleRoot: root,
            proof,
            verified,
        };
    },

    /** Verify a Merkle proof */
    async verifyMerkleProofLocal(leafHash: string, proof: MerkleProofStep[], expectedRoot: string): Promise<boolean> {
        return verifyMerkleProof(leafHash, proof, expectedRoot);
    },

    // ─── Analytics Helpers ───────────────────────────────────────────────────

    /** Get election results tallied from the blockchain */
    async getElectionResults(electionId: string): Promise<{ candidateId: string; voteCount: number; percentage: number }[]> {
        const voteBlocks = await this.getVoteBlocksByElection(electionId);
        const totals: Record<string, number> = {};

        for (const block of voteBlocks) {
            const cid = block.data.payload.candidateId;
            totals[cid] = (totals[cid] || 0) + 1;
        }

        const total = voteBlocks.length;
        const results = Object.entries(totals).map(([candidateId, voteCount]) => ({
            candidateId,
            voteCount,
            percentage: total > 0 ? Math.round((voteCount / total) * 10000) / 100 : 0,
        }));

        return results.sort((a, b) => b.voteCount - a.voteCount);
    },

    /** Get comprehensive analytics for an election */
    async getElectionAnalytics(electionId: string): Promise<any> {
        const voteBlocks = await this.getVoteBlocksByElection(electionId);
        const total = voteBlocks.length;

        // Candidate tallies
        const candidateCounts: Record<string, number> = {};
        for (const block of voteBlocks) {
            const cid = block.data.payload.candidateId;
            candidateCounts[cid] = (candidateCounts[cid] || 0) + 1;
        }

        const results = Object.entries(candidateCounts)
            .map(([candidateId, voteCount]) => ({
                candidateId,
                voteCount,
                percentage: total > 0 ? Math.round((voteCount / total) * 10000) / 100 : 0,
            }))
            .sort((a, b) => b.voteCount - a.voteCount);

        const winner = results[0] || null;
        const runnerUp = results[1] || null;
        const margin = winner && runnerUp ? winner.voteCount - runnerUp.voteCount : 0;

        // Time series (bucket by hour)
        const timeBuckets: Record<string, number> = {};
        for (const block of voteBlocks) {
            const ts = block.data.payload.timestamp || block.timestamp;
            const dt = new Date(ts);
            const bucket = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:00`;
            timeBuckets[bucket] = (timeBuckets[bucket] || 0) + 1;
        }
        const timeSeries = Object.entries(timeBuckets)
            .map(([time, votes]) => ({ time, votes }))
            .sort((a, b) => a.time.localeCompare(b.time));

        // Booth breakdown
        const boothBreakdown: Record<string, { boothId: string; boothName: string; voteCount: number; candidates: Record<string, number> }> = {};
        for (const block of voteBlocks) {
            const bid = block.data.payload.boothId || 'master';
            if (!boothBreakdown[bid]) {
                boothBreakdown[bid] = { boothId: bid, boothName: bid, voteCount: 0, candidates: {} };
            }
            boothBreakdown[bid].voteCount += 1;
            const cid = block.data.payload.candidateId;
            boothBreakdown[bid].candidates[cid] = (boothBreakdown[bid].candidates[cid] || 0) + 1;
        }

        // Chain stats
        const chain = await this.getChain();
        const verification = await this.verifyChain();
        const merkle = await this.getMerkleRoot();

        return {
            electionId,
            totalVotes: total,
            results,
            winner,
            runnerUp,
            margin,
            timeSeries,
            boothBreakdown: Object.values(boothBreakdown),
            blockchain: {
                masterBlocks: chain.length,
                masterValid: verification.valid,
                merkleRoot: merkle.merkleRoot,
                leafCount: merkle.leafCount,
                totalBooths: Object.keys(boothBreakdown).length,
            },
        };
    },
};
