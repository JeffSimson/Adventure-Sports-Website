const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const key=r=>r.deviceId||`${r.userId||''}|${r.endpoint||''}|${r.device||''}`;
function dedupe(rows=[]){
  const byDevice=new Map(),byToken=new Set();
  [...rows].sort((a,b)=>String(a.updatedAt||'').localeCompare(String(b.updatedAt||''))).forEach(r=>{
    if(!r?.token)return;
    const k=key(r);
    if(byToken.has(r.token))return;
    if(k)byDevice.set(k,r);else byDevice.set(`token:${r.token}`,r);
    byToken.add(r.token);
  });
  return [...byDevice.values()];
}
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  let all=dedupe(await getStoreValue('ase-notifications','registrations',[]));
  if(event.httpMethod==='GET'){
    await setStoreValue('ase-notifications','registrations',all);
    const mine=all.filter(x=>x.userId===actor.user.id).map(({token,...x})=>x);
    return json(200,{ok:true,registrations:mine});
  }
  if(event.httpMethod==='DELETE'){
    const body=JSON.parse(event.body||'{}');
    const next=all.filter(x=>!(x.userId===actor.user.id&&(!body.deviceId||x.deviceId===body.deviceId)));
    await setStoreValue('ase-notifications','registrations',next);return json(200,{ok:true});
  }
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const body=JSON.parse(event.body||'{}');if(!body.token)return json(400,{error:'Notification token is required.'});
  const deviceId=String(body.deviceId||'').trim();
  all=all.filter(x=>x.token!==body.token&&!(deviceId&&x.deviceId===deviceId)&&!(x.userId===actor.user.id&&x.endpoint===(body.endpoint||'')&&x.device===(body.device||'')));
  all.push({token:body.token,deviceId,endpoint:body.endpoint||'',userId:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.user_metadata?.name||actor.user.email,role:actor.role,device:body.device||'',platform:body.platform||'',enabled:true,updatedAt:new Date().toISOString()});
  all=dedupe(all).slice(-1000);
  await setStoreValue('ase-notifications','registrations',all);
  return json(200,{ok:true,deviceId,count:all.length});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
