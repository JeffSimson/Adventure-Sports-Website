const {json,verifiedUser}=require('./_role-auth');
exports.handler=async event=>{try{const actor=await verifiedUser(event);return json(200,{ok:true,role:actor.role,user:{id:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.user_metadata?.name||''}})}catch(e){return json(e.statusCode||500,{error:e.message})}};
