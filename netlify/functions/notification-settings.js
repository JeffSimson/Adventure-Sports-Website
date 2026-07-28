const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const DEFAULT={
  roleVisibility:{
    owner:{operationsFeed:true,staffPresence:true,deliveryReports:true,notificationHistory:true},
    manager:{operationsFeed:true,staffPresence:true,deliveryReports:true,notificationHistory:true},
    grounds:{operationsFeed:true,staffPresence:false,deliveryReports:false,notificationHistory:true},
    kitchen:{operationsFeed:true,staffPresence:false,deliveryReports:false,notificationHistory:true},
    cashier:{operationsFeed:true,staffPresence:false,deliveryReports:false,notificationHistory:true}
  },
  sendRoles:['owner','manager'],
  allowIndividualTargeting:true
};
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  if(event.httpMethod==='GET'){const settings=await getStoreValue('ase-notifications','settings',DEFAULT);return json(200,{ok:true,settings,role:actor.role});}
  requireRole(actor,['owner']);if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const body=JSON.parse(event.body||'{}'),settings={...DEFAULT,...body.settings,roleVisibility:{...DEFAULT.roleVisibility,...(body.settings?.roleVisibility||{})}};
  await setStoreValue('ase-notifications','settings',settings);
  await appendAudit(actor,'notification-permissions-updated','Updated notification and feed visibility controls.','🔔');
  return json(200,{ok:true,settings});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
