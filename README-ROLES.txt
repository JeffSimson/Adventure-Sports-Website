ADVENTURE SPORTS — ROLES, INVITES & PERMISSIONS

DEPLOYMENT
Upload the complete contents of this ZIP to the website root.

REQUIRED NETLIFY SETUP
1. Open Netlify > Site configuration > Environment variables.
2. Add:
   OWNER_EMAIL = the email address that should always be treated as the Owner.
3. Redeploy the site after adding the variable.

Netlify Identity must already be enabled because this Operations Hub uses it for login.

IDENTITY ADMINISTRATION
The included Team Management function first uses Netlify's secure Identity admin token supplied to serverless functions.
If your Netlify setup does not expose that token automatically, add one of these server-side environment variables:
   NETLIFY_IDENTITY_ADMIN_TOKEN
or:
   GOTRUE_ADMIN_TOKEN

Never place that token in browser JavaScript or a public file.

ROLES
OWNER
• Full app access
• Website Control
• Clover
• Staffing, reports, maintenance, weather, kitchen
• Invite Managers, Grounds, and Kitchen
• Change or terminate accounts below Owner
• Owner accounts are protected

MANAGER
• Dashboard, Clover, Staffing, Games, Maintenance, Weather, Reports, Kitchen
• Invite Grounds and Kitchen
• Change Grounds ↔ Kitchen
• Terminate Grounds and Kitchen
• Cannot manage Owners or Managers
• Cannot publish public website changes

GROUNDS
• Fields & Maintenance
• Weather Center

KITCHEN
• Kitchen Center
• Weather Center

SECURITY INCLUDED
• Tabs are hidden according to role
• Unauthorized hash routes are redirected
• Clover is checked server-side for Owner/Manager
• Website publishing is checked server-side for Owner only
• Team-management rules are checked server-side
• Managers cannot promote users to Manager or Owner
• Managers cannot edit or terminate another Manager
• Users cannot change or terminate their own account
• Termination requires typing TERMINATE

HOW INVITES WORK
1. Owner or Manager opens Team Management.
2. Enter employee name and email.
3. Select an allowed role.
4. The employee receives a Netlify Identity invitation.
5. After accepting and creating a password, the employee sees only the tabs assigned to the role.

IMPORTANT
The Kitchen page is included as a role destination, but its full inventory/checklist module is still a placeholder.
