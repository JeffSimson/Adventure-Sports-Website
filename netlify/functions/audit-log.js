const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue}=require('./_v2-storage');
exports.handler=async event=>{try{const actor=await verifiedUser(event);requireRole(actor,['owner']);const entries=await getStoreValue('ase-ops-v2','audit',[]);return json(200,{ok:true,entries})}catch(e){return json(e.statusCode||500,{error:e.message})}};
