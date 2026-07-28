(()=>{
const FIELDS=['A1','A2','B1','B2','C1','C2','D1','D2'];
const DAYS=[
 {key:'2026-07-28',label:'Tue · Jul 28',rows:[['8:00 AM',['D1']],['10:00 AM',FIELDS],['12:00 PM',FIELDS],['2:00 PM',FIELDS],['4:00 PM',FIELDS],['6:00 PM',FIELDS],['8:00 PM',['A1','A2','B1','B2','C1','C2','D2']]]},
 {key:'2026-07-29',label:'Wed · Jul 29',rows:[['10:00 AM',['A1','B1','B2','C1','C2','D1','D2']],['12:00 PM',FIELDS],['2:00 PM',FIELDS],['4:00 PM',FIELDS]]},
 {key:'2026-07-30',label:'Thu · Jul 30',rows:[['8:00 AM',['D2']],['8:30 AM',['A2','B2','C1']],['11:00 AM',['A2','B2','C1']],['1:30 PM',['A2','B1','B2']],['4:00 PM',['A2','B1','B2','D2']],['6:30 PM',['B2']]]},
 {key:'2026-07-31',label:'Fri · Jul 31',rows:[['3:00 PM',FIELDS],['5:00 PM',FIELDS],['7:00 PM',FIELDS]]},
 {key:'2026-08-01',label:'Sat · Aug 1',rows:[['9:00 AM',FIELDS],['11:00 AM',FIELDS],['1:00 PM',FIELDS],['3:00 PM',FIELDS],['5:00 PM',FIELDS],['7:00 PM',FIELDS]]},
 {key:'2026-08-02',label:'Sun · Aug 2',rows:[['8:45 AM',['A1','A2','B1','B2']],['9:00 AM',['C1','D1','D2']],['10:45 AM',['A1','A2','B2']],['11:00 AM',['B1','C1','D1','D2']],['1:00 PM',['A1','A2','B1','B2','C1','D1','D2']],['3:00 PM',['A1','A2','B1','B2','C1','D1','D2']],['5:00 PM',['A1','A2','B1','B2','C1']]]},
 {key:'2026-08-03',label:'Mon · Aug 3',rows:[['8:15 AM',['A2','C1']],['8:30 AM',['B2']],['10:45 AM',['A2','C1']],['11:15 AM',['B2']],['1:15 PM',['A2','B1']],['1:45 PM',['B2']],['3:45 PM',['A2','B1']],['4:15 PM',['B2']],['6:45 PM',['B2']]]}
];
const SETUPS=[
 {field:'A1',division:'11U',pitch:"50'",bases:"70'",note:'Change to 12U after Thursday semifinals only if needed.'},
 {field:'A2',division:'11U → 12U',pitch:"50'",bases:"70'",note:'11U Tuesday–Thursday morning. 12U Thursday afternoon through championship.',warn:true},
 {field:'B1',division:'12U',pitch:"50'",bases:"70'",note:'No changes all week.'},
 {field:'B2',division:'12U Championship',pitch:"50'",bases:"70'",note:'Championship field. No changes all week.',champ:true},
 {field:'C1',division:'10U',pitch:"46'",bases:"65'",note:'No changes all week.'},
 {field:'C2',division:'8U → 9U',pitch:"Coach Pitch → 46'",bases:"65'",note:'Tuesday evening: install mound and convert from 8U coach pitch to 9U.',warn:true},
 {field:'D1',division:'10U → 9U',pitch:"46'",bases:"65'",note:'Division changes Wednesday; mound and bases stay in place.'},
 {field:'D2',division:'9U',pitch:"46'",bases:"65'",note:'No changes all week.'}
];
let active=0;
const $=s=>document.querySelector(s);
function total(day){return day.rows.reduce((n,r)=>n+r[1].length,0)}
function todayIndex(){const iso=new Date().toLocaleDateString('en-CA',{timeZone:'America/New_York'});const i=DAYS.findIndex(d=>d.key===iso);return i>=0?i:0}
function renderTabs(){const box=$('#gamesDayTabs');if(!box)return;box.innerHTML=DAYS.map((d,i)=>`<button type="button" class="games-day-tab ${i===active?'active':''}" data-day="${i}">${d.label}</button>`).join('');box.querySelectorAll('button').forEach(b=>b.onclick=()=>{active=+b.dataset.day;render()})}
function renderSummary(day){const all=total(day),first=day.rows[0]?.[0]||'—',last=day.rows.at(-1)?.[0]||'—',unique=new Set(day.rows.flatMap(r=>r[1])).size;$('#gamesSummary').innerHTML=`<article class="games-summary-card"><span>Games Scheduled</span><strong>${all}</strong></article><article class="games-summary-card"><span>Fields Used</span><strong>${unique} / 8</strong></article><article class="games-summary-card"><span>First Pitch</span><strong>${first}</strong></article><article class="games-summary-card"><span>Last Start</span><strong>${last}</strong></article>`}
function renderMatrix(day){const box=$('#gamesMatrix');box.innerHTML=`<table class="games-matrix"><thead><tr><th>Time</th>${FIELDS.map(f=>`<th>${f}</th>`).join('')}<th>Total</th></tr></thead><tbody>${day.rows.map(([time,fields])=>`<tr><td><strong>${time}</strong></td>${FIELDS.map(f=>`<td><span class="game-slot ${fields.includes(f)?'active':'empty'}">${fields.includes(f)?'GAME':'—'}</span></td>`).join('')}<td><strong>${fields.length}</strong></td></tr>`).join('')}</tbody></table>`}
function renderFields(){const box=$('#gamesFieldCards');box.innerHTML=SETUPS.map(x=>`<article class="games-field-card ${x.warn?'needs-change':''}"><div class="games-field-title"><strong>${x.field}</strong>${x.champ?'<span>Championship</span>':x.warn?'<span>Setup Change</span>':''}</div><h3>${x.division}</h3><div class="games-field-specs"><div><small>Pitching</small><b>${x.pitch}</b></div><div><small>Bases</small><b>${x.bases}</b></div></div><p>${x.note}</p></article>`).join('')}
function render(){renderTabs();const d=DAYS[active];renderSummary(d);renderMatrix(d);renderFields()}
function boot(){active=todayIndex();render();$('#gamesTodayButton')?.addEventListener('click',()=>{active=todayIndex();render()});document.addEventListener('click',e=>{if(e.target.closest('[data-view="games"]'))setTimeout(render,20)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();