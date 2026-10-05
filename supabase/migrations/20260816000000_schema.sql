-- Run this SQL in your Supabase SQL Editor to create the necessary tables for full synchronization.

-- 1. Elections Table
CREATE TABLE IF NOT EXISTS public.elections (
    id text PRIMARY KEY,
    title text NOT NULL,
    description text,
    type text NOT NULL,
    status text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    constituency text NOT NULL,
    state text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- 2. Candidates Table
CREATE TABLE IF NOT EXISTS public.candidates (
    id text PRIMARY KEY,
    election_id text NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE,
    name text NOT NULL,
    party_name text NOT NULL,
    party_symbol text NOT NULL,
    age integer,
    qualification text,
    manifesto text,
    photo_url text
);

-- 3. Booths Table
CREATE TABLE IF NOT EXISTS public.booths (
    id text PRIMARY KEY,
    name text NOT NULL,
    constituency text NOT NULL
);

-- 4. Booth Voters Mapping
CREATE TABLE IF NOT EXISTS public.booth_voters (
    voter_id text PRIMARY KEY, -- assuming a voter is assigned to one booth
    booth_id text NOT NULL REFERENCES public.booths(id) ON DELETE CASCADE
);

-- 5. Booth Elections Mapping
CREATE TABLE IF NOT EXISTS public.booth_elections (
    id text PRIMARY KEY,
    booth_id text NOT NULL REFERENCES public.booths(id) ON DELETE CASCADE,
    election_id text NOT NULL REFERENCES public.elections(id) ON DELETE CASCADE
);

-- 6. Blocks Table (Blockchain Ledger)
CREATE TABLE IF NOT EXISTS public.blocks (
    index integer PRIMARY KEY,
    timestamp timestamp with time zone NOT NULL,
    data jsonb NOT NULL,
    previous_hash text NOT NULL,
    hash text NOT NULL UNIQUE,
    nonce integer NOT NULL
);

-- Note: 'voters' and 'votes' tables should already exist from your previous setup.

-- Allow public read access to these tables (adjust RLS as needed for your app security)
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booth_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on elections" ON public.elections FOR SELECT USING (true);
CREATE POLICY "Allow public read access on candidates" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Allow public read access on booths" ON public.booths FOR SELECT USING (true);
CREATE POLICY "Allow public read access on booth_voters" ON public.booth_voters FOR SELECT USING (true);
CREATE POLICY "Allow public read access on booth_elections" ON public.booth_elections FOR SELECT USING (true);
CREATE POLICY "Allow public read access on blocks" ON public.blocks FOR SELECT USING (true);

-- Allow insert/update for demo purposes (you should restrict this in production)
CREATE POLICY "Allow public insert/update on elections" ON public.elections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert/update on candidates" ON public.candidates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert/update on booths" ON public.booths FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert/update on booth_voters" ON public.booth_voters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert/update on booth_elections" ON public.booth_elections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public insert/update on blocks" ON public.blocks FOR ALL USING (true) WITH CHECK (true);
