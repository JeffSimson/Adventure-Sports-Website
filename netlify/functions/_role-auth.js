const json=(statusCode,body)=>({
  statusCode,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
  body:JSON.stringify(body)
});
const error=(message,statusCode=500)=>Object.assign(new Error(message),{statusCode});
const VALID_ROLES=['owner','manager','grounds','kitchen'];

function bearer(event){
  const value=event.headers.authorization||event.headers.Authorization||'';
  if(!value.startsWith('Bearer '))throw error('You are not signed in.',401);
  return value;
}
async function verifiedUser(event){
  const authorization=bearer(event);
  const siteUrl=process.env.URL||process.env.DEPLOY_PRIME_URL;
  if(!siteUrl)throw error('Netlify site URL is unavailable.',500);
  const response=await fetch(`${siteUrl}/.netlify/identity/user`,{headers:{Authorization:authorization}});
  if(!response.ok)throw error('Your login session could not be verified.',401);
  const user=await response.json();
  const ownerEmail=String(process.env.OWNER_EMAIL||'').trim().toLowerCase();
  let role=String(user.app_metadata?.role||'').trim().toLowerCase();
  if(ownerEmail&&String(user.email||'').toLowerCase()===ownerEmail)role='owner';
  return {user,role:VALID_ROLES.includes(role)?role:null,authorization};
}
function requireRole(actor,allowed){
  if(!actor.role)throw error('Your account has no assigned app role.',403);
  if(!allowed.includes(actor.role))throw error('You do not have permission to use this feature.',403);
}
function adminToken(context){
  return context?.clientContext?.identity?.token||
    process.env.NETLIFY_IDENTITY_ADMIN_TOKEN||
    process.env.GOTRUE_ADMIN_TOKEN||
    process.env.IDENTITY_ADMIN_TOKEN||
    '';
}
function identityBase(){
  const siteUrl=process.env.URL||process.env.DEPLOY_PRIME_URL;
  if(!siteUrl)throw error('Netlify site URL is unavailable.',500);
  return `${siteUrl}/.netlify/identity`;
}
async function adminFetch(path,context,options={}){
  const token=adminToken(context);
  if(!token)throw error('Identity administration is not configured. See README-ROLES.txt.',500);
  const response=await fetch(identityBase()+path,{
    ...options,
    headers:{
      Authorization:`Bearer ${token}`,
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
  const raw=await response.text();
  let data={};
  if(raw){try{data=JSON.parse(raw)}catch{data={message:raw.slice(0,300)}}}
  if(!response.ok)throw error(data.msg||data.error_description||data.message||`Identity request failed (${response.status}).`,response.status);
  return data;
}
module.exports={json,error,VALID_ROLES,verifiedUser,requireRole,adminFetch};
