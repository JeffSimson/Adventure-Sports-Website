const {getStoreValue,setStoreValue}=require('./_v2-storage');
async function appendAudit(actor,action,summary,icon='•'){
  const entries=await getStoreValue('ase-ops-v2','audit',[]);
  entries.unshift({id:crypto.randomUUID(),createdAt:new Date().toISOString(),actorId:actor.user.id,actorEmail:actor.user.email,actorName:actor.user.user_metadata?.full_name||actor.user.email,action,actionLabel:action.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),summary,icon});
  await setStoreValue('ase-ops-v2','audit',entries.slice(0,500));
}
module.exports={appendAudit};
