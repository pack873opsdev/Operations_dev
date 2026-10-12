BEGIN;
CREATE TABLE public.volunteer_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
 kind text NOT NULL CHECK (kind IN ('form','document','sheet')),
 google_file_id text,
 state text NOT NULL DEFAULT 'creating' CHECK (state IN ('creating','sharing','ready','review')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (user_id,request_id)
);
ALTER TABLE public.volunteer_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.volunteer_files FROM anon,authenticated;
GRANT SELECT ON public.volunteer_files TO authenticated;
GRANT ALL ON public.volunteer_files TO service_role;
CREATE POLICY volunteer_files_read ON public.volunteer_files FOR SELECT TO authenticated
 USING (public.pack873_directory_access(false) AND (user_id=auth.uid() OR public.pack873_directory_access(true)));
-- Only the authenticated Edge Function can reserve a creation request.
-- Lock per user so simultaneous requests cannot bypass the daily limit.
CREATE FUNCTION public.pack873_reserve_file(actor uuid, request uuid, file_title text, file_kind text)
RETURNS public.volunteer_files LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE existing public.volunteer_files;
BEGIN
 PERFORM id FROM auth.users WHERE id=actor FOR UPDATE;
 SELECT * INTO existing FROM public.volunteer_files WHERE user_id=actor AND request_id=request;
 IF FOUND THEN RETURN existing; END IF;
 IF (SELECT count(*) FROM public.volunteer_files WHERE user_id=actor AND created_at>now()-interval '24 hours')>=20 THEN
  RAISE EXCEPTION 'Daily creation limit reached' USING ERRCODE='P0001';
 END IF;
 INSERT INTO public.volunteer_files(user_id,request_id,title,kind) VALUES(actor,request,file_title,file_kind) RETURNING * INTO existing;
 RETURN existing;
END $$;
REVOKE ALL ON FUNCTION public.pack873_reserve_file(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pack873_reserve_file(uuid,uuid,text,text) TO service_role;
COMMIT;
