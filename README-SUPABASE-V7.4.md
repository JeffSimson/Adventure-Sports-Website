# Adventure Sports Operations Hub V7.4.0 — Supabase Setup

## 1. Run the database migrations
In Supabase, open **SQL Editor** and run these files in order:

1. `supabase/migrations/001-complete-schema.sql`
2. `supabase/migrations/002-starter-data.sql`
3. `supabase/migrations/003-security-setup.sql`

The first migration creates the complete shared operations foundation, indexes, private storage buckets, update triggers, and Row Level Security. The second inserts the eight fields and basic starter records.

## 2. Netlify environment variables
Set these in **Netlify → Site configuration → Environment variables**:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Keep the service-role key secret. It is only read by Netlify Functions and is never included in browser code.

## 3. Deploy
Deploy the project root to Netlify. `netlify.toml` already points to `netlify/functions`.

## 4. Verify
After signing in to `/ops/`, open the browser console and run:

```js
ASE_DATA.health().then(console.log)
ASE_DATA.list('fields').then(console.log)
```

A successful response confirms that Netlify Identity, the secure Netlify Function, and Supabase are connected.

## Included V7.4 APIs
- `/.netlify/functions/ops-data?action=health`
- Shared list/create/update/delete endpoint with table allowlists and role checks
- Browser wrapper at `/ops/supabase-data.js`

## Mobile navigation
On screens 860px wide or smaller:
- Swipe right from the left edge to open the menu.
- Swipe left to close it.
- Tap the backdrop or select a page to close it.
- Vertical scrolling, map gestures, inputs, and horizontally scrollable content remain protected from accidental drawer activation.
