const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue}=require('./_v2-storage');
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  const settings=await getStoreValue('ase-notifications','settings',{roleVisibility:{}});
  const visibility=settings.roleVisibility?.[actor.role]||{};
  let history=visibility.notificationHistory?await getStoreValue('ase-notifications','history',[]):[];
  if(!visibility.deliveryReports)history=history.map(({targeted,sent,failed,...x})=>x);
  const registrations=visibility.deliveryReports?await getStoreValue('ase-notifications','registrations',[]):[];
  const devices=registrations.map(({token,...x})=>x);
  return json(200,{ok:true,history,devices,visibility,canSend:(settings.sendRoles||[]).includes(actor.role),settings:actor.role==='owner'?settings:undefined});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
