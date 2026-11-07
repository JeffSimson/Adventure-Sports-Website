const crypto=require('crypto');
const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const fingerprint=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);
function dedupe(rows=[]){const m=new Map();for(const r of rows){if(!r?.token)continue;const k=r.deviceId||r.token;const old=m.get(k);if(!old||String(r.updatedAt||'')>String(old.updatedAt||''))m.set(k,r)}return [...m.values()]}
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  const settings=await getStoreValue('ase-notifications','settings',{roleVisibility:{}});
  const visibility=settings.roleVisibility?.[actor.role]||{};
  let history=visibility.notificationHistory?await getStoreValue('ase-notifications','history',[]):[];
  if(!visibility.deliveryReports)history=history.map(({targeted,sent,failed,...x})=>x);
  let registrations=dedupe(await getStoreValue('ase-notifications','registrations',[]));
  await setStoreValue('ase-notifications','registrations',registrations);
  if(!visibility.deliveryReports)registrations=[];
  const defaults={categories:{general:true,games:true,weather:true,operations:true,safety:true},quietHours:{enabled:false,start:'22:00',end:'06:00'}};
  const devices=registrations.map(({token,...x})=>({...x,preferences:{...defaults,...(x.preferences||{}),categories:{...defaults.categories,...(x.preferences?.categories||{})},quietHours:{...defaults.quietHours,...(x.preferences?.quietHours||{})}},tokenFingerprint:fingerprint(token)}));
  return json(200,{ok:true,history,devices,visibility,canSend:(settings.sendRoles||[]).includes(actor.role),settings:actor.role==='owner'?settings:undefined});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
