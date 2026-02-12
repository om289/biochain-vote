// Mocked Biometric Service — ready for real WebAuthn/FIDO2 integration

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface BiometricResult {
  success: boolean;
  method: 'fingerprint' | 'pin';
  credentialId?: string;
}

export const biometricService = {
  /** Check if WebAuthn is available */
  isWebAuthnAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.PublicKeyCredential;
  },

  /** Register biometric credential (mocked) */
  async registerBiometric(): Promise<BiometricResult> {
    await delay(2500);
    return {
      success: true,
      method: 'fingerprint',
      credentialId: crypto.randomUUID(),
    };
  },

  /** Authenticate with biometric (mocked) */
  async authenticate(): Promise<BiometricResult> {
    await delay(2000);
    return {
      success: true,
      method: 'fingerprint',
      credentialId: crypto.randomUUID(),
    };
  },

  /** Verify PIN fallback (mocked) */
  async verifyPin(pin: string): Promise<BiometricResult> {
    await delay(1000);
    return {
      success: pin.length >= 4,
      method: 'pin',
    };
  },
};
