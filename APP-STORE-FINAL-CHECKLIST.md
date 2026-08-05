# Adventure Sports App Store Final Checklist

## Deployment

- Deploy the full V9.3.0 package.
- Confirm `/ops/build.json` reports build `9300` and version `9.3.0`.
- Confirm the sidebar badge shows V9.3.0.
- Run Settings → Launch Center → Run Launch Preflight.
- Run Settings → System Tests → Run Full System Test.

## Account and permissions

- Test one Owner, Manager, Grounds, Kitchen, and Cashier account.
- Confirm confidential Settings, security, database, device, and permission controls are Owner-only.
- Confirm Games & Matrix management is limited to Owners and Managers.
- Confirm Grounds, Kitchen, and Cashier accounts cannot reveal hidden management pages by direct links.
- Test sign-out and forced session termination.

## iPhone and installed-app testing

- Test on the smallest supported iPhone and a current large-screen iPhone.
- Add to Home Screen and launch from the icon.
- Confirm no page-level sideways movement; only tables/matrices scroll horizontally inside their cards.
- Confirm the mobile menu closes after choosing a page and after tapping outside it.
- Confirm tabs open at the top of their content.
- Confirm keyboard use does not push controls outside the screen.
- Confirm orientation changes do not break the layout.
- Confirm the update-required screen and new-version refresh flow.

## Notifications

- Enroll at least two devices.
- Send a test alert to each device.
- Test foreground, background, locked-screen, and tapped-notification behavior.
- Test category opt-outs and quiet hours.
- Confirm emergency/urgent handling follows the approved policy.
- Remove an old device and confirm it stops receiving alerts.

## Game Day and tournament matrix

- Create, autosave, restore, validate, preview, save, publish, duplicate, copy a week, export CSV, and print/PDF a test matrix.
- Confirm duplicate date/time conflicts are blocked.
- Test moving, delaying, canceling, completing, and undoing a game.
- Test lightning hold, countdown, and management-confirmed reopening.
- Confirm the public website board updates and remains visually clean on mobile and desktop.
- Confirm automatic field-open and schedule-change alerts do not send duplicates.

## Connected services

- Verify Clover totals for Today, Yesterday, Week, Month, and a custom range.
- Verify weather, radar, official alerts, and lightning workflows.
- Verify work-order creation, due dates, overdue status, and Operations Center totals.
- Verify database backup, restore policy, maintenance mode, audit history, and system diagnostics.

## Store listing and policy

- Review `privacy.html` and `terms.html` with the business owner or attorney before submission.
- Confirm the support email and support URL are monitored.
- Use the included opaque 1024×1024 App Store icon.
- Confirm screenshots do not display private employee, incident, payment, or customer data.
- Enter the final native app version/build in App Store Connect and archive the approved source package.
