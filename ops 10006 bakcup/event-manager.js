(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const ENDPOINT='/.netlify/functions/event-admin';
const state={events:[],selected:null,registrations:[],loaded:false,questions:[]};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const api=(action,options={})=>window.ASE_OPS.api(ENDPOINT+(action?'?action='+encodeURIComponent(action):''),options);
const post=body=>window.ASE_OPS.api(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const toast=m=>window.ASE_OPS.toast?.(m);
const fmtDate=v=>{if(!v)return 'No date';const d=new Date(v+'T12:00:00');return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
const statusLabel=v=>({draft:'Draft',published:'Published',cancelled:'Cancelled',completed:'Completed'}[v]||v||'Draft');
const friendlyError=e=>{const m=String(e?.message||e||'Something went wrong.');if(/inactivity timeout|<html|page not found/i.test(m))return 'The event sync took too long. The new bulk-sync fix prevents this once deployed.';return m};
async function websiteEventsSource(){
  const r=await fetch('/content/events.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Could not load the current website events file.');
  const d=await r.json(),events=Array.isArray(d)?d:d.events;if(!Array.isArray(events))throw Error('The website events file is not in the expected format.');return events;
}

function setNotice(message,type='success'){
  const el=$('#eventManagerNotice');if(!el)return;el.textContent=message;el.className='publish-notice '+type;el.hidden=!message;
}
function editorField(name){return $(`[name="${name}"]`,$('#eventEditorForm'))}
function setField(name,value){const el=editorField(name);if(!el)return;if(el.type==='checkbox')el.checked=!!value;else el.value=value??''}
function getField(name){const el=editorField(name);if(!el)return null;return el.type==='checkbox'?el.checked:el.value}
function counts(e){const s=e.registration_stats||{};return {total:Number(s.total||0),confirmed:Number(s.confirmed||0),waitlisted:Number(s.waitlisted||0),pending:Number(s.pending||0)}}
function renderStats(){
  const events=state.events, published=events.filter(e=>e.status==='published'&&e.is_public).length, internal=events.filter(e=>e.signup_mode==='internal').length, totalRegs=events.reduce((a,e)=>a+counts(e).total,0);
  const map={eventStatTotal:events.length,eventStatPublished:published,eventStatInternal:internal,eventStatRegistrations:totalRegs};for(const [id,v] of Object.entries(map)){const el=$('#'+id);if(el)el.textContent=v}
}
function filteredEvents(){
  const q=($('#eventManagerSearch')?.value||'').toLowerCase().trim(),status=$('#eventManagerStatusFilter')?.value||'all',sport=$('#eventManagerCategoryFilter')?.value||'all';
  return state.events.filter(e=>(!q||[e.title,e.category,e.sport,e.description].some(x=>String(x||'').toLowerCase().includes(q)))&&(status==='all'||e.status===status)&&(sport==='all'||e.category===sport));
}
function renderFilters(){
  const el=$('#eventManagerCategoryFilter');if(!el)return;const current=el.value||'all',cats=[...new Set(state.events.map(e=>e.category).filter(Boolean))].sort();el.innerHTML='<option value="all">All categories</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if([...el.options].some(o=>o.value===current))el.value=current;
}
function renderList(){
  renderStats();renderFilters();const list=$('#eventManagerList');if(!list)return;const rows=filteredEvents();
  list.innerHTML=rows.map(e=>{const c=counts(e),selected=state.selected?.id===e.id;return `<button class="event-admin-card ${selected?'active':''}" type="button" data-event-open="${esc(e.id)}">
    <div class="event-admin-card-top"><span class="event-status ${esc(e.status)}">${esc(statusLabel(e.status))}</span><span class="event-admin-date">${esc(fmtDate(e.start_date))}${e.end_date&&e.end_date!==e.start_date?' – '+esc(fmtDate(e.end_date)):''}</span></div>
    <strong>${esc(e.title)}</strong><small>${esc(e.category||e.sport||'Event')} • ${esc(e.signup_mode==='internal'?'Adventure Signup':e.signup_mode==='external'?'External signup':'No signup')}</small>
    <div class="event-admin-card-metrics"><span><b>${c.total}</b> signups</span>${e.capacity?`<span><b>${esc(e.capacity)}</b> capacity</span>`:''}</div>
  </button>`}).join('')||'<div class="event-admin-empty"><b>No events match these filters.</b><span>Try another search or create a new event.</span></div>';
  $$('[data-event-open]',list).forEach(b=>b.onclick=()=>openEvent(b.dataset.eventOpen));
}
function blankEvent(){
  const today=new Date().toISOString().slice(0,10);return {title:'',short_title:'',description:'',category:'Tournaments',sport:'',event_kind:'Tournament',status:'draft',is_public:false,featured:false,start_date:today,end_date:today,start_time:'',end_time:'',timezone:'America/New_York',location_name:'Adventure Sports & Entertainment',location_address:'515 Monmouth Rd, Building 200, Jackson Township, NJ 08527',price_display:'See event details',event_fee:'',divisions:[],signup_mode:'internal',registration_type:'team',registration_state:'auto',registration_open_at:'',registration_close_at:'',capacity:'',waitlist_enabled:true,external_registration_url:'',registration_questions:[],image_url:'',logo_url:'',banner_url:'',admission_price:'',admission_note:'',rules_url:'',waiver_url:'',contact_name:'',contact_email:'',contact_phone:'',seo_title:'',seo_description:'',admin_notes:''};
}
function isoLocal(v){if(!v)return '';const d=new Date(v);if(Number.isNaN(d.getTime()))return '';const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
function fillEditor(e){
  const form=$('#eventEditorForm');if(!form)return;form.hidden=false;$('#eventEditorEmpty').hidden=true;state.questions=Array.isArray(e.registration_questions)?JSON.parse(JSON.stringify(e.registration_questions)):[];
  ['title','short_title','description','category','sport','event_kind','status','start_date','end_date','start_time','end_time','timezone','location_name','location_address','price_display','event_fee','signup_mode','registration_type','registration_state','capacity','external_registration_url','image_url','logo_url','banner_url','admission_price','admission_note','rules_url','waiver_url','contact_name','contact_email','contact_phone','seo_title','seo_description','admin_notes'].forEach(k=>setField(k,e[k]??''));
  setField('is_public',!!e.is_public);setField('featured',!!e.featured);setField('waitlist_enabled',e.waitlist_enabled!==false);setField('divisions',(e.divisions||[]).join(', '));
  setField('registration_open_at',isoLocal(e.registration_open_at));setField('registration_close_at',isoLocal(e.registration_close_at));
  $('#eventEditorTitle').textContent=e.id?e.title||'Edit Event':'Create New Event';$('#eventEditorMeta').textContent=e.id?`${statusLabel(e.status)} • Updated ${e.updated_at?new Date(e.updated_at).toLocaleString():'just now'}`:'Configure the event and publish when ready.';
  const del=$('#eventDeleteButton'),dup=$('#eventDuplicateButton');if(del)del.hidden=!e.id||window.ASE_OPS.role?.()!=='owner';if(dup)dup.hidden=!e.id;
  renderQuestions();updateModeUI();updatePreviewLink();selectTab('basics');
}
function openEvent(id){const e=state.events.find(x=>x.id===id);if(!e)return;state.selected=JSON.parse(JSON.stringify(e));fillEditor(state.selected);renderList();loadRegistrations(id)}
function newEvent(){state.selected=blankEvent();state.registrations=[];fillEditor(state.selected);renderList();renderRegistrations()}
function selectTab(name){$$('[data-event-editor-tab]').forEach(b=>b.classList.toggle('active',b.dataset.eventEditorTab===name));$$('[data-event-editor-panel]').forEach(p=>p.hidden=p.dataset.eventEditorPanel!==name);if(name==='registrations'&&state.selected?.id)loadRegistrations(state.selected.id)}
function renderQuestions(){
  const box=$('#eventQuestionList');if(!box)return;box.innerHTML=state.questions.map((q,i)=>`<div class="event-question-row" data-q-index="${i}"><input data-q-field="label" value="${esc(q.label||'')}" placeholder="Question label"><select data-q-field="type"><option value="text" ${q.type==='text'?'selected':''}>Short text</option><option value="textarea" ${q.type==='textarea'?'selected':''}>Long text</option><option value="select" ${q.type==='select'?'selected':''}>Dropdown</option><option value="checkbox" ${q.type==='checkbox'?'selected':''}>Checkbox</option></select><input data-q-field="options" value="${esc((q.options||[]).join(', '))}" placeholder="Options, comma separated" ${q.type==='select'?'':'disabled'}><label class="event-q-check"><input type="checkbox" data-q-field="required" ${q.required?'checked':''}> Required</label><button type="button" class="icon-button" data-q-remove="${i}">×</button></div>`).join('')||'<div class="event-admin-empty compact"><span>No custom questions. Standard contact/team fields will still be collected.</span></div>';
  $$('[data-q-index]',box).forEach(row=>{const i=Number(row.dataset.qIndex);$$('[data-q-field]',row).forEach(el=>el.onchange=()=>{const f=el.dataset.qField;if(f==='required')state.questions[i][f]=el.checked;else if(f==='options')state.questions[i][f]=el.value.split(',').map(x=>x.trim()).filter(Boolean);else state.questions[i][f]=el.value;if(f==='type')renderQuestions()})});$$('[data-q-remove]',box).forEach(b=>b.onclick=()=>{state.questions.splice(Number(b.dataset.qRemove),1);renderQuestions()});
}
function addQuestion(){state.questions.push({id:'q_'+Date.now(),label:'',type:'text',required:false,options:[]});renderQuestions();const rows=$$('.event-question-row');rows.at(-1)?.querySelector('input')?.focus()}
function updateModeUI(){
  const mode=getField('signup_mode');$$('[data-signup-mode]').forEach(x=>x.hidden=x.dataset.signupMode!==mode);const type=getField('registration_type');const label=$('#registrationTypeHelp');if(label)label.textContent=type==='team'?'Collects team, coach/registrant, division, contact information, roster, and custom questions.':'Collects participant, registrant, division, contact information, and custom questions.';
}
function updatePreviewLink(){const a=$('#eventPreviewButton');if(!a)return;const slug=state.selected?.slug;a.href=slug?`/event.html?event=${encodeURIComponent(slug)}`:'/events.html';a.classList.toggle('disabled',!slug)}
function collect(){
  const e={...state.selected};
  ['title','short_title','description','category','sport','event_kind','status','start_date','end_date','start_time','end_time','timezone','location_name','location_address','price_display','signup_mode','registration_type','registration_state','external_registration_url','image_url','logo_url','banner_url','admission_price','admission_note','rules_url','waiver_url','contact_name','contact_email','contact_phone','seo_title','seo_description','admin_notes'].forEach(k=>e[k]=getField(k));
  e.is_public=!!getField('is_public');e.featured=!!getField('featured');e.waitlist_enabled=!!getField('waitlist_enabled');e.capacity=getField('capacity')||null;e.event_fee=getField('event_fee')||null;
  e.divisions=String(getField('divisions')||'').split(',').map(x=>x.trim()).filter(Boolean);e.registration_questions=state.questions.map((q,i)=>({...q,id:q.id||`q${i+1}`,label:String(q.label||'').trim()})).filter(q=>q.label);
  const oa=getField('registration_open_at'),ca=getField('registration_close_at');e.registration_open_at=oa?new Date(oa).toISOString():null;e.registration_close_at=ca?new Date(ca).toISOString():null;
  return e;
}
async function saveEvent(ev){
  ev.preventDefault();const btn=$('#eventSaveButton');btn.disabled=true;btn.textContent='Saving…';setNotice('');
  try{const data=await post({action:'save',event:collect()});state.selected=data.event;toast('Event saved');setNotice('Saved. Public event data updates immediately when this event is published.');await refreshEvents(false);openEvent(data.event.id)}catch(e){setNotice(e.message,'error')}finally{btn.disabled=false;btn.textContent='Save Event'}
}
async function duplicateEvent(){if(!state.selected?.id)return;try{const d=await post({action:'duplicate',id:state.selected.id});toast('Event duplicated as a draft');await refreshEvents(false);openEvent(d.event.id)}catch(e){setNotice(e.message,'error')}}
async function deleteEvent(){if(!state.selected?.id)return;if(!confirm(`Delete “${state.selected.title}” and all of its registrations? This cannot be undone.`))return;try{await post({action:'delete',id:state.selected.id});toast('Event deleted');state.selected=null;state.registrations=[];await refreshEvents(false);$('#eventEditorForm').hidden=true;$('#eventEditorEmpty').hidden=false}catch(e){setNotice(e.message,'error')}}
async function syncWebsiteEvents({ask=false,silent=false}={}){
  if(ask&&!confirm('Sync every event currently published in content/events.json into Event Management? Existing imported events will be updated instead of duplicated.'))return false;
  const btn=$('#eventImportButton');if(btn){btn.disabled=true;btn.textContent='Syncing…'}
  try{
    if(!silent)setNotice('Syncing the events already published on the website…');
    const events=await websiteEventsSource();
    const out=await post({action:'import',events});
    if(!silent)setNotice(`Sync complete: ${out.synced||out.imported||events.length} website events are now in Event Management.`);
    toast(`${out.synced||out.imported||events.length} website events synced`);
    return true;
  }catch(e){setNotice(friendlyError(e),'error');return false}
  finally{if(btn){btn.disabled=false;btn.textContent='Sync Website Events'}}
}
async function importWebsiteEvents(){const ok=await syncWebsiteEvents({ask:true});if(ok)await refreshEvents(false,false)}
async function loadRegistrations(id){
  const body=$('#eventRegistrationRows');if(body)body.innerHTML='<tr><td colspan="7">Loading registrations…</td></tr>';try{const d=await window.ASE_OPS.api(ENDPOINT+'?action=registrations&event_id='+encodeURIComponent(id));state.registrations=d.registrations||[];renderRegistrations()}catch(e){if(body)body.innerHTML=`<tr><td colspan="7">${esc(e.message)}</td></tr>`}
}
function renderRegistrations(){
  const rows=$('#eventRegistrationRows'),summary=$('#eventRegistrationSummary');if(!rows)return;const regs=state.registrations||[];if(summary)summary.textContent=`${regs.length} registration${regs.length===1?'':'s'}`;
  rows.innerHTML=regs.map(r=>`<tr><td><b>${esc(r.registration_number)}</b><small>${esc(new Date(r.created_at).toLocaleString())}</small></td><td>${esc(r.team_name||r.participant_name||'—')}<small>${esc(r.organization_name||'')}</small></td><td>${esc(r.division||'—')}</td><td>${esc(r.registrant_name)}<small>${esc(r.email)}</small></td><td><select data-reg-status="${esc(r.id)}"><option value="confirmed" ${r.status==='confirmed'?'selected':''}>Confirmed</option><option value="pending" ${r.status==='pending'?'selected':''}>Pending</option><option value="waitlisted" ${r.status==='waitlisted'?'selected':''}>Waitlisted</option><option value="cancelled" ${r.status==='cancelled'?'selected':''}>Cancelled</option></select></td><td><button class="secondary-btn compact-btn" type="button" data-reg-view="${esc(r.id)}">View</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty-row">No registrations yet.</td></tr>';
  $$('[data-reg-status]',rows).forEach(s=>s.onchange=()=>updateRegistrationStatus(s.dataset.regStatus,s.value));$$('[data-reg-view]',rows).forEach(b=>b.onclick=()=>viewRegistration(b.dataset.regView));
}
async function updateRegistrationStatus(id,status){try{await post({action:'registration-status',registration_id:id,status});toast('Registration updated');await loadRegistrations(state.selected.id);await refreshEvents(false)}catch(e){setNotice(e.message,'error')}}
function viewRegistration(id){const r=state.registrations.find(x=>x.id===id);if(!r)return;state.activeRegistrationId=id;const roster=(r.roster||[]).join('\n'),responses=Object.entries(r.responses||{}).map(([k,v])=>{const q=(state.selected?.registration_questions||[]).find(x=>x.id===k);return `${q?.label||k}: ${typeof v==='boolean'?(v?'Yes':'No'):v}`}).join('\n')||'—';$('#eventRegistrationDetail').innerHTML=`<form id="eventRegistrationEditForm" class="event-reg-edit-form"><div class="event-reg-detail-grid"><label><small>Registration</small><input value="${esc(r.registration_number)}" disabled></label><label><small>Status</small><input value="${esc(r.status)}" disabled></label><label><small>Team Name</small><input name="team_name" value="${esc(r.team_name||'')}"></label><label><small>Participant Name</small><input name="participant_name" value="${esc(r.participant_name||'')}"></label><label><small>Organization</small><input name="organization_name" value="${esc(r.organization_name||'')}"></label><label><small>Division</small><input name="division" value="${esc(r.division||'')}"></label><label><small>Registrant *</small><input name="registrant_name" required value="${esc(r.registrant_name)}"></label><label><small>Email *</small><input name="email" type="email" required value="${esc(r.email)}"></label><label><small>Phone</small><input name="phone" value="${esc(r.phone||'')}"></label><label><small>City</small><input name="city" value="${esc(r.city||'')}"></label><label><small>State</small><input name="state" value="${esc(r.state||'')}"></label></div><label class="event-reg-edit-block"><small>Roster — one player per line</small><textarea name="roster" rows="6">${esc(roster)}</textarea></label><div class="event-reg-detail-block"><small>Custom responses</small><pre>${esc(responses)}</pre></div><div class="event-reg-detail-block"><small>Registrant notes</small><p>${esc(r.notes||'—')}</p></div><label class="event-reg-edit-block"><small>Internal admin notes</small><textarea name="admin_notes" rows="4" placeholder="Private notes for Adventure Sports staff">${esc(r.admin_notes||'')}</textarea></label></form>`;const del=$('#eventRegistrationDelete');if(del)del.hidden=window.ASE_OPS.role?.()!=='owner';$('#eventRegistrationModal').hidden=false;document.body.classList.add('modal-open')}
async function saveRegistrationDetail(){const id=state.activeRegistrationId,form=$('#eventRegistrationEditForm');if(!id||!form)return;const fd=new FormData(form),registration={team_name:fd.get('team_name'),participant_name:fd.get('participant_name'),organization_name:fd.get('organization_name'),division:fd.get('division'),registrant_name:fd.get('registrant_name'),email:fd.get('email'),phone:fd.get('phone'),city:fd.get('city'),state:fd.get('state'),admin_notes:fd.get('admin_notes'),roster:String(fd.get('roster')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean)};const btn=$('#eventRegistrationSave');btn.disabled=true;btn.textContent='Saving…';try{await post({action:'registration-update',registration_id:id,registration});toast('Registration saved');closeRegistrationDetail();await loadRegistrations(state.selected.id)}catch(e){setNotice(e.message,'error')}finally{btn.disabled=false;btn.textContent='Save Changes'}}
async function deleteRegistrationDetail(){const id=state.activeRegistrationId;if(!id||window.ASE_OPS.role?.()!=='owner')return;if(!confirm('Delete this registration permanently?'))return;try{await post({action:'registration-delete',registration_id:id});toast('Registration deleted');closeRegistrationDetail();await loadRegistrations(state.selected.id);await refreshEvents(false)}catch(e){setNotice(e.message,'error')}}
function closeRegistrationDetail(){$('#eventRegistrationModal').hidden=true;document.body.classList.remove('modal-open')}
function exportCSV(){
  const regs=state.registrations||[];if(!regs.length)return toast('No registrations to export');const cols=['registration_number','status','registration_type','team_name','participant_name','organization_name','division','registrant_name','email','phone','city','state','created_at'];const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';const csv=[cols.join(','),...regs.map(r=>cols.map(c=>q(r[c])).join(','))].join('\n');const blob=new Blob([csv],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(state.selected?.slug||'event')}-registrations.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
async function refreshEvents(preserve=true,autoSync=true){
  const d=await api('list');state.events=d.events||[];state.loaded=true;
  if(autoSync&&state.events.length===0){
    setNotice('Your event database is empty. Syncing every event already published on the website…');
    const ok=await syncWebsiteEvents({silent:true});
    if(ok)return refreshEvents(preserve,false);
  }
  renderList();if(preserve&&state.selected?.id){const fresh=state.events.find(x=>x.id===state.selected.id);if(fresh){state.selected=JSON.parse(JSON.stringify(fresh));fillEditor(state.selected)}}
}
async function load(){
  if(state.loaded){renderList();return}const list=$('#eventManagerList');if(list)list.innerHTML='<div class="event-admin-empty"><b>Loading events…</b><span>If the database is empty, your published website events will sync automatically.</span></div>';try{await refreshEvents(false,true)}catch(e){const msg=friendlyError(e);setNotice(msg,'error');if(list)list.innerHTML=`<div class="event-admin-empty error"><b>Event database is not ready.</b><span>${esc(msg)}</span><small>Run EVENT-ENGINE-SETUP.sql in Supabase once, then press Refresh.</small></div>`}
}
function bind(){
  $('#eventNewButton')?.addEventListener('click',newEvent);$('#eventRefreshButton')?.addEventListener('click',()=>refreshEvents(false));$('#eventImportButton')?.addEventListener('click',importWebsiteEvents);$('#eventEditorForm')?.addEventListener('submit',saveEvent);$('#eventDuplicateButton')?.addEventListener('click',duplicateEvent);$('#eventDeleteButton')?.addEventListener('click',deleteEvent);$('#eventAddQuestion')?.addEventListener('click',addQuestion);$('#eventManagerSearch')?.addEventListener('input',renderList);$('#eventManagerStatusFilter')?.addEventListener('change',renderList);$('#eventManagerCategoryFilter')?.addEventListener('change',renderList);$('#eventRegistrationExport')?.addEventListener('click',exportCSV);$$('[data-event-editor-tab]').forEach(b=>b.onclick=()=>selectTab(b.dataset.eventEditorTab));['signup_mode','registration_type'].forEach(n=>editorField(n)?.addEventListener('change',updateModeUI));$$('[data-event-registration-close]').forEach(x=>x.onclick=closeRegistrationDetail);$('#eventRegistrationSave')?.addEventListener('click',saveRegistrationDetail);$('#eventRegistrationDelete')?.addEventListener('click',deleteRegistrationDetail);
}
document.addEventListener('DOMContentLoaded',bind);if(document.readyState!=='loading')bind();
window.ASE_EVENT_MANAGER={load,refresh:()=>refreshEvents(false)};
})();
