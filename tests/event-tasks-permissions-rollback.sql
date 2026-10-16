-- Run as postgres in DEV. All fixtures and cleanup checks are rolled back.
BEGIN;
DO $$
DECLARE owner_id uuid:=gen_random_uuid(); a_id uuid:=gen_random_uuid(); b_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid(); pending_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
 av bigint; bv bigint; ar bigint; br bigint; eid uuid; tid uuid; result jsonb; failed boolean;
BEGIN
 INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
 (owner_id,'et.owner@example.invalid','{"pack873_role":"volunteer"}'),
 (a_id,'et.a@example.invalid','{"pack873_role":"volunteer"}'),
 (b_id,'et.b@example.invalid','{"pack873_role":"volunteer"}'),
 (outsider_id,'et.outside@example.invalid','{"pack873_role":"volunteer"}'),
 (pending_id,'et.pending@example.invalid','{"pack873_role":"volunteer","pack873_must_change_password":true}'),
 (admin_id,'et.admin@example.invalid','{"pack873_role":"admin"}');
 INSERT INTO public.volunteers(volunteer_name,email) VALUES('Task QA A','et.a@example.invalid') RETURNING id INTO av;
 INSERT INTO public.volunteers(volunteer_name,email) VALUES('Task QA B','et.b@example.invalid') RETURNING id INTO bv;
 INSERT INTO public.volunteer_roles(role_name) VALUES('Event Tasks QA A') RETURNING id INTO ar;
 INSERT INTO public.volunteer_roles(role_name) VALUES('Event Tasks QA B') RETURNING id INTO br;
 INSERT INTO public.committee_roles(role_master_id,volunteer_id,role_name,volunteer_name,email) VALUES(ar,av,'Event Tasks QA A','Task QA A','et.a@example.invalid'),(br,bv,'Event Tasks QA B','Task QA B','et.b@example.invalid');
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 eid:=(public.pack873_event_tasks('create_event','{"title":"QA Event"}') ->>'id')::uuid;
 tid:=(public.pack873_event_tasks('save_task',jsonb_build_object('event_id',eid,'title','Shared task','assignees',jsonb_build_array(av,bv))) ->>'id')::uuid;
 IF (SELECT count(*) FROM public.event_task_assignees WHERE task_id=tid)<>2 THEN RAISE EXCEPTION 'Shared assignment failed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a_id::text,true);
 result:=public.pack873_event_tasks('list');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'events') e WHERE e->>'id'=eid::text) THEN RAISE EXCEPTION 'Assignee cannot see event'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_task_notifications WHERE user_id=a_id AND task_id=tid AND read_at IS NULL) THEN RAISE EXCEPTION 'Assignment notification missing'; END IF;
 failed:=false; BEGIN PERFORM public.pack873_event_tasks('save_task',jsonb_build_object('event_id',eid,'title','Forbidden','assignees',jsonb_build_array(av))); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Assignee changed assignment'; END IF;
 PERFORM public.pack873_event_tasks('update_task',jsonb_build_object('event_id',eid,'task_id',tid,'status','In progress','message','A update'));
 PERFORM set_config('request.jwt.claim.sub',b_id::text,true);
 PERFORM public.pack873_event_tasks('update_task',jsonb_build_object('event_id',eid,'task_id',tid,'status','Completed','message','B final update'));
 IF (SELECT count(DISTINCT author_id) FROM public.event_task_updates WHERE task_id=tid)<>2 THEN RAISE EXCEPTION 'Shared update authors lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.event_task_notifications WHERE user_id=owner_id AND task_id=tid) THEN RAISE EXCEPTION 'Organizer update notification missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',outsider_id::text,true);
 failed:=false; BEGIN PERFORM public.pack873_event_tasks('details',jsonb_build_object('event_id',eid)); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Outsider read private tasks'; END IF;
 PERFORM set_config('request.jwt.claim.sub',pending_id::text,true);
 failed:=false; BEGIN PERFORM public.pack873_event_tasks('list'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Pending password bypass'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 failed:=false; BEGIN PERFORM public.pack873_event_tasks('list'); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Anonymous bypass'; END IF;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 result:=public.pack873_event_tasks('details',jsonb_build_object('event_id',eid));
 IF jsonb_array_length(result->'tasks')<>1 THEN RAISE EXCEPTION 'Admin cannot manage event'; END IF;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 failed:=false; BEGIN PERFORM public.pack873_event_tasks('close_event',jsonb_build_object('event_id',eid,'confirm','no')); EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'Cleanup did not require confirmation'; END IF;
 result:=public.pack873_event_tasks('close_event',jsonb_build_object('event_id',eid,'confirm','CLOSE AND CLEAN UP','summary','All done'));
 IF result->'report'->'tasks'->0->>'final_update'<>'B final update' THEN RAISE EXCEPTION 'Final update not preserved'; END IF;
 IF EXISTS(SELECT 1 FROM public.event_tasks WHERE event_id=eid) OR EXISTS(SELECT 1 FROM public.event_task_updates WHERE task_id=tid) OR EXISTS(SELECT 1 FROM public.event_task_notifications WHERE event_id=eid) THEN RAISE EXCEPTION 'Cleanup incomplete'; END IF;
 PERFORM set_config('request.jwt.claim.sub',a_id::text,true);
 result:=public.pack873_event_tasks('list');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'events') e WHERE e->>'id'=eid::text AND e->'final_report'->>'summary'='All done') THEN RAISE EXCEPTION 'Participant lost final report'; END IF;
END $$;
ROLLBACK;
SELECT 'Event task permissions, shared updates, notifications and atomic cleanup passed' AS result;
