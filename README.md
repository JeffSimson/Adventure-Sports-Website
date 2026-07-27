# Adventure Sports and Entertainment Website

## Deploy
Upload this whole folder to GitHub, then connect the repo to Netlify.

Build command: leave blank
Publish directory: .

## Admin
After Netlify deploy:
1. Enable Netlify Identity.
2. Set registration to Invite only.
3. Enable Git Gateway.
4. Invite yourself as a user.
5. Open /admin/.

Admin URL:
https://YOUR-SITE.netlify.app/admin/

## Rental form notifications
Go to Netlify > Forms > private-rental-request > Notifications and add:
asejakemollica1@gmail.com
asealec1@gmail.com


## Bulk Event Import

Admin helper page:
`/admin/events-import.html`

How to use:
1. Open `/admin/events-import.html`
2. Paste event blocks
3. Click Generate
4. Copy the JSON result
5. Replace the full contents of `content/events.json` in GitHub
6. Commit changes and Netlify will redeploy

This page is not linked on the public website.

# GitHub-safe version

This version compresses large images so GitHub's browser uploader is less likely to fail.

Upload the extracted contents, not the ZIP itself.


## Upcoming/Past Events

Events now use `startDate` and `endDate` in `content/events.json`.

- `/events.html` shows today and future events only.
- `/events.html?past=1` shows past events.
- Homepage featured events also only shows upcoming events.
