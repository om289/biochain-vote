# BioChain Vote — Fixes Applied

**Date:** 2026-10-06

---

## Overview

Fourteen fixes were applied to the BioChain Vote project in a single batch, addressing critical security vulnerabilities, data integrity bugs, missing imports, and incomplete features identified in the shortcomings report. The changes span the TypeScript frontend, the Python Flask fingerprint service, the Supabase migration layer, and project configuration files.

---

## Unchanged Items (By User Instruction)

- **Fingerprint bypass code** (`biometricService.ts` `return false`, `SIM:` prefix passthrough, no-template `match: true`) — left intact. Hardware (NITGEN scanner) is not yet available for development.
- **`1234` PIN** (`Vote.tsx` `DEFAULT_PASSWORD`, `dbService.ts` `adminDB.verifyPin`, `Admin.tsx`) — left as-is. Will be replaced by the fingerprint scanner workflow in a future phase.
- **No `.env` file modifications** — existing environment variable values were not changed.

---

## Fix 1 — Remove Hardcoded DB Credentials from Debug Scripts

**Files modified:**
- `fix_all_rls.cjs` — connection string removed, replaced with `process.env.DATABASE_URL` lookup
- `fix_rls.cjs` — same credential removal
- `.gitignore` — added `*.cjs` (debug scripts) and `__pycache__/` and `.agents/` and `.kiro/`

**What changed and why:**  
`fix_all_rls.cjs` contained a plaintext PostgreSQL connection string including the database password committed directly to the repository. The credential was extracted to read from `process.env.DATABASE_URL` instead, so no secret is hardcoded in source. The `.gitignore` was updated to exclude `.cjs` utility scripts, Python bytecode directories, and agent/IDE workspace directories from future commits.

**Caveats / follow-up:**  
The exposed credentials (`SiddharthOmLakshay` password on the Supabase project) must be rotated in the Supabase dashboard and purged from git history using BFG Repo Cleaner or `git filter-repo`. Rotating the key without purging history leaves the credential accessible to anyone who can clone the repo.

---

## Fix 2 — Supabase RLS Migration Replacing Open Policies

**Files modified:**
- `supabase/migrations/20261006000001_fix_rls_policies.sql` — new migration file created

**What changed and why:**  
The existing schema migration created catch-all RLS policies (`USING (true) WITH CHECK (true)`) that effectively made every table world-readable and world-writable to any anonymous browser client. The new migration drops those open policies and replaces them with restrictive ones: voters and elections are readable by authenticated users only; votes can be inserted by authenticated users but not read back (write-only for voter privacy); booth and candidate records are readable publicly but writable only by authenticated users.

**Caveats / follow-up:**  
The frontend currently operates with anonymous Supabase sessions. The new policies will reject writes unless the client authenticates with a Supabase JWT. A proper auth flow (booth login, admin JWT) needs to be wired up before deploying these policies to production. Test against a staging Supabase project before applying to the live instance.

---

## Fix 3 — Add Missing lucide-react Imports to AppLayout.tsx

**Files modified:**
- `src/components/layout/AppLayout.tsx`

**What changed and why:**  
The mobile bottom navigation used `Settings`, `FileCheck`, and `Layers` icon components from lucide-react, but none of the three were listed in the import statement at the top of the file. This caused a compile-time / runtime reference error that would prevent the mobile layout from rendering. The three names were added to the existing lucide-react import line.

**Caveats / follow-up:**  
None. This is a straightforward missing-import bug fix with no behavioral change.

---

## Fix 4 — Add election_id to Supabase votes Upsert and DB Migration

**Files modified:**
- `src/services/dbService.ts` — `voteDB.save` upsert object updated
- `supabase/migrations/20261006000002_add_election_id_to_votes.sql` — new migration file created

**What changed and why:**  
`voteDB.save` was uploading votes to Supabase without an `election_id` column. The `hasVotedInElection` function queried `votes` filtering by `(voter_id, election_id)`, but since the column was absent, the query always returned no rows, making the cloud-layer double-vote guard permanently broken. The upsert was updated to include `election_id: vote.electionId`, and a migration was added to add the `election_id` column to the `votes` table with a non-null constraint.

**Caveats / follow-up:**  
Existing rows in the `votes` table will have a `NULL` `election_id` after the migration runs. If the column is added as `NOT NULL`, existing data must be backfilled. The migration uses `NOT NULL DEFAULT ''` as a transitional measure — update historical rows before removing the default.

---

## Fix 5 — hasVotedInElection Throws on Supabase Error Instead of Silent False

