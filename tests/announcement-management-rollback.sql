-- DEV SQL Editor / postgres only. Temporary users, assignments and posts are all rolled back.
BEGIN;
DO $$
DECLARE owner_id uuid=gen_random_uuid(); other_id uuid=gen_random_uuid(); admin_id uuid;
role_one bigint; role_two bigint; other_role bigint; post_id uuid; original_date timestamptz;
BEGIN
 SELECT id INTO admin_id FROM auth.users WHERE raw_app_meta_data->>'pack873_role'='admin' LIMIT 1;
 INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
 (owner_id,'pack873.qa.owner@example.invalid','{"pack873_role":"volunteer","pack873_must_change_password":false}'),
 (other_id,'pack873.qa.other@example.invalid','{"pack873_role":"volunteer","pack873_must_change_password":false}');
 INSERT INTO public.committee_roles(role_name,volunteer_name,email,phone,status)
 VALUES('QA Pinewood Derby Lead','QA Owner','pack873.qa.owner@example.invalid','','Active') RETURNING id INTO role_one;
 INSERT INTO public.committee_roles(role_name,volunteer_name,email,phone,status)
 VALUES('QA AOL Den Leader','QA Owner','pack873.qa.owner@example.invalid','','Active') RETURNING id INTO role_two;
 INSERT INTO public.committee_roles(role_name,volunteer_name,email,phone,status)
 VALUES('QA Other Role','QA Other','pack873.qa.other@example.invalid','','Active') RETURNING id INTO other_role;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 IF (SELECT count(*) FROM public.pack873_announcement_roles())<>2 THEN RAISE EXCEPTION 'Multiple assigned roles failed'; END IF;
 post_id=public.pack873_save_announcement(NULL,role_one,'Role test','Brief',repeat('Details. ',200));
 UPDATE public.announcements SET created_at='2026-01-01T00:00:00Z' WHERE id=post_id;
 SELECT created_at INTO original_date FROM public.announcements WHERE id=post_id;
 PERFORM public.pack873_save_announcement(post_id,role_two,'Updated','Updated brief','Updated long details');
 IF NOT EXISTS(SELECT 1 FROM public.announcements WHERE id=post_id AND role_name='QA AOL Den Leader' AND created_at=original_date AND author_id=owner_id) THEN RAISE EXCEPTION 'Role selection or date preservation failed'; END IF;
 BEGIN
   PERFORM public.pack873_save_announcement(NULL,other_role,'Invalid role','','');
   RAISE EXCEPTION 'QA failed: wrong author role allowed';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Choose one of%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',other_id::text,true);
 IF jsonb_array_length(public.pack873_manage_announcements())<>0 THEN RAISE EXCEPTION 'Another author can see management data'; END IF;
 BEGIN
   PERFORM public.pack873_save_announcement(post_id,other_role,'Unauthorized','','');
   RAISE EXCEPTION 'QA failed: another author edited';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Announcement not found%' THEN RAISE; END IF; END;
 BEGIN
   PERFORM public.pack873_set_announcement_deleted(post_id,true);
   RAISE EXCEPTION 'QA failed: another author deleted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Announcement not found%' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
 PERFORM public.pack873_set_announcement_deleted(post_id,true);
 IF NOT EXISTS(SELECT 1 FROM public.announcements WHERE id=post_id AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Owner delete failed'; END IF;
 PERFORM public.pack873_set_announcement_deleted(post_id,false);
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 PERFORM public.pack873_save_announcement(post_id,role_one,'Admin updated','Brief','Full');
 PERFORM public.pack873_set_announcement_deleted(post_id,true);
 IF NOT EXISTS(SELECT 1 FROM public.announcements WHERE id=post_id AND author_id=owner_id AND role_name='QA Pinewood Derby Lead' AND deleted_at IS NOT NULL) THEN RAISE EXCEPTION 'Admin management failed'; END IF;
 PERFORM public.pack873_set_announcement_deleted(post_id,false);
END $$;
ROLLBACK;
