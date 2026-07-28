const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const {sendFCM}=require('./_firebase-fcm');
const clean=v=>String(v||'').trim();
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager']);
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const settings=await getStoreValue('ase-notifications','settings',{sendRoles:['owner','manager']});
  if(!settings.sendRoles?.includes(actor.role))return json(403,{error:'Your role cannot send notifications.'});
  const b=JSON.parse(event.body||'{}'),title=clean(b.title).slice(0,90),body=clean(b.body).slice(0,500);
  if(!title||!body)return json(400,{error:'Title and message are required.'});
  const roles=Array.isArray(b.roles)?b.roles:[],users=Array.isArray(b.users)?b.users:[];
  const all=await getStoreValue('ase-notifications','registrations',[]);
  const selected=all.filter(r=>r.enabled!==false&&(
    b.audience==='everyone'||roles.includes(r.role)||(settings.allowIndividualTargeting&&users.includes(r.userId))
  ));
  const id=`n_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const payload={title,body,url:b.url||'/ops/',priority:b.priority||'normal',notificationId:id};
  const origin=`https://${event.headers?.host||event.headers?.Host||'adventurenj.com'}`;
  const results=await Promise.allSettled(selected.map(r=>sendFCM(r,payload,origin)));
  const invalidTokens=[],failures=[];results.forEach((res,i)=>{if(res.status==='rejected'){const message=res.reason?.message||'Unknown Firebase error';const code=res.reason?.code||'';failures.push({deviceId:selected[i].deviceId||'',email:selected[i].email||'',code,message});if(/UNREGISTERED|not found|registration-token-not-registered|Requested entity was not found/i.test(message+' '+code))invalidTokens.push(selected[i].token)}});
  if(invalidTokens.length)await setStoreValue('ase-notifications','registrations',all.filter(r=>!invalidTokens.includes(r.token)));
  const sent=results.filter(x=>x.status==='fulfilled').length,failed=results.length-sent;
  let history=await getStoreValue('ase-notifications','history',[]);
  const record={id,title,body,audience:b.audience||'roles',roles,users,priority:b.priority||'normal',url:b.url||'/ops/',createdAt:new Date().toISOString(),createdBy:{id:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.email,role:actor.role},targeted:selected.length,sent,failed,removedInvalid:invalidTokens.length,failures:failures.slice(0,20)};
  history.unshift(record);history=history.slice(0,250);await setStoreValue('ase-notifications','history',history);
  await appendAudit(actor,'notification-sent',`Sent "${title}" to ${sent} device${sent===1?'':'s'}.`,'🔔');
  return json(200,{ok:true,record});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
