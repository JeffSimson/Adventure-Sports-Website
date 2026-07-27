const GOOGLE_SCHEDULE_URL =
  process.env.STAFF_GOOGLE_SHEETS_URL ||
  "https://script.google.com/macros/s/AKfycbw9scSqtOlPYdpnHPoqnk04xYDYkjizbv_V4ygmhCNTAH83TSfEtPa-shD8xe9ktmVz/exec";

const GOOGLE_SCHEDULE_KEY =
  process.env.STAFF_GOOGLE_SHEETS_KEY ||
  "ASE-Staff-Live-2026";

const EMPLOYEES = {"gavin jaskewicz":{"displayName":"Gavin Jaskewicz","phone":"484-541-2229","canOpen":true,"canClose":true,"maxHours":6.5},"cj":{"displayName":"CJ","phone":"732-915-6075","canOpen":true,"canClose":true,"maxHours":6.5},"veronica mykolaitis":{"displayName":"Veronica Mykolaitis","phone":"732-910-4510","canOpen":true,"canClose":true,"maxHours":6.5},"kylie oneill":{"displayName":"Kylie Oneill","phone":"609-949-4175","canOpen":true,"canClose":true,"maxHours":6.5},"carly craig":{"displayName":"Carly Craig","phone":"732-915-6683","canOpen":false,"canClose":false,"maxHours":6.5},"jaidin bon":{"displayName":"Jaidin Bon","phone":"631-383-9742","canOpen":false,"canClose":false,"maxHours":6.5},"grace seraphin":{"displayName":"Grace Seraphin","phone":"609-210-3745","canOpen":false,"canClose":false,"maxHours":6.5},"bella bolognese":{"displayName":"Bella Bolognese","phone":"732-580-7285","canOpen":true,"canClose":true,"maxHours":6.5},"noah bravo de rueda":{"displayName":"Noah Bravo De Rueda","phone":"201-957-5067","canOpen":true,"canClose":true,"maxHours":6.5},"ally proske":{"displayName":"Ally Proske","phone":"732-995-3517","canOpen":true,"canClose":true,"maxHours":6.5},"mia castellano":{"displayName":"Mia Castellano","phone":"","canOpen":false,"canClose":false,"maxHours":6.5},"morgan mcgee":{"displayName":"Morgan","phone":"","canOpen":false,"canClose":false,"maxHours":6.5},"gianna palmieri":{"displayName":"Gianna","phone":"","canOpen":false,"canClose":false,"maxHours":6.5},"riley daly":{"displayName":"Riley Daly","phone":"908-930-5478","canOpen":true,"canClose":true,"maxHours":6.5},"skylar daly":{"displayName":"Skylar Daly","phone":"908-217-2047","canOpen":true,"canClose":true,"maxHours":6.5},"ashley palmieri":{"displayName":"Ashley Palmieri","phone":"848-231-4050","canOpen":true,"canClose":true,"maxHours":6.5},"dakota palmieri":{"displayName":"Dakota Palmieri","phone":"848-231-4049","canOpen":true,"canClose":true,"maxHours":6.5},"alex mars":{"displayName":"Alex Mars","phone":"732-674-1576","canOpen":false,"canClose":false,"maxHours":6.5},"shea":{"displayName":"Shea","phone":"","canOpen":false,"canClose":false,"maxHours":6.5},"asha":{"displayName":"Asha","phone":"609-591-5406","canOpen":false,"canClose":false,"maxHours":6.5},"samantha shearer":{"displayName":"Samantha Shearer","phone":"908-447-9906","canOpen":false,"canClose":false,"maxHours":6.5}};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify(body)
});

const clean = value => String(value ?? "")
  .replace(/\u00a0/g, " ")
  .replace(/[–—−]/g, "-")
  .replace(/\s+/g, " ")
  .trim();

function parseHeaderDate(value) {
  const text = clean(value);
  const match = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i
  );
  if (!match) return null;

  const months = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };
  const month = months[match[1].toLowerCase()];
  const day = Number(match[2]);
  const now = new Date();
  let year = now.getUTCFullYear();

  // The workbook currently covers July/August 2026. This keeps year rollover sensible.
  if (month < 2 && now.getUTCMonth() > 9) year += 1;
  if (month > 9 && now.getUTCMonth() < 2) year -= 1;

  const date = new Date(Date.UTC(year, month, day));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeTime(hour, minute, period) {
  let h = Number(hour);
  const m = String(minute || "00").padStart(2, "0");
  let p = String(period || "").toUpperCase();

  if (!p) p = h >= 7 && h <= 11 ? "AM" : "PM";
  h = ((h - 1) % 12) + 1;
  return `${h}:${m} ${p}`;
}

function timeMinutes(value) {
  const match = clean(value).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let h = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(match[2]);
}

