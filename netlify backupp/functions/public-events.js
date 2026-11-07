const {json,error}=require('./_role-auth');
const {supabase}=require('./_supabase');

const safe=v=>String(v??'').trim();
const PUBLIC_FIELDS='id,slug,title,short_title,description,category,sport,event_kind,status,featured,start_date,end_date,start_time,end_time,timezone,location_name,location_address,price_display,event_fee,divisions,signup_mode,registration_type,registration_state,registration_open_at,registration_close_at,capacity,waitlist_enabled,external_registration_url,registration_questions,image_url,logo_url,banner_url,admission_price,admission_note,rules_url,waiver_url,contact_name,contact_email,contact_phone,seo_title,seo_description,updated_at';

function registrationAvailability(event,count=0){
  if(event.status==='cancelled'||event.status==='completed')return 'closed';
  if(event.signup_mode!=='internal')return event.signup_mode;
  if(event.registration_state==='closed')return 'closed';
  if(event.registration_state==='open')return event.capacity&&count>=event.capacity?(event.waitlist_enabled?'waitlist':'full'):'open';
  const now=Date.now();
  if(event.registration_open_at&&new Date(event.registration_open_at).getTime()>now)return 'coming_soon';
  if(event.registration_close_at&&new Date(event.registration_close_at).getTime()<now)return 'closed';
  if(event.capacity&&count>=event.capacity)return event.waitlist_enabled?'waitlist':'full';
  return 'open';
}

async function countsFor(ids){
  if(!ids.length)return {};
  const encoded=ids.map(encodeURIComponent).join(',');
  const {data}=await supabase(`event_registrations?select=event_id,status&event_id=in.(${encoded})&status=in.(pending,confirmed,waitlisted)`);
  const out={};
  for(const r of data||[]){
    out[r.event_id]=out[r.event_id]||{active:0,confirmed:0,waitlisted:0,pending:0};
    out[r.event_id].active++;
    out[r.event_id][r.status]=(out[r.event_id][r.status]||0)+1;
  }
  return out;
}

exports.handler=async event=>{try{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed.'});
  const q=event.queryStringParameters||{};
  let path=`event_catalog?select=${PUBLIC_FIELDS}&is_public=eq.true&status=neq.draft`;
  if(q.id)path+=`&id=eq.${encodeURIComponent(q.id)}`;
  if(q.slug)path+=`&slug=eq.${encodeURIComponent(safe(q.slug))}`;
  if(q.category)path+=`&category=eq.${encodeURIComponent(safe(q.category))}`;
  if(q.upcoming!=='0'&&!q.slug&&!q.id){
    const today=new Date();today.setHours(0,0,0,0);
    path+=`&end_date=gte.${today.toISOString().slice(0,10)}`;
  }
  path+=`&order=start_date.asc,title.asc&limit=${Math.min(Math.max(Number(q.limit)||250,1),500)}`;
  const {data}=await supabase(path);
  const rows=data||[];
  const counts=await countsFor(rows.map(x=>x.id));
  const normalized=rows.map(x=>{
    const c=counts[x.id]||{active:0,confirmed:0,waitlisted:0,pending:0};
    return {...x,registration_count:c.active,confirmed_count:c.confirmed,waitlist_count:c.waitlisted,registration_availability:registrationAvailability(x,c.active)};
  });
  if(q.slug||q.id){
    if(!normalized[0])throw error('Event not found.',404);
    return json(200,{ok:true,event:normalized[0]});
  }
  return json(200,{ok:true,events:normalized});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
