# Adventure Sports V7.5.0 — Security Hardening Phase One

This release adds mandatory Owner verification using a six-digit email code, plus optional text-message codes through Twilio Verify.

## 1. Run the new Supabase migration

In Supabase, open **SQL Editor → New query** and run only:

`supabase/migrations/005-security-hardening.sql`

Do not reset the database and do not rerun migrations 001–004.

## 2. Create a long security-session secret

Generate a random value of at least 32 characters. In Netlify, add:

- `SECURITY_SESSION_SECRET`

Use a password manager or random generator. Do not place this value in any project file.

## 3. Configure email codes with Resend

Create or use a Resend account, verify a sending domain, and add these Netlify environment variables:

- `RESEND_API_KEY`
- `SECURITY_EMAIL_FROM`

Example sender after the domain is verified:

`Adventure Sports Security <security@yourdomain.com>`

Until these values are configured, Owner accounts will not be able to receive the required email code.

## 4. Configure SMS codes with Twilio Verify

In Twilio, create a Verify Service. Add these Netlify environment variables:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`

The Verify Service SID normally starts with `VA`.

## 5. Deploy

Upload the unzipped V7.5.0 project to Netlify. Then use **Trigger deploy → Clear cache and deploy site**.

## 6. First Owner login

1. Sign in with the normal email and password.
2. Choose **Email code**.
3. Enter the six-digit code from the email.
4. Open **Settings → Security Center**.
5. Enter the Owner phone in international format, such as `+19085551234`.
6. Check **Allow text-message verification codes** and save.

The next Owner verification screen will offer both email and SMS.

## Security behavior

- Owner access requires a fresh second-step verification.
- The verified Owner session lasts eight hours in the current browser tab/session.
- Security codes expire after ten minutes.
- Repeated code requests and verification attempts are rate limited.
- Database deletes are Owner-only.
- Database writes use explicit table and column allowlists.
- UUID, role, ownership, and system fields cannot be changed through the generic Database Center API.
- Security events are written to `security_events`.
- Private endpoints return no-store headers.

## Important limitation

This is Phase One hardening, not a claim that the application is penetration-tested or impossible to compromise. A professional security review is still recommended before storing highly sensitive payroll, medical, or financial records.
