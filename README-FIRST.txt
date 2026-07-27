ADVENTURE SPORTS — LIVE GOOGLE SHEETS STAFF MODULE

This package connects the Staff page directly to the Google Apps Script API you created.

LIVE CONNECTION INCLUDED:
Google Apps Script URL:
https://script.google.com/macros/s/AKfycbw9scSqtOlPYdpnHPoqnk04xYDYkjizbv_V4ygmhCNTAH83TSfEtPa-shD8xe9ktmVz/exec

API key:
ASE-Staff-Live-2026

WHAT IT DOES:
• Reads the Base Schedule directly from Google Sheets
• Refreshes automatically every 30 seconds
• Refreshes again whenever the page becomes active
• Includes a manual Refresh button
• Shows Live, Syncing, or Offline connection status
• Keeps the previous schedule on screen if one refresh fails
• Falls back to content/staff-schedule.json if the live connection is unavailable
• Uses the existing Staff Operations design
• Does not add Manager Mode or other future features

UPLOAD THE COMPLETE ZIP CONTENTS TO THE WEBSITE ROOT.

Files being added/replaced:
ops/index.html
ops/styles.css
ops/staff.js
content/staff-schedule.json
netlify/functions/staff-schedule.js

Keep every other existing website file.

After Netlify deploys:
1. Open https://adventurenj.com/ops/#staff
2. Press Command + Shift + R once.
3. Confirm the Staff page says “Live.”
4. Change a shift in the Google Sheet.
5. Wait up to 30 seconds or press Refresh.

IMPORTANT:
Your Apps Script must stay deployed as:
Execute as: Me
Who has access: Anyone

The Apps Script must keep returning:
ok
sheetName
updatedAt
displayValues

OPTIONAL SECURITY:
The live URL and key are already included so the ZIP works immediately.
Later, you may add these Netlify environment variables and redeploy:
STAFF_GOOGLE_SHEETS_URL
STAFF_GOOGLE_SHEETS_KEY
