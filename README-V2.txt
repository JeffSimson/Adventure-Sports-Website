ADVENTURE SPORTS OPERATIONS HUB — ROLES & PERMISSIONS V2
Generated: 2026-07-27

WHAT V2 ADDS
• Multiple Owners managed inside the app
• Invite a new Owner or promote an existing employee
• Last active Owner cannot be demoted, disabled, or terminated
• Owner-only permission matrix
• Employee profiles: phone, hire date, emergency contact, notes
• Disable and re-enable accounts
• Password-reset emails
• Permanent termination controls
• Audit log for invites, role changes, profiles, disables, resets, permissions, and terminations
• Managers remain limited to Grounds and Kitchen accounts
• Server-side permission checks remain enforced

INITIAL OWNER SETUP
Keep this Netlify environment variable:
OWNER_EMAIL=davidkeimel5@gmail.com

Optional backup bootstrap owners:
OWNER_EMAILS=davidkeimel1@gmail.com

After deployment, sign in as davidkeimel5@gmail.com.
Open People & Permissions > Owners.
From there, invite or promote additional Owners without editing Netlify.

NETLIFY STORAGE REQUIRED FOR PERMANENT V2 DATA
The V2 permission matrix, employee profiles, and audit log use Netlify Blobs REST storage.

Add these environment variables:
NETLIFY_AUTH_TOKEN=<a Netlify personal access token with access to this site>
SITE_ID=<your Netlify Site ID>

Site ID is found under:
Netlify > Site configuration > General > Site details > Site ID

Create a personal access token under:
Netlify user settings > Applications > Personal access tokens

Keep tokens private. Never place them in browser files.

IDENTITY ADMINISTRATION
Netlify Identity admin access must be available to serverless functions.
The package checks these variables:
NETLIFY_IDENTITY_ADMIN_TOKEN
GOTRUE_ADMIN_TOKEN
IDENTITY_ADMIN_TOKEN

Your existing V1 invitation system may already provide this automatically.
If Team Management says Identity administration is not configured, add an admin token server-side.

DEPLOYMENT
1. Unzip this package.
2. Upload the contents as the full site deployment.
3. Add or confirm the environment variables above.
4. Trigger a fresh deploy.
5. Sign out and back in.

ROLE RULES
OWNER
Full access. Can invite/promote/demote Owners and manage all lower roles.
At least one active Owner is always protected.

MANAGER
Can access Clover and operational modules allowed by the permission matrix.
Can invite, change, disable, reset, and terminate Grounds and Kitchen accounts only.
Cannot manage Owners or Managers.

GROUNDS
Default access: Fields & Maintenance and Weather.

KITCHEN
Default access: Kitchen and Weather.

IMPORTANT LIMITATIONS
• Real-time employee online status is not included because Netlify Identity does not provide reliable live-presence tracking.
• Two-factor authentication configuration depends on your identity provider and is not implemented in this ZIP.
• IP/location logging is intentionally not collected by default for employee privacy.
• Fine-grained permission changes are stored and enforced in the app navigation. Existing standalone server functions still retain their own hard server-side restrictions where already implemented.
