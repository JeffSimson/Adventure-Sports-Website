ADVENTURE SPORTS — STAFF OPERATIONS MODULE

This ZIP is a complete Operations Hub update built from:
Adventure Sports Shift Final JULY.xlsm → July Base Schedule

NEW STAFF FEATURES
• Daily date selector
• Today button
• Scheduled, working-now, later, completed, labor-hour and closing KPIs
• Live shift status based on Eastern Time
• Employee search
• Status filtering
• Opening and closing staff summary
• Daily coverage visualization
• Shift-start timeline
• Mobile-friendly employee cards
• Text and Call shortcuts when a phone number exists in Employee Database
• Current July Base Schedule data through August 1

UPLOAD THE ENTIRE PACKAGE CONTENTS TO THE ROOT OF THE WEBSITE.
At minimum, replace/add:

ops/index.html
ops/styles.css
ops/app.js
ops/staff.js
content/staff-schedule.json

Keep all other existing website files.

AFTER NETLIFY DEPLOYS
1. Open https://adventurenj.com/ops/#staff
2. Press Command + Shift + R on Mac.
3. The page will automatically choose today when today's date exists.

IMPORTANT FOR AUGUST
The Staff page reads content/staff-schedule.json. When the August Base Schedule is ready, that JSON file can be regenerated from the new Base Schedule workbook without changing the Staff page design.