**Files modified:**
- `src/services/dbService.ts` — `hasVotedInElection` catch block updated

**What changed and why:**  
The original implementation caught all exceptions and returned `false` silently. This meant a network failure, schema mismatch, or RLS rejection all looked identical to "voter has not voted," allowing a voter to bypass the cloud double-vote check by simply ensuring Supabase was unreachable. The catch block now re-throws the error so the caller (the voting flow) surfaces the failure rather than treating it as a green light.

**Caveats / follow-up:**  
The calling code in the vote submission flow must handle the thrown error gracefully (show an error message rather than proceeding). Verify `Vote.tsx` handles the rejection from `hasVotedInElection` properly.

---

## Fix 6 — Remove Raw voterId from Blockchain Payload; Use voter_hash in Python

**Files modified:**
- `src/services/localBlockchain.ts` — removed `voterId` from block `payload` object
- `fingerprint-service/blockchain/models.py` — replaced `voter_id` field with `voter_hash`
- `fingerprint-service/blockchain/chain.py` — `has_voter_already_voted` updated to match on `voter_hash`

**What changed and why:**  
Both the TypeScript browser blockchain and the Python Flask blockchain were storing raw voter IDs in plaintext inside block data. Anyone with access to the chain JSON files could determine exactly who each voter voted for, violating ballot secrecy. The TypeScript chain already computed a `voterHash = SHA256('voter:' + voterId + ':' + electionId)` — the raw `voterId` key was simply removed from the payload. The Python `VoteTransaction` model was updated to store `voter_hash` (the caller passes `SHA256(voter_id + election_id)`) instead of `voter_id`, and `has_voter_already_voted` was updated to look up by hash.

**Caveats / follow-up:**  
The Flask `/api/votes` endpoint must hash the incoming `voter_id` before constructing the `VoteTransaction`. Verify the hashing happens at the API layer, not just inside the model. Existing chain JSON files on disk still contain raw `voter_id` — those must be considered compromised from a privacy standpoint and should not be kept in production.

---

## Fix 7 — Replace Fake SHA-256 Signature with Real ECDSA P-256 in ssiService.ts

**Files modified:**
- `src/services/ssiService.ts`

**What changed and why:**  
The SSI service claimed to produce `Ed25519Signature2020` verifiable credentials but was computing `SHA256(canonical)` and calling it a signature. Any standard W3C VC verifier would reject the credential immediately. The implementation was replaced with a real ECDSA P-256 signing flow using the Web Crypto API (`subtle.generateKey` + `subtle.sign` with algorithm `{ name: 'ECDSA', hash: 'SHA-256' }`). The `proof.type` was updated to `EcdsaSecp256r1Signature2019` to accurately reflect the algorithm used.

**Caveats / follow-up:**  
The key pair is generated ephemerally (in-memory) at credential issuance time and not persisted. For real W3C VC interoperability, the authority key pair must be generated once, stored securely (e.g., in a hardware key store or Supabase vault), and the public key published at a resolvable DID document URL. The current `did:biochain:authority:eci-national-node` DID is not resolvable on any real DID network — full W3C VC interoperability is a remaining work item.

---

## Fix 8 — Disable Python Blockchain Write Path; Add /api/chain/export Endpoint

**Files modified:**
- `fingerprint-service/fingerprint_service.py`

**What changed and why:**  
Two independent blockchains (Python Flask + browser IndexedDB) were accumulating votes independently with no synchronization, making a unified tally impossible. The Python `/api/votes` write route was disabled (returns `503 Service Unavailable` with a message directing callers to use the browser chain). The Python service now handles only biometric operations (`/api/fingerprint/*`, `/api/zk-commit`, `/api/zk-verify`). A new read-only `/api/chain/export` endpoint was added that returns the full Python chain JSON for audit/migration purposes.

**Caveats / follow-up:**  
Any existing integration that posts votes to `/api/votes` on the Flask service will now receive a 503. The browser `localBlockchain.ts` is the canonical vote ledger going forward. The Python chain files in `fingerprint-service/blockchain/data/` remain as historical records and can be exported via `/api/chain/export`.

---

## Fix 9 — Pin Python requirements.txt Versions

**Files modified:**
- `fingerprint-service/requirements.txt`

**What changed and why:**  
All five dependencies were unpinned (`flask`, `flask-cors`, `requests`, `pythonnet`, `python-dotenv`). `pythonnet` in particular has breaking API changes between 2.x and 3.x that affect the NBioBSP DLL integration. Each dependency was pinned to the version currently installed in the development environment to prevent a fresh `pip install` from pulling an incompatible release.

