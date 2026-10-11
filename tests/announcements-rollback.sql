-- Run in the DEV SQL Editor as postgres. All inserted test rows are rolled back.
BEGIN;
SELECT set_config('request.jwt.claim.sub',(
  SELECT id::text FROM auth.users
  WHERE raw_app_meta_data->>'pack873_role' IN ('volunteer','admin')
  AND raw_app_meta_data->>'pack873_must_change_password' IS DISTINCT FROM 'true'
  ORDER BY (raw_app_meta_data->>'pack873_role'='volunteer') DESC LIMIT 1),true);
SET LOCAL ROLE authenticated;
INSERT INTO public.announcements(topic_name,topic_description,full_details)
VALUES ('Pack 873 announcement rollback QA','Brief line one' || chr(10) || 'Brief line two',repeat('Long details. ',200))
RETURNING role_name,created_at,length(full_details) AS full_details_length;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT topic_name,role_name,length(full_details) AS public_full_details_length
FROM public.announcements WHERE topic_name='Pack 873 announcement rollback QA';
RESET ROLE;
SELECT has_column_privilege('anon','public.announcements','author_id','SELECT') AS public_can_read_author_id,
has_column_privilege('anon','public.announcements','topic_name','INSERT') AS public_can_publish;
SELECT set_config('request.jwt.claim.sub',coalesce((SELECT id::text FROM auth.users
 WHERE raw_app_meta_data->>'pack873_must_change_password'='true' LIMIT 1),''),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.announcements(topic_name) VALUES ('Pending password must be blocked');
    RAISE EXCEPTION 'QA failed: pending password account published';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'Sign in and complete password setup%' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
ROLLBACK;
