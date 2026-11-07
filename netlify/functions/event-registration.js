const crypto=require('crypto');
const {json,error}=require('./_role-auth');
const {supabase}=require('./_supabase');
const {rateLimit,clientIp}=require('./_security');
const {sendSignupEmails}=require('./_event-email');

const clean=(v,n=500)=>String(v??'').trim().slice(0,n);
const emailOK=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const allowedStatuses=new Set(['pending','confirmed','waitlisted','cancelled']);

async function getEvent(id){
  const {data}=await supabase(`event_catalog?id=eq.${encodeURIComponent(id)}&select=*`);
  return data?.[0]||null;
}
async function activeCount(eventId){
  const {response}=await supabase(`event_registrations?event_id=eq.${encodeURIComponent(eventId)}&status=in.(pending,confirmed,waitlisted)&select=id&limit=1`,{headers:{Prefer:'count=exact'}});
  const range=response.headers.get('content-range')||'';
  const n=Number(range.split('/')[1]);return Number.isFinite(n)?n:0;
}
function isOpen(ev,count){
  if(!ev||!ev.is_public||ev.status!=='published'||ev.signup_mode!=='internal')return {ok:false,message:'Registration is not available for this event.'};
  if(ev.registration_state==='closed')return {ok:false,message:'Registration is closed for this event.'};
  const now=Date.now();
  if(ev.registration_state==='auto'&&ev.registration_open_at&&new Date(ev.registration_open_at).getTime()>now)return {ok:false,message:'Registration has not opened yet.'};
  if(ev.registration_state==='auto'&&ev.registration_close_at&&new Date(ev.registration_close_at).getTime()<now)return {ok:false,message:'Registration is closed for this event.'};
  if(ev.capacity&&count>=Number(ev.capacity))return ev.waitlist_enabled?{ok:true,status:'waitlisted'}:{ok:false,message:'This event is full.'};
  return {ok:true,status:'confirmed'};
}
function validateQuestions(questions,responses){
  for(const q of Array.isArray(questions)?questions:[]){
    if(!q?.required)continue;const value=responses?.[q.id]??responses?.[q.label];if(q.type==='checkbox'){if(value!==true&&value!=='true'&&value!==1)throw error(`${clean(q.label,120)||'A required question'} is required.`,400);}else if(!clean(value,1000))throw error(`${clean(q.label,120)||'A required question'} is required.`,400);
  }
}

exports.handler=async event=>{try{
  if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:{Allow:'POST,OPTIONS'},body:''};
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  await rateLimit(`event-register:${clientIp(event)}`,20,600);
  if(Buffer.byteLength(event.body||'','utf8')>100000)throw error('Registration is too large.',413);
  let b={};try{b=JSON.parse(event.body||'{}')}catch{throw error('Invalid registration request.',400)}
  if(clean(b.website))return json(200,{ok:true}); // honeypot
  const eventId=clean(b.event_id,80);if(!eventId)throw error('Event is required.',400);
  const ev=await getEvent(eventId);if(!ev)throw error('Event not found.',404);
  const count=await activeCount(ev.id),availability=isOpen(ev,count);if(!availability.ok)throw error(availability.message,409);
  const registrationType=ev.registration_type==='individual'?'individual':'team';
  const registrantName=clean(b.registrant_name,160),email=clean(b.email,240).toLowerCase();
  if(!registrantName)throw error('Your name is required.',400);if(!emailOK(email))throw error('Enter a valid email address.',400);
  const teamName=clean(b.team_name,180),participantName=clean(b.participant_name,180);
  if(registrationType==='team'&&!teamName)throw error('Team name is required.',400);
  if(registrationType==='individual'&&!participantName)throw error('Participant name is required.',400);
  const division=clean(b.division,120);
  if(Array.isArray(ev.divisions)&&ev.divisions.length&&division&&!ev.divisions.map(String).includes(division))throw error('Choose a valid division.',400);
  const responses=(b.responses&&typeof b.responses==='object'&&!Array.isArray(b.responses))?b.responses:{};validateQuestions(ev.registration_questions,responses);
  const roster=Array.isArray(b.roster)?b.roster.map(x=>clean(x,160)).filter(Boolean).slice(0,100):[];
  const day=String(ev.start_date||'').replaceAll('-','');
  let number='ASE-'+day+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  const payload={
    event_id:ev.id,registration_number:number,registration_type:registrationType,status:availability.status||'confirmed',division:division||null,
    team_name:teamName||null,organization_name:clean(b.organization_name,180)||null,participant_name:participantName||null,registrant_name:registrantName,
    email,phone:clean(b.phone,60)||null,city:clean(b.city,120)||null,state:clean(b.state,60)||null,roster,responses,
    notes:clean(b.notes,2000)||null
  };
  const {data}=await supabase('event_registrations',{method:'POST',body:payload,headers:{Prefer:'return=representation'}});
  const row=data?.[0]||data;
  let email_delivery={configured:false,results:[]};
  try{email_delivery=await sendSignupEmails(ev,row)}catch(emailErr){email_delivery={configured:true,results:[{sent:false,error:String(emailErr?.message||emailErr)}]};console.error('Signup email notification failed',emailErr)}
  return json(201,{ok:true,registration:{registration_number:row.registration_number,status:row.status,event_title:ev.title,event_date:ev.start_date,team_name:row.team_name,participant_name:row.participant_name,email:row.email},email_delivery});
}catch(e){return json(e.statusCode||500,{error:e.message})}};
