-- One-time cutover: the owner assumes delivery for existing volunteers only.
-- This is an assumption, not proof of an email being sent. No passwords change.
BEGIN;
ALTER TABLE public.volunteers ADD COLUMN temporary_password_delivery_assumed boolean NOT NULL DEFAULT false;
UPDATE public.volunteers SET temporary_password_delivery_assumed=true;
UPDATE auth.users u
SET raw_app_meta_data=coalesce(u.raw_app_meta_data,'{}'::jsonb)
  || jsonb_build_object('pack873_temporary_password_sent_at',now(),
                       'pack873_temporary_password_delivery_assumed',true)
WHERE u.raw_app_meta_data->>'pack873_role'='volunteer'
  AND u.raw_app_meta_data->>'pack873_must_change_password'='true'
  AND u.raw_app_meta_data->>'pack873_temporary_password_sent_at' IS NULL
  AND EXISTS (SELECT 1 FROM public.volunteers v WHERE lower(trim(v.email))=lower(u.email));
COMMIT;
