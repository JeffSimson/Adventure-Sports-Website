const crypto=require('crypto');
const {json,verifiedUser,requireRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const {sendFCM}=require('./_firebase-fcm');
const {allowsRegistration,categoryFor}=require('./_notification-preferences');
const clean=v=>String(v||'').trim();
const fingerprint=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager']);
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const settings=await getStoreValue('ase-notifications','settings',{sendRoles:['owner','manager']});
  if(!settings.sendRoles?.includes(actor.role))return json(403,{error:'Your role cannot send notifications.'});
  const b=JSON.parse(event.body||'{}'),title=clean(b.title).slice(0,90),body=clean(b.body).slice(0,500);
  if(!title||!body)return json(400,{error:'Title and message are required.'});
  const roles=Array.isArray(b.roles)?b.roles:[],users=Array.isArray(b.users)?b.users:[];
  const all=await getStoreValue('ase-notifications','registrations',[]);
  const category=categoryFor({category:b.category,url:b.url,title});
  const selected=all.filter(r=>(b.audience==='everyone'||roles.includes(r.role)||(settings.allowIndividualTargeting&&users.includes(r.userId)))&&allowsRegistration(r,{category,priority:b.priority||'normal',url:b.url,title}));
  const id=`n_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const payload={title,body,url:b.url||'/ops/',priority:b.priority||'normal',notificationId:id};
  const origin=`https://${event.headers?.host||event.headers?.Host||'adventurenj.com'}`;
  console.log(`[push ${id}] starting; registrations=${all.length}; selected=${selected.length}; audience=${b.audience||'roles'}`);
  const settled=await Promise.allSettled(selected.map(r=>sendFCM(r,payload,origin)));
  const invalidTokens=[],failures=[],accepted=[];
  settled.forEach((res,i)=>{
    const registration=selected[i]||{};
    const device={deviceId:registration.deviceId||'',email:registration.email||'',name:registration.name||'',role:registration.role||'',platform:registration.platform||'',tokenFingerprint:fingerprint(registration.token)};
    if(res.status==='fulfilled'){
      const messageName=res.value?.name||'';
      accepted.push({...device,messageName});
      console.log(`[push ${id}] FCM accepted token=${device.tokenFingerprint} user=${device.email||device.name||'unknown'} message=${messageName||'accepted'}`);
      return;
    }
    const message=res.reason?.message||'Unknown Firebase error';
    const code=res.reason?.code||'';
    failures.push({...device,code,message});
    console.error(`[push ${id}] FCM rejected token=${device.tokenFingerprint} user=${device.email||device.name||'unknown'} code=${code||'unknown'} message=${message}`);
    if(/UNREGISTERED|not found|registration-token-not-registered|Requested entity was not found/i.test(message+' '+code))invalidTokens.push(registration.token);
  });
  if(invalidTokens.length)await setStoreValue('ase-notifications','registrations',all.filter(r=>!invalidTokens.includes(r.token)));
  const sent=accepted.length,failed=failures.length;
  console.log(`[push ${id}] complete; accepted=${sent}; rejected=${failed}; invalidRemoved=${invalidTokens.length}. FCM acceptance confirms handoff, not on-device display.`);
  let history=await getStoreValue('ase-notifications','history',[]);
  const record={id,title,body,category,audience:b.audience||'roles',roles,users,priority:b.priority||'normal',url:b.url||'/ops/',createdAt:new Date().toISOString(),createdBy:{id:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.email,role:actor.role},targeted:selected.length,sent,failed,removedInvalid:invalidTokens.length,accepted:accepted.slice(0,50),failures:failures.slice(0,50)};
  history.unshift(record);history=history.slice(0,250);await setStoreValue('ase-notifications','history',history);
  await appendAudit(actor,'notification-sent',`Sent "${title}" to ${sent} device${sent===1?'':'s'}.`,'🔔');
  return json(200,{ok:true,record});
}catch(e){console.error('[push] fatal error',e);return json(e.statusCode||500,{error:e.message})}};
