ADVENTURE SPORTS OPERATIONS HUB — WEBSITE STATUS HOTFIX

This package fixes the exact problems shown in the screenshot:

• Fixes “Unexpected end of JSON input”
• Restores working facility-status publishing
• Makes every Netlify function return a readable JSON error
• Adds the missing publish-content function
• Adds the missing live-content function
• Cleans up and modernizes the Website Control Center
• Replaces “Clover V2” wording with “Clover”
• Preserves Dashboard V2 and the existing Clover page

UPLOAD AND REPLACE/ADD:

1. ops/index.html
2. ops/app.js
3. ops/styles.css
4. netlify/functions/publish-content.js
5. netlify/functions/live-content.js

Keep all other existing files.

REQUIRED NETLIFY ENVIRONMENT VARIABLE:

GITHUB_TOKEN = a GitHub token with permission to update the repository

The functions automatically use:
JeffSimson/Adventure-Sports-Website
main branch

Optional variables, only if your repository or branch is different:
GITHUB_REPOSITORY
GITHUB_BRANCH

AFTER UPLOAD:

1. Commit the files.
2. Wait for Netlify deployment to finish.
3. Open https://adventurenj.com/ops/#website
4. Press Command + Shift + R.
5. Select a status and press Publish Changes.

The stylesheet and app versions are now 50 to clear Chrome’s old cache.