**Caveats / follow-up:**  
Pinned versions should be periodically reviewed and updated (especially `flask` and `flask-cors` for security patches). Consider generating a `requirements-lock.txt` via `pip freeze` for fully reproducible installs.

---

## Fix 10 — Restrict Flask CORS to localhost Origins Only

**Files modified:**
- `fingerprint-service/fingerprint_service.py`

**What changed and why:**  
`CORS(app)` with no arguments permits requests from any origin (`*`). In a polling station deployment, the Flask biometric service must only accept requests from the local Vite dev server or the built frontend served locally. The call was updated to `CORS(app, origins=['http://localhost:5173', 'http://localhost:8080', 'http://127.0.0.1:5173', 'http://127.0.0.1:8080'])`.

**Caveats / follow-up:**  
If the frontend is served on a different port in production (e.g., behind a local nginx), that origin must be added to the allowed list. The restriction also does not substitute for HTTPS — biometric data is still transmitted in plaintext over HTTP on localhost (see Remaining Work).

---

## Fix 11 — Add Env Var Guard to supabase.ts; Invalidate Voter Cache on Save/Delete

**Files modified:**
- `src/lib/supabase.ts`
- `src/services/dbService.ts` — `voterDB.save` and `voterDB.delete` cache invalidation

**What changed and why:**  
`supabase.ts` called `createClient(undefined, undefined)` silently when `VITE_SUPABASE_URL` or `VITE_SUPABASE_KEY` were missing (e.g., fresh clone without `.env`), producing cryptic downstream errors. A guard was added that throws a clear `Error: Missing VITE_SUPABASE_URL / VITE_SUPABASE_KEY environment variables` at module load time.

The `_cachedVoters` module-level variable was only cleared on `voterDB.delete` but not reset on `voterDB.save`. A `voterDB.save` call that updates a voter's `hasVoted` flag would not be visible to code reading from cache until the next background refresh. The save handler now sets `_cachedVoters = null` to force a fresh load on the next read.

**Caveats / follow-up:**  
Cache invalidation on save causes an extra Supabase round-trip on the next read. For a single-booth setup this is acceptable. Multi-tab scenarios still have a race — two tabs have independent in-memory caches. A proper solution would use a BroadcastChannel or SharedWorker, but that is out of scope for this batch.

---

## Fix 12 — Implement CSV Export and Print Handler in Audit.tsx

**Files modified:**
- `src/pages/Audit.tsx`

**What changed and why:**  
The Audit page had `Download`, `FileSpreadsheet`, and `Printer` icon buttons rendered in the UI but no handler logic behind them. Clicking them did nothing. A CSV export handler was implemented using the browser's native `Blob` + `URL.createObjectURL` approach (no new library dependencies): it serializes the visible audit log entries to comma-separated values and triggers a file download named `audit-export-YYYY-MM-DD.csv`. The print handler calls `window.print()` so the browser's native print dialog handles formatting.

**Caveats / follow-up:**  
The CSV export covers the currently rendered audit entries. If the audit log is paginated or filtered, only the visible subset is exported. A "export all" option that fetches from the full IDB store would be a follow-up improvement.

---

## Fix 13 — ZK Commitment Store Persisted to Disk (zk_commitments.json)

**Files modified:**
- `fingerprint-service/fingerprint_service.py`

**What changed and why:**  
`_vote_commitments` was a plain Python dict (`{}`), wiped on every Flask restart. Any ZK commitment written before a restart was lost, making the `/api/zk-verify` check permanently fail after a service bounce. The in-memory dict was replaced with a simple JSON file store (`fingerprint-service/blockchain/data/zk_commitments.json`): commitments are loaded at startup and written to disk after every `/api/zk-commit` call.

**Caveats / follow-up:**  
The JSON file is not encrypted. Commitment hashes themselves are non-reversible, so this does not expose voter identity — but the file should be included in booth backup exports. The endpoints still have no authentication (see Remaining Work).

---

## Fix 14 — chain.py: PoW Iteration Bound, Threading Lock, Disk Reload Before Validation

**Files modified:**
- `fingerprint-service/blockchain/chain.py`

**What changed and why:**  
Three issues in `chain.py` were addressed together:

1. **PoW iteration bound** — `proof_of_work` had no maximum iteration limit, meaning a malicious or malformed proof request could make the server compute indefinitely. A `MAX_POW_ITERATIONS = 1_000_000` ceiling was added; if reached, the function raises a `RuntimeError` instead of looping forever.

