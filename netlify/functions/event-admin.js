const {json,verifiedUser,requireRole,requirePermission,requireWritable,error}=require('./_role-auth');
const {logEvent,rateLimit,clientIp}=require('./_security');
const {supabase}=require('./_supabase');
const crypto=require('crypto');

const EVENT_FIELDS=['slug','title','short_title','description','category','sport','event_kind','status','is_public','featured','start_date','end_date','start_time','end_time','timezone','location_name','location_address','price_display','event_fee','divisions','signup_mode','registration_type','registration_state','registration_open_at','registration_close_at','capacity','waitlist_enabled','external_registration_url','registration_questions','image_url','logo_url','banner_url','admission_price','admission_note','rules_url','waiver_url','contact_name','contact_email','contact_phone','seo_title','seo_description','admin_notes','legacy_data','source_key'];
const ID=/^[0-9a-f-]{36}$/i;
const clean=(v,n=1000)=>String(v??'').trim().slice(0,n);
const slugify=v=>clean(v,180).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'event';
const normalizeArray=v=>Array.isArray(v)?v.map(x=>clean(x,160)).filter(Boolean):[];
function picked(input){const out={};for(const k of EVENT_FIELDS)if(Object.prototype.hasOwnProperty.call(input||{},k))out[k]=input[k];return out}
function normalizeEvent(input){
  const o=picked(input||{});
  for(const k of ['title','short_title','description','category','sport','event_kind','status','timezone','location_name','location_address','price_display','signup_mode','registration_type','registration_state','external_registration_url','image_url','logo_url','banner_url','admission_price','admission_note','rules_url','waiver_url','contact_name','contact_email','contact_phone','seo_title','seo_description','admin_notes','source_key'])if(k in o)o[k]=clean(o[k],k==='description'||k==='admin_notes'||k==='admission_note'?8000:1000)||null;
  if('divisions'in o)o.divisions=normalizeArray(o.divisions);
  if('registration_questions'in o)o.registration_questions=Array.isArray(o.registration_questions)?o.registration_questions.slice(0,30).map((q,i)=>({id:clean(q.id,80)||`q${i+1}`,label:clean(q.label,180),type:['text','textarea','select','checkbox'].includes(q.type)?q.type:'text',required:!!q.required,options:normalizeArray(q.options)})).filter(q=>q.label):[];
  if('capacity'in o)o.capacity=o.capacity?Math.max(1,Number(o.capacity)||1):null;
  if('event_fee'in o)o.event_fee=o.event_fee===''||o.event_fee==null?null:Number(o.event_fee);
  if('is_public'in o)o.is_public=!!o.is_public;if('featured'in o)o.featured=!!o.featured;if('waitlist_enabled'in o)o.waitlist_enabled=!!o.waitlist_enabled;
  if(!o.slug&&o.title)o.slug=slugify(o.title+'-'+(o.start_date||''));else if(o.slug)o.slug=slugify(o.slug);
  return o;
}
async function countsFor(ids){
  if(!ids.length)return {};
  const {data}=await supabase(`event_registrations?select=event_id,status&event_id=in.(${ids.map(encodeURIComponent).join(',')})`);
  const out={};for(const r of data||[]){out[r.event_id]=out[r.event_id]||{total:0,confirmed:0,pending:0,waitlisted:0,cancelled:0};out[r.event_id].total++;out[r.event_id][r.status]=(out[r.event_id][r.status]||0)+1}return out;
}
function legacyToEvent(e){
  const title=clean(e.title,220),start=clean(e.startDate,10),end=clean(e.endDate||e.startDate,10);
  const category=clean(e.category,120)||'Tournaments';
  const key=`legacy:${slugify(title)}:${start}`;
  const lower=(category+' '+title).toLowerCase();
  const registrationType=/camp|clinic|training|individual/.test(lower)?'individual':'team';
  const noSignup=/private rental|rental|facility closure|closed/.test(lower);
  return {
    source_key:key,slug:slugify(title+'-'+start),title,description:clean(e.description,8000),category,sport:category,event_kind:'Tournament',status:'published',is_public:true,featured:!!e.featured,
    start_date:start,end_date:end,location_name:'Adventure Sports & Entertainment',location_address:clean(e.location,1000)||'515 Monmouth Rd, Building 200, Jackson Township, NJ 08527',price_display:clean(e.price,240)||'See event details',
    divisions:[],signup_mode:noSignup?'none':'internal',registration_type:registrationType,registration_state:'auto',waitlist_enabled:true,external_registration_url:clean(e.register,1000)||null,
    image_url:clean(e.image,1000)||null,logo_url:clean(e.logo,1000)||null,legacy_data:e
  };
}

