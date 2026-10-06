-- Fix duplicate election and add PRIMARY KEY constraints

-- 1. Remove the duplicate 'upcoming' election (keep the 'active' one)
DELETE FROM public.elections 
WHERE id = 'elec-1791247824438' 
AND status = 'upcoming';

-- 2. Add PRIMARY KEY constraints to prevent future duplicates

-- Add PRIMARY KEY to elections table
ALTER TABLE public.elections 
DROP CONSTRAINT IF EXISTS elections_pkey;

ALTER TABLE public.elections 
ADD CONSTRAINT elections_pkey PRIMARY KEY (id);

-- Add PRIMARY KEY to candidates table
ALTER TABLE public.candidates 
DROP CONSTRAINT IF EXISTS candidates_pkey;

ALTER TABLE public.candidates 
ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);

-- Add PRIMARY KEY to booths table
ALTER TABLE public.booths 
DROP CONSTRAINT IF EXISTS booths_pkey;

ALTER TABLE public.booths 
ADD CONSTRAINT booths_pkey PRIMARY KEY (id);

-- Add PRIMARY KEY to booth_elections table
ALTER TABLE public.booth_elections 
DROP CONSTRAINT IF EXISTS booth_elections_pkey;

ALTER TABLE public.booth_elections 
ADD CONSTRAINT booth_elections_pkey PRIMARY KEY (id);

-- Verify the fix
SELECT id, title, status, created_at 
FROM public.elections 
ORDER BY created_at;
