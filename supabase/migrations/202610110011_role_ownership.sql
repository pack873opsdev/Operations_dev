BEGIN;
CREATE UNIQUE INDEX committee_role_one_assignment ON public.committee_roles(role_master_id) WHERE role_master_id IS NOT NULL;
CREATE UNIQUE INDEX committee_role_unique_name ON public.committee_roles(lower(btrim(role_name)));
CREATE UNIQUE INDEX role_master_unique_name ON public.volunteer_roles(lower(btrim(role_name)));
CREATE FUNCTION public.pack873_protect_admin_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM auth.users u WHERE lower(u.email)=lower(OLD.email) AND u.raw_app_meta_data->>'pack873_role'='admin') THEN
  RAISE EXCEPTION 'Administrator role assignments cannot be deleted';
 END IF;
 RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.pack873_protect_admin_assignment() FROM PUBLIC;
CREATE TRIGGER protect_admin_committee_assignment BEFORE DELETE ON public.committee_roles FOR EACH ROW EXECUTE FUNCTION public.pack873_protect_admin_assignment();
COMMIT;
