const crypto=require('crypto');
const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {sendFCM}=require('./_firebase-fcm');
const key=r=>r.deviceId||`${r.userId||''}|${r.endpoint||''}|${r.device||''}`;
const fingerprint=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);
const DEFAULT_PREFS={categories:{general:true,games:true,weather:true,operations:true,safety:true},quietHours:{enabled:false,start:'22:00',end:'06:00'}};
function dedupe(rows=[]){const byDevice=new Map(),tokenOwner=new Map();[...rows].sort((a,b)=>String(a.updatedAt||'').localeCompare(String(b.updatedAt||''))).forEach(r=>{if(!r?.token)return;const k=key(r)||`token:${r.token}`,previousKey=tokenOwner.get(r.token);if(previousKey&&previousKey!==k)byDevice.delete(previousKey);byDevice.set(k,r);tokenOwner.set(r.token,k)});return[...byDevice.values()]}
const publicRow=r=>{const{token,...x}=r;return{...x,preferences:{...DEFAULT_PREFS,...(x.preferences||{}),categories:{...DEFAULT_PREFS.categories,...(x.preferences?.categories||{})},quietHours:{...DEFAULT_PREFS.quietHours,...(x.preferences?.quietHours||{})}},tokenFingerprint:fingerprint(token)}};
exports.handler=async event=>{try{
 const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
 let all=dedupe(await getStoreValue('ase-notifications','registrations',[]));
 if(event.httpMethod==='GET'){await setStoreValue('ase-notifications','registrations',all);const scope=event.queryStringParameters?.scope==='all'&&actor.role==='owner'?'all':'mine';const rows=scope==='all'?all:all.filter(x=>x.userId===actor.user.id);return json(200,{ok:true,registrations:rows.map(publicRow),scope})}
 if(event.httpMethod==='DELETE'){
  const body=JSON.parse(event.body||'{}'),target=all.find(x=>x.deviceId===body.deviceId||x.token===body.token);
  if(target&&actor.role!=='owner'&&target.userId!==actor.user.id)return json(403,{error:'You can only remove your own device.'});
  const next=all.filter(x=>!(body.deviceId&&x.deviceId===body.deviceId)&&!(body.token&&x.token===body.token)&&!(body.removeMine&&x.userId===actor.user.id));
  await setStoreValue('ase-notifications','registrations',next);return json(200,{ok:true,removed:all.length-next.length});
 }
 if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
 const body=JSON.parse(event.body||'{}'),action=String(body.action||'register');
 if(action==='test'){
  requireRole(actor,['owner','manager']);const reg=all.find(x=>x.deviceId===body.deviceId);if(!reg)return json(404,{error:'That enrolled device was not found.'});
  if(actor.role!=='owner'&&reg.userId!==actor.user.id)return json(403,{error:'Managers may only test their own device.'});
  const origin=`https://${event.headers?.host||event.headers?.Host||'adventurenj.com'}`;
  const result=await sendFCM(reg,{title:'Adventure Sports Test Alert',body:'Push notifications are working on this device.',url:'/ops/#notifications',priority:'normal',notificationId:`test_${Date.now()}`},origin);
  return json(200,{ok:true,result,message:'Test notification handed to Firebase.'});
 }
 if(action==='preferences'||action==='rename'){
  const reg=all.find(x=>x.deviceId===body.deviceId);if(!reg)return json(404,{error:'That enrolled device was not found.'});
  if(actor.role!=='owner'&&reg.userId!==actor.user.id)return json(403,{error:'You can only edit your own device.'});
  if(action==='rename')reg.label=String(body.label||'').trim().slice(0,80);
  if(action==='preferences')reg.preferences={...DEFAULT_PREFS,...(reg.preferences||{}),categories:{...DEFAULT_PREFS.categories,...(reg.preferences?.categories||{}),...(body.preferences?.categories||{})},quietHours:{...DEFAULT_PREFS.quietHours,...(reg.preferences?.quietHours||{}),...(body.preferences?.quietHours||{})}};
  reg.updatedAt=new Date().toISOString();await setStoreValue('ase-notifications','registrations',dedupe(all));return json(200,{ok:true,registration:publicRow(reg)});
 }
 if(!body.token)return json(400,{error:'Notification token is required.'});
 const deviceId=String(body.deviceId||'').trim(),endpoint=body.endpoint||'',device=body.device||'';
 const existing=all.find(x=>(deviceId&&x.deviceId===deviceId)||(x.userId===actor.user.id&&x.endpoint===endpoint&&x.device===device));
 all=all.filter(x=>x.token!==body.token&&!(deviceId&&x.deviceId===deviceId)&&!(x.userId===actor.user.id&&x.endpoint===endpoint&&x.device===device));
 const row={token:body.token,deviceId,endpoint,userId:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.user_metadata?.name||actor.user.email,role:actor.role,label:existing?.label||body.label||'',device,platform:body.platform||'',enabled:true,preferences:existing?.preferences||DEFAULT_PREFS,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 all.push(row);all=dedupe(all).slice(-1000);await setStoreValue('ase-notifications','registrations',all);
 return json(200,{ok:true,deviceId,tokenFingerprint:fingerprint(row.token),count:all.length,registration:publicRow(row)});
}catch(e){console.error('[push-register] error',e);return json(e.statusCode||500,{error:e.message})}};
