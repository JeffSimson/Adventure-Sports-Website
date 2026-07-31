const {json,verifiedUser}=require('./_role-auth');
const {verify,profile}=require('./_security');
exports.handler=async event=>{try{
 const actor=await verifiedUser(event,{allowUnverified:true});
 const token=event.headers['x-ase-stepup']||'';
 const p=await profile(actor.user);
 return json(200,{ok:true,role:actor.role,mfaRequired:actor.role==='owner',mfaVerified:actor.role!=='owner'||verify(token,actor.user.id),security:{emailEnabled:p?.email_mfa_enabled!==false,smsEnabled:!!p?.sms_mfa_enabled,phoneConfigured:!!p?.phone_e164,phoneMasked:p?.phone_e164?`••• ••• ${p.phone_e164.slice(-4)}`:null},user:{id:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.user_metadata?.name||''}})
}catch(e){return json(e.statusCode||500,{error:e.message})}};
