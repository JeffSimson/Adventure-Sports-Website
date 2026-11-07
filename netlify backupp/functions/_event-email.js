const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const clean=v=>String(v??'').trim();
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
const prettyDate=v=>{if(!v)return 'Date TBD';const d=new Date(`${v}T12:00:00`);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})};
function configured(){return !!(process.env.RESEND_API_KEY&&(process.env.EVENT_EMAIL_FROM||process.env.SECURITY_EMAIL_FROM));}
function sender(){const raw=clean(process.env.EVENT_EMAIL_FROM||process.env.SECURITY_EMAIL_FROM);if(!raw)return '';return raw.includes('<')?raw:`Adventure Sports <${raw}>`;}
function adminRecipients(){
  const values=[process.env.EVENT_SIGNUP_NOTIFY_EMAILS,process.env.OWNER_EMAIL,process.env.OWNER_EMAILS].filter(Boolean).flatMap(v=>String(v).split(','));
  return [...new Set(values.map(clean).filter(validEmail).map(v=>v.toLowerCase()))];
}
async function send(to,subject,html,replyTo){
  if(!configured())return {sent:false,reason:'not_configured'};
  const recipients=(Array.isArray(to)?to:[to]).map(clean).filter(validEmail);if(!recipients.length)return {sent:false,reason:'no_recipient'};
  const body={from:sender(),to:recipients,subject,html};if(validEmail(replyTo))body.reply_to=clean(replyTo);
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){let detail='';try{detail=(await r.text()).slice(0,500)}catch{};throw new Error(`Resend email failed (${r.status})${detail?`: ${detail}`:''}`)}
  let data={};try{data=await r.json()}catch{}return {sent:true,id:data.id||null};
}
function wrap(title,content){return `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#17304d"><div style="max-width:680px;margin:0 auto;padding:28px 16px"><div style="background:#071f43;color:#fff;border-radius:18px 18px 0 0;padding:22px 26px"><div style="font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#91bcea;font-weight:700">Adventure Sports & Entertainment</div><h1 style="font-size:24px;margin:8px 0 0">${esc(title)}</h1></div><div style="background:#fff;border:1px solid #dfe7f0;border-top:0;border-radius:0 0 18px 18px;padding:26px">${content}</div><p style="font-size:11px;color:#7d8998;text-align:center;margin:18px 0 0">Adventure Sports & Entertainment • Jackson, New Jersey</p></div></body></html>`}
async function sendSignupEmails(ev,registration){
  const who=registration.team_name||registration.participant_name||registration.registrant_name;
  const status=registration.status==='waitlisted'?'Waitlisted':'Confirmed';
  const rows=[
    ['Event',ev.title],['Date',prettyDate(ev.start_date)],['Registration #',registration.registration_number],['Status',status],
    [registration.registration_type==='individual'?'Participant':'Team',who],['Organization',registration.organization_name],['Division',registration.division],
    ['Registrant',registration.registrant_name],['Email',registration.email],['Phone',registration.phone],['City / State',[registration.city,registration.state].filter(Boolean).join(', ')]
  ].filter(([,v])=>clean(v));
  const grid=rows.map(([k,v])=>`<tr><td style="padding:9px 10px;border-bottom:1px solid #edf1f5;color:#738198;font-size:12px;font-weight:700;width:34%">${esc(k)}</td><td style="padding:9px 10px;border-bottom:1px solid #edf1f5;color:#17304d;font-size:13px;font-weight:700">${esc(v)}</td></tr>`).join('');
  const base=clean(process.env.URL||process.env.DEPLOY_PRIME_URL||'https://adventurenj.com').replace(/\/$/,'');
  const adminHtml=wrap(`New signup: ${ev.title}`,`<p style="font-size:15px;line-height:1.55;margin-top:0"><b>${esc(who)}</b> just submitted a registration through the Adventure Sports website.</p><table style="border-collapse:collapse;width:100%;background:#fbfdff;border:1px solid #e4ebf2;border-radius:12px">${grid}</table><div style="margin-top:22px"><a href="${esc(base)}/ops/#eventsadmin" style="display:inline-block;background:#1768b4;color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px">Open Events & Signups</a></div>`);
  const confirmationHtml=wrap(`Registration received`, `<p style="font-size:15px;line-height:1.55;margin-top:0">Hi ${esc(registration.registrant_name)},</p><p style="font-size:15px;line-height:1.55">We received your registration for <b>${esc(ev.title)}</b>.</p><div style="background:#f4f8fc;border:1px solid #dfe7f0;border-radius:12px;padding:16px;margin:18px 0"><div style="font-size:12px;color:#728198">Confirmation number</div><div style="font-size:22px;font-weight:800;color:#0d3c6e;margin-top:3px">${esc(registration.registration_number)}</div><div style="margin-top:10px;font-size:13px"><b>Status:</b> ${esc(status)}<br><b>Date:</b> ${esc(prettyDate(ev.start_date))}</div></div><p style="font-size:13px;line-height:1.5;color:#607186">No online payment was processed with this signup. Adventure Sports will contact you if additional information is needed.</p>`);
  const tasks=[];const admins=adminRecipients();if(admins.length)tasks.push(send(admins,`New registration — ${ev.title}`,adminHtml,registration.email).then(r=>({type:'admin',...r})));
  if(validEmail(registration.email))tasks.push(send(registration.email,`Registration received — ${ev.title}`,confirmationHtml).then(r=>({type:'confirmation',...r})));
  if(!tasks.length)return {configured:configured(),adminRecipients:admins.length,results:[]};
  const settled=await Promise.allSettled(tasks);return {configured:configured(),adminRecipients:admins.length,results:settled.map(x=>x.status==='fulfilled'?x.value:{sent:false,error:x.reason?.message||'Email failed'})};
}
module.exports={sendSignupEmails,configured,adminRecipients};
