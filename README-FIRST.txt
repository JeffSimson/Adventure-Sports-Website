ADVENTURE SPORTS OPERATIONS HUB — EMERGENCY RESTORE

This ZIP fixes the plain, unstyled Operations Hub shown in your screenshot.

THE ACTUAL PROBLEM:
The /ops/styles.css file is missing from the repository, so the browser is displaying raw HTML.

REPLACE/UPLOAD THESE FILES EXACTLY:
- ops/index.html
- ops/app.js
- ops/styles.css
- netlify/functions/clover-dashboard.js

Do not paste the file text into the browser or inside another file.
Upload the files into the matching folders.

This restores:
- Modern dark-blue sidebar
- Dashboard cards and panels
- Mobile layout
- Website controls
- Clover page
- Front Gate Sales
- Kitchen Sales
- Recent orders
- Top items
- Inventory alerts
- Secure login

After Netlify finishes:
1. Open https://adventurenj.com/ops/
2. Press Command + Shift + R
3. If needed, close the tab and reopen it

The HTML uses version 20 for CSS and JavaScript to force Chrome to download the repaired files.
