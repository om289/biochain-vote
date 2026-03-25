// API Service — IndexedDB-backed offline data layer for BioChain Vote

import { voterDB, electionDB, candidateDB, voteDB, adminDB, seedDemoData, type Voter, type ElectionRecord, type CandidateRecord, type VoteRecord } from './dbService';

export const apiService = {
  /**
   * Initialize local IndexedDB stores (elections, candidates, admin PIN).
   * Voters and votes are managed by Supabase — no seeding needed here.
   */
  async initialize(): Promise<void> {
    try {
      await seedDemoData();
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
    const all = await electionDB.getAll();
    return all.filter(e => e.constituency === voter.constituency || e.state === voter.state);
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
    return voteDB.hasVoted(electionId, voterId);
  },

  async castVote(electionId: string, voterId: string, candidateId: string, candidateName?: string, boothId?: string): Promise<VoteRecord> {
    // Check if already voted via Supabase voters.has_voted
    const alreadyVoted = await voterDB.hasVoted(voterId);
    if (alreadyVoted) {
      throw new Error('You have already voted. Double voting is not allowed.');
    }

    // Build the vote record
    const voteId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Send to Python Blockchain
    const flaskUrl = `http://${window.location.hostname}:5000`;
    const endpoint = boothId ? `${flaskUrl}/api/booths/${boothId}/votes` : `${flaskUrl}/api/votes`;
    
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voter_id: voterId,
        candidate_id: candidateId,
        election_id: electionId
      })
    });
    
    if (!res.ok) {
      throw new Error('Failed to record vote on the blockchain. Backend may be down.');
    }
    
    const blockData = await res.json();

    const vote: VoteRecord = {
      id: crypto.randomUUID(),
      electionId,
      voterId,
      candidateId,
      blockHash: blockData.block_hash,
      blockIndex: blockData.block_index,
      timestamp,
    };

    // Save to Supabase votes table — store candidateName for readability
    const voteForSupabase = { ...vote, candidateId: candidateName || candidateId };
    await voteDB.save(voteForSupabase);

    // Mark voter as voted in Supabase (prevents double voting)
    await voterDB.markVoted(voterId);

    return vote;
  },

  async getVotesByElection(electionId: string): Promise<VoteRecord[]> {
    return voteDB.getByElection(electionId);
  },

  async getVotesByVoter(voterId: string): Promise<VoteRecord[]> {
    try {
      const flaskUrl = `http://${window.location.hostname}:5000`;
      const res = await fetch(`${flaskUrl}/api/voter/${voterId}/votes`);
      if (res.ok) {
        const data = await res.json();
        return data.votes || [];
      }
    } catch (e) {
      console.error("Failed to fetch votes from blockchain", e);
    }
    return [];
  },

  async getVoteCountByElection(electionId: string): Promise<number> {
    return voteDB.countByElection(electionId);
  },

  /** Get election results with candidate vote counts */
  async getElectionResults(electionId: string): Promise<{
    candidate: CandidateRecord;
    voteCount: number;
    percentage: number;
  }[]> {
    const candidates = await candidateDB.getByElection(electionId);
    const votes = await voteDB.getByElection(electionId);
    const totalVotes = votes.length;

    const results = candidates.map(candidate => {
      const voteCount = votes.filter(v => v.candidateId === candidate.id).length;
      return {
        candidate,
        voteCount,
        percentage: totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0,
      };
    });

    return results.sort((a, b) => b.voteCount - a.voteCount);
  },

  // ===== Admin Operations =====
  async verifyAdminPin(pin: string): Promise<boolean> {
    return adminDB.verifyPin(pin);
  },

  // ===== Blockchain Operations =====
  async verifyBlockchain() {
    const flaskUrl = `http://${window.location.hostname}:5000`;
    const res = await fetch(`${flaskUrl}/api/blocks`);
    const data = await res.json();
    return data.is_valid;
  },

  async getBlockchain() {
    const flaskUrl = `http://${window.location.hostname}:5000`;
    const res = await fetch(`${flaskUrl}/api/blocks`);
    const data = await res.json();
    return data.chain;
  },

  async getBlockByHash(hash: string) {
    const chain = await this.getBlockchain();
    return chain.find((c: any) => c.hash === hash || c.previous_hash === hash);
  },

  async getBlockCount() {
    const flaskUrl = `http://${window.location.hostname}:5000`;
    const res = await fetch(`${flaskUrl}/api/blocks`);
    const data = await res.json();
    return data.length;
  },
};

// Helper: SHA-256 hash
async function sha256Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
