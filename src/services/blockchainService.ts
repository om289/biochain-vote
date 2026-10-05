/**
 * blockchainService.ts — Offline-First Implementation for BioChain Vote
 *
 * Features:
 *   1. Real MetaMask wallet connect (ethers.js BrowserProvider)
 *   2. Real ECDSA vote signing via MetaMask personal_sign
 *   3. Real Merkle proof verification (SHA-256, client-side, local data)
 *   4. Zero-knowledge vote commitment (hash-based commit-reveal, local data)
 *   5. Real chain data from IndexedDB
 */

import { ethers } from 'ethers';
import { localBlockchain } from './localBlockchain';
import { zkCommitmentDB } from './dbService';
import type { MerkleProofStep } from './localBlockchain';

// ─── SHA-256 Helper (Web Crypto API) ────────────────────────────────────────

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MerkleVerificationResult {
  included: boolean;
  leafHash: string;
  merkleRoot: string;
  proof: MerkleProofStep[];
  blockCount: number;
}

export interface VoteCommitment {
  commitment: string;
  nonce: string;
  candidateId: string;
  timestamp: string;
}

export interface VoteSignature {
  message: string;
  signature: string;
  signerAddress: string;
}

// ─── Wallet Connect (Real MetaMask) ─────────────────────────────────────────

async function getEthereumProvider(): Promise<ethers.BrowserProvider> {
  // Check for MetaMask or any injected provider
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error(
      'No Ethereum wallet detected. Please install MetaMask (https://metamask.io) to use wallet features.'
    );
  }
  return new ethers.BrowserProvider(ethereum);
}

// ─── Exported Service ───────────────────────────────────────────────────────

export const blockchainService = {

  /**
   * Connect to MetaMask wallet.
   * Requests account access and returns the real wallet address and chain ID.
   */
  async connectWallet(
    provider: 'metamask' | 'trustwallet',
  ): Promise<{ address: string; chainId: number }> {
    const ethereum = (window as any).ethereum;

    if (!ethereum) {
      throw new Error(
        `${provider === 'metamask' ? 'MetaMask' : 'Trust Wallet'} not detected. ` +
        'Please install the browser extension and try again.'
      );
    }

    // For Trust Wallet, check if it's the active provider
    if (provider === 'trustwallet' && !ethereum.isTrust) {
      throw new Error(
        'Trust Wallet not detected. Please open this page in the Trust Wallet browser.'
      );
    }

    const ethersProvider = new ethers.BrowserProvider(ethereum);

    // Request account access — this triggers the MetaMask popup
    const accounts = await ethersProvider.send('eth_requestAccounts', []);

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock your wallet and try again.');
    }

    const network = await ethersProvider.getNetwork();

    return {
      address: accounts[0],
      chainId: Number(network.chainId),
    };
  },

  /**
   * Sign a vote payload using MetaMask personal_sign.
   * Creates an ECDSA signature binding the voter's wallet to their vote.
   */
  async signVote(
    electionId: string,
    candidateId: string,
    voterId: string,
  ): Promise<VoteSignature> {
    const ethersProvider = await getEthereumProvider();
    const signer = await ethersProvider.getSigner();
    const address = await signer.getAddress();

    // Construct the message to sign
    const timestamp = new Date().toISOString();
    const message = [
      'BioChain Vote — Digital Signature',
      `Election: ${electionId}`,
      `Candidate: ${candidateId}`,
      `Voter: ${voterId}`,
      `Timestamp: ${timestamp}`,
      '',
      'By signing this message, I confirm my vote.',
    ].join('\n');

    // Sign using MetaMask — this triggers the signing popup
    const signature = await signer.signMessage(message);

    return {
      message,
      signature,
      signerAddress: address,
    };
  },

  /**
   * Verify a vote's inclusion in the blockchain using a real Merkle proof.
   * Uses local blockchain data (IndexedDB).
   */
  async verifyVote(txHash: string): Promise<MerkleVerificationResult> {
    const proofData = await localBlockchain.getMerkleProof(txHash);
    const rootData = await localBlockchain.getMerkleRoot();

    return {
      included: proofData.found && proofData.verified,
      leafHash: proofData.leafHash,
      merkleRoot: proofData.merkleRoot,
      proof: proofData.proof,
      blockCount: rootData.chainLength,
    };
  },

  /**
   * Create a zero-knowledge vote commitment.
   * Generates: commitment = SHA256(candidateId + nonce)
   * The nonce is kept secret by the voter. Later, revealing the nonce proves
   * they voted for that candidate without having exposed it during voting.
   */
  async createVoteCommitment(
    candidateId: string,
    voterId: string,
    electionId: string,
  ): Promise<VoteCommitment> {
    // Generate a cryptographically secure random nonce
    const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
    const nonce = Array.from(nonceBytes, b => b.toString(16).padStart(2, '0')).join('');

    // Compute: commitment = SHA256(candidateId + nonce)
    const commitment = await sha256(candidateId + nonce);

    // Submit the commitment to IndexedDB (without revealing candidateId or nonce)
    await zkCommitmentDB.save({
      id: `${voterId}:${electionId}`,
      voterId,
      electionId,
      commitment,
      revealed: false,
      createdAt: new Date().toISOString(),
    });

    return {
      commitment,
      nonce,
      candidateId,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Verify a zero-knowledge commitment by revealing the preimage.
   * Proves the voter voted for a specific candidate by revealing the nonce.
   */
  async verifyCommitment(
    voterId: string,
    electionId: string,
    candidateId: string,
    nonce: string,
  ): Promise<{ valid: boolean; storedCommitment: string; recomputed: string }> {
    const record = await zkCommitmentDB.getByVoterElection(voterId, electionId);
    if (!record) {
      throw new Error('Commitment not found for this voter and election.');
    }

    const recomputed = await sha256(candidateId + nonce);
    const valid = recomputed === record.commitment;

    if (valid && !record.revealed) {
      // Mark as revealed
      await zkCommitmentDB.save({ ...record, revealed: true });
    }

    return {
      valid,
      storedCommitment: record.commitment,
      recomputed,
    };
  },

  /**
   * Get the current Merkle root of the blockchain.
   */
  async getMerkleRoot(): Promise<{ merkleRoot: string; leafCount: number; chainLength: number }> {
    return localBlockchain.getMerkleRoot();
  },

  /**
   * Get real election participation data from the local blockchain.
   */
  async getElectionStats(
    electionId: string,
  ): Promise<{ totalVotes: number; participationRate: number; chainLength: number }> {
    const chainLength = await localBlockchain.getBlockCount();
    const voteBlocks = await localBlockchain.getVoteBlocksByElection(electionId);
    const totalVotes = voteBlocks.length;
    const allVoteBlocks = await localBlockchain.getVoteBlocks();
    
    return {
      totalVotes,
      participationRate: allVoteBlocks.length > 0 ? totalVotes / allVoteBlocks.length : 0,
      chainLength,
    };
  },

  /**
   * Check if MetaMask is available in the browser.
   */
  isWalletAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).ethereum;
  },

  /**
   * Recover the signer address from a signed message (for verification).
   */
  recoverSigner(message: string, signature: string): string {
    return ethers.verifyMessage(message, signature);
  },
};
