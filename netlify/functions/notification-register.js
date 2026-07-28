const crypto=require('crypto');
const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const key=r=>r.deviceId||`${r.userId||''}|${r.endpoint||''}|${r.device||''}`;
const fingerprint=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);
function dedupe(rows=[]){
  const byDevice=new Map(),tokenOwner=new Map();
  [...rows].sort((a,b)=>String(a.updatedAt||'').localeCompare(String(b.updatedAt||''))).forEach(r=>{
    if(!r?.token)return;
    const k=key(r)||`token:${r.token}`;
    const previousKey=tokenOwner.get(r.token);
    if(previousKey&&previousKey!==k)byDevice.delete(previousKey);
    byDevice.set(k,r);tokenOwner.set(r.token,k);
  });
  return [...byDevice.values()];
}
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  let all=dedupe(await getStoreValue('ase-notifications','registrations',[]));
  if(event.httpMethod==='GET'){
    await setStoreValue('ase-notifications','registrations',all);
    const mine=all.filter(x=>x.userId===actor.user.id).map(({token,...x})=>({...x,tokenFingerprint:fingerprint(token)}));
    return json(200,{ok:true,registrations:mine});
  }
  if(event.httpMethod==='DELETE'){
    const body=JSON.parse(event.body||'{}');
    const next=all.filter(x=>!(x.userId===actor.user.id&&(!body.deviceId||x.deviceId===body.deviceId)));
    await setStoreValue('ase-notifications','registrations',next);return json(200,{ok:true});
  }
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const body=JSON.parse(event.body||'{}');if(!body.token)return json(400,{error:'Notification token is required.'});
  const deviceId=String(body.deviceId||'').trim(),endpoint=body.endpoint||'',device=body.device||'';
  // Replace this physical device, this exact token, and stale registrations from
  // the same signed-in user/browser pair instead of accumulating duplicates.
  all=all.filter(x=>x.token!==body.token&&!(deviceId&&x.deviceId===deviceId)&&!(x.userId===actor.user.id&&x.endpoint===endpoint&&x.device===device));
  const row={token:body.token,deviceId,endpoint,userId:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.user_metadata?.name||actor.user.email,role:actor.role,device,platform:body.platform||'',enabled:true,updatedAt:new Date().toISOString()};
  all.push(row);all=dedupe(all).slice(-1000);
  await setStoreValue('ase-notifications','registrations',all);
  console.log(`[push-register] user=${row.email} device=${deviceId||'unknown'} token=${fingerprint(row.token)} total=${all.length}`);
  return json(200,{ok:true,deviceId,tokenFingerprint:fingerprint(row.token),count:all.length});
}catch(e){console.error('[push-register] error',e);return json(e.statusCode||500,{error:e.message})}};
