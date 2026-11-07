const {json,error,verifiedUser,requireRole,adminFetch,VALID_ROLES}=require('./_role-auth');

const cleanRole=value=>String(value||'').trim().toLowerCase();
const cleanEmail=value=>String(value||'').trim().toLowerCase();
const cleanName=value=>String(value||'').trim().slice(0,80);
const displayName=user=>user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split('@')[0]||'Team Member';
const roleOf=user=>{
  const ownerEmail=String(process.env.OWNER_EMAIL||'').trim().toLowerCase();
  if(ownerEmail&&String(user.email||'').toLowerCase()===ownerEmail)return 'owner';
  const role=cleanRole(user.app_metadata?.role);
  return VALID_ROLES.includes(role)?role:null;
};
function canAssign(actorRole,targetRole){
  if(actorRole==='owner')return ['manager','grounds','kitchen'].includes(targetRole);
  return ['grounds','kitchen'].includes(targetRole);
}
function canManage(actor,target){
  if(String(actor.user.id)===String(target.id))return false;
  const targetRole=roleOf(target);
  if(actor.role==='owner')return targetRole!=='owner';
  return ['grounds','kitchen'].includes(targetRole);
}
async function allUsers(context){
  const data=await adminFetch('/admin/users',context);
  return Array.isArray(data.users)?data.users:Array.isArray(data)?data:[];
}
async function findUser(context,id){
  const users=await allUsers(context);
  const found=users.find(u=>String(u.id)===String(id));
  if(!found)throw error('The selected user could not be found.',404);
  return found;
}
async function patchUser(context,user,patch){
  return adminFetch(`/admin/users/${encodeURIComponent(user.id)}`,context,{
    method:'PUT',
    body:JSON.stringify({
      email:user.email,
      user_metadata:{...(user.user_metadata||{}),...(patch.user_metadata||{})},
      app_metadata:{...(user.app_metadata||{}),...(patch.app_metadata||{})}
    })
  });
}
exports.handler=async (event,context)=>{
  try{
    const actor=await verifiedUser(event);
    requireRole(actor,['owner','manager']);

    if(event.httpMethod==='GET'){
      const users=await allUsers(context);
      const visible=actor.role==='owner'?users:users.filter(u=>['grounds','kitchen'].includes(roleOf(u)));
      return json(200,{
        ok:true,
        users:visible.map(u=>({
          id:u.id,
          email:u.email,
          name:displayName(u),
          role:roleOf(u),
          confirmed:Boolean(u.confirmed_at||u.confirmed),
          invitedAt:u.invited_at||null,
          createdAt:u.created_at||null,
          lastSignIn:u.last_sign_in_at||null
        })).sort((a,b)=>(a.name||a.email).localeCompare(b.name||b.email))
      });
    }

    if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});

    let body={};
    try{body=JSON.parse(event.body||'{}')}catch{throw error('The request was not valid JSON.',400)}
    const action=String(body.action||'');

    if(action==='invite'){
      const email=cleanEmail(body.email),name=cleanName(body.name),newRole=cleanRole(body.role);
      if(!email||!email.includes('@'))throw error('Enter a valid email address.',400);
      if(!name)throw error('Enter the employee name.',400);
      if(!canAssign(actor.role,newRole))throw error('You cannot assign that role.',403);

      const existing=(await allUsers(context)).find(u=>cleanEmail(u.email)===email);
      if(existing)throw error('An account or pending invitation already uses this email.',409);

      let invited=await adminFetch('/invite',context,{
        method:'POST',
        body:JSON.stringify({email,data:{full_name:name}})
      });

      let invitedUser=invited;
      if(!invitedUser?.id){
        const users=await allUsers(context);
        invitedUser=users.find(u=>cleanEmail(u.email)===email);
      }
      if(!invitedUser?.id)throw error('The invitation was sent, but the role could not be attached. Refresh Team Management and assign the role manually.',500);
      await patchUser(context,invitedUser,{user_metadata:{full_name:name},app_metadata:{role:newRole}});
      return json(200,{ok:true,message:'Invitation sent.'});
    }

    if(action==='set-role'){
      const newRole=cleanRole(body.role);
      if(!canAssign(actor.role,newRole))throw error('You cannot assign that role.',403);
      const target=await findUser(context,body.userId);
      if(!canManage(actor,target))throw error('You cannot change this account.',403);
      await patchUser(context,target,{app_metadata:{role:newRole}});
      return json(200,{ok:true,message:'Role updated.'});
    }

    if(action==='terminate'){
      const target=await findUser(context,body.userId);
      if(!canManage(actor,target))throw error('You cannot terminate this account.',403);
      await adminFetch(`/admin/users/${encodeURIComponent(target.id)}`,context,{method:'DELETE'});
      return json(200,{ok:true,message:'Account terminated.'});
    }

    throw error('Unknown user-management action.',400);
  }catch(err){
    console.error('user-management error:',err);
    return json(err.statusCode||500,{error:err.message||'User management failed.'});
  }
};
