// Mocked SSI (Self-Sovereign Identity) Service

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface SSICredential {
  did: string;
  issuanceDate: string;
  expiryDate: string;
  verificationStatus: 'valid' | 'expired' | 'revoked' | 'pending';
  credentialType: string;
  issuer: string;
}

export const ssiService = {
  /** Generate DID (mocked) */
  async generateDID(): Promise<string> {
    await delay(1500);
    const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `did:biochain:${id}`;
  },

  /** Get stored credentials (mocked) */
  async getCredentials(): Promise<SSICredential[]> {
    await delay(800);
    return [
      {
        did: 'did:biochain:a1b2c3d4e5f6...',
        issuanceDate: '2025-01-15',
        expiryDate: '2027-01-15',
        verificationStatus: 'valid',
        credentialType: 'VoterIdentity',
        issuer: 'National Election Authority',
      },
    ];
  },

  /** Export credential (mocked) */
  async exportCredential(did: string): Promise<string> {
    await delay(1000);
    return JSON.stringify({ did, exported: true, timestamp: new Date().toISOString() });
  },

  /** Generate QR code data for credential sharing */
  getQRData(did: string): string {
    return `biochain://verify/${did}`;
  },
};
