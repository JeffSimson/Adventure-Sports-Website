ADVENTURE SPORTS — FIELD & MAINTENANCE OPERATIONS

UPLOAD:
Upload the complete contents of this ZIP to the website root, exactly like the previous Operations Hub ZIP.

NEW MODULE:
Open Operations Hub → Fields & Maintenance.

WHAT WORKS IMMEDIATELY:
• Eight field cards: A1, A2, B1, B2, C1, C2, D1, D2
• Good / Needs Attention / Maintenance Required status
• Detailed field inspections
• Baseball mound and softball mound condition
• First, second, third base and home plate condition
• Infield, outfield/turf, fencing, and dugout condition
• Needs clay, chalk, packing, dragging, and lining flags
• Per-field closing checklist
• Facility opening checklist
• Facility closing checklist
• Maintenance issue reporting, editing, resolving, and reopening
• Priority and location filters
• Equipment status, hours, fuel/charge, service due, and notes
• Activity history with employee and timestamp
• Mobile-friendly controls and modals
• Data is saved automatically in the browser on the device being used

IMPORTANT ABOUT LIVE MULTI-DEVICE SYNC:
This first ZIP works immediately and does not require changing the working Staff Google Sheet API.
Maintenance records are saved on each device. They are not yet shared between multiple phones/computers.

A prepared optional Google Apps Script extension is included at:
google-apps-script/MaintenanceBackend.gs

That extension can be connected later without changing this dashboard design.

AFTER DEPLOYING:
1. Open https://adventurenj.com/ops/#maintenance
2. Press Command + Shift + R once.
3. Open a field, make an inspection, and press Save Inspection.
4. Refresh the page to confirm the data remains saved.

FILES ADDED OR UPDATED:
ops/index.html
ops/styles.css
ops/maintenance.js
google-apps-script/MaintenanceBackend.gs
README-MAINTENANCE.txt
