-- ================================================================
-- 003_fix_resources_rls.sql
-- KMAP: Fix resource allocation — make resources publicly readable.
--
-- Context: Supabase Auth was removed from this project. The previous
-- policy restricted SELECT to 'authenticated' role only, which meant:
--   - Server-side (service_role key) still worked (bypasses RLS)
--   - Any anon/client-side call returned nothing
--   - Deployed envs without SUPABASE_SERVICE_ROLE_KEY returned 503
--
-- Fix: Replace with a public SELECT policy (same as subjects table).
-- The service_role key on API routes still bypasses RLS for all ops.
-- ================================================================

-- Drop the old auth-only policy
DROP POLICY IF EXISTS "Authenticated users can read resources" ON public.resources;

-- Allow any role (anon, service_role) to SELECT from resources
CREATE POLICY "Resources are publicly readable"
  ON public.resources FOR SELECT
  USING (true);

-- Subjects table already has this correct policy, no change needed.
-- Capsules table already has this correct policy, no change needed.
