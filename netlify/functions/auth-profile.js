const {json,verifiedUser}=require('./_role-auth');
exports.handler=async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed.'});
  try{
    const actor=await verifiedUser(event);
    return json(200,{
      ok:true,
      role:actor.role,
      user:{
        id:actor.user.id,
        email:actor.user.email,
        name:actor.user.user_metadata?.full_name||actor.user.user_metadata?.name||''
      }
    });
  }catch(err){
    return json(err.statusCode||500,{error:err.message||'Your access could not be verified.'});
  }
};
