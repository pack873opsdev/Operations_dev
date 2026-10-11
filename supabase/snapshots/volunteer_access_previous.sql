-- Pack 873 DEV: apply after reviewing existing RLS policies and backing up the database.
-- Restrictive policies compose with existing permissive policies; they cannot grant access by themselves.
BEGIN;
ALTER TABLE public.committee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_roles ENABLE ROW LEVEL SECURITY;
-- Block directory reads until the user changes the temporary password.
-- Admins retain their existing access; volunteers receive read-only access.
DROP POLICY IF EXISTS pack873_dev_directory_password_gate ON public.committee_roles;
CREATE POLICY pack873_dev_directory_password_gate ON public.committee_roles AS RESTRICTIVE FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'pack873_role') IN ('admin','volunteer') AND coalesce((auth.jwt()->'app_metadata'->>'pack873_must_change_password')::boolean,false)=false);
DROP POLICY IF EXISTS pack873_dev_volunteers_password_gate ON public.volunteers;
CREATE POLICY pack873_dev_volunteers_password_gate ON public.volunteers AS RESTRICTIVE FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'pack873_role') IN ('admin','volunteer') AND coalesce((auth.jwt()->'app_metadata'->>'pack873_must_change_password')::boolean,false)=false);
DROP POLICY IF EXISTS pack873_dev_roles_password_gate ON public.volunteer_roles;
CREATE POLICY pack873_dev_roles_password_gate ON public.volunteer_roles AS RESTRICTIVE FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'pack873_role') IN ('admin','volunteer') AND coalesce((auth.jwt()->'app_metadata'->>'pack873_must_change_password')::boolean,false)=false);
-- Enforce Admin-only modifications even if older permissive policies exist.
DROP POLICY IF EXISTS pack873_dev_assignment_insert_gate ON public.committee_roles;
CREATE POLICY pack873_dev_assignment_insert_gate ON public.committee_roles AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((auth.jwt()->'app_metadata'->>'pack873_role')='admin');
DROP POLICY IF EXISTS pack873_dev_assignment_update_gate ON public.committee_roles;
CREATE POLICY pack873_dev_assignment_update_gate ON public.committee_roles AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((auth.jwt()->'app_metadata'->>'pack873_role')='admin') WITH CHECK ((auth.jwt()->'app_metadata'->>'pack873_role')='admin');
DROP POLICY IF EXISTS pack873_dev_assignment_delete_gate ON public.committee_roles;
CREATE POLICY pack873_dev_assignment_delete_gate ON public.committee_roles AS RESTRICTIVE FOR DELETE TO authenticated
USING ((auth.jwt()->'app_metadata'->>'pack873_role')='admin');
-- Grant read access to signed-in directory members, subject to the restrictive password gate.
DROP POLICY IF EXISTS pack873_dev_committee_member_read ON public.committee_roles;
CREATE POLICY pack873_dev_committee_member_read ON public.committee_roles FOR SELECT TO authenticated
USING ((auth.jwt()->'app_metadata'->>'pack873_role') IN ('admin','volunteer'));
-- Existing admin-only master-list policies should remain in place.
GRANT SELECT ON public.committee_roles,public.volunteers,public.volunteer_roles TO authenticated;
COMMIT;
-- IMPORTANT: Review all existing PERMISSIVE policies on committee_roles.
-- Ensure there is an authenticated SELECT policy for admins and volunteers,
-- and no anonymous read policy. Restrictive policies cannot grant SELECT themselves.
