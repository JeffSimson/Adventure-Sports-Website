(()=>{
  const FIELDS=['A1','A2','B1','B2','C1','C2','D1','D2'];
  const TZ='America/New_York';
  const DAYS=[
    {key:'2026-07-28',label:'Tuesday',short:'Tue · Jul 28',rows:[['8:00 AM',['D1']],['10:00 AM',FIELDS],['12:00 PM',FIELDS],['2:00 PM',FIELDS],['4:00 PM',FIELDS],['6:00 PM',FIELDS],['8:00 PM',['A1','A2','B1','B2','C1','C2','D2']]]},
    {key:'2026-07-29',label:'Wednesday',short:'Wed · Jul 29',rows:[['10:00 AM',['A1','B1','B2','C1','C2','D1','D2']],['12:00 PM',FIELDS],['2:00 PM',FIELDS],['4:00 PM',FIELDS]]},
    {key:'2026-07-30',label:'Thursday',short:'Thu · Jul 30',rows:[['8:00 AM',['D2']],['8:30 AM',['A2','B2','C1']],['11:00 AM',['A2','B2','C1']],['1:30 PM',['A2','B1','B2']],['4:00 PM',['A2','B1','B2','D2']],['6:30 PM',['B2']]]},
    {key:'2026-07-31',label:'Friday',short:'Fri · Jul 31',rows:[['3:00 PM',FIELDS],['5:00 PM',FIELDS],['7:00 PM',FIELDS]]},
    {key:'2026-08-01',label:'Saturday',short:'Sat · Aug 1',rows:[['9:00 AM',FIELDS],['11:00 AM',FIELDS],['1:00 PM',FIELDS],['3:00 PM',FIELDS],['5:00 PM',FIELDS],['7:00 PM',FIELDS]]},
    {key:'2026-08-02',label:'Sunday',short:'Sun · Aug 2',rows:[['8:45 AM',['A1','A2','B1','B2']],['9:00 AM',['C1','D1','D2']],['10:45 AM',['A1','A2','B2']],['11:00 AM',['B1','C1','D1','D2']],['1:00 PM',['A1','A2','B1','B2','C1','D1','D2']],['3:00 PM',['A1','A2','B1','B2','C1','D1','D2']],['5:00 PM',['A1','A2','B1','B2','C1']]]},
    {key:'2026-08-03',label:'Monday',short:'Mon · Aug 3',rows:[['8:15 AM',['A2','C1']],['8:30 AM',['B2']],['10:45 AM',['A2','C1']],['11:15 AM',['B2']],['1:15 PM',['A2','B1']],['1:45 PM',['B2']],['3:45 PM',['A2','B1']],['4:15 PM',['B2']],['6:45 PM',['B2']]]}
  ];
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

  let active=0;
  const $=s=>document.querySelector(s);
  const total=d=>d.rows.reduce((n,r)=>n+r[1].length,0);
  const isoToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const todayIndex=()=>{const i=DAYS.findIndex(d=>d.key===isoToday());return i>=0?i:0};
  const parseTime=(key,time)=>new Date(`${key}T${to24(time)}:00-04:00`);
  function to24(time){const m=time.match(/(\d+):(\d+)\s*(AM|PM)/i);let h=Number(m[1]);const min=m[2];const ap=m[3].toUpperCase();if(ap==='PM'&&h!==12)h+=12;if(ap==='AM'&&h===12)h=0;return `${String(h).padStart(2,'0')}:${min}`}
  function currentStatus(day,rowIndex){
    if(day.key!==isoToday()) return 'scheduled';
    const now=new Date();
    const start=parseTime(day.key,day.rows[rowIndex][0]);
    const next=day.rows[rowIndex+1]?parseTime(day.key,day.rows[rowIndex+1][0]):new Date(start.getTime()+120*60000);
    if(now>=start&&now<next)return 'live';
    if(now>=next)return 'finished';
    return 'upcoming';
  }
  function fieldGameCount(day,field){return day.rows.filter(r=>r[1].includes(field)).length}
  function nextFieldGame(day,field){
    if(day.key!==isoToday()) return day.rows.find(r=>r[1].includes(field))?.[0]||'—';
    const now=new Date();
    const r=day.rows.find(r=>r[1].includes(field)&&parseTime(day.key,r[0])>=now);
    return r?.[0]||'Complete';
  }
  function renderTabs(){
    const box=$('#gamesDayTabs'); if(!box)return;
    box.innerHTML=DAYS.map((d,i)=>`<button type="button" class="games-day-tab ${i===active?'active':''}" data-day="${i}"><span>${d.label}</span><small>${d.short.split('·')[1].trim()}</small></button>`).join('');
    box.querySelectorAll('button').forEach(b=>b.onclick=()=>{active=Number(b.dataset.day);render()});
  }
  function renderSummary(day){
    const unique=new Set(day.rows.flatMap(r=>r[1])).size;
    const first=day.rows[0]?.[0]||'—';
    const last=day.rows.at(-1)?.[0]||'—';
    const today=day.key===isoToday();
    $('#gamesSelectedDay').textContent=`${day.label} · ${new Date(day.key+'T12:00:00').toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`;
    $('#gamesSummary').innerHTML=`
      <article class="games-summary-card"><span>Games Scheduled</span><strong>${total(day)}</strong><small>${today?'Today':'Selected day'}</small></article>
      <article class="games-summary-card"><span>Fields Used</span><strong>${unique} / 8</strong><small>${8-unique===0?'All fields active':`${8-unique} field${8-unique===1?'':'s'} idle`}</small></article>
      <article class="games-summary-card"><span>First Pitch</span><strong>${first}</strong><small>Opening start time</small></article>
      <article class="games-summary-card"><span>Last Start</span><strong>${last}</strong><small>Final scheduled slot</small></article>`;
  }
  function renderMatrix(day){
    const box=$('#gamesMatrix'); if(!box)return;
    box.innerHTML=`<table class="games-matrix"><thead><tr><th>Time</th>${FIELDS.map(f=>`<th>${f}</th>`).join('')}<th>Total</th></tr></thead><tbody>${day.rows.map(([time,fields],idx)=>{
      const status=currentStatus(day,idx);
      return `<tr class="games-row ${status}"><td><div class="games-time-cell"><strong>${time}</strong>${status==='live'?'<span class="live-pill">LIVE</span>':status==='finished'?'<span class="done-pill">DONE</span>':''}</div></td>${FIELDS.map(f=>`<td><span class="game-slot ${fields.includes(f)?'active':'empty'}" title="${fields.includes(f)?`${f} game at ${time}`:`No game on ${f}`}">${fields.includes(f)?'✓':'—'}</span></td>`).join('')}<td><strong>${fields.length}</strong></td></tr>`
    }).join('')}</tbody></table>`;
  }
  function renderFields(day){
    const box=$('#gamesFieldCards'); if(!box)return;
    box.innerHTML=SETUPS.map(x=>`<button type="button" class="games-field-card ${x.warn?'needs-change':''} ${x.critical?'critical-change':''}" data-field="${x.field}">
      <div class="games-field-title"><strong>${x.field}</strong>${x.champ?'<span>Championship</span>':x.warn?'<span>Setup Change</span>':'<span class="standard-badge">Standard</span>'}</div>
      <h3>${x.division}</h3>
      <div class="games-field-specs"><div><small>Pitching</small><b>${x.pitch}</b></div><div><small>Bases</small><b>${x.bases}</b></div></div>
      <div class="games-field-day"><span>${fieldGameCount(day,x.field)} game${fieldGameCount(day,x.field)===1?'':'s'}</span><span>Next: ${nextFieldGame(day,x.field)}</span></div>
      <p>${x.note}</p>
      <span class="games-card-link">View field details →</span>
    </button>`).join('');
    box.querySelectorAll('.games-field-card').forEach(btn=>btn.onclick=()=>openField(btn.dataset.field,day));
  }
  function renderAlerts(day){
    const box=$('#gamesOpsAlert'); if(!box)return;
    const alerts=[];
    if(day.key==='2026-07-28') alerts.push('<strong>C2 conversion required after tonight:</strong> remove coach-pitch setup, install mound, set rubber to 46 feet, and bases to 65 feet.');
    if(day.key==='2026-07-30') alerts.push('<strong>A2 changes after the morning session:</strong> switch field use from 11U to 12U. Dimensions remain 50/70.');
    if(!alerts.length){box.hidden=true;box.innerHTML='';return}
    box.hidden=false;
    box.innerHTML=`<div class="games-alert-icon">!</div><div><span>Operations Alert</span>${alerts.map(a=>`<p>${a}</p>`).join('')}</div>`;
  }
  function openField(field,day){
    const setup=SETUPS.find(x=>x.field===field); if(!setup)return;
    let modal=$('#gamesFieldModal');
    if(!modal){
      modal=document.createElement('div');modal.id='gamesFieldModal';modal.className='games-modal';modal.innerHTML='<div class="games-modal-card" role="dialog" aria-modal="true"><button class="games-modal-close" aria-label="Close">×</button><div id="gamesModalContent"></div></div>';document.body.appendChild(modal);
      modal.addEventListener('click',e=>{if(e.target===modal||e.target.closest('.games-modal-close'))modal.classList.remove('open')});
    }
    const times=day.rows.filter(r=>r[1].includes(field)).map(r=>r[0]);
    $('#gamesModalContent').innerHTML=`<p class="eyebrow">Field details</p><h2>${field}</h2><span class="games-modal-division">${setup.division}</span><div class="games-modal-specs"><div><small>Pitching distance</small><strong>${setup.pitch}</strong></div><div><small>Base distance</small><strong>${setup.bases}</strong></div><div><small>Games on ${day.label}</small><strong>${times.length}</strong></div></div><h3>Game times</h3><div class="games-modal-times">${times.length?times.map(t=>`<span>${t}</span>`).join(''):'<span>No games scheduled</span>'}</div><h3>Setup notes</h3><p>${setup.note}</p>`;
    modal.classList.add('open');
  }
  function render(){const d=DAYS[active];renderTabs();renderSummary(d);renderAlerts(d);renderMatrix(d);renderFields(d)}
  function boot(){
    active=todayIndex();render();
    $('#gamesTodayButton')?.addEventListener('click',()=>{active=todayIndex();render()});
    document.addEventListener('click',e=>{if(e.target.closest('[data-view="games"]'))setTimeout(render,20)});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
