BEGIN;
ALTER TABLE public.announcements ADD COLUMN committee_role_id bigint REFERENCES public.committee_roles(id) ON DELETE SET NULL;
ALTER TABLE public.announcements ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.announcements ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.announcements a SET committee_role_id=(SELECT min(c.id) FROM public.committee_roles c JOIN auth.users u ON lower(u.email)=lower(c.email) WHERE u.id=a.author_id AND c.role_name=a.role_name);
CREATE OR REPLACE FUNCTION public.pack873_announcement_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE selected_name text; owner_id uuid;
BEGIN
  IF NOT public.pack873_directory_access(false) THEN RAISE EXCEPTION 'Sign in and complete password setup before making an announcement'; END IF;
  owner_id=CASE WHEN TG_OP='INSERT' THEN auth.uid() ELSE OLD.author_id END;
  IF owner_id<>auth.uid() AND NOT public.pack873_directory_access(true) THEN RAISE EXCEPTION 'You can only change your own announcements'; END IF;
  IF TG_OP='UPDATE' AND NEW.committee_role_id IS NULL AND OLD.committee_role_id IS NULL THEN
    NEW.role_name=OLD.role_name;
  ELSE
    SELECT c.role_name INTO selected_name FROM public.committee_roles c JOIN auth.users u ON lower(c.email)=lower(u.email)
    WHERE c.id=NEW.committee_role_id AND u.id=owner_id;
    IF selected_name IS NULL THEN RAISE EXCEPTION 'Choose one of the announcement author''s assigned roles'; END IF;
    NEW.role_name=selected_name;
  END IF;
  NEW.author_id=owner_id;
  NEW.created_at=CASE WHEN TG_OP='INSERT' THEN now() ELSE OLD.created_at END;
  NEW.updated_at=now();
  RETURN NEW;
END;
$$;
DROP TRIGGER announcement_author ON public.announcements;
CREATE TRIGGER announcement_author BEFORE INSERT OR UPDATE OF topic_name,topic_description,full_details,committee_role_id ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.pack873_announcement_author();
DROP POLICY announcements_public_read ON public.announcements;
CREATE POLICY announcements_public_read ON public.announcements FOR SELECT TO anon,authenticated USING(deleted_at IS NULL);
-- Browser writes use authenticated RPCs, so edit/delete authorization is checked before every mutation.
REVOKE INSERT ON public.announcements FROM authenticated;
REVOKE INSERT(topic_name,topic_description,full_details) ON public.announcements FROM authenticated;
CREATE FUNCTION public.pack873_announcement_roles(target_author uuid DEFAULT auth.uid())
RETURNS TABLE(assignment_id bigint,role_name text,status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.pack873_directory_access(false) OR (target_author<>auth.uid() AND NOT public.pack873_directory_access(true)) THEN RAISE EXCEPTION 'Announcement access denied'; END IF;
 RETURN QUERY SELECT c.id,c.role_name,c.status FROM public.committee_roles c JOIN auth.users u ON lower(u.email)=lower(c.email) WHERE u.id=target_author ORDER BY c.role_name,c.id;
END;
$$;
CREATE FUNCTION public.pack873_manage_announcements()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.pack873_directory_access(false) THEN RAISE EXCEPTION 'Announcement access denied'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC) FROM (
 SELECT a.*,coalesce((SELECT v.volunteer_name FROM public.volunteers v JOIN auth.users u ON lower(v.email)=lower(u.email) WHERE u.id=a.author_id LIMIT 1),'Committee Member') AS author_name
 FROM public.announcements a WHERE a.author_id=auth.uid() OR public.pack873_directory_access(true)) x),'[]'::jsonb);
END;
$$;
CREATE FUNCTION public.pack873_save_announcement(announcement_id uuid DEFAULT NULL,selected_role bigint DEFAULT NULL,topic text DEFAULT '',brief text DEFAULT '',details text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved_id uuid;
BEGIN
 IF NOT public.pack873_directory_access(false) THEN RAISE EXCEPTION 'Announcement access denied'; END IF;
 IF announcement_id IS NULL THEN
   INSERT INTO public.announcements(topic_name,topic_description,full_details,committee_role_id) VALUES(topic,brief,details,selected_role) RETURNING id INTO saved_id;
 ELSE
   UPDATE public.announcements SET topic_name=topic,topic_description=brief,full_details=details,committee_role_id=selected_role
   WHERE id=announcement_id AND deleted_at IS NULL AND (author_id=auth.uid() OR public.pack873_directory_access(true)) RETURNING id INTO saved_id;
 END IF;
 IF saved_id IS NULL THEN RAISE EXCEPTION 'Announcement not found or access denied'; END IF;
 RETURN saved_id;
END;
$$;
CREATE FUNCTION public.pack873_set_announcement_deleted(announcement_id uuid,is_deleted boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.pack873_directory_access(false) THEN RAISE EXCEPTION 'Announcement access denied'; END IF;
 UPDATE public.announcements SET deleted_at=CASE WHEN is_deleted THEN now() ELSE NULL END,updated_at=now()
 WHERE id=announcement_id AND (author_id=auth.uid() OR public.pack873_directory_access(true));
 IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not found or access denied'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.pack873_announcement_roles(uuid),public.pack873_manage_announcements(),public.pack873_save_announcement(uuid,bigint,text,text,text),public.pack873_set_announcement_deleted(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pack873_announcement_roles(uuid),public.pack873_manage_announcements(),public.pack873_save_announcement(uuid,bigint,text,text,text),public.pack873_set_announcement_deleted(uuid,boolean) TO authenticated;
COMMIT;
