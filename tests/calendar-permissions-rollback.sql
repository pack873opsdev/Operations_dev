-- Run as postgres in DEV SQL Editor. All QA events and changes are rolled back.
BEGIN;
DO $$
DECLARE admin_id uuid; volunteer_id uuid; event_id bigint; affected integer;
BEGIN
 SELECT id INTO admin_id FROM auth.users WHERE raw_app_meta_data->>'pack873_role'='admin' AND raw_app_meta_data->>'pack873_must_change_password' IS DISTINCT FROM 'true' LIMIT 1;
 SELECT id INTO volunteer_id FROM auth.users WHERE raw_app_meta_data->>'pack873_role'='volunteer' LIMIT 1;
 IF admin_id IS NULL OR volunteer_id IS NULL THEN RAISE EXCEPTION 'QA requires existing admin and volunteer logins'; END IF;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO public.calendar_events(event_name,audience,event_date,place,address,start_time,end_time) VALUES('Calendar QA rollback','Wolf','2099-01-01','QA Park','QA Address','09:00','10:00') RETURNING id INTO event_id;
 UPDATE public.calendar_events SET event_name='Admin edited QA' WHERE id=event_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'Admin update failed'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',volunteer_id::text,true);
 SET LOCAL ROLE authenticated;
 UPDATE public.calendar_events SET event_name='Unauthorized change' WHERE id=event_id;
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>0 THEN RAISE EXCEPTION 'Volunteer update was allowed'; END IF;
 BEGIN
  INSERT INTO public.calendar_events(event_name,audience,event_date,place,address,start_time,end_time) VALUES('Unauthorized','Lion','2099-01-01','Place','Address','09:00','10:00');
  RAISE EXCEPTION 'Volunteer insert was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub','',true);
 SET LOCAL ROLE anon;
 IF NOT EXISTS(SELECT 1 FROM public.calendar_events WHERE id=event_id AND event_name='Admin edited QA') THEN RAISE EXCEPTION 'Public calendar read failed'; END IF;
 BEGIN
  INSERT INTO public.calendar_events(event_name,audience,event_date,place,address,start_time,end_time) VALUES('Anonymous','Lion','2099-01-01','Place','Address','09:00','10:00');
  RAISE EXCEPTION 'Anonymous insert was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 RESET ROLE;
END $$;
ROLLBACK;
