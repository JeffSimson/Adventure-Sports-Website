const {json,error,verifiedUser,requireRole,adminFetch,VALID_ROLES,effectiveRole}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const clean=v=>String(v||'').trim(), email=v=>clean(v).toLowerCase();
const nameOf=u=>u.user_metadata?.full_name||u.user_metadata?.name||u.email?.split('@')[0]||'Team Member';
async function allUsers(context){const d=await adminFetch('/admin/users',context);return Array.isArray(d.users)?d.users:Array.isArray(d)?d:[]}
async function findUser(context,id){const u=(await allUsers(context)).find(x=>String(x.id)===String(id));if(!u)throw error('User not found.',404);return u}
async function patch(context,u,parts){return adminFetch(`/admin/users/${encodeURIComponent(u.id)}`,context,{method:'PUT',body:JSON.stringify({email:u.email,user_metadata:{...(u.user_metadata||{}),...(parts.user_metadata||{})},app_metadata:{...(u.app_metadata||{}),...(parts.app_metadata||{})}})})}
async function profiles(){return getStoreValue('ase-ops-v2','profiles',{})}
async function saveProfiles(p){return setStoreValue('ase-ops-v2','profiles',p)}
async function ownerCount(context){let n=0;for(const u of await allUsers(context))if((await effectiveRole(u))==='owner'&&!u.app_metadata?.disabled)n++;return n}
function assignable(actorRole,targetRole){if(actorRole==='owner')return VALID_ROLES.includes(targetRole);return ['grounds','kitchen'].includes(targetRole)}
async function canManage(actor,target,context){
  if(String(actor.user.id)===String(target.id))return false;
  const tr=await effectiveRole(target);
  if(actor.role==='owner'){if(tr==='owner')return (await ownerCount(context))>1;return true}
  return ['grounds','kitchen'].includes(tr);
}
exports.handler=async (event,context)=>{
  try{
    const actor=await verifiedUser(event);requireRole(actor,['owner','manager']);
    if(event.httpMethod==='GET'){
      const p=await profiles(),users=await allUsers(context),out=[];
      for(const u of users){
        const r=await effectiveRole(u);
        if(actor.role==='manager'&&!['grounds','kitchen'].includes(r))continue;
        out.push({id:u.id,email:u.email,name:nameOf(u),role:r,confirmed:Boolean(u.confirmed_at||u.confirmed),disabled:Boolean(u.app_metadata?.disabled),status:u.app_metadata?.disabled?'Disabled':u.confirmed_at?'Active':'Invitation pending',lastSignIn:u.last_sign_in_at||null,profile:p[u.id]||{}});
      }
      return json(200,{ok:true,users:out.sort((a,b)=>a.name.localeCompare(b.name))});
    }
    if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
    let b={};try{b=JSON.parse(event.body||'{}')}catch{throw error('Invalid JSON.',400)}
    const action=clean(b.action);
    if(action==='invite'){
      const targetRole=clean(b.role),targetEmail=email(b.email),targetName=clean(b.name).slice(0,80);
      if(!targetEmail.includes('@')||!targetName)throw error('Name and valid email are required.',400);
      if(!assignable(actor.role,targetRole))throw error('You cannot assign that role.',403);
      if((await allUsers(context)).some(u=>email(u.email)===targetEmail))throw error('That email already has an account or invitation.',409);
      const invited=await adminFetch('/invite',context,{method:'POST',body:JSON.stringify({email:targetEmail,data:{full_name:targetName}})});
      let user=invited;if(!user?.id)user=(await allUsers(context)).find(u=>email(u.email)===targetEmail);
      if(!user?.id)throw error('Invite sent, but role assignment could not be completed.',500);
      await patch(context,user,{user_metadata:{full_name:targetName},app_metadata:{role:targetRole,disabled:false}});
      const p=await profiles();p[user.id]={phone:clean(b.phone),hireDate:clean(b.hireDate),createdAt:new Date().toISOString()};await saveProfiles(p);
      await appendAudit(actor,'user-invited',`Invited ${targetName} (${targetEmail}) as ${targetRole}.`,'✉');
      return json(200,{ok:true});
    }
    const target=await findUser(context,b.userId),targetRole=await effectiveRole(target);
    if(action==='set-role'){
      const newRole=clean(b.role);if(!assignable(actor.role,newRole))throw error('You cannot assign that role.',403);
      if(!(await canManage(actor,target,context)))throw error('You cannot change this account.',403);
      if(targetRole==='owner'&&newRole!=='owner'&&(await ownerCount(context))<=1)throw error('The last active Owner cannot be demoted.',409);
      await patch(context,target,{app_metadata:{role:newRole}});
      await appendAudit(actor,'role-changed',`Changed ${nameOf(target)} from ${targetRole||'unassigned'} to ${newRole}.`,'↔');
      return json(200,{ok:true});
    }
    if(action==='update-profile'){
      const self=String(actor.user.id)===String(target.id);
      if(!self&&!(await canManage(actor,target,context)))throw error('You cannot edit this profile.',403);
      const p=await profiles(),x=b.profile||{};p[target.id]={...(p[target.id]||{}),phone:clean(x.phone),hireDate:clean(x.hireDate),emergencyContact:clean(x.emergencyContact),emergencyPhone:clean(x.emergencyPhone),notes:clean(x.notes),updatedAt:new Date().toISOString()};
      await saveProfiles(p);if(clean(x.name))await patch(context,target,{user_metadata:{full_name:clean(x.name).slice(0,80)}});
      await appendAudit(actor,'profile-updated',`Updated profile for ${nameOf(target)}.`,'✎');return json(200,{ok:true});
    }
    if(action==='disable'||action==='enable'){
      if(!(await canManage(actor,target,context)))throw error('You cannot change this account.',403);
      if(targetRole==='owner'&&action==='disable'&&(await ownerCount(context))<=1)throw error('The last active Owner cannot be disabled.',409);
      await patch(context,target,{app_metadata:{disabled:action==='disable'}});
      await appendAudit(actor,action==='disable'?'account-disabled':'account-enabled',`${action==='disable'?'Disabled':'Re-enabled'} ${nameOf(target)}.`,'⏻');return json(200,{ok:true});
    }
    if(action==='terminate'){
      if(!(await canManage(actor,target,context)))throw error('You cannot terminate this account.',403);
      if(targetRole==='owner'&&(await ownerCount(context))<=1)throw error('The last active Owner cannot be terminated.',409);
      await adminFetch(`/admin/users/${encodeURIComponent(target.id)}`,context,{method:'DELETE'});
      const p=await profiles();delete p[target.id];await saveProfiles(p);
      await appendAudit(actor,'account-terminated',`Terminated ${nameOf(target)} (${target.email}).`,'×');return json(200,{ok:true});
    }
    if(action==='send-recovery'){
      const self=String(actor.user.id)===String(target.id);
      if(!self&&actor.role!=='owner'&&!['grounds','kitchen'].includes(targetRole))throw error('You cannot reset this password.',403);
      await adminFetch('/recover',context,{method:'POST',body:JSON.stringify({email:target.email})});
      await appendAudit(actor,'password-reset-sent',`Sent a password reset to ${target.email}.`,'🔑');return json(200,{ok:true});
    }
    throw error('Unknown action.',400);
  }catch(e){console.error(e);return json(e.statusCode||500,{error:e.message||'User management failed.'})}
};
