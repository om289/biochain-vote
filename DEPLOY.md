# Deployment Guide — BioChain Vote

## Frontend (Vercel — Recommended)

1. Push this repo to GitHub
2. Go to https://vercel.com → New Project → Import your repo
3. Framework: Vite (auto-detected)
4. Build command: `npm run build`
5. Output directory: `dist`
6. Add environment variables:
   - `VITE_SUPABASE_URL` — your Supabase project URL
   - `VITE_SUPABASE_KEY` — your Supabase anon/public key
7. Deploy

Every push to main auto-deploys.

## Alternative: Netlify

1. Push to GitHub
2. Go to https://netlify.com → New site from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add same env vars in Site Settings → Environment Variables
6. `public/_redirects` handles SPA routing automatically.

## Alternative: Supabase Storage
Supabase Storage can serve static files but does not support SPA routing rewrites. Use Vercel or Netlify.

## Flask Fingerprint Service
The Python fingerprint service runs locally on each polling booth machine (it needs physical USB access to the NITGEN scanner). It is NOT deployed to the cloud.

1. `cd fingerprint-service`
2. `pip install -r requirements.txt`
3. `python fingerprint_service.py`

The frontend auto-detects if the service is running. If not, it falls back to PIN-only mode.

## Environment Setup
Copy `.env.example` to `.env` and fill in your Supabase credentials.

## NITGEN Integration Note
When hardware arrives, change `isFingerprintServiceAvailable()` in `src/services/biometricService.ts`
from `return false` to:
```typescript
return fetch('http://localhost:5000/status').then(r => r.ok).catch(() => false);
```
Everything else in the fingerprint flow is already wired.
