ALTER TABLE public.votes ADD COLUMN IF NOT EXISTS election_id TEXT;
CREATE INDEX IF NOT EXISTS idx_votes_voter_election ON public.votes(voter_id, election_id);
