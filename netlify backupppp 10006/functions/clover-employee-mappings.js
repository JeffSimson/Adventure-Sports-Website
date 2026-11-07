const {json,verifiedUser,requireRole,error}=require('./_role-auth');
const {supabase}=require('./_supabase');
const clean=v=>String(v??'').trim();
exports.handler=async event=>{try{
 const actor=await verifiedUser(event);requireRole(actor,['owner']);
 if(event.httpMethod==='GET'){
  const {data}=await supabase('clover_employee_mappings?select=*&order=clover_employee_name.asc');
  return json(200,{ok:true,rows:data||[]});
 }
 const body=event.body?JSON.parse(event.body):{};
 if(event.httpMethod==='POST'){
  const clover_employee_id=clean(body.clover_employee_id);if(!clover_employee_id)throw error('Clover employee ID is required.',400);
  const payload={clover_employee_id,clover_employee_name:clean(body.clover_employee_name)||null,display_name:clean(body.display_name)||null,employee_id:clean(body.employee_id)||null,active:body.active!==false,updated_at:new Date().toISOString()};
  const {data}=await supabase('clover_employee_mappings?on_conflict=clover_employee_id',{method:'POST',body:payload,headers:{Prefer:'resolution=merge-duplicates,return=representation'}});
  return json(200,{ok:true,row:data?.[0]||data});
 }
 if(event.httpMethod==='DELETE'){
  const id=clean(event.queryStringParameters?.id);if(!id)throw error('Mapping ID is required.',400);
  await supabase(`clover_employee_mappings?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});return json(200,{ok:true});
 }
 return json(405,{error:'Method not allowed.'});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
