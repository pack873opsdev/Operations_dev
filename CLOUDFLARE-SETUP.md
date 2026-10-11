# Pack 873 DEV — Cloudflare account and website

## Login

- Login email: `pack873ops.dev@gmail.com` (starts with **pack**, not park).
- Dashboard: https://dash.cloudflare.com/
- Account shown in the dashboard: `Pack873ops.dev@gmail.com's Account`.
- Cloudflare account ID: `ad8e7f260cc95107e1f46b49712d2a00`.
- Password and recovery codes: keep in your password manager; they are not stored in this file.

## Website

- Pages project: `pack873-operations-dev`.
- Public DEV URL: https://pack873-operations-dev.pages.dev/
- Project dashboard: https://dash.cloudflare.com/ad8e7f260cc95107e1f46b49712d2a00/pages/view/pack873-operations-dev
- Connected GitHub repository: https://github.com/pack873opsdev/Operations_dev
- Deployment branch: `main`.
- Framework preset: None.
- Build command: `exit 0`.
- Build output directory: `Pack873_Website_DEV`.
- Root directory: repository root (blank).
- Custom domain: none configured during this setup.

Cloudflare labels the main deployment **Production** even though this project is used for DEV. Git pushes to main trigger automatic website deployments.

## Supabase

- Project name: `Pack873_Operations_DEV`.
- Project reference: `ksgbrkqpjhsdaxfuxmle`.
- Dashboard: https://supabase.com/dashboard/project/ksgbrkqpjhsdaxfuxmle

Supabase functions and SQL must be deployed separately from Cloudflare. Keep Supabase service-role keys and Gmail OAuth credentials in server secrets.

## Verified status

GitHub upload succeeded on October 11, 2026, through commit `7fd48d3`. Both Supabase functions have been deployed and the pending SQL migrations applied successfully. The live administrator login-status controls work. Four existing volunteer login accounts were created with temporary-password delivery assumed; all show change pending. No emails were sent during provisioning.