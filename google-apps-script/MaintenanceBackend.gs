/*
OPTIONAL MAINTENANCE SYNC EXTENSION
This is prepared for a later multi-device Google Sheets sync.
The ZIP already works immediately and saves maintenance data in the browser.
Do not replace your working Staff API with this file unless following the setup guide.
*/
const API_KEY = "ASE-Staff-Live-2026";
const MAINTENANCE_SHEET = "Maintenance Data";

function ensureMaintenanceSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(MAINTENANCE_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(MAINTENANCE_SHEET);
    sheet.getRange("A1:B1").setValues([["Key","JSON"]]);
    sheet.hideSheet();
  }
  return sheet;
}

function readMaintenance_() {
  const sheet = ensureMaintenanceSheet_();
  const value = sheet.getRange("B2").getValue();
  if (!value) return null;
  try { return JSON.parse(value); } catch (e) { return null; }
}

function writeMaintenance_(data) {
  const sheet = ensureMaintenanceSheet_();
  sheet.getRange("A2:B2").setValues([["maintenance", JSON.stringify(data)]]);
  SpreadsheetApp.flush();
}

function maintenanceResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/*
To merge this with the existing Staff API:
- In doGet(e), when e.parameter.action === "maintenance", validate key and return:
  maintenanceResponse_({ok:true, data:readMaintenance_(), updatedAt:new Date().toISOString()})
- Add doPost(e) to validate key, JSON.parse(e.postData.contents), call writeMaintenance_(body.data),
  then return maintenanceResponse_({ok:true, updatedAt:new Date().toISOString()})
*/
