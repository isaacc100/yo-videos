# Youth Onboarding tutorials

A small Cloudflare Pages app for one public parent-support tutorial playlist.

The public page is open to everyone. The `/admin` page uses an app-level admin code stored as the `ADMIN_CODE` Cloudflare secret and a signed HttpOnly session cookie using `SESSION_SECRET`.

After two failed admin sign-in attempts, admin access locks and an unlock code is emailed with Resend. Unlock emails can be resent after 30 seconds, then 60 seconds, then one hour, then one day. Rotating `ADMIN_UNLOCK_RESET_SECRET` also clears the lock.

## Stack

- Cloudflare Pages for hosting
- Cloudflare Pages Functions for `/api/*` and `/media/*`
- Cloudflare D1 for video metadata
- Cloudflare R2 for uploaded videos and thumbnails
- React and Vite for the interface

## Local setup

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run cf:dev
```

Set real local values in `.dev.vars`. Do not commit `.dev.vars`.

## Create Cloudflare resources

Create the D1 database:

```bash
npx wrangler d1 create yo-videos-db
```

Copy the returned `database_id` into `wrangler.toml`.

Apply the migration and seed video:

```bash
npm run db:migrate:remote
```

Create the R2 bucket for videos and thumbnails:

```bash
npx wrangler r2 bucket create yo-videos-videos
```

## Add Cloudflare secrets

Use long random values. Rotate the admin code before production use.

```bash
npx wrangler pages secret put ADMIN_CODE --project-name yo-videos
npx wrangler pages secret put SESSION_SECRET --project-name yo-videos
npx wrangler pages secret put ADMIN_UNLOCK_RESET_SECRET --project-name yo-videos
npx wrangler pages secret put RESEND_API_KEY --project-name yo-videos
```

`SESSION_SECRET` and `ADMIN_UNLOCK_RESET_SECRET` should be at least 32 random bytes. For example:

```bash
openssl rand -hex 32
```

## Deploy with GitHub and Cloudflare Pages

1. Create a private GitHub repository and push this project.
2. In Cloudflare, go to Workers & Pages and create a Pages application.
3. Choose Connect to Git and select the private GitHub repository.
4. Use these build settings:
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/`
5. Keep `wrangler.toml` in the repository so Pages picks up the D1 and R2 bindings.
6. In the Pages project settings, confirm the bindings:
   - `DB` bound to `yo-videos-db`
   - `VIDEOS_BUCKET` bound to `yo-videos-videos`
7. Add the `ADMIN_CODE`, `SESSION_SECRET`, `ADMIN_UNLOCK_RESET_SECRET`, and `RESEND_API_KEY` secrets to the Pages project.
8. Redeploy after adding bindings or secrets.

## Optional Cloudflare Access

Do not protect the full site with Cloudflare Access. Parents need open access to the public playlist.

If you want an extra layer for admin routes, create Access policies only for:

- `/admin`
- `/api/admin/*`

The app-level admin code is still required for editing access.

## Admin

Open `/admin`, enter the admin code, then add, edit, publish, unpublish, delete, or reorder videos.

After two failed admin-code attempts, the admin area locks. Use the emailed unlock code to reopen it, or rotate `ADMIN_UNLOCK_RESET_SECRET` in Cloudflare Pages secrets to clear the lock.

Use the upload controls under the Video URL and Thumbnail URL fields to upload files into R2. Uploaded files return `/media/...` URLs and are public so parents can play videos without signing in. Save the video after uploading so the generated URL is stored in D1.

Use the Parent guide section to set or upload the SJA produced parent guide PDF. This link appears in the public disclosure notice.

Public visitors only see published videos.
