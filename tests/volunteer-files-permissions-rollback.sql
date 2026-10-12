BEGIN;
DO $$ DECLARE actor uuid; other_actor uuid;
BEGIN
 SELECT id INTO actor FROM auth.users WHERE raw_app_meta_data->>'pack873_role'='volunteer' AND raw_app_meta_data->>'pack873_must_change_password' IS DISTINCT FROM 'true' LIMIT 1;
 SELECT id INTO other_actor FROM auth.users WHERE id<>actor LIMIT 1;
 IF actor IS NULL OR other_actor IS NULL THEN RAISE EXCEPTION 'Two existing accounts, including a completed volunteer, are required for this test'; END IF;
 INSERT INTO public.volunteer_files(user_id,request_id,title,kind) VALUES
 (actor,'e9866c12-9adf-471c-a4f9-1e5b239b4115','QA rollback only','sheet'),
 (other_actor,'e9866c12-9adf-471c-a4f9-1e5b239b4115','QA rollback only','document');
 PERFORM set_config('request.jwt.claims',json_build_object('sub',actor,'role','authenticated')::text,true);
END $$;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.volunteer_files WHERE request_id='e9866c12-9adf-471c-a4f9-1e5b239b4115')<>1 THEN RAISE EXCEPTION 'Volunteer file isolation failed'; END IF;
 IF has_table_privilege(current_user,'public.volunteer_files','INSERT') THEN RAISE EXCEPTION 'Volunteers must not insert directly'; END IF;
 IF has_function_privilege(current_user,'public.pack873_reserve_file(uuid,uuid,text,text)','EXECUTE') THEN RAISE EXCEPTION 'Volunteers must not invoke the service reservation'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF has_table_privilege(current_user,'public.volunteer_files','SELECT') THEN RAISE EXCEPTION 'Public visitors must not read volunteer file links'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'Volunteer file isolation, direct-write denial and anonymous denial passed; no records retained' AS result;
