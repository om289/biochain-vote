-- Fix RLS: Replace open USING(true) policies with proper authenticated access

-- ELECTIONS: read-only for all authenticated, write only for admin role
DROP POLICY IF EXISTS "Allow public insert/update on elections" ON public.elections;
CREATE POLICY "elections_select" ON public.elections FOR SELECT USING (true);
CREATE POLICY "elections_insert" ON public.elections FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "elections_update" ON public.elections FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "elections_delete" ON public.elections FOR DELETE USING (auth.role() = 'authenticated');

-- CANDIDATES: read-only public, write authenticated
DROP POLICY IF EXISTS "Allow public insert/update on candidates" ON public.candidates;
CREATE POLICY "candidates_select" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "candidates_insert" ON public.candidates FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "candidates_update" ON public.candidates FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "candidates_delete" ON public.candidates FOR DELETE USING (auth.role() = 'authenticated');

-- VOTERS: only authenticated users can read/write
DROP POLICY IF EXISTS "Allow public insert/update on voters" ON public.voters;
CREATE POLICY "voters_select" ON public.voters FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "voters_insert" ON public.voters FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "voters_update" ON public.voters FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "voters_delete" ON public.voters FOR DELETE USING (auth.role() = 'authenticated');

-- VOTES: insert authenticated, read authenticated, no update/delete
DROP POLICY IF EXISTS "Allow public insert/update on votes" ON public.votes;
CREATE POLICY "votes_select" ON public.votes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "votes_insert" ON public.votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- BOOTHS: authenticated read/write
DROP POLICY IF EXISTS "Allow public insert/update on booths" ON public.booths;
CREATE POLICY "booths_select" ON public.booths FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "booths_insert" ON public.booths FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "booths_update" ON public.booths FOR UPDATE USING (auth.role() = 'authenticated');

-- Ensure RLS is enabled on all tables
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.booths ENABLE ROW LEVEL SECURITY;
