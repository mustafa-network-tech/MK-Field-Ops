-- Add can_see_prices to profiles for team leader price visibility (CM grants/revokes in Users tab).
-- When true, team leader can see their team earnings and unit prices in their share.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_see_prices boolean DEFAULT false;
COMMENT ON COLUMN public.profiles.can_see_prices IS 'When true, team leader can see price-related fields (team earnings, unit price in their share). Set by company manager in Users tab.';
