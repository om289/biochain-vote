// biometricService.ts — NITGEN fingerprint scanner integration for BioChain Vote
//
// All fingerprint templates are stored in Supabase voters.fingerprint_template.
// The local Flask service (http://127.0.0.1:5000) drives the NITGEN SDK.

import { voterDB, type Voter } from './dbService';

const FLASK_URL = 'http://127.0.0.1:5000';

export interface BiometricResult {
  success: boolean;
  method: 'fingerprint';
  voter?: Voter;
  error?: string;
}

// ── Flask API helpers ──────────────────────────────────────────────────────

/** Enroll a voter's fingerprint. Captures and stores in Supabase via Flask. */
export async function fingerprintEnroll(
  voterId: string,
): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
  try {
    const res = await fetch(`${FLASK_URL}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_id: voterId }),
    });
    const result = await res.json();
    if (res.ok) return { success: true, simulated: result.status === 'enrolled_simulated' };
    return { success: false, error: result.error || 'Enrollment failed.' };
  } catch {
    return { success: false, error: 'Fingerprint scanner service not reachable. Make sure it is running.' };
  }
}

/** Verify a voter's fingerprint against Supabase-stored template. */
export async function fingerprintVerify(
  voterId: string,
): Promise<{ match: boolean; simulated?: boolean; error?: string }> {
  try {
    const res = await fetch(`${FLASK_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voter_id: voterId }),
    });
    const result = await res.json();
    if (res.ok) return { match: result.match, simulated: result.simulated };
    return { match: false, error: result.error || 'Verification failed.' };
  } catch {
    return { match: false, error: 'Fingerprint scanner service not reachable.' };
  }
}

/** Check if the Flask fingerprint service is available. */
export async function isFingerprintServiceAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${FLASK_URL}/status`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch {
    return false;
  }
}

// ── Main service ──────────────────────────────────────────────────────────

export const biometricService = {
  /** Returns true if the Flask scanner service is reachable. */
  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    return isFingerprintServiceAvailable();
  },

  /** Re-verify a voter's fingerprint before a critical action (e.g., casting vote). */
  async reVerify(voterId: string): Promise<BiometricResult> {
    const voter = await voterDB.getById(voterId);
    if (!voter) {
      return { success: false, method: 'fingerprint', error: 'Voter not found.' };
    }
    const result = await fingerprintVerify(voter.id);
    if (result.match) return { success: true, method: 'fingerprint', voter };
    return {
      success: false,
      method: 'fingerprint',
      error: result.error || 'Fingerprint verification failed. Please try again.',
    };
  },

  /** Not used — return an informative message. */
  async verifyWithTouchID(): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Please select your identity from the voter list first.' };
  },
};
