// Zustand store for BioChain Vote global state
import { create } from 'zustand';
import type { Voter, ElectionRecord, CandidateRecord, VoteRecord } from '@/services/dbService';

// Re-export DB types for convenience
export type { Voter, ElectionRecord, CandidateRecord, VoteRecord };

export interface VoteReceipt {
  id: string;
  electionId: string;
  electionTitle: string;
  candidateId: string;
  candidateName: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  status: 'confirmed' | 'pending' | 'failed';
  // Real crypto fields
  merkleRoot?: string;
  merkleProof?: { hash: string; position: 'left' | 'right' }[];
  commitment?: string;
  commitmentNonce?: string;
  signature?: string;
  signerAddress?: string;
}


export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  provider: string | null;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  isAdmin: boolean;
  currentVoter: Voter | null;
  setCurrentVoter: (voter: Voter | null) => void;
  setAuthenticated: (auth: boolean) => void;
  setAdmin: (isAdmin: boolean) => void;

  // Wallet
  wallet: WalletState;
  setWallet: (wallet: Partial<WalletState>) => void;

  // Elections (cached in memory from IndexedDB)
  elections: ElectionRecord[];
  setElections: (elections: ElectionRecord[]) => void;

  // current election context
  currentElectionId: string | null;
  setCurrentElectionId: (id: string | null) => void;

  // Vote history
  voteReceipts: VoteReceipt[];
  addVoteReceipt: (receipt: VoteReceipt) => void;
  setVoteReceipts: (receipts: VoteReceipt[]) => void;

  // UI
  currentTheme: 'dark' | 'light';
  toggleTheme: () => void;

  // DB initialized flag
  dbInitialized: boolean;
  setDbInitialized: (init: boolean) => void;

  // Logout
  logout: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  isAuthenticated: false,
  isAdmin: false,
  currentVoter: null,
  setCurrentVoter: (currentVoter) => set({ currentVoter }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setAdmin: (isAdmin) => set({ isAdmin }),

  // Wallet
  wallet: { connected: false, address: null, chainId: null, provider: null },
  setWallet: (walletUpdate) => set((state) => ({ wallet: { ...state.wallet, ...walletUpdate } })),

  // Elections
  elections: [],
  setElections: (elections) => set({ elections }),

  // Current election
  currentElectionId: null,
  setCurrentElectionId: (currentElectionId) => set({ currentElectionId }),

  // Vote history
  voteReceipts: [],
  addVoteReceipt: (receipt) => set((state) => ({ voteReceipts: [...state.voteReceipts, receipt] })),
  setVoteReceipts: (voteReceipts) => set({ voteReceipts }),

  // UI
  currentTheme: 'light',
  toggleTheme: () => set((state) => ({ currentTheme: state.currentTheme === 'dark' ? 'light' : 'dark' })),

  // DB
  dbInitialized: false,
  setDbInitialized: (dbInitialized) => set({ dbInitialized }),

  // Logout
  logout: () => set({
    isAuthenticated: false,
    isAdmin: false,
    currentVoter: null,
    voteReceipts: [],
    currentElectionId: null,
  }),
}));
