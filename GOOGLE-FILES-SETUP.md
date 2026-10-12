# Pack 873 volunteer files

Owner: **pack873ops.dev@gmail.com**. Volunteers create Google Forms, Docs and Sheets through the website; Google Sheets supports File → Download → Microsoft Excel. Each new file is shared as writer only with the authenticated volunteer's email, with no automatic sharing email. Forms are created unpublished. There is no public editing link and no access to the owner's Gmail or other Drive files.

## One-time Google connection

1. Sign in to Google Cloud Console as the Pack account. Select the OAuth project used for the website (or create a dedicated project).
2. Enable **Google Drive API** and **Google Forms API** in APIs & Services → Library. Native Docs and Sheets are created through Drive, so the separate Docs/Sheets APIs are not required for this blank-file creation flow.
3. In Google Auth Platform, configure an external OAuth application. Add the Pack email as a test user while testing. Request only `https://www.googleapis.com/auth/drive.file` for this integration.
4. Create a Web application OAuth client for this feature with authorized redirect URI `https://developers.google.com/oauthplayground`. Keep its client ID and secret outside Git.
5. Open Google's OAuth Playground. In its settings choose **Use your own OAuth credentials** and enter that client's ID and secret. Enter the `drive.file` scope and authorize with **pack873ops.dev@gmail.com**. Exchange the authorization code for tokens.
6. Store the client ID, client secret and refresh token in Supabase → Edge Functions → Secrets as `PACK873_DRIVE_CLIENT_ID`, `PACK873_DRIVE_CLIENT_SECRET`, `PACK873_DRIVE_REFRESH_TOKEN`. Do not paste tokens into chat or commit them. These are separate from the Gmail email-delivery credentials.
7. External OAuth applications in Testing can have refresh tokens expire after seven days. Set up the appropriate production publishing status and consent requirements before relying on the connection. If the connection expires, creation displays a reconnection error; existing files remain in Drive.

## Deployment and validation

Apply migration `supabase/migrations/202610120014_volunteer_files.sql` and deploy `supabase/functions/pack873-volunteer-files-dev/index.ts` as **pack873-volunteer-files-dev**. The function always calls Auth `getUser` and checks current metadata, volunteer record and role assignment. Retain authenticated invocation / JWT verification as configured in the project's existing functions.

Push website changes to main to deploy through Cloudflare. A Google connector in Codex does not authorize the website; the dedicated server OAuth connection above is required.

The file registry uses RLS: authenticated volunteers can read their own records after password setup; administrators can read all registry rows. Creation writes are service-only. An atomic per-user reservation enforces a 20-file / rolling-24-hour limit. Repeated submissions reuse the same request ID; sharing retries reuse the original file. Uncertain creation failures are marked for administrator review to avoid duplicate files. Administrators can inspect `volunteer_files` in Supabase; the UI displays only successfully shared files.

Signed-in Google editor access requires the volunteer's email to be recognized by Google. A non-Gmail email can be used for a Google account. If Google refuses sharing, the file stays owned by the Pack account and retry does not create a new file. Portal logout clears displayed links but does not revoke Google permissions; Google sharing remains until the owner removes it.

Acceptance check after connection: create one Form, Doc and Sheet using an actual volunteer; confirm Pack ownership, volunteer writer access, unpublished Form state, link visibility on returning to the menu, and Excel download from Sheets. A second volunteer must not see those links. No real Google file has been created during mocked tests.

## Official references

- [Drive authorization and drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Create native files](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/create)
- [Create Forms](https://developers.google.com/workspace/forms/api/reference/rest/v1/forms/create)
- [Grant editor access](https://developers.google.com/workspace/drive/api/reference/rest/v3/permissions/create)
- [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
