BEGIN;
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id),
  topic_name text NOT NULL DEFAULT '',
  topic_description text NOT NULL DEFAULT '',
  full_details text NOT NULL DEFAULT '',
  role_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.pack873_announcement_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE author_email text; assigned_roles text; member_role text;
BEGIN
  IF NOT public.pack873_directory_access(false) THEN
    RAISE EXCEPTION 'Sign in and complete password setup before making an announcement';
  END IF;
  SELECT email, raw_app_meta_data->>'pack873_role' INTO author_email, member_role
  FROM auth.users WHERE id=auth.uid();
  SELECT string_agg(DISTINCT role_name, ' · ' ORDER BY role_name) INTO assigned_roles
  FROM public.committee_roles WHERE lower(email)=lower(author_email) AND status='Active';
  NEW.author_id=auth.uid();
  NEW.role_name=coalesce(assigned_roles,CASE WHEN member_role='admin' THEN 'Administrator' ELSE 'Volunteer' END);
  NEW.created_at=now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.pack873_announcement_author() FROM PUBLIC;
CREATE TRIGGER announcement_author BEFORE INSERT ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.pack873_announcement_author();
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.announcements FROM anon, authenticated;
GRANT SELECT(id,topic_name,topic_description,full_details,role_name,created_at)
ON public.announcements TO anon, authenticated;
GRANT INSERT(topic_name,topic_description,full_details) ON public.announcements TO authenticated;
CREATE POLICY announcements_public_read ON public.announcements FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY announcements_member_insert ON public.announcements FOR INSERT TO authenticated
WITH CHECK(author_id=auth.uid() AND public.pack873_directory_access(false));
CREATE INDEX announcements_created_at_idx ON public.announcements(created_at DESC);
COMMIT;
