(function(){
'use strict';

const $=(s,r=document)=>r.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const TZ='America/New_York';
const LIVE_ENDPOINT='/.netlify/functions/staff-schedule';
const FALLBACK_ENDPOINT='/content/staff-schedule.json';
const REFRESH_MS=30000;

let data={dates:[],shifts:[]};
let selected='';
let query='';
let filter='all';
let refreshing=false;
let refreshTimer=null;

const dateFmt=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:TZ});
const shortFmt=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:TZ});

function today(){
  const p=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:TZ}).formatToParts(new Date());
  const g=t=>p.find(x=>x.type===t)?.value||'';
  return `${g('year')}-${g('month')}-${g('day')}`;
}
function mins(t){
  const m=String(t||'').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if(!m)return 0;
  let h=+m[1]%12;
  if(m[3].toUpperCase()==='PM')h+=12;
  return h*60+(+m[2]);
}
function nowMins(){
  const p=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',hour12:false,timeZone:TZ}).formatToParts(new Date());
  const h=+(p.find(x=>x.type==='hour')?.value||0),m=+(p.find(x=>x.type==='minute')?.value||0);
  return h*60+m;
}
function state(s){
  if(selected!==today())return 'scheduled';
  const n=nowMins(),a=mins(s.start),b=mins(s.end);
  return n<a?'later':n>=b?'completed':'working';
}
function label(x){
  return x==='working'?'Working now':x==='later'?'Scheduled later':x==='completed'?'Completed':'Scheduled';
}
function chooseInitial(){
  const t=today();
  if(data.dates.includes(t))return t;
  const future=data.dates.find(d=>d>t);
  return future||data.dates[data.dates.length-1]||'';
}
function fullDate(d){return dateFmt.format(new Date(d+'T12:00:00'))}
function populateDates(preserve=true){
  const select=$('#staffDateSelect');
  if(!select)return;
  const previous=preserve?selected:'';
  select.innerHTML=data.dates.map(d=>`<option value="${d}">${esc(shortFmt.format(new Date(d+'T12:00:00')))}</option>`).join('');
  selected=(previous&&data.dates.includes(previous))?previous:chooseInitial();
  select.value=selected;
}
function peopleAtEdge(shifts,key,mode){
  if(!shifts.length)return [];
  const vals=shifts.map(s=>mins(s[key]));
  const edge=mode==='min'?Math.min(...vals):Math.max(...vals);
  return shifts.filter(s=>mins(s[key])===edge);
}
function timeline(shifts){
  const groups={};
  shifts.forEach(s=>(groups[s.start]??=[]).push(s));
  const times=Object.keys(groups).sort((a,b)=>mins(a)-mins(b));
  $('#staffTimeline').innerHTML=times.length?times.map(t=>`<div class="timeline-row"><time>${esc(t)}</time><span></span><div>${groups[t].map(s=>`<b>${esc(s.displayName||s.name)}</b>`).join('')}<small>${groups[t].length} shift${groups[t].length===1?'':'s'} starting</small></div></div>`).join(''):'<div class="staff-empty-small">No shifts scheduled.</div>';
}
function coverageBar(shifts){
  if(!shifts.length){$('#staffCoverageBar').innerHTML='';return}
  const start=Math.min(...shifts.map(s=>mins(s.start))),end=Math.max(...shifts.map(s=>mins(s.end))),span=Math.max(1,end-start);
  const sortedStart=shifts.slice().sort((a,b)=>mins(a.start)-mins(b.start));
  const sortedEnd=shifts.slice().sort((a,b)=>mins(b.end)-mins(a.end));
  $('#staffCoverageBar').innerHTML=`<div class="coverage-axis"><span>${esc(sortedStart[0].start)}</span><b>Daily coverage</b><span>${esc(sortedEnd[0].end)}</span></div><div class="coverage-track">${shifts.map(s=>{const left=((mins(s.start)-start)/span)*100,width=((mins(s.end)-mins(s.start))/span)*100;return `<i style="left:${left}%;width:${Math.max(width,1.8)}%" title="${esc(s.displayName||s.name)}: ${esc(s.start)}–${esc(s.end)}"></i>`}).join('')}</div>`;
}
function setConnection(mode,message){
  const dot=$('#staffLiveDot');
  const text=$('#staffLiveText');
  const notice=$('#staffNotice');
  if(dot)dot.className=`staff-live-dot ${mode}`;
  if(text)text.textContent=message;
  if(notice&&mode!=='error')notice.hidden=true;
}
function updateSyncDetails(){
  $('#staffLoadedDates').textContent=data.dates.length;
  $('#staffDataUpdated').textContent=new Date(data.generatedAt||Date.now()).toLocaleString();
  const source=$('#staffSourceName');
  if(source)source.textContent=data.sheetName||'Base Schedule';
}
function render(){
  const all=data.shifts.filter(s=>s.date===selected).map(s=>({...s,state:state(s)}));
  const working=all.filter(s=>s.state==='working'),later=all.filter(s=>s.state==='later'),completed=all.filter(s=>s.state==='completed');
  const closers=peopleAtEdge(all,'end','max'),openers=peopleAtEdge(all,'start','min');
  const labor=all.reduce((n,s)=>n+(+s.hours||0),0);

  $('#staffScheduledCount').textContent=all.length;
  $('#staffWorkingCount').textContent=working.length;
  $('#staffLaterCount').textContent=later.length;
  $('#staffCompletedCount').textContent=completed.length;
  $('#staffLaborHours').textContent=labor.toFixed(labor%1?1:0);
  $('#staffCloserCount').textContent=closers.length;
  $('#staffWorkingNote').textContent=selected===today()?'currently on shift':'live count shown on today';
  $('#staffScheduledNote').textContent=all.length===1?'employee today':'employees today';
  $('#staffClosingTime').textContent=closers.length?`coverage until ${closers[0].end}`:'latest coverage';
  $('#staffDayHeading').textContent=selected?fullDate(selected):'Daily Schedule';
  $('#staffDaySummary').textContent=all.length?`${all.length} shifts • ${labor.toFixed(1)} scheduled labor hours`:'No shifts are entered for this date.';
  $('#staffFirstIn').textContent=openers[0]?.start||'—';
  $('#staffOpeners').textContent=openers.length?openers.map(s=>s.displayName||s.name).join(', '):'No opener scheduled';
  $('#staffLastOut').textContent=closers[0]?.end||'—';
  $('#staffClosers').textContent=closers.length?closers.map(s=>s.displayName||s.name).join(', '):'No closer scheduled';

  coverageBar(all);
  timeline(all);

  let shown=all
    .filter(s=>filter==='all'||s.state===filter)
    .filter(s=>(`${s.name} ${s.displayName} ${s.role}`).toLowerCase().includes(query.toLowerCase()))
    .sort((a,b)=>mins(a.start)-mins(b.start));

  $('#staffShiftCards').innerHTML=shown.length?shown.map(s=>`<article class="staff-shift-card ${s.state}"><div class="staff-card-status"><span></span>${esc(label(s.state))}</div><div class="staff-card-main"><div class="staff-avatar">${esc((s.displayName||s.name).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><div><h3>${esc(s.displayName||s.name)}</h3><p>${esc(s.role)}</p></div></div><div class="staff-shift-time"><div><small>Starts</small><strong>${esc(s.start)}</strong></div><span>→</span><div><small>Ends</small><strong>${esc(s.end)}</strong></div></div><div class="staff-card-footer"><span>${Number(s.hours).toFixed(Number.isInteger(s.hours)?0:1)} scheduled hours</span>${s.phone?`<a href="sms:${esc(s.phone)}">Text</a><a href="tel:${esc(s.phone)}">Call</a>`:'<em>No phone listed</em>'}</div></article>`).join(''):`<div class="staff-empty"><span>👥</span><h3>No matching shifts</h3><p>Try another date, status, or search.</p></div>`;
}
async function fetchJson(url){
  const r=await fetch(`${url}${url.includes('?')?'&':'?'}v=${Date.now()}`,{cache:'no-store'});
  const raw=await r.text();
  let parsed;
  try{parsed=JSON.parse(raw)}catch{throw Error(`Schedule server returned an unreadable response (${r.status}).`)}
  if(!r.ok||parsed.ok===false)throw Error(parsed.error||`Schedule request failed (${r.status}).`);
  return parsed;
}
async function load({manual=false,initial=false}={}){
  if(refreshing)return;
  refreshing=true;
  const button=$('#staffRefreshButton');
  if(button){button.disabled=true;button.textContent='Refreshing…'}
  setConnection('syncing',manual?'Refreshing Google Sheet…':'Syncing Google Sheet…');

  try{
    const live=await fetchJson(LIVE_ENDPOINT);
    data=live;
    populateDates(!initial);
    updateSyncDetails();
    render();
    setConnection('live',`Live • synced ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`);
  }catch(error){
    const notice=$('#staffNotice');
    if(initial){
      try{
        const fallback=await fetchJson(FALLBACK_ENDPOINT);
        data=fallback;
        populateDates(false);
        updateSyncDetails();
        render();
        setConnection('warning','Offline • showing last uploaded schedule');
        notice.textContent=`Live Google Sheets connection failed: ${error.message} Showing the last uploaded schedule instead.`;
        notice.className='publish-notice error';
        notice.hidden=false;
      }catch{
        setConnection('error','Schedule offline');
        notice.textContent=error.message;
        notice.className='publish-notice error';
        notice.hidden=false;
        $('#staffShiftCards').innerHTML='<div class="staff-empty"><span>!</span><h3>Schedule could not load</h3><p>Check the Google Apps Script deployment and Netlify function.</p></div>';
      }
    }else{
      setConnection('warning','Connection issue • retrying automatically');
      notice.textContent=`Could not refresh: ${error.message} The previous schedule remains on screen.`;
      notice.className='publish-notice error';
      notice.hidden=false;
    }
  }finally{
    refreshing=false;
    if(button){button.disabled=false;button.textContent='Refresh'}
  }
}
document.addEventListener('DOMContentLoaded',()=>{
  const d=$('#staffDateSelect');
  if(!d)return;
  d.onchange=()=>{selected=d.value;render()};
  $('#staffTodayButton').onclick=()=>{const t=today();selected=data.dates.includes(t)?t:chooseInitial();d.value=selected;render()};
  $('#staffRefreshButton').onclick=()=>load({manual:true});
  $('#staffSearch').oninput=e=>{query=e.target.value;render()};
  $('#staffStatusFilter').onchange=e=>{filter=e.target.value;render()};
  load({initial:true});
  refreshTimer=setInterval(()=>load(),REFRESH_MS);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
});
})();
