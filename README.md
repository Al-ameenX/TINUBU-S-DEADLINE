# Nigeria 2027 Results Observatory

The original election dashboard is at `/`. Its results link opens `/results.html`, which covers all 774 LGAs, including the six FCT area councils. The geographic directory ships with the site; election records are stored in Netlify Database. No election totals or demonstration results are seeded.

## First administrator

Identity has been enabled. In the project's Netlify dashboard, open **Identity**, invite the administrator, then add the `admin` role to that user and save. The invite opens the site's password setup flow. Invite other editors and assign `reviewer` to allow review decisions without uploads. Roles must be assigned in the dashboard; the application never grants roles through public registration.

The first administrator must be assigned through the dashboard before uploads can be used. A signed-in account without either role cannot modify results. Administrators can upload and review; reviewers can review.

## Uploading and reviewing

1. Open **Editorial desk** on the results page and sign in.
2. Download the JSON template and directory of exact state/LGA names.
3. Replace template values with actual 2027 presidential figures, include all contesting parties, and provide a public HTTPS source-document URL. The template intentionally has an invalid URL to prevent accidental publication.
4. Upload a JSON object containing a `results` array, with up to 774 records and a file size below 1 MB. Counts must be whole numbers; accredited voters cannot exceed registered voters, and total party votes plus rejected ballots cannot exceed accredited voters. Duplicate LGAs within one file are rejected. The entire upload is validated and saved atomically.
5. Select an LGA, inspect the source, and record a verified or disputed decision with a reason. Replacing a result resets its review status. Review history is retained, and version checks prevent a stale review from overwriting newer figures.

Results are publicly readable, including pending and disputed uploads. Verification is editorial, not official INEC certification. Source documents must be publicly accessible; the app links to them rather than hosting uploaded files. JSON result files are uploaded to the database, not stored as public assets.

## Deployment and checks

Netlify publishes `public` and deploys the API function in `netlify/functions`. Database migrations under `netlify/database/migrations` are applied by the platform at deployment. Do not manually apply them. The fresh database may return a service error before its first migration is applied; the explorer retains map/directory access and offers a retry.

Run `npm run check` for TypeScript checks. For local emulation, use `netlify dev --port 8889`. Browser-side sign-in loads the pinned `@netlify/identity` SDK through esm.sh. Data sources and geographic attribution are documented in `public/assets/DATA-SOURCES.md`.
