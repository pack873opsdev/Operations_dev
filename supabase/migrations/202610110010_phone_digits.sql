BEGIN;
-- Preserve every existing digit while removing presentation characters.
UPDATE public.volunteers SET phone=regexp_replace(coalesce(phone,''),'[^0-9]','','g') WHERE phone IS DISTINCT FROM regexp_replace(coalesce(phone,''),'[^0-9]','','g');
UPDATE public.committee_roles SET phone=regexp_replace(coalesce(phone,''),'[^0-9]','','g') WHERE phone IS DISTINCT FROM regexp_replace(coalesce(phone,''),'[^0-9]','','g');
ALTER TABLE public.volunteers ADD CONSTRAINT volunteers_phone_digits CHECK(phone ~ '^[0-9]*$');
ALTER TABLE public.committee_roles ADD CONSTRAINT committee_roles_phone_digits CHECK(phone ~ '^[0-9]*$');
COMMIT;
