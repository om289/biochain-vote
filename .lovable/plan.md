

# BioChain Vote — Secure Decentralized E-Voting Frontend

A visually stunning, dark-themed web application for blockchain-based voting with biometric authentication. Full UI with mocked services, structured for easy future backend integration.

## Design System
- **Dark mode primary** with deep blues (#010F1F background, #051D40 accents, electric blue highlights)
- Subtle gradient overlays, glassmorphism cards, smooth animations (CSS transitions + keyframes)
- Mobile-first responsive design, accessible with ARIA labels throughout
- Security-focused UX: loading states for "transaction confirmations," clear error handling

## Pages & Features

### 1. Onboarding & Auth
- **Welcome/splash screen** with animated logo and tagline "Bridging Blockchain Transparency with Unbreakable Voter Identity"
- **Biometric setup wizard** — WebAuthn integration for external fingerprint sensors, with PIN fallback
- **Voter registration form** — ID verification UI (mocked), credential generation animation
- **Login screen** — fingerprint prompt + PIN fallback, elegant transition to dashboard

### 2. Dashboard (Home)
- Active elections with countdown timers and status badges
- Past vote history cards with verification status indicators
- Voter identity status card (SSI credential status, verification level)
- Quick-action buttons: Cast Vote, Verify Vote, View Audit

### 3. Vote Casting Flow
- **Election selection** → **Candidate list** with photos, party, platform info
- "Generating zk-SNARK proof" animation (mocked but visually convincing progress steps)
- "Encrypting vote with threshold key" step visualization
- **Wallet connect modal** — MetaMask/Trust Wallet UI (mocked connection flow)
- **Transaction confirmation** screen with hash, block number, timestamp
- Success screen with shareable verification receipt

### 4. End-to-End Verification
- Enter vote receipt/transaction hash to verify inclusion
- Blockchain explorer-style view: block details, Merkle proof visualization
- "Your vote was counted" confirmation with cryptographic proof display
- Timeline showing: Vote Cast → Encrypted → Included in Tally → Verified

### 5. SSI (Self-Sovereign Identity) Management
- View/manage encrypted voter credentials
- Credential cards showing: DID, issuance date, expiry, verification status
- Export/backup credential UI (mocked)
- QR code for credential sharing

### 6. Admin / Trustee Panel
- Dashboard showing decryption ceremony status
- List of n trustees with their key-share submission status
- "Submit Key Share" flow with threshold progress bar (e.g., 3 of 5 submitted)
- Decryption trigger when threshold is met, with result reveal animation

### 7. Public Audit Page
- Encrypted tally display with election metadata
- Computation verification interface (mocked zero-knowledge proof checks)
- Election statistics: participation rate, geographic distribution charts
- Downloadable audit reports (mocked)

### 8. Profile & Settings
- Voter profile with identity details
- Biometric device management
- Wallet connection status
- Notification preferences
- Theme toggle (dark/light)

## Navigation
- **Bottom tab bar** (mobile) / **sidebar** (desktop): Home, Vote, Verify, Profile
- Stack-based modals for voting flow, wallet connect, biometric prompts
- Admin panel accessible via role-based routing

## Architecture (Frontend Only)
- **Service layer** with clear interfaces for: blockchain service, biometric service, API service, SSI service — all mocked with realistic delays and responses
- **Zustand** for global state: wallet connection, user session, vote status
- **Recharts** for audit page visualizations
- Modular component structure ready for real integrations

## Key Screens (5 Hero Screens)
1. **Biometric Login** — Fingerprint prompt with glowing scanner animation
2. **Dashboard** — Election cards, status overview, quick actions
3. **Vote Casting** — Candidate selection with proof generation visualization
4. **Verification** — Blockchain explorer-style vote confirmation
5. **Trustee Panel** — Threshold decryption ceremony with key-share progress

