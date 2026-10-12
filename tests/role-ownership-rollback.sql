-- Run as postgres in the DEV SQL Editor. All QA records are rolled back.
BEGIN;
DO $$
DECLARE suffix text=gen_random_uuid()::text; role_one bigint; role_two bigint; protected_role bigint; volunteer_one bigint; volunteer_two bigint; admin_volunteer bigint; admin_email text; protected_assignment bigint;
BEGIN
 INSERT INTO public.volunteer_roles(role_name) VALUES('QA Owner Role '||suffix) RETURNING id INTO role_one;
 INSERT INTO public.volunteer_roles(role_name) VALUES('QA Second Role '||suffix) RETURNING id INTO role_two;
 INSERT INTO public.volunteer_roles(role_name) VALUES('QA Protected Role '||suffix) RETURNING id INTO protected_role;
 INSERT INTO public.volunteers(volunteer_name,email,phone) VALUES('QA One','qa.one.'||suffix||'@example.invalid','1234567890') RETURNING id INTO volunteer_one;
 INSERT INTO public.volunteers(volunteer_name,email,phone) VALUES('QA Two','qa.two.'||suffix||'@example.invalid','1234567890') RETURNING id INTO volunteer_two;
 INSERT INTO public.committee_roles(role_master_id,volunteer_id,role_name,volunteer_name,email,phone) VALUES(role_one,volunteer_one,'placeholder','placeholder','placeholder@example.invalid',''),(role_two,volunteer_one,'placeholder','placeholder','placeholder@example.invalid','');
 IF (SELECT count(*) FROM public.committee_roles WHERE volunteer_id=volunteer_one)<>2 THEN RAISE EXCEPTION 'Multiple roles per volunteer failed'; END IF;
 BEGIN
  INSERT INTO public.committee_roles(role_master_id,volunteer_id,role_name,volunteer_name,email,phone) VALUES(role_one,volunteer_two,'placeholder','placeholder','placeholder@example.invalid','');
  RAISE EXCEPTION 'Duplicate owner was allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 SELECT email INTO admin_email FROM auth.users WHERE raw_app_meta_data->>'pack873_role'='admin' LIMIT 1;
 IF admin_email IS NULL THEN RAISE EXCEPTION 'QA requires the existing DEV administrator'; END IF;
 SELECT id INTO admin_volunteer FROM public.volunteers WHERE lower(email)=lower(admin_email) LIMIT 1;
 IF admin_volunteer IS NULL THEN INSERT INTO public.volunteers(volunteer_name,email,phone) VALUES('QA Administrator',admin_email,'') RETURNING id INTO admin_volunteer; END IF;
 INSERT INTO public.committee_roles(role_master_id,volunteer_id,role_name,volunteer_name,email,phone) VALUES(protected_role,admin_volunteer,'placeholder','placeholder','placeholder@example.invalid','') RETURNING id INTO protected_assignment;
 -- This newly created QA assignment is protected: the attempted delete must fail.
 BEGIN
  DELETE FROM public.committee_roles WHERE id=protected_assignment;
  RAISE EXCEPTION 'Protected administrator assignment was deleted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Administrator role assignments cannot be deleted' THEN RAISE; END IF;
 END;
 IF NOT EXISTS(SELECT 1 FROM public.committee_roles WHERE id=protected_assignment) THEN RAISE EXCEPTION 'Protected QA assignment missing'; END IF;
END $$;
ROLLBACK;
