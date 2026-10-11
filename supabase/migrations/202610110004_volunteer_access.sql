-- Read authoritative app_metadata, so old JWTs cannot bypass the first-login gate.
BEGIN;
CREATE OR REPLACE FUNCTION public.pack873_directory_access(admin_only boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users u WHERE u.id=auth.uid()
    AND u.raw_app_meta_data->>'pack873_must_change_password' IS DISTINCT FROM 'true'
    AND (u.raw_app_meta_data->>'pack873_role'='admin'
      OR (NOT admin_only AND u.raw_app_meta_data->>'pack873_role'='volunteer')));
$$;
REVOKE ALL ON FUNCTION public.pack873_directory_access(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pack873_directory_access(boolean) TO authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['committee_roles','volunteers','volunteer_roles'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',t);
    EXECUTE format('DROP POLICY IF EXISTS pack873_member_read ON public.%I',t);
    EXECUTE format('CREATE POLICY pack873_member_read ON public.%I FOR SELECT TO authenticated USING (public.pack873_directory_access(false))',t);
    EXECUTE format('DROP POLICY IF EXISTS pack873_password_read_gate ON public.%I',t);
    EXECUTE format('CREATE POLICY pack873_password_read_gate ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING (public.pack873_directory_access(false))',t);
    EXECUTE format('DROP POLICY IF EXISTS pack873_insert_gate ON public.%I',t);
    EXECUTE format('CREATE POLICY pack873_insert_gate ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.pack873_directory_access(true))',t);
    EXECUTE format('DROP POLICY IF EXISTS pack873_update_gate ON public.%I',t);
    EXECUTE format('CREATE POLICY pack873_update_gate ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.pack873_directory_access(true)) WITH CHECK (public.pack873_directory_access(true))',t);
    EXECUTE format('DROP POLICY IF EXISTS pack873_delete_gate ON public.%I',t);
    EXECUTE format('CREATE POLICY pack873_delete_gate ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.pack873_directory_access(true))',t);
  END LOOP;
END $$;
COMMIT;
