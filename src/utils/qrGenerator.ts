import QRCode from 'qrcode';

/** Build compact, SHA-256 signed voter QR payload */
async function buildVoterPayload(voterId: string, name: string, constituency: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(voterId + name + constituency);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hash = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return JSON.stringify({ type: 'voter', id: voterId, hash });
}

/**
 * Generate a real, scannable QR code as a data URL.
 * Returns a black-and-white PNG data URL.
 */
export async function generateQRDataURL(text: string, size: number = 200): Promise<string> {
  return QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Generate a voter-specific QR with SHA-256 hash payload.
 * Use this for voter identity cards and admin voter QR dialogs.
 */
export async function generateVoterQRDataURL(
  voterId: string,
  name: string,
  constituency: string,
  size: number = 200,
): Promise<string> {
  const payload = await buildVoterPayload(voterId, name, constituency);
  return generateQRDataURL(payload, size);
}