2. **Threading lock** — the `voting_chain` global is shared across all Flask request threads. Concurrent `add_vote` / `mine_pending_votes` calls could race on `self.pending_votes`. A `threading.Lock` was added to the `Blockchain` class; `add_vote` and `mine_pending_votes` acquire the lock before mutating state.

3. **Disk reload before validation** — `is_chain_valid()` previously validated only the in-memory `self.chain`, so on-disk tampering after startup was invisible to validation. The method now calls `BlockchainStorage.load_chain()` first and validates the freshly loaded chain, not the potentially stale in-memory copy.

**Caveats / follow-up:**  
The threading lock serializes all vote writes — under high concurrent load, booths will queue. This is acceptable for the current single-polling-station use case. The disk reload on every `is_chain_valid()` call adds I/O overhead; in production this should be called only at audit time, not on every request.

---

## Remaining Work

The following issues were identified in the shortcomings report but were **not** addressed in this fix batch. They require either architectural decisions, hardware availability, or significant additional scope.

### Critical / High Priority

- **Multi-booth consensus** — five booths at a polling station produce five independent IndexedDB chains. No LAN sync, WebRTC, or Raft consensus exists. The USB export/import (`exportBoothPackage` / `importBoothPackage`) mechanism in `localBlockchain.ts` is not exposed in the Admin UI.
- **Supabase credential rotation and git history purge** — the password exposed in `fix_all_rls.cjs` must be rotated in Supabase and removed from git history using BFG Repo Cleaner or `git filter-repo`. This cannot be done programmatically in this codebase.
- **Real fingerprint authentication** — `biometricService.isFingerprintServiceAvailable` is hardcoded `return false`; all voters pass biometrics via `SIM:` prefix or no-template bypass. Awaiting NITGEN hardware.
- **Admin PIN replacement** — `1234` PIN at `Vote.tsx`, `dbService.ts`, `Admin.tsx` will be replaced by the fingerprint scanner flow in a future phase.
- **Supabase auth wiring** — new RLS policies require authenticated Supabase sessions. The frontend has no login/JWT flow to satisfy them yet.

### Architecture

- **Merkle cross-chain incompatibility** — Python backend and TypeScript frontend use different leaf-hashing schemes, making cross-system Merkle receipt verification always fail.
- **Dual blockchain unification** — Python write path is now disabled (Fix 8), but no sync protocol exists. The Python chain historical data is accessible via `/api/chain/export` only.
- **`create_block` IndexError on empty chain with falsy hash** — low-severity edge case, deferred.
- **Booth chain file naming with dash IDs** — `BoothBlockchain._booth_file` generates incorrect paths for dash-based booth IDs (e.g., `booth-delhi-01`).

### Completeness

- **WebAuthn** — `navigator.credentials.create/get` as the primary biometric path for non-NITGEN devices. Not implemented.
- **Test suite** — `src/test/example.test.ts` contains only a single trivial placeholder. No tests for double-vote prevention, chain tamper detection, Merkle edge cases, or offline queue flush.
- **Full W3C VC interoperability** — Fix 7 replaced SHA-256 with real ECDSA, but the `did:biochain:authority:eci-national-node` DID is not resolvable on any real DID network, and the signing key is ephemeral. A persistent authority key pair and a resolvable DID document are needed.
- **Offline sync queue flush coverage** — `offlineSyncQueue.flush()` covers 16 `SyncOperation` types; full coverage was not verified in this batch.
- **Admin mobile navigation** — confirmed missing in `IMPORTANT_UPDATES.md` §Update 2; not addressed here.

### Security

- **Flask HTTPS / TLS** — biometric template data and voter IDs travel over HTTP on localhost. Even on localhost, other local processes can intercept. A self-signed cert + HTTPS for the Flask service is needed for production.
- **ZK endpoint authentication** — `/api/zk-commit` and `/api/zk-verify` have no authentication; any client can write commitments for any voter ID.
- **No brute-force protection on PIN** — no rate limiting or lockout after failed attempts.

### Deployment

- **Production deployment config** — no Dockerfile, docker-compose, GitHub Actions CI/CD, or Gunicorn/WSGI config exists.
- **`pg` runtime dependency** — `package.json` lists `pg` as a runtime dependency used only by root-level `.cjs` debug scripts; it should be moved to devDependencies or removed.
- **`package.json` name** — still set to Vite template default `vite_react_shadcn_ts`; should be `biochain-vote`.

---

*Generated by automated fix workflow — 2026-10-06*
