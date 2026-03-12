// Biometric Service — Touch ID as verification gate + simulation fallback
//
// How it works:
//   Touch ID on macOS can only confirm "an authorized fingerprint was used" —
//   it CANNOT distinguish between different people's fingers.
//   So we use it as a LIVENESS / VERIFICATION gate:
//     1. Voter identifies themselves (selects from list or enters Aadhaar)
//     2. Touch ID confirms a real person is authorizing the action
//   This is two-factor: something you know (your ID) + something you are (fingerprint).

import { voterDB, type Voter } from './dbService';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BiometricResult {
  success: boolean;
  method: 'touchid' | 'fingerprint' | 'pin';
  voter?: Voter;
  error?: string;
}

// ── WebAuthn helper for Touch ID ────────────────────────────────────

const RP_NAME = 'BioChain Vote';

/**
 * Trigger a Touch ID prompt using WebAuthn.
 * This doesn't identify anyone — it just proves a real person is present.
 * Returns true if the fingerprint was verified, false if cancelled/failed.
 */
async function triggerTouchID(): Promise<{ success: boolean; error?: string }> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    // We use a "create" flow with a throwaway credential —
    // the credential is never stored or reused. We only care that
    // the user successfully touched the sensor.
    // 
    // Alternatively we could use a persistent credential, but for a
    // pure liveness check this is simpler and doesn't pollute the keychain.
    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: RP_NAME, id: window.location.hostname },
        user: {
          // Random user each time — we don't care about the credential
          id: crypto.getRandomValues(new Uint8Array(16)),
          name: `voter-${Date.now()}`,
          displayName: 'BioChain Voter Verification',
        },
        challenge,
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Force Touch ID
          userVerification: 'required',        // Must use biometric
          residentKey: 'discouraged',          // Don't save to keychain
        },
        timeout: 60000,
        attestation: 'none', // We don't need attestation
      },
    });

    return { success: !!credential };
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      return { success: false, error: 'Touch ID was cancelled or timed out.' };
    }
    if (err?.name === 'InvalidStateError') {
      // Credential already exists — this is fine for our use case
      // Try with navigator.credentials.get() as fallback
      return await triggerTouchIDGet();
    }
    return { success: false, error: err?.message || 'Touch ID verification failed.' };
  }
}

/**
 * Alternative Touch ID trigger using credentials.get() with an empty allowCredentials.
 * Some browsers support this for platform authenticators.
 */
async function triggerTouchIDGet(): Promise<{ success: boolean; error?: string }> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [], // Empty = let the authenticator pick
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return { success: !!assertion };
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') {
      return { success: false, error: 'Touch ID was cancelled or timed out.' };
    }
    return { success: false, error: err?.message || 'Touch ID verification failed.' };
  }
}

// ── Main service ────────────────────────────────────────────────────

export const biometricService = {
  /** Check if WebAuthn is available in the browser */
  isWebAuthnAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  },

  /** Check if the device has Touch ID / platform authenticator */
  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isWebAuthnAvailable()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  },

  /**
   * Verify with Touch ID — pure liveness check.
   * Prompts the native Touch ID dialog. Returns success/failure.
   * Does NOT identify the user — just proves a real person is present.
   */
  async verifyWithTouchID(): Promise<{ success: boolean; error?: string }> {
    const hasPlatform = await this.isPlatformAuthenticatorAvailable();
    if (!hasPlatform) {
      return { success: false, error: 'Touch ID is not available on this device.' };
    }
    return triggerTouchID();
  },

  /**
   * Authenticate a voter by index (for "Select Voter" demo flow).
   * Step 1: Find the voter in DB
   * Step 2: Verify with Touch ID (if available)
   * If Touch ID isn't available, falls back to simulation.
   */
  async authenticate(voterIndex?: number): Promise<BiometricResult> {
    // Get voters from DB
    const voters = await voterDB.getAll();
    if (voters.length === 0) {
      return {
        success: false,
        method: 'fingerprint',
        error: 'No registered voters found. Please register voters first via the Admin panel.',
      };
    }

    const idx = voterIndex !== undefined ? voterIndex : 0;
    const voter = voters[idx % voters.length];

    // Try Touch ID verification
    const hasPlatform = await this.isPlatformAuthenticatorAvailable();
    if (hasPlatform) {
      const touchResult = await triggerTouchID();
      if (!touchResult.success) {
        return {
          success: false,
          method: 'touchid',
          error: touchResult.error || 'Touch ID verification failed.',
        };
      }
      return { success: true, method: 'touchid', voter };
    }

    // Fallback: simulated scan
    await delay(2500);
    return { success: true, method: 'fingerprint', voter };
  },

  /**
   * Authenticate by Aadhaar number.
   * Looks up voter, then verifies with Touch ID.
   */
  async authenticateByAadhaar(aadhaar: string): Promise<BiometricResult> {
    const voter = await voterDB.getByAadhaar(aadhaar);
    if (!voter) {
      return {
        success: false,
        method: 'fingerprint',
        error: 'No voter found with this Aadhaar number.',
      };
    }

    const hasPlatform = await this.isPlatformAuthenticatorAvailable();
    if (hasPlatform) {
      const touchResult = await triggerTouchID();
      if (!touchResult.success) {
        return {
          success: false,
          method: 'touchid',
          error: touchResult.error || 'Touch ID verification cancelled.',
        };
      }
      return { success: true, method: 'touchid', voter };
    }

    await delay(2000);
    return { success: true, method: 'fingerprint', voter };
  },

  /**
   * Re-verify identity before a critical action (e.g., casting a vote).
   * Triggers Touch ID if available, otherwise simulated.
   */
  async reVerify(voterId: string): Promise<BiometricResult> {
    const voter = await voterDB.getById(voterId);
    if (!voter) {
      return { success: false, method: 'fingerprint', error: 'Voter not found in the system.' };
    }

    const hasPlatform = await this.isPlatformAuthenticatorAvailable();
    if (hasPlatform) {
      const touchResult = await triggerTouchID();
      if (!touchResult.success) {
        return {
          success: false,
          method: 'touchid',
          error: touchResult.error || 'Touch ID verification failed. Please try again.',
        };
      }
      return { success: true, method: 'touchid', voter };
    }

    // Fallback
    await delay(1500);
    return { success: true, method: 'fingerprint', voter };
  },

  /** Verify PIN fallback */
  async verifyPin(pin: string): Promise<BiometricResult> {
    await delay(1000);

    try {
      const voters = await voterDB.getAll();
      const voter = voters.find(v => v.aadhaarNumber.slice(0, 4) === pin || v.aadhaarNumber.slice(-4) === pin);

      if (voter) {
        return { success: true, method: 'pin', voter };
      }

      return {
        success: false,
        method: 'pin',
        error: 'Invalid PIN. Use the first or last 4 digits of your Aadhaar number.',
      };
    } catch {
      return { success: false, method: 'pin', error: 'PIN verification failed.' };
    }
  },
};
