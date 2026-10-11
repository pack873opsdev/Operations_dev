-- Pack 873 DEV: run after the master-list migration.
-- Existing assignments default to Active. No emails are sent by this migration.
BEGIN;
ALTER TABLE public.committee_roles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Active';
UPDATE public.committee_roles SET status = 'Active' WHERE status IS NULL;
ALTER TABLE public.committee_roles
  ALTER COLUMN status SET DEFAULT 'Active',
  ALTER COLUMN status SET NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pack873_dev_committee_status_check' AND conrelid='public.committee_roles'::regclass) THEN
  ALTER TABLE public.committee_roles ADD CONSTRAINT pack873_dev_committee_status_check CHECK (status IN ('Active','Inactive'));
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS pack873_dev_committee_status_idx ON public.committee_roles(status);
COMMIT;
