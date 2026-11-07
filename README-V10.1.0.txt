Adventure Sports V10.1.0 — Premium Public Event Page

Replace these 3 files in the website ROOT:
- event.html
- event-detail.js
- style.css

Then commit + push through GitHub Desktop and let Netlify deploy.

This patch ONLY changes the public event detail/registration page.
It does NOT modify Ops, authentication, Supabase tables, backend functions, events.json, or email settings.

What changed:
- Permanently removes the loading panel after the event renders
- Restores the full V10 event page styling that was missing from the previous hotfix
- Prevents event artwork from tiling/repeating
- Cleaner premium hero layout and overlay
- Contained Adventure logo/nav on event pages
- Better date/time/price/location quick facts
- Cleaner admission & safety cards
- Premium sticky signup panel
- Better form spacing, focus states and green registration CTA
- Better tablet/mobile responsiveness
- Cache version bumped to 10100
