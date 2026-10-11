# Pack 873 Operations DEV

Public DEV site: https://pack873-operations-dev.pages.dev

Cloudflare Pages builds `main` with `exit 0` and publishes `Pack873_Website_DEV`. Supabase source stays outside that public directory. Git pushes update the HTML site; they do **not** deploy Supabase functions or run SQL.

## Volunteer login rollout

1. Review the migrations against the existing database. `202610110001` reconstructs the original base table for fresh installations, not a verified schema dump. The master/status migrations were recovered from local exports. On this existing DEV project, verify the first three are already present and apply `202610110004_volunteer_access.sql` in the SQL Editor.
2. Deploy `supabase/functions/pack873-volunteer-access-dev/index.ts` as **pack873-volunteer-access-dev**. The function verifies the caller's session and restricts provisioning and delivery status changes to administrators. Keep JWT verification enabled for legacy JWT projects; if using newer signing keys, follow Supabase's authenticated Edge Function configuration and retain `getUser` validation.
3. The exported deployed function named **pack873-volunteer-email-dev** actually contained volunteer-access code. Its exact source is retained in `supabase/snapshots/deployed_email_function.ts`. Deploy the recovered assignment-email implementation from `supabase/functions/pack873-volunteer-email-dev/index.ts` under that email function name. Existing Gmail OAuth secrets must remain only in Supabase secrets; none are included here.
4. The access function uses `PACK873_DEV_INITIAL_PASSWORD` if configured, otherwise the requested DEV default **Pack873#ops**. If an old secret is configured, change it to the requested value in Supabase before provisioning. Never reset personal passwords on existing accounts. Existing temporary accounts retain their current password; newly created accounts receive the configured default.
5. Sign in as an existing administrator, open **Manage Roles & Volunteers**, and select **Create missing volunteer logins**. Existing accounts and admin roles are preserved. Accounts with an unrelated role are shown as `Existing account` and need separate administrator review.
6. Deliver the temporary password securely to each volunteer; then use **Mark temporary password sent** to record actual delivery. No emails are sent by provisioning or marking delivery. Assignment emails remain a separate feature.
7. Volunteers sign in with their own email, set a different password of at least 12 characters, and are automatically signed in with it. Password setup clears the temporary-password message and sent timestamp. A failed automatic sign-in leaves the new password usable for manual sign-in.

Database access remains blocked until the server clears the first-login flag. The access migration checks current Auth metadata rather than trusting an old JWT. Volunteers have read-only access; writes require an administrator. Passwords are handled through Supabase Auth, not stored in public tables.

The shared DEV default allows someone who knows a volunteer's email and the default to claim an unclaimed login. Use unique temporary passwords or email invitations before inviting real users to a production rollout.

## Validation

Run `node --test tests/volunteer-access.test.cjs` and `node scripts/check-site.cjs`. These use mocked Supabase responses and check browser-script syntax; live Supabase, SQL execution, actual Gmail delivery, and real first-login flows require the rollout above.

Supabase documentation: https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid and https://supabase.com/docs/guides/functions/auth-legacy-jwt
