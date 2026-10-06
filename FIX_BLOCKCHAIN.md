# Fix Blockchain Duplicates & Integrity Issues

This guide explains how to fix duplicate elections and blockchain integrity violations.

## Problem

You may see "INTEGRITY VIOLATION" errors in the Chain Sync panel caused by:
- Duplicate election records in Supabase (no PRIMARY KEY constraints)
- Corrupted blockchain data in browser IndexedDB
- Old demo seed data creating fake blocks

## Solution: 3-Step Fix

### Step 1: Fix Supabase Database

**Option A: Automatic (Recommended)**

Run the Node.js script to automatically fix duplicates and add PRIMARY KEY constraints:

```bash
node fix_supabase_duplicates.cjs
```

**Option B: Manual**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** → New query
3. Copy and paste contents of `fix_elections_pk.sql`
4. Click **Run**

This will:
- Remove duplicate elections
- Add PRIMARY KEY constraints to prevent future duplicates

### Step 2: Clear Browser IndexedDB

**Option A: Use the Admin Button (Easiest)**

1. Open the app in your browser
2. Go to **Admin** → **Chain Sync** tab
3. Click the **"Clear IndexedDB"** button (red button next to "Refresh All")
4. Confirm the action
5. Page will auto-refresh

**Option B: Manual (Developer Tools)**

1. Press **F12** to open Developer Tools
2. Go to **Application** tab
3. Expand **IndexedDB** in the left sidebar
4. Find `biochain-vote` database
5. Right-click → **Delete database**
6. Close DevTools and refresh the page (**Ctrl+R** or **F5**)

### Step 3: Verify the Fix

1. Go to **Admin** → **Chain Sync** tab
2. Check that "Master Chain" shows **"Integrity OK"** (green)
3. Verify block count is reasonable (not inflated by duplicates)
4. Each election should have its own independent blockchain

## What Gets Fixed

✅ **Duplicate elections removed** - Only one record per election ID  
✅ **PRIMARY KEY constraints enforced** - Prevents future duplicates  
✅ **Corrupted blockchain cleared** - Fresh rebuild from Supabase  
✅ **Demo seed data removed** - Only real data remains  
✅ **Per-election master chains** - Each election has independent blockchain  

## Block Count Explanation

The block count will vary based on your actual data:

- **1 election created** = ~1 block
- **Booth anchored** = ~1-2 blocks per booth
- **Vote cast** = 1 block per vote
- **Booth chains merged** = 1 block

**Example:** If you have 2 elections, 3 booths anchored, 10 votes cast, and 1 merge → ~16 blocks total

The "67 blocks" you saw before was inflated by:
- Duplicate election records
- Old demo seed blocks
- Test data from development

## Files Included

- **`fix_elections_pk.sql`** - Manual SQL script for Supabase
- **`fix_supabase_duplicates.cjs`** - Automated Node.js fix script
- **Admin UI Button** - One-click IndexedDB clear in Chain Sync panel

## Need Help?

If you still see integrity violations after following these steps:

1. Check browser console (F12) for errors
2. Verify Supabase connection is working
3. Ensure no duplicate elections remain in Supabase
4. Try clearing IndexedDB again
5. Check that `seedDemoData()` is disabled in `apiService.initialize()`

## Prevention

To prevent future issues:

- PRIMARY KEY constraints now enforced (duplicates impossible)
- Demo seed data disabled in production
- Per-election master chains isolated
- Idempotency guards on blockchain operations
