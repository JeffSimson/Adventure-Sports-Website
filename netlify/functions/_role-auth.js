const {getStoreValue}=require('./_v2-storage');
const {supabase}=require('./_supabase');
const SECURITY_HEADERS={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json=(statusCode,body)=>({statusCode,headers:SECURITY_HEADERS,body:JSON.stringify(body)});
const error=(message,statusCode=500,code='APP_ERROR')=>Object.assign(new Error(message),{statusCode,code});
const VALID_ROLES=['owner','manager','grounds','kitchen','cashier'];
const DEFAULT_GRANTS={
 owner:['*'],
 manager:['ops.read','ops.write','games.manage','staff.manage','maintenance.manage','inventory.manage','incidents.manage','notifications.view'],
 grounds:['ops.read','maintenance.manage','inventory.manage','incidents.create','notifications.view'],
 kitchen:['ops.read','inventory.manage','maintenance.create','incidents.create','notifications.view'],
 cashier:['ops.read','notifications.view']
};
function bearer(event){const value=event.headers.authorization||event.headers.Authorization||'';if(!value.startsWith('Bearer '))throw error('You are not signed in.',401,'AUTH_REQUIRED');return value}
async function systemSettings(){const {data}=await supabase('security_system_settings?singleton=eq.true&select=*');return data?.[0]||{maintenance_mode:false,session_epoch:new Date(0).toISOString()}}
async function accountControl(userId){const {data}=await supabase(`security_account_controls?user_id=eq.${encodeURIComponent(userId)}&select=*`);return data?.[0]||null}
async function verifiedUser(event,options={}){
  const authorization=bearer(event),siteUrl=process.env.URL||process.env.DEPLOY_PRIME_URL;
  if(!siteUrl)throw error('Netlify site URL is unavailable.',500,'CONFIG_ERROR');
  const response=await fetch(`${siteUrl}/.netlify/identity/user`,{headers:{Authorization:authorization}});
  if(!response.ok)throw error('Your login session could not be verified.',401,'INVALID_SESSION');
  const user=await response.json();
  const bootstrap=[process.env.OWNER_EMAIL,...String(process.env.OWNER_EMAILS||'').split(',')].filter(Boolean).map(x=>String(x).trim().toLowerCase());
  let role=String(user.app_metadata?.role||'').trim().toLowerCase();if(bootstrap.includes(String(user.email||'').toLowerCase()))role='owner';
  const actor={user,role:VALID_ROLES.includes(role)?role:null,authorization};
  const control=await accountControl(user.id);if(control?.disabled)throw error('This Operations Hub account has been disabled.',403,'ACCOUNT_DISABLED');
  actor.system=await systemSettings();
  if(!options.allowUnverified&&actor.role==='owner'){const {requireStepUp}=require('./_security');requireStepUp(event,actor)}
  return actor;
}
function requireRole(actor,allowed){if(!actor.role)throw error('Your account has no assigned app role.',403,'ROLE_REQUIRED');if(!allowed.includes(actor.role))throw error('You do not have permission to use this feature.',403,'FORBIDDEN')}
async function grantsFor(actor){if(actor.role==='owner')return new Set(['*']);const {data}=await supabase(`security_permission_grants?role=eq.${encodeURIComponent(actor.role)}&enabled=eq.true&select=permission`);const custom=(data||[]).map(x=>x.permission);return new Set(custom.length?custom:(DEFAULT_GRANTS[actor.role]||[]))}
async function requirePermission(actor,permission){const grants=await grantsFor(actor);if(!(grants.has('*')||grants.has(permission)))throw error('Your account is not allowed to perform this action.',403,'PERMISSION_DENIED')}
function requireWritable(actor){if(actor.system?.maintenance_mode&&actor.role!=='owner')throw error(actor.system.maintenance_message||'The Operations Hub is temporarily read-only.',423,'MAINTENANCE_MODE')}
function adminToken(context){return context?.clientContext?.identity?.token||process.env.NETLIFY_IDENTITY_ADMIN_TOKEN||process.env.GOTRUE_ADMIN_TOKEN||process.env.IDENTITY_ADMIN_TOKEN||''}
function identityBase(){const siteUrl=process.env.URL||process.env.DEPLOY_PRIME_URL;if(!siteUrl)throw error('Netlify site URL is unavailable.',500);return `${siteUrl}/.netlify/identity`}
async function adminFetch(path,context,options={}){const token=adminToken(context);if(!token)throw error('Identity administration is not configured.',500);const response=await fetch(identityBase()+path,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}});const raw=await response.text();let data={};if(raw){try{data=JSON.parse(raw)}catch{data={message:raw.slice(0,300)}}}if(!response.ok)throw error(data.msg||data.error_description||data.message||`Identity request failed (${response.status}).`,response.status);return data}
async function effectiveRole(user){const bootstrap=[process.env.OWNER_EMAIL,...String(process.env.OWNER_EMAILS||'').split(',')].filter(Boolean).map(x=>x.trim().toLowerCase());if(bootstrap.includes(String(user.email||'').toLowerCase()))return 'owner';const r=String(user.app_metadata?.role||'').toLowerCase();return VALID_ROLES.includes(r)?r:null}
module.exports={json,error,VALID_ROLES,verifiedUser,requireRole,requirePermission,requireWritable,systemSettings,adminFetch,effectiveRole};
