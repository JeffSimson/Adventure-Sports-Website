const {json,verifiedUser,requireRole,requirePermission,requireWritable,error}=require('./_role-auth');
const {logEvent,rateLimit,clientIp}=require('./_security');
const {supabase,health}=require('./_supabase');
const READ_TABLES=new Set(['employees','employee_availability','time_off_requests','shifts','fields','field_status_history','inspection_templates','field_inspections','inspection_responses','maintenance_requests','work_orders','work_order_tasks','equipment','equipment_assignments','inventory_items','inventory_transactions','vendors','purchase_orders','tournaments','games','game_assignments','notifications','notification_receipts','weather_observations','rentals','incident_reports','reports','website_announcements','activity_feed','clover_employee_mappings']);
const MANAGER_TABLES=new Set([...READ_TABLES]);
const GROUNDS_TABLES=new Set(['fields','field_status_history','field_inspections','inspection_responses','maintenance_requests','work_orders','work_order_tasks','equipment','equipment_assignments','inventory_items','inventory_transactions','incident_reports','activity_feed','clover_employee_mappings']);
const KITCHEN_TABLES=new Set(['inventory_items','inventory_transactions','maintenance_requests','work_orders','incident_reports','activity_feed','clover_employee_mappings']);
const ID=/^[0-9a-f-]{36}$/i;
const safeTable=t=>{if(!READ_TABLES.has(t))throw error('That data module is not available.',400);return t};
const canWrite=(role,table)=>role==='owner'||(role==='manager'&&MANAGER_TABLES.has(table))||(role==='grounds'&&GROUNDS_TABLES.has(table))||(role==='kitchen'&&KITCHEN_TABLES.has(table));
const PROTECTED=new Set(['id','created_at','updated_at','created_by','updated_by','organization_id','role','permissions','owner_id','user_id']);
const COLUMN_ALLOWLIST={
 fields:['name','code','status','surface_type','notes'],
 incident_reports:['occurred_at','location','incident_type','severity','people_involved','description','actions_taken','status','reported_by','reviewed_by','timeline_before','timeline_event','timeline_after','response_details','follow_up','responding_staff','internal_notes','manager_review_status'],
 maintenance_requests:['field_id','title','description','priority','status','assigned_to','due_at'],
 work_orders:['title','description','priority','status','field_id','equipment_id','assigned_to','due_at','completed_at'],
 equipment:['name','category','serial_number','status','location','notes','purchase_date','purchase_cost'],
 inventory_items:['name','sku','category','quantity_on_hand','reorder_level','unit','location','cost_per_unit','active'],
 tournaments:['name','start_date','end_date','status','sport','notes'],
 games:['tournament_id','field_id','game_date','start_time','end_time','home_team','away_team','division','status','notes'],
 notifications:['title','message','audience','priority','status','scheduled_for'],
 website_announcements:['title','message','status','starts_at','ends_at'],
 clover_employee_mappings:['clover_employee_id','clover_employee_name','employee_id','active']
};
const cleanObject=(table,o)=>{const out={},allowed=COLUMN_ALLOWLIST[table]||[];for(const [k,v] of Object.entries(o||{})){if(allowed.includes(k)&&!PROTECTED.has(k))out[k]=v}return out};
const bodySize=e=>Buffer.byteLength(e.body||'','utf8');
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager','grounds','kitchen','cashier']);
  if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:{Allow:'GET,POST,PATCH,DELETE,OPTIONS'},body:''};
  const q=event.queryStringParameters||{};
  if(q.action==='health')return json(200,{...(await health()),configured:true});
  const table=safeTable(q.table);
  if(event.httpMethod==='GET'){await requirePermission(actor,'ops.read');
    const limit=Math.min(Math.max(Number(q.limit)||100,1),500),offset=Math.max(Number(q.offset)||0,0);
    const order=/^[a-z][a-z0-9_]*$/i.test(q.order||'')?q.order:'created_at';
    const ascending=q.ascending==='true';
    let path=`${table}?select=*&limit=${limit}&offset=${offset}&order=${order}.${ascending?'asc':'desc'}`;
    if(q.id){if(!ID.test(q.id))throw error('Invalid record ID.',400);path+=`&id=eq.${encodeURIComponent(q.id)}`}
    const {data,response}=await supabase(path,{headers:{Prefer:'count=exact'}});
    return json(200,{ok:true,rows:data||[],count:response.headers.get('content-range')||null});
  }
  requireWritable(actor);await requirePermission(actor,'ops.write');if(!canWrite(actor.role,table))throw error('You do not have permission to change this data.',403);await rateLimit(`ops-write:${actor.user.id}:${clientIp(event)}`,120,60);
  if(bodySize(event)>100000)throw error('Request body is too large.',413);
  let body={};try{body=event.body?JSON.parse(event.body):{}}catch{throw error('Invalid JSON request.',400)}
  if(event.httpMethod==='POST'){
    const payload=cleanObject(table,body.data);if(!Object.keys(payload).length)throw error('No editable fields were provided.',400);payload.created_by=payload.created_by||actor.user.id;payload.updated_by=actor.user.id;
    const {data}=await supabase(table,{method:'POST',body:payload,headers:{Prefer:'return=representation'}});await logEvent(event,actor,'record_created','success',{table,id:data?.[0]?.id||null});return json(201,{ok:true,row:data?.[0]||data});
  }
  if(!q.id||!ID.test(q.id))throw error('A valid record ID is required.',400);
  if(event.httpMethod==='PATCH'){
    const payload=cleanObject(table,body.data);if(!Object.keys(payload).length)throw error('No editable fields were provided.',400);payload.updated_by=actor.user.id;payload.updated_at=new Date().toISOString();
    const {data}=await supabase(`${table}?id=eq.${encodeURIComponent(q.id)}`,{method:'PATCH',body:payload,headers:{Prefer:'return=representation'}});await logEvent(event,actor,'record_updated','success',{table,id:q.id,fields:Object.keys(payload)});return json(200,{ok:true,row:data?.[0]||data});
  }
  if(event.httpMethod==='DELETE'){
    requireRole(actor,['owner']);
    await supabase(`${table}?id=eq.${encodeURIComponent(q.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});await logEvent(event,actor,'record_deleted','success',{table,id:q.id});return json(200,{ok:true});
  }
  return json(405,{error:'Method not allowed.'});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