exports.handler=async event=>{try{
  const actor=await verifiedUser(event);requireRole(actor,['owner','manager']);await requirePermission(actor,'ops.read');
  const q=event.queryStringParameters||{},action=clean(q.action,80)||'list';
  if(event.httpMethod==='GET'){
    if(action==='list'){
      const {data}=await supabase('event_catalog?select=*&order=start_date.asc,title.asc&limit=500');
      const counts=await countsFor((data||[]).map(x=>x.id));
      return json(200,{ok:true,events:(data||[]).map(x=>({...x,registration_stats:counts[x.id]||{total:0,confirmed:0,pending:0,waitlisted:0,cancelled:0}}))});
    }
    if(action==='registrations'){
      const id=clean(q.event_id,80);if(!ID.test(id))throw error('Valid event ID required.',400);
      const {data}=await supabase(`event_registrations?event_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc&limit=1000`);
      return json(200,{ok:true,registrations:data||[]});
    }
    throw error('Unknown event action.',400);
  }
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  requireWritable(actor);await requirePermission(actor,'ops.write');await rateLimit(`event-admin:${actor.user.id}:${clientIp(event)}`,180,60);
  let b={};try{b=JSON.parse(event.body||'{}')}catch{throw error('Invalid JSON.',400)}
  const postAction=clean(b.action,80);
  if(postAction==='save'){
    const input=normalizeEvent(b.event||{}),id=clean(b.event?.id,80);
    if(!input.title)throw error('Event title is required.',400);if(!input.start_date||!input.end_date)throw error('Start and end dates are required.',400);
    input.updated_by=actor.user.id;input.updated_at=new Date().toISOString();
    let row;
    if(id){if(!ID.test(id))throw error('Invalid event ID.',400);const {data}=await supabase(`event_catalog?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:input,headers:{Prefer:'return=representation'}});row=data?.[0]}
    else{input.created_by=actor.user.id;const {data}=await supabase('event_catalog',{method:'POST',body:input,headers:{Prefer:'return=representation'}});row=data?.[0]}
    await logEvent(event,actor,id?'event_updated':'event_created','success',{event_id:row?.id,title:row?.title});return json(id?200:201,{ok:true,event:row});
  }
  if(postAction==='delete'){
    requireRole(actor,['owner']);const id=clean(b.id,80);if(!ID.test(id))throw error('Invalid event ID.',400);
    await supabase(`event_catalog?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});await logEvent(event,actor,'event_deleted','success',{event_id:id});return json(200,{ok:true});
  }
  if(postAction==='duplicate'){
    const id=clean(b.id,80);if(!ID.test(id))throw error('Invalid event ID.',400);const {data}=await supabase(`event_catalog?id=eq.${encodeURIComponent(id)}&select=*`);const src=data?.[0];if(!src)throw error('Event not found.',404);
    for(const k of ['id','created_at','updated_at','created_by','updated_by','source_key'])delete src[k];src.title=`${src.title} (Copy)`;src.slug=slugify(src.slug+'-copy-'+crypto.randomBytes(2).toString('hex'));src.status='draft';src.is_public=false;src.created_by=actor.user.id;src.updated_by=actor.user.id;
    const {data:created}=await supabase('event_catalog',{method:'POST',body:src,headers:{Prefer:'return=representation'}});return json(201,{ok:true,event:created?.[0]});
  }
  if(postAction==='import'){
    const incoming=Array.isArray(b.events)?b.events.slice(0,500):[];if(!incoming.length)throw error('No website events were provided.',400);
    let skipped=0;
    const now=new Date().toISOString();
    const rows=[];
    for(const raw of incoming){
      const x=legacyToEvent(raw);if(!x.title||!x.start_date){skipped++;continue}
      x.created_by=actor.user.id;x.updated_by=actor.user.id;x.updated_at=now;rows.push(x);
    }
    if(!rows.length)throw error('No valid website events were found to import.',400);
    // One bulk UPSERT instead of hundreds of sequential database calls. This avoids Netlify timeouts.
    await supabase('event_catalog?on_conflict=source_key',{method:'POST',body:rows,headers:{Prefer:'resolution=merge-duplicates,return=minimal'}});
    await logEvent(event,actor,'events_imported','success',{synced:rows.length,skipped});
    return json(200,{ok:true,imported:rows.length,updated:0,synced:rows.length,skipped});
  }
  if(postAction==='registration-status'){
    const id=clean(b.registration_id,80),status=clean(b.status,40);if(!ID.test(id))throw error('Invalid registration ID.',400);if(!['pending','confirmed','waitlisted','cancelled'].includes(status))throw error('Invalid registration status.',400);
    const payload={status,admin_notes:clean(b.admin_notes,8000)||null,updated_at:new Date().toISOString()};const {data}=await supabase(`event_registrations?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:payload,headers:{Prefer:'return=representation'}});return json(200,{ok:true,registration:data?.[0]});
  }
  if(postAction==='registration-update'){
    const id=clean(b.registration_id,80);if(!ID.test(id))throw error('Invalid registration ID.',400);const x=b.registration||{};
    const payload={division:clean(x.division,120)||null,team_name:clean(x.team_name,180)||null,organization_name:clean(x.organization_name,180)||null,participant_name:clean(x.participant_name,180)||null,registrant_name:clean(x.registrant_name,180),email:clean(x.email,240).toLowerCase(),phone:clean(x.phone,60)||null,city:clean(x.city,120)||null,state:clean(x.state,60)||null,admin_notes:clean(x.admin_notes,8000)||null,roster:Array.isArray(x.roster)?x.roster.map(v=>clean(v,180)).filter(Boolean).slice(0,100):[],updated_at:new Date().toISOString()};
    if(!payload.registrant_name||!payload.email)throw error('Registrant name and email are required.',400);const {data}=await supabase(`event_registrations?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',body:payload,headers:{Prefer:'return=representation'}});return json(200,{ok:true,registration:data?.[0]});
  }
  if(postAction==='registration-delete'){
    requireRole(actor,['owner']);const id=clean(b.registration_id,80);if(!ID.test(id))throw error('Invalid registration ID.',400);await supabase(`event_registrations?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});return json(200,{ok:true});
  }
  throw error('Unknown event action.',400);
}catch(e){return json(e.statusCode||500,{error:e.message})}};
