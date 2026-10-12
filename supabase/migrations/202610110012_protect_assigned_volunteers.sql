BEGIN;
CREATE OR REPLACE FUNCTION public.pack873_protect_assigned_volunteer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.committee_roles c WHERE c.volunteer_id=OLD.id OR (c.volunteer_id IS NULL AND lower(btrim(c.email))=lower(btrim(OLD.email)))) THEN
  RAISE EXCEPTION 'A volunteer with a role assignment cannot be deleted. Refresh the unassigned list.';
 END IF;
 IF EXISTS(SELECT 1 FROM auth.users u WHERE lower(btrim(u.email))=lower(btrim(OLD.email)) AND u.raw_app_meta_data->>'pack873_role'='admin') THEN
  RAISE EXCEPTION 'Administrator volunteer records cannot be deleted.';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.pack873_protect_assigned_volunteer() FROM PUBLIC;
DROP TRIGGER IF EXISTS pack873_protect_assigned_volunteer ON public.volunteers;
CREATE TRIGGER pack873_protect_assigned_volunteer BEFORE DELETE ON public.volunteers FOR EACH ROW EXECUTE FUNCTION public.pack873_protect_assigned_volunteer();
COMMIT;
