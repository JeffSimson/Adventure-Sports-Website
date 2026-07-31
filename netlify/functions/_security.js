const crypto=require('crypto');
const {supabase}=require('./_supabase');
const {error}=require('./_role-auth');
const secret=()=>process.env.SECURITY_SESSION_SECRET||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const b64=v=>Buffer.from(v).toString('base64url');
const ub64=v=>Buffer.from(v,'base64url').toString('utf8');
function sign(payload){
  const key=secret(); if(!key)throw error('Security session signing is not configured.',503);
  const body=b64(JSON.stringify(payload));
  const sig=crypto.createHmac('sha256',key).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verify(token,userId){
  try{
    const [body,sig]=String(token||'').split('.'); if(!body||!sig)return false;
    const expected=crypto.createHmac('sha256',secret()).update(body).digest('base64url');
    if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return false;
    const p=JSON.parse(ub64(body));
    return p.sub===userId && Number(p.exp)>Date.now() && p.purpose==='ase-stepup';
  }catch{return false}
}
const hashCode=(userId,code)=>crypto.createHash('sha256').update(`${userId}:${code}:${secret()}`).digest('hex');
const randomCode=()=>String(crypto.randomInt(0,1000000)).padStart(6,'0');
const clientIp=e=>String(e.headers['x-nf-client-connection-ip']||e.headers['x-forwarded-for']||'').split(',')[0].trim().slice(0,64);
async function logEvent(event,actor,eventType,outcome='success',metadata={}){
  try{await supabase('security_events',{method:'POST',body:{user_id:actor?.user?.id||null,email:actor?.user?.email||null,event_type:eventType,outcome,ip_address:clientIp(event)||null,user_agent:String(event.headers['user-agent']||'').slice(0,500)||null,metadata},headers:{Prefer:'return=minimal'}})}catch{}
}
async function rateLimit(key,max=5,windowSeconds=300){
  const now=Date.now(); const start=new Date(now-windowSeconds*1000).toISOString();
  const {data}=await supabase(`security_rate_limits?bucket_key=eq.${encodeURIComponent(key)}&select=*`);
  const row=data?.[0];
  if(!row||new Date(row.window_started_at).getTime()<now-windowSeconds*1000){
    await supabase('security_rate_limits',{method:'POST',body:{bucket_key:key,window_started_at:new Date().toISOString(),request_count:1,updated_at:new Date().toISOString()},headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});return;
  }
  if(Number(row.request_count)>=max)throw error('Too many attempts. Please wait and try again.',429);
  await supabase(`security_rate_limits?bucket_key=eq.${encodeURIComponent(key)}`,{method:'PATCH',body:{request_count:Number(row.request_count)+1,updated_at:new Date().toISOString()},headers:{Prefer:'return=minimal'}});
}
async function profile(user){
  const {data}=await supabase(`security_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=*`);
  return data?.[0]||null;
}
function requireStepUp(event,actor){
  if(actor.role!=='owner')return;
  const token=event.headers['x-ase-stepup']||event.headers['X-ASE-Stepup'];
  if(!verify(token,actor.user.id))throw error('A fresh email security code is required.',428);
  try{const body=JSON.parse(ub64(String(token).split('.')[0]));const epoch=new Date(actor.system?.session_epoch||0).getTime();if(Number(body.iat)<epoch)throw error('Your security session was revoked. Verify again.',428)}catch(e){if(e.statusCode)throw e;throw error('A fresh email security code is required.',428)}
}
module.exports={sign,verify,hashCode,randomCode,clientIp,logEvent,rateLimit,profile,requireStepUp};
