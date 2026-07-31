const {json,verifiedUser,requireRole,error}=require('./_role-auth');
const {supabase}=require('./_supabase');
const {hashCode,sign,rateLimit,logEvent,clientIp}=require('./_security');

exports.handler=async event=>{try{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const actor=await verifiedUser(event,{allowUnverified:true});
  requireRole(actor,['owner']);
  let body={};
  try{body=JSON.parse(event.body||'{}')}catch{throw error('Invalid request.',400)}
  const code=String(body.code||'').replace(/\D/g,'');
  const trustDevice=body.trustDevice===true;
  if(!/^\d{6}$/.test(code))throw error('Enter the complete 6-digit code.',400);

  await rateLimit(`verify:${actor.user.id}:${clientIp(event)}`,8,600);
  const {data}=await supabase(
    `security_email_challenges?user_id=eq.${encodeURIComponent(actor.user.id)}`+
    `&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`+
    `&attempts=lt.8&order=created_at.desc&limit=1&select=*`
  );
  const challenge=data?.[0];
  const valid=!!challenge&&challenge.code_hash===hashCode(actor.user.id,code);

  if(challenge){
    await supabase(`security_email_challenges?id=eq.${encodeURIComponent(challenge.id)}`,{
      method:'PATCH',
      body:valid?{consumed_at:new Date().toISOString()}:{attempts:Number(challenge.attempts||0)+1},
      headers:{Prefer:'return=minimal'}
    });
  }
  if(!valid){
    await logEvent(event,actor,'email_verification','failure',{trusted_device_requested:trustDevice});
    throw error('That code is incorrect or expired.',401);
  }

  const now=Date.now();
  const stepupExp=now+8*60*60*1000;
  const stepup=sign({sub:actor.user.id,purpose:'ase-stepup',iat:now,exp:stepupExp});
  let trustedDevice=null,trustedDeviceExpiresAt=null;

  if(trustDevice){
    const trustedExp=now+30*24*60*60*1000;
    trustedDevice=sign({sub:actor.user.id,purpose:'ase-trusted-device',iat:now,exp:trustedExp});
    trustedDeviceExpiresAt=new Date(trustedExp).toISOString();
  }

  await supabase('security_profiles',{
    method:'POST',
    body:{
      user_id:actor.user.id,
      email:actor.user.email,
      email_mfa_enabled:true,
      last_verified_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    },
    headers:{Prefer:'resolution=merge-duplicates,return=minimal'}
  });
  await logEvent(event,actor,'email_verification','success',{
    trusted_device_created:!!trustedDevice,
    trusted_device_days:trustedDevice?30:0
  });

  return json(200,{
    ok:true,
    stepup,
    expiresAt:new Date(stepupExp).toISOString(),
    trustedDevice,
    trustedDeviceExpiresAt
  });
}catch(e){
  return json(e.statusCode||500,{error:e.message,code:e.code});
}};
