# Pack 873 Operations DEV

Public DEV site: https://pack873-operations-dev.pages.dev

Cloudflare Pages builds `main` with `exit 0` and publishes `Pack873_Website_DEV`. Supabase source stays outside that public directory. Git pushes update the HTML site; they do **not** deploy Supabase functions or run SQL.

## Volunteer login rollout

1. Review the migrations against the existing database. `202610110001` reconstructs the original base table for fresh installations, not a verified schema dump. The master/status migrations were recovered from local exports. On this existing DEV project, verify the first three are already present and apply `202610110004_volunteer_access.sql` in the SQL Editor.
2. Deploy `supabase/functions/pack873-volunteer-access-dev/index.ts` as **pack873-volunteer-access-dev**. The function verifies the caller's session and restricts provisioning and delivery status changes to administrators. Keep JWT verification enabled for legacy JWT projects; if using newer signing keys, follow Supabase's authenticated Edge Function configuration and retain `getUser` validation.
3. The exported deployed function named **pack873-volunteer-email-dev** actually contained volunteer-access code. Its exact source is retained in `supabase/snapshots/deployed_email_function.ts`. Deploy the recovered assignment-email implementation from `supabase/functions/pack873-volunteer-email-dev/index.ts` under that email function name. Existing Gmail OAuth secrets must remain only in Supabase secrets; none are included here.
4. Newly created volunteer accounts use the fixed DEV temporary password **Pack873ops#Dev**. The earlier PACK873_DEV_INITIAL_PASSWORD secret is no longer used. Existing accounts keep their current password; personal passwords are never reset.
5. Sign in as an existing administrator, open **Manage Roles & Volunteers**, and select **Create missing volunteer logins**. Existing accounts and admin roles are preserved. Accounts with an unrelated role are shown as `Existing account` and need separate administrator review.
6. Apply `202610110005_existing_password_delivery.sql` once before deploying the access function. The owner has authorized treating existing volunteers as already sent their temporary password. This records an assumption for current rows only; new rows default to not sent. Accounts that already set a personal password are unchanged. Existing volunteers without login accounts still need provisioning. New volunteers automatically receive the fixed temporary password through Gmail when their login is created. Sent status is recorded only after Gmail accepts the email. Use **Send temporary password** to retry failed delivery. The access function imports `_shared/temporary-password-email.ts`; deploy both files together and retain the Gmail secrets in Supabase. Assignment emails remain a separate feature.
7. Volunteers sign in with their own email, set their chosen password (no custom length or complexity rules; Supabase Auth settings still apply), and are automatically signed in with it. Password setup clears the temporary-password message and sent timestamp. A failed automatic sign-in leaves the new password usable for manual sign-in.

Database access remains blocked until the server clears the first-login flag. The access migration checks current Auth metadata rather than trusting an old JWT. Volunteers have read-only access; writes require an administrator. Passwords are handled through Supabase Auth, not stored in public tables.

The shared DEV default allows someone who knows a volunteer's email and the default to claim an unclaimed login. Use unique temporary passwords or email invitations before inviting real users to a production rollout.

## Validation

Run `node --test tests/volunteer-access.test.cjs` and `node scripts/check-site.cjs`. These use mocked Supabase responses and check browser-script syntax; live Supabase, SQL execution, actual Gmail delivery, and real first-login flows require the rollout above.

Supabase documentation: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid and https://supabase.com/docs/guides/functions/auth-legacy-jwt

## Deployment status — October 11, 2026

- GitHub commits uploaded to main; Cloudflare serves the updated administrator login-status controls.
- Supabase volunteer-access function and corrected assignment-email function deployed through the dashboard.
- Migrations 004 and 005 applied successfully in the existing DEV database. Do not rerun the one-time cutover migration 005.
- Live administrator login-status retrieval succeeds. Gmail secret names are present; no test email was sent during deployment, and inbox delivery remains unverified.
- The dashboard access deployment uses `file2.ts` for the shared email helper; the Git source uses the equivalent `_shared/temporary-password-email.ts` module.
- Four existing volunteer login accounts were created after owner confirmation; live status shows temporary password sent (assumed) and change pending. No emails were sent during provisioning. No personal passwords were reset. The real first-login password-change flow remains to be tested by a volunteer.
