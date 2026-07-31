const {json,verifiedUser,requireRole}=require('./_role-auth');
const {profile,verify}=require('./_security');
exports.handler=async event=>{try{
 const actor=await verifiedUser(event,{allowUnverified:true});requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
 const p=await profile(actor.user); const token=event.headers['x-ase-stepup']||'';
 return json(200,{ok:true,role:actor.role,mfaRequired:actor.role==='owner',verified:actor.role!=='owner'||verify(token,actor.user.id),email:actor.user.email,phoneConfigured:!!p?.phone_e164,smsEnabled:!!p?.sms_mfa_enabled,emailEnabled:p?.email_mfa_enabled!==false,phoneMasked:p?.phone_e164?`••• ••• ${p.phone_e164.slice(-4)}`:null});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
