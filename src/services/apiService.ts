// Mocked API Service — ready for real backend integration

import type { Election, Candidate, Trustee, User } from '@/store/useAppStore';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const apiService = {
  /** Login (mocked) */
  async login(biometricToken: string): Promise<User> {
    await delay(1000);
    return {
      id: 'user-001',
      name: 'Alex Morgan',
      email: 'alex.morgan@email.com',
      did: 'did:biochain:a1b2c3d4e5f6...',
      verificationLevel: 'verified',
      biometricRegistered: true,
      createdAt: '2025-06-01T00:00:00Z',
    };
  },

  /** Get elections (mocked) */
  async getElections(): Promise<Election[]> {
    await delay(600);
    return [
      {
        id: 'elec-001',
        title: '2026 Federal Election',
        description: 'National presidential and parliamentary election.',
        status: 'active',
        startDate: '2026-02-10T00:00:00Z',
        endDate: '2026-02-15T23:59:59Z',
        candidateCount: 5,
        totalVoters: 1_200_000,
        votesCast: 487_320,
      },
      {
        id: 'elec-002',
        title: 'State Assembly Vote',
        description: 'State-level assembly representative election.',
        status: 'upcoming',
        startDate: '2026-03-01T00:00:00Z',
        endDate: '2026-03-05T23:59:59Z',
        candidateCount: 8,
        totalVoters: 350_000,
        votesCast: 0,
      },
      {
        id: 'elec-003',
        title: '2025 Municipal Election',
        description: 'City council and mayoral election.',
        status: 'completed',
        startDate: '2025-11-01T00:00:00Z',
        endDate: '2025-11-05T23:59:59Z',
        candidateCount: 12,
        totalVoters: 85_000,
        votesCast: 62_340,
      },
    ];
  },

  /** Get candidates for an election (mocked) */
  async getCandidates(electionId: string): Promise<Candidate[]> {
    await delay(500);
    return [
      { id: 'c1', name: 'Sarah Chen', party: 'Progressive Alliance', platform: 'Digital infrastructure, green energy, education reform', photoUrl: '' },
      { id: 'c2', name: 'James Okonkwo', party: 'Unity Front', platform: 'Economic growth, security, healthcare', photoUrl: '' },
      { id: 'c3', name: 'Maria Gonzalez', party: 'People\'s Voice', platform: 'Social justice, housing, workers\' rights', photoUrl: '' },
      { id: 'c4', name: 'David Kim', party: 'Innovation Party', platform: 'Technology, transparency, blockchain governance', photoUrl: '' },
      { id: 'c5', name: 'Amara Osei', party: 'Independent', platform: 'Anti-corruption, civil liberties, decentralization', photoUrl: '' },
    ];
  },

  /** Get trustees (mocked) */
  async getTrustees(): Promise<Trustee[]> {
    await delay(500);
    return [
      { id: 't1', name: 'Dr. Elena Vasquez', keyShareSubmitted: true, submittedAt: '2026-02-12T10:30:00Z' },
      { id: 't2', name: 'Prof. Hiroshi Tanaka', keyShareSubmitted: true, submittedAt: '2026-02-12T11:15:00Z' },
      { id: 't3', name: 'Justice Amina Diallo', keyShareSubmitted: true, submittedAt: '2026-02-12T12:00:00Z' },
      { id: 't4', name: 'Cmdr. Robert Hale', keyShareSubmitted: false },
      { id: 't5', name: 'Dr. Priya Sharma', keyShareSubmitted: false },
    ];
  },
};
