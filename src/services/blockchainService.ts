// Mocked Blockchain Service — ready for real ethers.js integration

import type { VoteReceipt } from '@/store/useAppStore';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const randomHash = () =>
  '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export const blockchainService = {
  /** Connect wallet (mocked) */
  async connectWallet(provider: 'metamask' | 'trustwallet'): Promise<{ address: string; chainId: number }> {
    await delay(1500);
    return {
      address: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
      chainId: 137, // Polygon
    };
  },

  /** Submit vote transaction (mocked) */
  async submitVote(electionId: string, encryptedVote: string): Promise<VoteReceipt> {
    await delay(3000);
    return {
      id: crypto.randomUUID(),
      electionId,
      electionTitle: '',
      transactionHash: randomHash(),
      blockNumber: 45_000_000 + Math.floor(Math.random() * 100_000),
      timestamp: new Date().toISOString(),
      status: 'confirmed',
      zkProofId: randomHash().slice(0, 18),
    };
  },

  /** Verify vote inclusion (mocked) */
  async verifyVote(txHash: string): Promise<{
    included: boolean;
    blockNumber: number;
    merkleRoot: string;
    proof: string[];
  }> {
    await delay(2000);
    return {
      included: true,
      blockNumber: 45_000_000 + Math.floor(Math.random() * 100_000),
      merkleRoot: randomHash(),
      proof: [randomHash(), randomHash(), randomHash()],
    };
  },

  /** Get election results (mocked) */
  async getEncryptedTally(electionId: string): Promise<{ encryptedTally: string; participationRate: number }> {
    await delay(1000);
    return {
      encryptedTally: randomHash(),
      participationRate: 0.65 + Math.random() * 0.2,
    };
  },
};