function extractTimes(value) {
  const text = clean(value)
    .replace(/(\d{1,2})\s*-\s*(AM|PM)/gi, "$1:00 $2")
    .replace(/(\d{1,2}:\d{2})\s*-\s*(AM|PM)/gi, "$1 $2");

  const matches = [...text.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi)]
    .filter(m => Number(m[1]) <= 12);

  if (matches.length < 2) return null;

  const first = matches[0];
  const second = matches[1];
  let firstPeriod = first[3] ? first[3].toUpperCase() : "";
  let secondPeriod = second[3] ? second[3].toUpperCase() : "";

  if (!firstPeriod && secondPeriod) {
    const firstHour = Number(first[1]);
    const secondHour = Number(second[1]);
    firstPeriod = (secondPeriod === "PM" && firstHour <= secondHour) ? "PM" : "AM";
  }
  if (!secondPeriod && firstPeriod) secondPeriod = firstPeriod;

  let start = normalizeTime(first[1], first[2], firstPeriod);
  let end = normalizeTime(second[1], second[2], secondPeriod);

  // Fix common spreadsheet typos such as 1:00 AM–5:00 PM on an afternoon shift.
  if (timeMinutes(end) - timeMinutes(start) > 12 * 60) {
    start = start.replace(" AM", " PM");
  }
  if (timeMinutes(end) <= timeMinutes(start) && /PM$/i.test(end) && /PM$/i.test(start)) {
    // leave same-day PM values as entered
  }

  const duration = Math.max(0, (timeMinutes(end) - timeMinutes(start)) / 60);
  if (!duration || duration > 16) return null;

  return { start, end, hours: Math.round(duration * 100) / 100 };
}

function roleFromShift(value) {
  const text = String(value || "");
  if (/snow\s*cone/i.test(text)) return "Snow Cone";
  if (/front\s*\/?\s*close/i.test(text) || /\bclose\b/i.test(text)) return "Front / Close";
  if (/kitchen/i.test(text)) return "Kitchen";
  return "Front Gate";
}

function parseGrid(displayValues, sheetName, sourceUpdatedAt) {
  if (!Array.isArray(displayValues)) {
    throw new Error("Google Sheets did not return a displayValues grid.");
  }

  const datesByColumn = {};
  const shifts = [];
  let id = 0;

  for (let rowIndex = 0; rowIndex < displayValues.length; rowIndex++) {
    const row = Array.isArray(displayValues[rowIndex]) ? displayValues[rowIndex] : [];

    for (let col = 0; col < row.length; col++) {
      const date = parseHeaderDate(row[col]);
      if (date) datesByColumn[col] = date;
    }

    for (let col = 0; col < row.length - 1; col++) {
      const date = datesByColumn[col];
      if (!date) continue;

      const original = String(row[col] ?? "").trim();
      const employeeName = clean(row[col + 1]);

      if (!original || !employeeName) continue;
      if (/^(none|name|pgf|\?|n\/a)$/i.test(employeeName)) continue;
      if (!/\d/.test(original)) continue;

      const times = extractTimes(original);
      if (!times) continue;

      const meta = EMPLOYEES[employeeName.toLowerCase()] || {};
      id += 1;
      shifts.push({
        id: `${date}-${id}`,
        date,
        name: employeeName,
        displayName: meta.displayName || employeeName,
        role: roleFromShift(original),
        phone: meta.phone || "",
        canOpen: Boolean(meta.canOpen),
        canClose: Boolean(meta.canClose),
        maxHours: meta.maxHours || 6.5,
        start: times.start,
        end: times.end,
        hours: times.hours,
        original
      });

      // Skip the employee-name column so it is not reprocessed as a shift column.
      col += 1;
    }
  }

  shifts.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    timeMinutes(a.start) - timeMinutes(b.start) ||
    a.displayName.localeCompare(b.displayName)
  );

  const dates = [...new Set(shifts.map(s => s.date))].sort();
  return {
    ok: true,
    live: true,
    source: "Google Sheets",
    sheetName: sheetName || "Base Schedule",
    generatedAt: new Date().toISOString(),
    sourceUpdatedAt: sourceUpdatedAt || null,
    timezone: "America/New_York",
    dates,
    shifts
  };
}

exports.handler = async event => {
  if (event.httpMethod === "OPTIONS") return response(204, {});
  if (event.httpMethod !== "GET") return response(405, { ok: false, error: "Method not allowed." });

  try {
    const url = new URL(GOOGLE_SCHEDULE_URL);
    url.searchParams.set("key", GOOGLE_SCHEDULE_KEY);
    url.searchParams.set("_", Date.now().toString());

    const upstream = await fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
      redirect: "follow"
    });

    const raw = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`Google Sheets returned an unreadable response (${upstream.status}).`);
    }

    if (!upstream.ok || payload.ok === false) {
      throw new Error(payload.error || `Google Sheets request failed (${upstream.status}).`);
    }

    return response(200, parseGrid(
      payload.displayValues,
      payload.sheetName,
      payload.updatedAt
    ));
  } catch (error) {
    console.error("staff-schedule error:", error);
    return response(502, {
      ok: false,
      live: false,
      error: error.message || "The live schedule could not be loaded."
    });
  }
};
