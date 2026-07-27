ADVENTURE SPORTS — ONE-SECOND LIVE STATUS

WHAT CHANGED
• The Operations Hub no longer commits field-status changes to GitHub.
• Publishing no longer triggers a Netlify rebuild.
• Status is saved directly to Netlify live storage.
• Every public website page checks the live status once every second.
• Visitors do not need to wait for a deployment.
• Open pages update automatically without being refreshed.

REQUIRED NETLIFY ENVIRONMENT VARIABLES
1. PROJECT_ID = your Netlify Project ID
2. NETLIFY_AUTH_TOKEN = your Netlify personal access token
3. OWNER_EMAIL = davidkeimel5@gmail.com

DEPLOYMENT
Upload this complete ZIP as the website deployment, not only the /ops folder.

EXPECTED RESULT
After pressing Publish in /ops, the public banner should change in about one second.
No new GitHub commit or Netlify build should appear for a status update.
