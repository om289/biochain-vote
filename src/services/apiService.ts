// API Service — Offline-First Data Layer for BioChain Vote
// No Flask backend. All voting and analytics operations use local IndexedDB.
// Supabase is used for identity and as a publish target.

import { 
  voterDB, electionDB, candidateDB, voteDB, adminDB, boothDB, boothVoterDB, boothElectionDB, seedDemoData, 
  type Voter, type ElectionRecord, type CandidateRecord, type VoteRecord, type BoothRecord 
} from './dbService';
import { blockchainService } from './blockchainService';
import { localBlockchain } from './localBlockchain';

export const apiService = {
  /**
   * Initialize local IndexedDB stores (elections, candidates, admin PIN).
   */
  async initialize(): Promise<void> {
    try {
      await seedDemoData();
      await localBlockchain.initialize();
    } catch (e) {
      console.warn('[apiService] initialize error (non-fatal):', e);
    }
  },

  // ===== Voter Operations =====
  async getVoters(): Promise<Voter[]> {
    return voterDB.getAll();
  },

  async getVoterById(id: string): Promise<Voter | undefined> {
    return voterDB.getById(id);
  },

  async saveVoter(voter: Voter): Promise<void> {
    return voterDB.save(voter);
  },

  async deleteVoter(id: string): Promise<void> {
    return voterDB.delete(id);
  },

  // ===== Booth Management =====
  async getBooths(): Promise<BoothRecord[]> {
    return boothDB.getAll();
  },

  async getVoterBooth(voterId: string): Promise<{ booth_id: string; assigned: boolean } | null> {
    const record = await boothVoterDB.getByVoter(voterId);
    if (!record) return { booth_id: '', assigned: false };
    return { booth_id: record.boothId, assigned: true };
  },

  async getBoothElections(boothId: string): Promise<string[]> {
    const records = await boothElectionDB.getByBooth(boothId);
    return records.map(r => r.electionId);
  },

  // ===== Election Operations =====
  async getElections(): Promise<ElectionRecord[]> {
    return electionDB.getAll();
  },

  async getElectionById(id: string): Promise<ElectionRecord | undefined> {
    return electionDB.getById(id);
  },

  async getActiveElections(): Promise<ElectionRecord[]> {
    return electionDB.getByStatus('active');
  },

  async getElectionsForVoter(voter: Voter): Promise<ElectionRecord[]> {
    const boothAssignment = await this.getVoterBooth(voter.id);
    if (!boothAssignment?.assigned) return [];
    
    const assignedElectionIds = await this.getBoothElections(boothAssignment.booth_id);
    const all = await electionDB.getAll();
    
    return all.filter(e => assignedElectionIds.includes(e.id));
  },

  async saveElection(election: ElectionRecord): Promise<void> {
    return electionDB.save(election);
  },

  async deleteElection(id: string): Promise<void> {
    return electionDB.delete(id);
  },

  // ===== Candidate Operations =====
  async getCandidates(electionId: string): Promise<CandidateRecord[]> {
    return candidateDB.getByElection(electionId);
  },

  async getAllCandidates(): Promise<CandidateRecord[]> {
    return candidateDB.getAll();
  },

  async saveCandidate(candidate: CandidateRecord): Promise<void> {
    return candidateDB.save(candidate);
  },

  async deleteCandidate(id: string): Promise<void> {
    return candidateDB.delete(id);
  },

  // ===== Vote Operations =====
  async hasVoted(electionId: string, voterId: string): Promise<boolean> {
    return localBlockchain.hasVoterVoted(voterId, electionId);
  },

  async castVote(
    electionId: string, 
    voterId: string, 
    candidateId: string, 
    candidateName?: string, 
    boothId?: string
  ): Promise<VoteRecord & { commitment?: string; commitmentNonce?: string; merkleRoot?: string; signature?: string; signerAddress?: string }> {
    
    // Check if already voted in this election via Supabase OR local blockchain
    const sbVoted = await voterDB.hasVotedInElection(voterId, electionId);
    const localVoted = await localBlockchain.hasVoterVoted(voterId, electionId);
    
    if (sbVoted || localVoted) {
      throw new Error('You have already voted in this election. Double voting is not allowed.');
    }

    // ── Step 1: Create ZK-commitment ──
    let commitment: string | undefined;
    let commitmentNonce: string | undefined;
    try {
      const zkCommit = await blockchainService.createVoteCommitment(candidateId, voterId, electionId);
      commitment = zkCommit.commitment;
      commitmentNonce = zkCommit.nonce;
    } catch (e) {
      console.warn('[apiService] ZK-commitment failed (non-fatal):', e);
    }

    // ── Step 2: Sign with wallet if available ──
    let signature: string | undefined;
    let signerAddress: string | undefined;
    try {
      if (blockchainService.isWalletAvailable()) {
        const sig = await blockchainService.signVote(electionId, candidateId, voterId);
        signature = sig.signature;
        signerAddress = sig.signerAddress;
      }
    } catch (e) {
      console.warn('[apiService] Wallet signing skipped (non-fatal):', e);
    }

    // ── Step 3: Record locally on offline blockchain ──
    // Create voter hash for privacy
    const encoder = new TextEncoder();
    const data = encoder.encode(`voter:${voterId}:${electionId}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const voterHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const block = await localBlockchain.recordVote({
      voterId,
      electionId,
      candidateId,
      voterHash,
      boothId
    });

    // ── Step 4: Fetch Merkle root ──
    let merkleRoot: string | undefined;
    try {
      const merkle = await blockchainService.getMerkleRoot();
      merkleRoot = merkle.merkleRoot;
    } catch (e) {
      console.warn('[apiService] Merkle root fetch failed (non-fatal):', e);
    }

    const timestamp = new Date().toISOString();

    const vote: VoteRecord = {
      id: crypto.randomUUID(),
      electionId,
      voterId,
      candidateId,
      blockHash: block.hash,
      blockIndex: block.index,
      timestamp,
    };

    // Mark voter as voted in Supabase (prevents double voting)
    try {
      await voterDB.markVoted(voterId);
    } catch (e) {
      console.warn('[apiService] Could not update Supabase (offline mode). Sync required later.', e);
    }

    return {
      ...vote,
      commitment,
      commitmentNonce,
      merkleRoot,
      signature,
      signerAddress,
    };
  },

  async getVotesByElection(electionId: string): Promise<VoteRecord[]> {
    const blocks = await localBlockchain.getVoteBlocksByElection(electionId);
    return blocks.map(b => ({
      id: b.hash,
      electionId: b.data.payload.electionId,
      voterId: b.data.payload.voterId,
      candidateId: b.data.payload.candidateId,
      blockHash: b.hash,
      blockIndex: b.index,
      timestamp: b.data.payload.timestamp || b.timestamp,
    }));
  },

  async getVotesByVoter(voterId: string): Promise<VoteRecord[]> {
    const blocks = await localBlockchain.getVoteBlocks();
    const voterBlocks = blocks.filter(b => b.data.payload.voterId === voterId);
    
    return voterBlocks.map(b => ({
      id: b.hash,
      electionId: b.data.payload.electionId,
      voterId: b.data.payload.voterId,
      candidateId: b.data.payload.candidateId,
      blockHash: b.hash,
      blockIndex: b.index,
      timestamp: b.data.payload.timestamp || b.timestamp,
    }));
  },

  async getVoteCountByElection(electionId: string): Promise<number> {
    const blocks = await localBlockchain.getVoteBlocksByElection(electionId);
    return blocks.length;
  },

  /** Get election results with candidate vote counts — from local blockchain */
  async getElectionResults(electionId: string): Promise<{
    candidate: CandidateRecord;
    voteCount: number;
    percentage: number;
  }[]> {
    const candidates = await candidateDB.getByElection(electionId);
    const tallies = await localBlockchain.getElectionResults(electionId);
    
    let totalVotes = tallies.reduce((sum, t) => sum + t.voteCount, 0);
    if (totalVotes === 0) totalVotes = 1; // prevent division by zero

    const results = candidates.map(candidate => {
      const tally = tallies.find((r: any) => r.candidateId === candidate.id);
      const baseVoteCount = tally ? tally.voteCount : 0;
      
      return {
        candidate,
        voteCount: baseVoteCount,
        percentage: (baseVoteCount / totalVotes) * 100,
      };
    });

    return results.sort((a, b) => b.voteCount - a.voteCount);
  },

  /** Get comprehensive election analytics from the local blockchain, enriched with candidate names */
  async getElectionAnalytics(electionId: string): Promise<any> {
    const rawAnalytics = await localBlockchain.getElectionAnalytics(electionId);
    const candidates = await candidateDB.getByElection(electionId);
    
    // Build candidateId → name/party map
    const candMap: Record<string, { name: string; partyName: string; partySymbol: string }> = {};
    for (const c of candidates) {
      candMap[c.id] = { name: c.name, partyName: c.partyName, partySymbol: c.partySymbol };
    }

    // Enrich results with candidate names
    const enrichedResults = rawAnalytics.results.map((r: any) => ({
      ...r,
      voteCount: r.voteCount,
      candidateName: candMap[r.candidateId]?.name || r.candidateId,
      partyName: candMap[r.candidateId]?.partyName || 'Unknown',
      partySymbol: candMap[r.candidateId]?.partySymbol || '⭐',
    }));

    // Enrich winner/runnerUp and scale
    const enrichedWinner = rawAnalytics.winner ? {
      ...rawAnalytics.winner,
      voteCount: rawAnalytics.winner.voteCount,
      candidateName: candMap[rawAnalytics.winner.candidateId]?.name || rawAnalytics.winner.candidateId,
      partyName: candMap[rawAnalytics.winner.candidateId]?.partyName || 'Unknown',
    } : null;

    const enrichedRunnerUp = rawAnalytics.runnerUp ? {
      ...rawAnalytics.runnerUp,
      voteCount: rawAnalytics.runnerUp.voteCount,
      candidateName: candMap[rawAnalytics.runnerUp.candidateId]?.name || rawAnalytics.runnerUp.candidateId,
      partyName: candMap[rawAnalytics.runnerUp.candidateId]?.partyName || 'Unknown',
    } : null;

    // Enrich booth breakdown and scale
    const enrichedBooths = rawAnalytics.boothBreakdown.map((booth: any) => {
      const enrichedCandidates: Record<string, any> = {};
      for (const [cid, count] of Object.entries(booth.candidates)) {
        const key = candMap[cid]?.name || cid;
        enrichedCandidates[key] = count as number;
      }
      return { 
        ...booth, 
        voteCount: booth.voteCount,
        candidates: enrichedCandidates 
      };
    });
    
    // No need to scale time series
    const timeSeries = rawAnalytics.timeSeries;

    return {
      ...rawAnalytics,
      results: enrichedResults,
      winner: enrichedWinner,
      runnerUp: enrichedRunnerUp,
      boothBreakdown: enrichedBooths,
      timeSeries: timeSeries,
    };
  },

  /** 
   * Publish results to Supabase (Admin action).
   *
   * Flow:
   *  1. Call mergeBoothChains → writes a MERGE block to the master chain
   *     containing per-booth Merkle roots (cryptographic audit seal)
   *  2. Upload individual vote records to Supabase votes table
   */
  async publishResults(electionId: string): Promise<{ success: boolean; publishedVotes: number; mergeBlock?: any; boothSummaries?: any[] }> {
    // ── Step 1: Merge — write MERGE block to master chain ──
    let mergeBlock: any;
    let boothSummaries: any[] = [];
    try {
      const result = await localBlockchain.mergeBoothChains(electionId);
      mergeBlock = result;
      boothSummaries = result.boothSummaries;
      console.info(`[apiService] MERGE block written: #${result.index} — masterMerkleRoot: ${result.data.payload.masterMerkleRoot?.slice(0, 16)}…`);
    } catch (e) {
      console.warn('[apiService] mergeBoothChains failed (no booth vote blocks yet?):', e);
    }

    // ── Step 2: Upload votes to Supabase ──
    const voteBlocks = await localBlockchain.getVoteBlocksByElection(electionId);

    function hashToUUID(hash: string): string {
      return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
    }

    let publishedCount = 0;
    for (const block of voteBlocks) {
      try {
        const vote: VoteRecord = {
          id: hashToUUID(block.hash),
          electionId: block.data.payload.electionId,
          voterId: block.data.payload.voterId,
          candidateId: block.data.payload.candidateId,
          blockHash: block.hash,
          blockIndex: block.index,
          timestamp: block.data.payload.timestamp || block.timestamp,
        };
        await voteDB.save(vote);
        publishedCount++;
      } catch (e) {
        console.error('[apiService] Failed to publish vote', block.hash, e);
      }
    }

    return { success: publishedCount > 0 || !!mergeBlock, publishedVotes: publishedCount, mergeBlock, boothSummaries };
  },

  // ===== Admin Operations =====
  async verifyAdminPin(pin: string): Promise<boolean> {
    return adminDB.verifyPin(pin);
  },

  // ===== Booth Management (IndexedDB) =====
  async saveBooth(booth: BoothRecord): Promise<void> {
    return boothDB.save(booth);
  },

  async deleteBooth(id: string): Promise<void> {
    return boothDB.delete(id);
  },

  async assignVoterToBooth(boothId: string, voterId: string): Promise<void> {
    return boothVoterDB.assign(voterId, boothId);
  },

  async unassignVoterFromBooth(voterId: string): Promise<void> {
    return boothVoterDB.unassign(voterId);
  },

  async assignElectionToBooth(boothId: string, electionId: string): Promise<void> {
    await boothElectionDB.assign(boothId, electionId);
    // Fork the booth sub-chain for this election so it's anchored to master chain tip NOW
    try {
      await localBlockchain.forkForBooth(boothId, electionId);
      console.info(`[apiService] Booth ${boothId} forked for election ${electionId}`);
    } catch (e) {
      console.warn('[apiService] Fork failed (non-fatal, will auto-fork on first vote):', e);
    }
  },

  async unassignElectionFromBooth(boothId: string, electionId: string): Promise<void> {
    return boothElectionDB.unassign(boothId, electionId);
  },

  /** Get booth details with assigned voters, elections, and vote stats */
  async getBoothDetails(): Promise<any[]> {
    const booths = await boothDB.getAll();
    const result: any[] = [];

    for (const booth of booths) {
      const voters = await boothVoterDB.getByBooth(booth.id);
      const elections = await boothElectionDB.getByBooth(booth.id);
      
      // Count votes for this booth from the blockchain
      const allVoteBlocks = await localBlockchain.getVoteBlocks();
      const boothVoteBlocks = allVoteBlocks.filter(b => b.data.payload.boothId === booth.id);

      result.push({
        booth_id: booth.id,
        name: booth.name,
        constituency: booth.constituency,
        assigned_voters: voters.map(v => v.voterId),
        assigned_elections: elections.map(e => e.electionId),
        blocks: boothVoteBlocks.length + 1, // +1 for genesis
        total_votes: boothVoteBlocks.length,
        is_valid: true,
      });
    }

    return result;
  },

  // ===== Blockchain Operations =====
  async verifyBlockchain() {
    const res = await localBlockchain.verifyChain();
    return res.valid;
  },

  async getBlockchain() {
    return localBlockchain.getChain();
  },

  async getBlockByHash(hash: string) {
    return localBlockchain.getBlockByHash(hash);
  },

  async getBlockCount() {
    return localBlockchain.getBlockCount();
  },

  async getBlockchainStatus(): Promise<{ blockCount: number; isValid: boolean; merkleRoot: string }> {
    try {
      const blockCount = await localBlockchain.getBlockCount();
      const verifyRes = await localBlockchain.verifyChain();
      const merkle = await localBlockchain.getMerkleRoot();

      return {
        blockCount,
        isValid: verifyRes.valid,
        merkleRoot: merkle.merkleRoot,
      };
    } catch (e) {
      console.warn('[apiService] Failed to get blockchain status:', e);
      return { blockCount: 0, isValid: false, merkleRoot: '' };
    }
  },

  // ===== Distributed Booth Sub-Chain & Merge Operations =====
  async forkBoothChain(boothId: string, electionId?: string) {
    return localBlockchain.forkForBooth(boothId, electionId);
  },

  async getBoothChain(boothId: string) {
    return localBlockchain.getBoothChain(boothId);
  },

  async getBoothChainSummary(boothId: string, electionId?: string) {
    return localBlockchain.getBoothChainSummary(boothId, electionId);
  },

  async verifyBoothChain(boothId: string) {
    return localBlockchain.verifyBoothChain(boothId);
  },

  async mergeBoothChains(electionId: string) {
    return localBlockchain.mergeBoothChains(electionId);
  },

  async getMasterChain() {
    return localBlockchain.getMasterChain();
  },

  async verifyMasterChain() {
    return localBlockchain.verifyMasterChain();
  },

  async exportBoothPackage(boothId: string, electionId?: string) {
    return localBlockchain.exportBoothPackage(boothId, electionId);
  },

  async importBoothPackage(pkg: any) {
    return localBlockchain.importBoothPackage(pkg);
  },
};
