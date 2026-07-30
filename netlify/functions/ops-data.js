const {json,verifiedUser,requireRole,error}=require('./_role-auth');
const {supabase,health}=require('./_supabase');
const READ_TABLES=new Set(['employees','employee_availability','time_off_requests','shifts','fields','field_status_history','inspection_templates','field_inspections','inspection_responses','maintenance_requests','work_orders','work_order_tasks','equipment','equipment_assignments','inventory_items','inventory_transactions','vendors','purchase_orders','tournaments','games','game_assignments','notifications','notification_receipts','weather_observations','rentals','incident_reports','reports','website_announcements','activity_feed','clover_employee_mappings']);
const WRITE_ROLES={owner:true,manager:true,grounds:true,kitchen:true,cashier:false};
const MANAGER_TABLES=new Set([...READ_TABLES]);
const GROUNDS_TABLES=new Set(['fields','field_status_history','field_inspections','inspection_responses','maintenance_requests','work_orders','work_order_tasks','equipment','equipment_assignments','inventory_items','inventory_transactions','incident_reports','activity_feed','clover_employee_mappings']);
const KITCHEN_TABLES=new Set(['inventory_items','inventory_transactions','maintenance_requests','work_orders','incident_reports','activity_feed','clover_employee_mappings']);
const ID=/^[0-9a-f-]{36}$/i;
const safeTable=t=>{if(!READ_TABLES.has(t))throw error('That data module is not available.',400);return t};
const canWrite=(role,table)=>role==='owner'||(role==='manager'&&MANAGER_TABLES.has(table))||(role==='grounds'&&GROUNDS_TABLES.has(table))||(role==='kitchen'&&KITCHEN_TABLES.has(table));
const cleanObject=o=>{const out={};for(const [k,v] of Object.entries(o||{})){if(/^[a-z][a-z0-9_]*$/i.test(k)&&!['id','created_at','updated_at'].includes(k))out[k]=v}return out};
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:{Allow:'GET,POST,PATCH,DELETE,OPTIONS'},body:''};
  const q=event.queryStringParameters||{};
  if(q.action==='health')return json(200,{...(await health()),configured:true});
  const table=safeTable(q.table);
  if(event.httpMethod==='GET'){
    const limit=Math.min(Math.max(Number(q.limit)||100,1),500),offset=Math.max(Number(q.offset)||0,0);
    const order=/^[a-z][a-z0-9_]*$/i.test(q.order||'')?q.order:'created_at';
    const ascending=q.ascending==='true';
    let path=`${table}?select=*&limit=${limit}&offset=${offset}&order=${order}.${ascending?'asc':'desc'}`;
    if(q.id){if(!ID.test(q.id))throw error('Invalid record ID.',400);path+=`&id=eq.${encodeURIComponent(q.id)}`}
    const {data,response}=await supabase(path,{headers:{Prefer:'count=exact'}});
    return json(200,{ok:true,rows:data||[],count:response.headers.get('content-range')||null});
  }
  if(!canWrite(actor.role,table))throw error('You do not have permission to change this data.',403);
  const body=event.body?JSON.parse(event.body):{};
  if(event.httpMethod==='POST'){
    const payload=cleanObject(body.data);payload.created_by=payload.created_by||actor.user.id;payload.updated_by=actor.user.id;
    const {data}=await supabase(table,{method:'POST',body:payload,headers:{Prefer:'return=representation'}});return json(201,{ok:true,row:data?.[0]||data});
  }
  if(!q.id||!ID.test(q.id))throw error('A valid record ID is required.',400);
  if(event.httpMethod==='PATCH'){
    const payload=cleanObject(body.data);payload.updated_by=actor.user.id;payload.updated_at=new Date().toISOString();
    const {data}=await supabase(`${table}?id=eq.${encodeURIComponent(q.id)}`,{method:'PATCH',body:payload,headers:{Prefer:'return=representation'}});return json(200,{ok:true,row:data?.[0]||data});
  }
  if(event.httpMethod==='DELETE'){
    requireRole(actor,['owner','manager']);
    await supabase(`${table}?id=eq.${encodeURIComponent(q.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});return json(200,{ok:true});
  }
  return json(405,{error:'Method not allowed.'});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
