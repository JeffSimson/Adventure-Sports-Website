const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const DEFAULT={owner:['dashboard','website','clover','staff','games','maintenance','weather','reports','kitchen','notifications','users','settings'],manager:['dashboard','clover','staff','games','maintenance','weather','reports','kitchen','notifications','users'],grounds:['maintenance','weather','notifications'],kitchen:['kitchen','weather','notifications'],cashier:['dashboard','notifications']};
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  if(event.httpMethod==='GET'){const p=await getStoreValue('ase-ops-v2','permissions',DEFAULT);p.owner=DEFAULT.owner;return json(200,{ok:true,permissions:p})}
  requireRole(actor,['owner']);if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const b=JSON.parse(event.body||'{}'),p=b.permissions||{};p.owner=DEFAULT.owner;
  for(const r of ['manager','grounds','kitchen','cashier'])if(!Array.isArray(p[r]))p[r]=DEFAULT[r];
  await setStoreValue('ase-ops-v2','permissions',p);await appendAudit(actor,'permissions-updated','Updated the role permission matrix.','⚙');return json(200,{ok:true,permissions:p});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
