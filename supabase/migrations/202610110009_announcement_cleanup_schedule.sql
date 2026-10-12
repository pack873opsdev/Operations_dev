BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule('pack873-expired-announcements','*/10 * * * *', $job$DELETE FROM public.announcements WHERE deleted_at <= now()-interval '7 days'$job$);
COMMIT;
