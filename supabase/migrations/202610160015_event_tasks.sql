BEGIN;
CREATE TABLE public.task_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200), description text NOT NULL DEFAULT '',
 event_date date, created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz, final_report jsonb
);
CREATE TABLE public.event_tasks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.task_events(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 200), instructions text NOT NULL DEFAULT '', due_date date,
 status text NOT NULL DEFAULT 'Not started' CHECK(status IN('Not started','In progress','Blocked','Completed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.event_task_assignees(
 task_id uuid NOT NULL REFERENCES public.event_tasks(id) ON DELETE CASCADE,
 volunteer_id bigint NOT NULL REFERENCES public.volunteers(id), PRIMARY KEY(task_id,volunteer_id)
);
CREATE TABLE public.event_task_updates(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.event_tasks(id) ON DELETE CASCADE,
 author_id uuid NOT NULL REFERENCES auth.users(id), author_name text NOT NULL,
 message text NOT NULL, status text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.event_task_notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
 event_id uuid NOT NULL REFERENCES public.task_events(id) ON DELETE CASCADE,
 task_id uuid REFERENCES public.event_tasks(id) ON DELETE CASCADE, message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz
);
CREATE INDEX event_tasks_event_idx ON public.event_tasks(event_id);
CREATE INDEX event_assignees_volunteer_idx ON public.event_task_assignees(volunteer_id);
CREATE INDEX event_updates_task_idx ON public.event_task_updates(task_id,created_at);
CREATE INDEX event_notifications_user_idx ON public.event_task_notifications(user_id,created_at);
DO $$DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['task_events','event_tasks','event_task_assignees','event_task_updates','event_task_notifications'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 END LOOP;
END $$;
-- All access is checked inside the single authenticated entry point. No direct table access.
CREATE FUNCTION public.pack873_event_tasks(p_action text,p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); admin boolean; actor_email text; actor_name text;
 ev public.task_events; task public.event_tasks; eid uuid; tid uuid; vid bigint; state text; note text; report jsonb;
BEGIN
 IF NOT public.pack873_directory_access(false) THEN RAISE EXCEPTION 'Sign in and complete password setup first'; END IF;
 admin:=public.pack873_directory_access(true);
 SELECT lower(email) INTO actor_email FROM auth.users WHERE id=actor;
 SELECT volunteer_name INTO actor_name FROM public.volunteers WHERE lower(email)=actor_email;
 actor_name:=coalesce(actor_name,'Committee member');
 IF p_action='list' THEN
  RETURN jsonb_build_object(
   'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'description',e.description,'event_date',e.event_date,'owner_id',e.owner_id,'owner_name',coalesce(v.volunteer_name,'Organizer'),'closed_at',e.closed_at,'final_report',e.final_report,'can_manage',admin OR e.owner_id=actor) ORDER BY e.created_at DESC)
    FROM public.task_events e LEFT JOIN auth.users u ON u.id=e.owner_id LEFT JOIN public.volunteers v ON lower(v.email)=lower(u.email)
    WHERE admin OR e.owner_id=actor OR EXISTS(SELECT 1 FROM public.event_tasks t JOIN public.event_task_assignees a ON a.task_id=t.id JOIN public.volunteers av ON av.id=a.volunteer_id WHERE t.event_id=e.id AND lower(av.email)=actor_email)
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(e.final_report->'participants','[]'::jsonb)) member WHERE member#>>'{}'=actor::text)), '[]'::jsonb),
   'volunteers',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',v.volunteer_name) ORDER BY v.volunteer_name) FROM public.volunteers v WHERE EXISTS(SELECT 1 FROM public.committee_roles c WHERE c.volunteer_id=v.id)), '[]'::jsonb),
   'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC) FROM public.event_task_notifications n WHERE n.user_id=actor AND n.read_at IS NULL),'[]'::jsonb));
 ELSIF p_action='create_event' THEN
  INSERT INTO public.task_events(owner_id,title,description,event_date) VALUES(actor,btrim(p_data->>'title'),coalesce(p_data->>'description',''),nullif(p_data->>'event_date','')::date) RETURNING id INTO eid;
  RETURN jsonb_build_object('id',eid);
 ELSIF p_action='read_notifications' THEN
  UPDATE public.event_task_notifications SET read_at=now() WHERE user_id=actor AND id IN(SELECT value::uuid FROM jsonb_array_elements_text(p_data->'ids'));
  RETURN jsonb_build_object('success',true);
 END IF;
 eid:=(p_data->>'event_id')::uuid;
 -- Event lock serializes task updates and event closure; snapshot and cleanup are atomic.
 SELECT * INTO ev FROM public.task_events WHERE id=eid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
 IF NOT(admin OR ev.owner_id=actor OR EXISTS(SELECT 1 FROM public.event_tasks t JOIN public.event_task_assignees a ON a.task_id=t.id JOIN public.volunteers v ON v.id=a.volunteer_id WHERE t.event_id=eid AND lower(v.email)=actor_email)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(ev.final_report->'participants','[]'::jsonb)) member WHERE member#>>'{}'=actor::text)) THEN RAISE EXCEPTION 'You do not have access to this event'; END IF;
 IF p_action='details' THEN
  RETURN jsonb_build_object('tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'instructions',t.instructions,'due_date',t.due_date,'status',t.status,
   'assignees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'name',v.volunteer_name)) FROM public.event_task_assignees a JOIN public.volunteers v ON v.id=a.volunteer_id WHERE a.task_id=t.id),'[]'::jsonb),
   'updates',coalesce((SELECT jsonb_agg(to_jsonb(up) ORDER BY up.created_at) FROM public.event_task_updates up WHERE up.task_id=t.id),'[]'::jsonb)) ORDER BY t.created_at)
   FROM public.event_tasks t WHERE t.event_id=eid AND (admin OR ev.owner_id=actor OR EXISTS(SELECT 1 FROM public.event_task_assignees a JOIN public.volunteers v ON v.id=a.volunteer_id WHERE a.task_id=t.id AND lower(v.email)=actor_email))),'[]'::jsonb));
 END IF;
 IF ev.closed_at IS NOT NULL THEN RAISE EXCEPTION 'This event is closed'; END IF;
 IF p_action='save_task' THEN
  IF NOT(admin OR ev.owner_id=actor) THEN RAISE EXCEPTION 'Only the organizer or an administrator can assign tasks'; END IF;
  IF jsonb_array_length(coalesce(p_data->'assignees','[]'::jsonb))=0 THEN RAISE EXCEPTION 'Select at least one volunteer'; END IF;
  tid:=nullif(p_data->>'task_id','')::uuid;
  IF tid IS NULL THEN INSERT INTO public.event_tasks(event_id,title,instructions,due_date) VALUES(eid,btrim(p_data->>'title'),coalesce(p_data->>'instructions',''),nullif(p_data->>'due_date','')::date) RETURNING id INTO tid;
  ELSE
   UPDATE public.event_tasks SET title=btrim(p_data->>'title'),instructions=coalesce(p_data->>'instructions',''),due_date=nullif(p_data->>'due_date','')::date WHERE id=tid AND event_id=eid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
   DELETE FROM public.event_task_assignees WHERE task_id=tid;
  END IF;
  FOR vid IN SELECT DISTINCT value::bigint FROM jsonb_array_elements_text(p_data->'assignees') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.committee_roles c WHERE c.volunteer_id=vid) THEN RAISE EXCEPTION 'Assignees must have a committee role'; END IF;
   INSERT INTO public.event_task_assignees VALUES(tid,vid);
  END LOOP;
  INSERT INTO public.event_task_notifications(user_id,event_id,task_id,message)
   SELECT DISTINCT u.id,eid,tid,actor_name||' assigned or updated your task: '||(p_data->>'title') FROM public.event_task_assignees a JOIN public.volunteers v ON v.id=a.volunteer_id JOIN auth.users u ON lower(u.email)=lower(v.email) WHERE a.task_id=tid AND u.id<>actor;
  RETURN jsonb_build_object('id',tid);
 ELSIF p_action='update_task' THEN
  tid:=(p_data->>'task_id')::uuid; SELECT * INTO task FROM public.event_tasks WHERE id=tid AND event_id=eid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF NOT(admin OR ev.owner_id=actor OR EXISTS(SELECT 1 FROM public.event_task_assignees a JOIN public.volunteers v ON v.id=a.volunteer_id WHERE a.task_id=tid AND lower(v.email)=actor_email)) THEN RAISE EXCEPTION 'This task is not assigned to you'; END IF;
  state:=p_data->>'status'; note:=btrim(coalesce(p_data->>'message',''));
  IF state NOT IN('Not started','In progress','Blocked','Completed') OR state IS NULL THEN RAISE EXCEPTION 'Choose a valid status'; END IF;
  IF note='' THEN RAISE EXCEPTION 'Enter an update'; END IF;
  UPDATE public.event_tasks SET status=state WHERE id=tid;
  INSERT INTO public.event_task_updates(task_id,author_id,author_name,message,status) VALUES(tid,actor,actor_name,note,state);
  INSERT INTO public.event_task_notifications(user_id,event_id,task_id,message)
   SELECT recipient,eid,tid,actor_name||' posted an update: '||task.title FROM(
    SELECT ev.owner_id AS recipient UNION SELECT u.id FROM public.event_task_assignees a JOIN public.volunteers v ON v.id=a.volunteer_id JOIN auth.users u ON lower(u.email)=lower(v.email) WHERE a.task_id=tid
   ) recipients WHERE recipient<>actor;
  RETURN jsonb_build_object('success',true);
 ELSIF p_action='close_event' THEN
  IF NOT(admin OR ev.owner_id=actor) THEN RAISE EXCEPTION 'Only the organizer or an administrator can close an event'; END IF;
  IF p_data->>'confirm' IS DISTINCT FROM 'CLOSE AND CLEAN UP' THEN RAISE EXCEPTION 'Confirm cleanup before closing'; END IF;
  SELECT jsonb_build_object('event',ev.title,'organizer',coalesce((SELECT v.volunteer_name FROM public.volunteers v JOIN auth.users u ON lower(u.email)=lower(v.email) WHERE u.id=ev.owner_id),'Organizer'),'event_date',ev.event_date,'closed_at',now(),'summary',coalesce(p_data->>'summary',''),
   'participants',coalesce((SELECT jsonb_agg(DISTINCT u.id) FROM public.event_tasks t JOIN public.event_task_assignees a ON a.task_id=t.id JOIN public.volunteers v ON v.id=a.volunteer_id JOIN auth.users u ON lower(u.email)=lower(v.email) WHERE t.event_id=eid),'[]'::jsonb),
   'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('title',t.title,'owners',(SELECT string_agg(v.volunteer_name,', ' ORDER BY v.volunteer_name) FROM public.event_task_assignees a JOIN public.volunteers v ON v.id=a.volunteer_id WHERE a.task_id=t.id),'status',t.status,'due_date',t.due_date,'final_update',(SELECT up.message FROM public.event_task_updates up WHERE up.task_id=t.id ORDER BY up.created_at DESC,up.id DESC LIMIT 1),'last_update_at',(SELECT max(up.created_at) FROM public.event_task_updates up WHERE up.task_id=t.id)) ORDER BY t.created_at) FROM public.event_tasks t WHERE t.event_id=eid),'[]'::jsonb)) INTO report;
  UPDATE public.task_events SET final_report=report,closed_at=now(),description='' WHERE id=eid;
  DELETE FROM public.event_task_notifications WHERE event_id=eid;
  DELETE FROM public.event_tasks WHERE event_id=eid;
  RETURN jsonb_build_object('report',report);
 ELSE RAISE EXCEPTION 'Unknown action';
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.pack873_event_tasks(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pack873_event_tasks(text,jsonb) TO authenticated;
COMMIT;
