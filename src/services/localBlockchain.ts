// Local Blockchain — SHA-256-linked tamper-proof ledger stored in IndexedDB

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

// SHA-256 hash using Web Crypto API
async function sha256(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function calculateHash(block: Omit<Block, 'hash'>): Promise<string> {
    const blockString = `${block.index}${block.timestamp}${JSON.stringify(block.data)}${block.previousHash}${block.nonce}`;
    return sha256(blockString);
}

// Create the genesis block
async function createGenesisBlock(): Promise<Block> {
    const block: Omit<Block, 'hash'> = {
        index: 0,
        timestamp: new Date().toISOString(),
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
            timestamp: new Date().toISOString(),
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
    }): Promise<Block> {
        return this.addBlock({
            type: 'vote',
            payload: {
                voterHash: voteData.voterHash,
                electionId: voteData.electionId,
                candidateId: voteData.candidateId,
                timestamp: new Date().toISOString(),
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
};
