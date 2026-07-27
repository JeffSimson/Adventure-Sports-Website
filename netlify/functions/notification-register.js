const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  if(event.httpMethod==='GET'){
    const all=await getStoreValue('ase-notifications','registrations',[]);
    const mine=all.filter(x=>x.userId===actor.user.id).map(({token,...x})=>x);
    return json(200,{ok:true,registrations:mine});
  }
  if(event.httpMethod==='DELETE'){
    const body=JSON.parse(event.body||'{}'),all=await getStoreValue('ase-notifications','registrations',[]);
    const next=all.filter(x=>!(x.userId===actor.user.id&&(!body.endpoint||x.endpoint===body.endpoint)));
    await setStoreValue('ase-notifications','registrations',next);return json(200,{ok:true});
  }
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const body=JSON.parse(event.body||'{}');if(!body.token) return json(400,{error:'Notification token is required.'});
  let all=await getStoreValue('ase-notifications','registrations',[]);
  all=all.filter(x=>x.token!==body.token);
  all.push({token:body.token,endpoint:body.endpoint||'',userId:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.user_metadata?.name||actor.user.email,role:actor.role,device:body.device||'',enabled:true,updatedAt:new Date().toISOString()});
  await setStoreValue('ase-notifications','registrations',all.slice(-1000));
  return json(200,{ok:true});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
