// Zustand store for BioChain Vote global state
import { create } from 'zustand';

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  did: string; // Decentralized Identifier
  verificationLevel: 'basic' | 'verified' | 'full';
  biometricRegistered: boolean;
  createdAt: string;
}

export interface Election {
  id: string;
  title: string;
  description: string;
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  candidateCount: number;
  totalVoters: number;
  votesCast: number;
}

export interface Candidate {
  id: string;
  name: string;
  party: string;
  platform: string;
  photoUrl: string;
}

export interface VoteReceipt {
  id: string;
  electionId: string;
  electionTitle: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: string;
  status: 'confirmed' | 'pending' | 'failed';
  zkProofId: string;
}

export interface Trustee {
  id: string;
  name: string;
  keyShareSubmitted: boolean;
  submittedAt?: string;
}

export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  provider: string | null; // 'metamask' | 'trustwallet' | null
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  user: User | null;
  setUser: (user: User | null) => void;
  setAuthenticated: (auth: boolean) => void;

  // Wallet
  wallet: WalletState;
  setWallet: (wallet: Partial<WalletState>) => void;

  // Elections
  elections: Election[];
  setElections: (elections: Election[]) => void;

  // Vote history
  voteReceipts: VoteReceipt[];
  addVoteReceipt: (receipt: VoteReceipt) => void;

  // Trustees
  trustees: Trustee[];
  setTrustees: (trustees: Trustee[]) => void;
  updateTrustee: (id: string, update: Partial<Trustee>) => void;

  // UI
  currentTheme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Auth
  isAuthenticated: false,
  user: null,
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),

  // Wallet
  wallet: { connected: false, address: null, chainId: null, provider: null },
  setWallet: (walletUpdate) => set((state) => ({ wallet: { ...state.wallet, ...walletUpdate } })),

  // Elections
  elections: [],
  setElections: (elections) => set({ elections }),

  // Vote history
  voteReceipts: [],
  addVoteReceipt: (receipt) => set((state) => ({ voteReceipts: [...state.voteReceipts, receipt] })),

  // Trustees
  trustees: [],
  setTrustees: (trustees) => set({ trustees }),
  updateTrustee: (id, update) => set((state) => ({
    trustees: state.trustees.map((t) => (t.id === id ? { ...t, ...update } : t)),
  })),

  // UI
  currentTheme: 'dark',
  toggleTheme: () => set((state) => ({ currentTheme: state.currentTheme === 'dark' ? 'light' : 'dark' })),
}));
