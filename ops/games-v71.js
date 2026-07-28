(()=>{
'use strict';
const FIELDS=['A1','A2','B1','B2','C1','C2','D1','D2'];
const TZ='America/New_York';
const API='/.netlify/functions/tournament-matrix';
const FALLBACK={"id":"cup-championship-2026","name":"Tournament Field Matrix","dateRange":"July 28\u2013August 3, 2026","fields":["A1","A2","B1","B2","C1","C2","D1","D2"],"days":[{"key":"2026-07-28","label":"Tuesday","short":"Tue \u00b7 Jul 28","rows":[["8:00 AM",["C1","D1"]],["10:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["12:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["2:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["4:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["6:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["8:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-07-29","label":"Wednesday","short":"Wed \u00b7 Jul 29","rows":[["10:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["12:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["2:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["4:00 PM",["A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-07-30","label":"Thursday","short":"Thu \u00b7 Jul 30","rows":[["8:30 AM",["A2","B2","C1"]],["11:00 AM",["A2","B2","C1"]],["1:30 PM",["A2","B1","B2"]],["4:00 PM",["A2","B1","B2"]],["6:30 PM",["B2"]]]},{"key":"2026-07-31","label":"Friday","short":"Fri \u00b7 Jul 31","rows":[["3:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["7:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-08-01","label":"Saturday","short":"Sat \u00b7 Aug 1","rows":[["9:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["11:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["1:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["3:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["7:00 PM",["A1","A2","B1","B2","C1","D1","D2"]]]},{"key":"2026-08-02","label":"Sunday","short":"Sun \u00b7 Aug 2","rows":[["8:45 AM",["A1","A2","B1","B2"]],["9:00 AM",["C1","D1","D2"]],["10:45 AM",["A1","A2","B2"]],["11:00 AM",["B1","C1","D1","D2"]],["1:00 PM",["A1","A2","B1","B2","C1","D1","D2"]],["3:00 PM",["A1","A2","B1","B2","C1","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1"]]]},{"key":"2026-08-03","label":"Monday","short":"Mon \u00b7 Aug 3","rows":[["8:15 AM",["A2","C1"]],["8:30 AM",["B2"]],["10:45 AM",["A2","C1"]],["11:15 AM",["B2"]],["1:15 PM",["A2","B1"]],["1:45 PM",["B2"]],["3:45 PM",["A2","B1"]],["4:15 PM",["B2"]],["6:45 PM",["B2"]]]}],"updatedAt":"2026-07-28T12:00:00.000Z","updatedBy":"System","version":1};
const SETUPS=[
 {field:'A1',division:'11U',pitch:"50'",bases:"70'",note:'Change to 12U after Thursday semifinals only if needed.'},
 {field:'A2',division:'11U → 12U',pitch:"50'",bases:"70'",note:'11U Tuesday through Thursday morning. 12U Thursday afternoon through championship.',warn:true},
 {field:'B1',division:'12U',pitch:"50'",bases:"70'",note:'No changes all week.'},
 {field:'B2',division:'12U Championship',pitch:"50'",bases:"70'",note:'Championship field. No changes all week.',champ:true},
 {field:'C1',division:'10U',pitch:"46'",bases:"65'",note:'No changes all week.'},
 {field:'C2',division:'8U → 9U',pitch:"Coach Pitch → 46'",bases:"65'",note:'Tuesday evening: install mound and convert from 8U coach pitch to 9U.',warn:true,critical:true},
 {field:'D1',division:'10U → 9U',pitch:"46'",bases:"65'",note:'Division changes Wednesday. Mound and bases stay in place.'},
 {field:'D2',division:'9U',pitch:"46'",bases:"65'",note:'No changes all week.'}
];
let matrix=FALLBACK, archive=[], active=0, preview=null;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const total=d=>d.rows.reduce((n,r)=>n+r[1].length,0);
const isoToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const todayIndex=()=>{const i=matrix.days.findIndex(d=>d.key===isoToday());return i>=0?i:0};
function session(){try{return JSON.parse(localStorage.getItem('ase_ops_identity_session_v2')||'null')}catch{return null}}
async function request(options={}){
 const api=window.ASE_OPS?.api;
 if(api)return api(API,options);
 const token=session()?.token?.access_token;
 const r=await fetch(API,{cache:'no-store',...options,headers:{Authorization:'Bearer '+token,...(options.headers||{})}});
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(d.error||'Matrix request failed.');
 return d;
}
function to24(time){const m=time.match(/(\d+):(\d+)\s*(AM|PM)/i);if(!m)return'00:00';let h=Number(m[1]);if(m[3].toUpperCase()==='PM'&&h!==12)h+=12;if(m[3].toUpperCase()==='AM'&&h===12)h=0;return`${String(h).padStart(2,'0')}:${m[2]}`}
function parseTime(key,time){return new Date(`${key}T${to24(time)}:00-04:00`)}
function currentStatus(day,rowIndex){
 if(day.key!==isoToday())return'scheduled';
 const now=new Date(),start=parseTime(day.key,day.rows[rowIndex][0]);
 const next=day.rows[rowIndex+1]?parseTime(day.key,day.rows[rowIndex+1][0]):new Date(start.getTime()+120*60000);
 return now>=start&&now<next?'live':now>=next?'finished':'upcoming';
}
function fieldGameCount(day,field){return day.rows.filter(r=>r[1].includes(field)).length}
function nextFieldGame(day,field){
 if(day.key!==isoToday())return day.rows.find(r=>r[1].includes(field))?.[0]||'—';
 const now=new Date(),r=day.rows.find(r=>r[1].includes(field)&&parseTime(day.key,r[0])>=now);
 return r?.[0]||'Complete';
}
function renderTabs(){
 const box=$('#gamesDayTabs');if(!box)return;
 box.innerHTML=matrix.days.map((d,i)=>`<button type="button" class="games-day-tab ${i===active?'active':''}" data-day="${i}"><span>${esc(d.label)}</span><small>${esc((d.short||'').split('·')[1]?.trim()||d.key)}</small></button>`).join('');
 box.querySelectorAll('button').forEach(b=>b.onclick=()=>{active=Number(b.dataset.day);render()});
}
function renderSummary(day){
 const unique=new Set(day.rows.flatMap(r=>r[1])).size,first=day.rows[0]?.[0]||'—',last=day.rows.at(-1)?.[0]||'—',today=day.key===isoToday();
 $('#gamesSelectedDay').textContent=`${day.label} · ${new Date(day.key+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`;
 $('#gamesSummary').innerHTML=`<article class="games-summary-card"><span>Games Scheduled</span><strong>${total(day)}</strong><small>${today?'Today':'Selected day'}</small></article><article class="games-summary-card"><span>Fields Used</span><strong>${unique} / 8</strong><small>${8-unique===0?'All fields active':`${8-unique} field${8-unique===1?'':'s'} idle`}</small></article><article class="games-summary-card"><span>First Pitch</span><strong>${first}</strong><small>Opening start time</small></article><article class="games-summary-card"><span>Last Start</span><strong>${last}</strong><small>Final scheduled slot</small></article>`;
}
function renderMatrix(day){
 const box=$('#gamesMatrix');if(!box)return;
 box.innerHTML=`<table class="games-matrix"><thead><tr><th>Time</th>${FIELDS.map(f=>`<th>${f}</th>`).join('')}<th>Total</th></tr></thead><tbody>${day.rows.map(([time,fields],idx)=>{const status=currentStatus(day,idx);return`<tr class="games-row ${status}"><td><div class="games-time-cell"><strong>${time}</strong>${status==='live'?'<span class="live-pill">LIVE</span>':status==='finished'?'<span class="done-pill">DONE</span>':''}</div></td>${FIELDS.map(f=>`<td><span class="game-slot ${fields.includes(f)?'active':'empty'}">${fields.includes(f)?'✓':'—'}</span></td>`).join('')}<td><strong>${fields.length}</strong></td></tr>`}).join('')}</tbody></table>`;
}
function renderFields(day){
 const box=$('#gamesFieldCards');if(!box)return;
 box.innerHTML=SETUPS.map(x=>`<button type="button" class="games-field-card ${x.warn?'needs-change':''} ${x.critical?'critical-change':''}" data-field="${x.field}"><div class="games-field-title"><strong>${x.field}</strong>${x.champ?'<span>Championship</span>':x.warn?'<span>Setup Change</span>':'<span class="standard-badge">Standard</span>'}</div><h3>${x.division}</h3><div class="games-field-specs"><div><small>Pitching</small><b>${x.pitch}</b></div><div><small>Bases</small><b>${x.bases}</b></div></div><div class="games-field-day"><span>${fieldGameCount(day,x.field)} game${fieldGameCount(day,x.field)===1?'':'s'}</span><span>Next: ${nextFieldGame(day,x.field)}</span></div><p>${x.note}</p></button>`).join('');
}
function renderAlerts(day){
 const box=$('#gamesOpsAlert');if(!box)return;const alerts=[];
 if(day.key==='2026-07-28')alerts.push('<strong>C2 conversion required after tonight:</strong> remove coach-pitch setup, install mound, set rubber to 46 feet, and bases to 65 feet.');
 if(day.key==='2026-07-30')alerts.push('<strong>A2 changes after the morning session:</strong> switch field use from 11U to 12U. Dimensions remain 50/70.');
 box.hidden=!alerts.length;box.innerHTML=alerts.length?`<div class="games-alert-icon">!</div><div><span>Operations Alert</span>${alerts.map(a=>`<p>${a}</p>`).join('')}</div>`:'';
}
function render(){
 if(!matrix.days?.length)return;active=Math.min(active,matrix.days.length-1);const day=matrix.days[active];
 renderTabs();renderSummary(day);renderMatrix(day);renderFields(day);renderAlerts(day);
 window.dispatchEvent(new CustomEvent('ase:matrix-updated',{detail:matrix}));
}
function notice(message,type='success'){const el=$('#gamesMatrixNotice');if(!el)return;el.textContent=message;el.className='publish-notice '+type;el.hidden=false}
function managerMeta(){
 $('#gamesMatrixName').textContent=matrix.name||'Tournament Field Matrix';
 $('#gamesMatrixRange').textContent=matrix.dateRange||'—';
 $('#gamesMatrixVersion').textContent='v'+(matrix.version||1);
 $('#gamesMatrixUpdated').textContent=matrix.updatedAt?new Date(matrix.updatedAt).toLocaleString():'—';
 $('#gamesMatrixBy').textContent=matrix.updatedBy||'—';
 const box=$('#gamesMatrixArchive');
 box.innerHTML=archive.length?archive.map(x=>`<div class="games-archive-item"><div><b>${esc(x.name||'Tournament Matrix')}</b><small>v${x.version||1} · ${x.updatedAt?new Date(x.updatedAt).toLocaleString():'Unknown date'}</small></div><button class="small-btn" data-restore="${esc(x.id)}" type="button">Restore</button></div>`).join(''):'<p class="empty-list">No archived schedules yet.</p>';
 box.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restore(b.dataset.restore));
}
function monthNumber(name){return['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(name.toLowerCase())+1}
function normalizeTime(v){const m=String(v).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);if(!m)return null;return`${Number(m[1])}:${String(m[2]||'00').padStart(2,'0')} ${m[3].toUpperCase()}`}
function parseText(text){
 const raw=String(text||'').replace(/\r/g,'').replace(/\u00a0/g,' ').trim();
 if(!raw)throw Error('Paste or upload a matrix first.');
 const lines=raw.split('\n').map(x=>x.trim()).filter(Boolean);
 const parsed=[];let day=null;let year=2026;
 for(const line of lines){
   const dm=line.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*[•\-|]\s*(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2})(?:,\s*(\d{4}))?$/i);
   if(dm){
     year=Number(dm[4]||year);const mo=monthNumber(dm[2]),da=Number(dm[3]);const key=`${year}-${String(mo).padStart(2,'0')}-${String(da).padStart(2,'0')}`;
     day={key,label:dm[1][0].toUpperCase()+dm[1].slice(1).toLowerCase(),short:`${dm[1].slice(0,3)[0].toUpperCase()+dm[1].slice(1,3).toLowerCase()} · ${dm[2][0].toUpperCase()+dm[2].slice(1,3).toLowerCase()} ${da}`,rows:[]};parsed.push(day);continue;
   }
   const tm=line.match(/^(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s+(.+)$/i);
   if(tm&&day){
     const time=normalizeTime(tm[1]);const tokens=tm[2].split(/\s+/);
     const activeFields=[];FIELDS.forEach((f,i)=>{const mark=tokens[i];if(mark&&/^(✓|✔|x|yes|1)$/i.test(mark))activeFields.push(f)});
     if(!activeFields.length&&tokens.length>=9){FIELDS.forEach((f,i)=>{if(tokens[i]!=='—'&&tokens[i]!=='-')activeFields.push(f)})}
     day.rows.push([time,activeFields]);
   }
 }
 if(!parsed.length)throw Error('No day headings were found. Use headings such as TUESDAY • JULY 28.');
 if(parsed.some(d=>!d.rows.length))throw Error('At least one day does not contain any valid time rows.');
 const first=new Date(parsed[0].key+'T12:00:00'),last=new Date(parsed.at(-1).key+'T12:00:00');
 const range=first.toLocaleDateString('en-US',{month:'long',day:'numeric'})+'–'+last.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
 return{id:'preview',name:'Tournament Field Matrix',dateRange:range,fields:FIELDS,days:parsed};
}
function previewHtml(data){
 const games=data.days.reduce((n,d)=>n+total(d),0),slots=data.days.reduce((n,d)=>n+d.rows.length,0);
 return`<div class="games-preview-stats"><div><strong>${data.days.length}</strong><small>Days</small></div><div><strong>${slots}</strong><small>Time slots</small></div><div><strong>${games}</strong><small>Games</small></div></div><p><b>${esc(data.dateRange)}</b></p><p>${data.days.map(d=>`${esc(d.label)}: ${total(d)} games`).join('<br>')}</p>`;
}
async function previewInput(){
 try{preview=parseText($('#gamesMatrixText').value);$('#gamesMatrixPreview').innerHTML=previewHtml(preview);$('#gamesMatrixPublishButton').disabled=false;notice('Preview ready. Review the totals, then publish live.','success')}catch(e){preview=null;$('#gamesMatrixPublishButton').disabled=true;notice(e.message,'error')}
}
async function publish(){
 if(!preview)return notice('Preview the matrix before publishing.','error');
 const btn=$('#gamesMatrixPublishButton');btn.disabled=true;btn.textContent='Publishing…';
 try{const d=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({matrix:preview})});matrix=d.matrix;archive=d.archive||[];active=0;render();managerMeta();preview=null;$('#gamesMatrixPreview').innerHTML='<p>Published successfully. Paste the next matrix whenever it is ready.</p>';notice('Matrix published live. Everyone will see it after refreshing.','success')}catch(e){notice(e.message,'error')}finally{btn.textContent='Publish Live';btn.disabled=!preview}
}
async function restore(id){
 if(!confirm('Restore this archived tournament matrix as the live schedule?'))return;
 try{const d=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restore',id})});matrix=d.matrix;archive=d.archive||[];active=0;render();managerMeta();notice('Archived matrix restored live.','success')}catch(e){notice(e.message,'error')}
}
async function handleFile(file){
 if(!file)return;$('#gamesMatrixFileName').textContent=file.name;
 try{
   let text='';
   if(/\.(xlsx|xls)$/i.test(file.name)){
     if(!window.XLSX)throw Error('Spreadsheet reader did not load. Save the matrix as TXT or CSV and try again.');
     const data=await file.arrayBuffer(),book=XLSX.read(data,{type:'array'}),sheet=book.Sheets[book.SheetNames[0]];
     text=XLSX.utils.sheet_to_csv(sheet,{FS:' '});
   }else text=await file.text();
   $('#gamesMatrixText').value=text;previewInput();
 }catch(e){notice(e.message,'error')}
}
async function load(){
 try{
  const d=await request();matrix=d.matrix||FALLBACK;archive=d.archive||[];
  active=todayIndex();render();
  const manager=$('#gamesMatrixManager');if(manager){manager.hidden=!d.canManage;if(d.canManage)managerMeta()}
 }catch(e){matrix=FALLBACK;active=todayIndex();render();console.warn(e)}
}
function init(){
 if(!$('#gamesMatrix'))return;
 $('#gamesTodayButton')?.addEventListener('click',()=>{active=todayIndex();render()});
 $('#gamesMatrixPreviewButton')?.addEventListener('click',previewInput);
 $('#gamesMatrixPublishButton')?.addEventListener('click',publish);
 $('#gamesMatrixFile')?.addEventListener('change',e=>handleFile(e.target.files?.[0]));
 load();
}
document.addEventListener('DOMContentLoaded',init);
})();