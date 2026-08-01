(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const PREF='/.netlify/functions/dashboard-preferences';
const CARD_META={
 facility:{label:'Facility Status',icon:'●',go:'website'},weather:{label:'Weather',icon:'☁',go:'weather'},schedule:{label:'Schedule',icon:'▣',go:'games'},fields:{label:'Fields',icon:'◇',go:'maintenance'},staff:{label:'Employees',icon:'♙',go:'staff'},incidents:{label:'Incidents',icon:'!',go:'incidents'},workorders:{label:'Work Orders',icon:'⚒',go:'maintenance'},notifications:{label:'Notifications',icon:'◉',go:'notifications'},clover:{label:'Clover',icon:'$',go:'clover'},system:{label:'System Health',icon:'✓',go:'settings'}
};
const role=()=>window.ASE_OPS?.role?.()||'cashier';
const api=(u,o)=>window.ASE_OPS.api(u,o);
const go=v=>document.querySelector(`.nav-item[data-view="${v}"]`)?.click();
let prefs=null,events=[],monthCursor=new Date(),paletteIndex=0,v9Initialized=false;
const setText=(selector,value)=>{const el=$(selector);if(el)el.textContent=value};

function installNav(){
 const labels={dashboard:['⌂','Home'],games:['▣','Schedule'],maintenance:['◇','Fields & Work Orders'],staff:['♙','Employees'],incidents:['!','Incidents'],notifications:['◉','Notifications'],settings:['☰','Settings']};
 for(const [key,[icon,label]] of Object.entries(labels)){const b=$(`.nav-item[data-view="${key}"]`);if(b)b.innerHTML=`<span>${icon}</span>${label}`}
 const mobile=$('.mobile-header');if(mobile&&!$('#v9SearchButton')){const b=document.createElement('button');b.id='v9SearchButton';b.className='icon-button';b.type='button';b.setAttribute('aria-label','Search commands');b.textContent='⌕';mobile.appendChild(b)}
}

async function loadPrefs(){try{prefs=await api(PREF);applyDashboard()}catch(e){console.warn('Dashboard preferences:',e)}}
function applyDashboard(){
 const cards=new Set(prefs?.cards||[]);document.body.dataset.v9Role=role();
 $$('[data-v9-card]').forEach(x=>x.hidden=!cards.has(x.dataset.v9Card));
 const subtitle=$('#v9RoleSubtitle');if(subtitle)subtitle.textContent=`${role()[0].toUpperCase()+role().slice(1)} dashboard · only the information you need`;
}
function dashboardMarkup(){return `<section id="v9Dashboard" class="v9-dashboard">
 <div class="v9-dashboard-head"><div><p class="eyebrow">Adventure Sports</p><h1 id="v9Greeting">Operations Home</h1><p id="v9RoleSubtitle">Your role dashboard</p></div><button id="v9DesktopSearch" class="v9-command-button" type="button"><span>⌕</span> Search or run a command <kbd>⌘K</kbd></button></div>
 <div class="v9-alert-zone" id="v9AlertZone"></div>
 <div class="v9-card-grid">
  <button data-v9-card="facility" data-v9-go="website" class="v9-home-card"><span class="v9-card-icon">●</span><small>Facility</small><strong id="v9Facility">Loading…</strong><em id="v9Announcement">Public status</em></button>
  <button data-v9-card="weather" data-v9-go="weather" class="v9-home-card"><span class="v9-card-icon">☁</span><small>Weather</small><strong id="v9Weather">Loading…</strong><em id="v9WeatherNote">Jackson, NJ</em></button>
  <button data-v9-card="schedule" data-v9-go="games" class="v9-home-card"><span class="v9-card-icon">▣</span><small>Today’s Schedule</small><strong id="v9Schedule">Loading…</strong><em id="v9ScheduleNote">Website events + games</em></button>
  <button data-v9-card="fields" data-v9-go="maintenance" class="v9-home-card"><span class="v9-card-icon">◇</span><small>Fields</small><strong id="v9Fields">8 fields</strong><em id="v9FieldsNote">Tap for readiness</em></button>
  <button data-v9-card="staff" data-v9-go="staff" class="v9-home-card"><span class="v9-card-icon">♙</span><small>Employees</small><strong id="v9Staff">View staff</strong><em>Coverage and profiles</em></button>
  <button data-v9-card="incidents" data-v9-go="incidents" class="v9-home-card"><span class="v9-card-icon">!</span><small>Incidents</small><strong id="v9Incidents">Create or review</strong><em>Confidential reports</em></button>
  <button data-v9-card="workorders" data-v9-go="maintenance" class="v9-home-card"><span class="v9-card-icon">⚒</span><small>Work Orders</small><strong id="v9WorkOrders">Open maintenance</strong><em>Assigned and due work</em></button>
  <button data-v9-card="notifications" data-v9-go="notifications" class="v9-home-card"><span class="v9-card-icon">◉</span><small>Notifications</small><strong id="v9Notifications">Send or review</strong><em>Manual + automatic</em></button>
  <button data-v9-card="clover" data-v9-go="clover" class="v9-home-card"><span class="v9-card-icon">$</span><small>Clover</small><strong id="v9Clover">Sales & tips</strong><em>Owner controls</em></button>
  <button data-v9-card="system" data-v9-go="settings" class="v9-home-card"><span class="v9-card-icon">✓</span><small>System Health</small><strong id="v9System">Checking…</strong><em id="v9SystemNote">Connected services</em></button>
 </div>
 <section class="v9-focus-panel"><div class="panel-head"><div><p class="eyebrow">Today</p><h2>What needs attention</h2></div><button class="secondary-btn" id="v9RefreshHome" type="button">Refresh</button></div><div id="v9FocusList" class="v9-focus-list"><p>Loading today’s schedule and facility status…</p></div></section>
 </section>`}
function replaceDashboard(){const old=$('[data-view-panel="dashboard"]');if(!old)return;old.innerHTML=dashboardMarkup();$$('[data-v9-go]').forEach(b=>b.onclick=()=>go(b.dataset.v9Go));$('#v9DesktopSearch').onclick=openPalette;$('#v9RefreshHome').onclick=refreshHome;}

async function refreshHome(){
 if(!$('#v9Dashboard'))return;
 try{
  const site=await fetch('/content/site.json',{cache:'no-store'}).then(r=>r.json());
  setText('#v9Facility',site.fieldStatus||site.status||'OPEN');
  setText('#v9Announcement',site.announcement||'No public announcement');
 }catch{}
 try{
  const wx=await api('/.netlify/functions/weather-center');const c=wx.current||{};
  setText('#v9Weather',c.temperature!=null?`${Math.round(c.temperature)}°F`:(c.temp!=null?`${Math.round(c.temp)}°F`:'Weather ready'));
  setText('#v9WeatherNote',c.shortForecast||c.condition||wx.source||'Forecast available');
 }catch{setText('#v9Weather','Backup ready')}
 try{
  await loadEvents();const today=new Date().toISOString().slice(0,10);const todayEvents=events.filter(e=>e.startDate<=today&&e.endDate>=today);
  setText('#v9Schedule',todayEvents.length?`${todayEvents.length} event${todayEvents.length===1?'':'s'} today`:'No website events today');
  setText('#v9ScheduleNote',todayEvents[0]?.title||'View calendar and games');renderFocus(todayEvents);
 }catch{}
 setText('#v9System','Online');setText('#v9SystemNote','Security, database and weather connected');
}
function renderFocus(todayEvents){const box=$('#v9FocusList');if(!box)return;const items=[];todayEvents.slice(0,3).forEach(e=>items.push(`<button data-open-event="${events.indexOf(e)}"><span>▣</span><div><b>${esc(e.title)}</b><small>${esc(e.category||'Event')} · ${esc(e.date||'Today')}</small></div><em>View</em></button>`));items.push(`<button data-focus-go="maintenance"><span>◇</span><div><b>Check field readiness</b><small>Inspections, issues, equipment and work orders</small></div><em>Open</em></button>`);items.push(`<button data-focus-go="notifications"><span>◉</span><div><b>Review notifications</b><small>Manual alerts and automatic notification controls</small></div><em>Open</em></button>`);box.innerHTML=items.join('');$$('[data-focus-go]',box).forEach(b=>b.onclick=()=>go(b.dataset.focusGo));$$('[data-open-event]',box).forEach(b=>b.onclick=()=>{go('games');setTimeout(()=>openEvent(Number(b.dataset.openEvent)),100)});}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

// Schedule calendar linked directly to website event JSON.
async function loadEvents(){if(events.length)return events;const d=await fetch('/content/events.json',{cache:'no-store'}).then(r=>r.json());events=(d.events||[]).map(e=>({...e,startDate:e.startDate||e.start_date,endDate:e.endDate||e.end_date||e.startDate||e.start_date})).filter(e=>e.startDate);return events}
function scheduleMarkup(){return `<section id="v9ScheduleCenter" class="v9-schedule-center">
 <div class="v9-module-head"><div><p class="eyebrow">Website-linked calendar</p><h1>Schedule</h1><p>Events update from the same calendar used on adventurenj.com.</p></div><button id="v9ScheduleToday" class="secondary-btn">Today</button></div>
 <div class="v9-segmented"><button class="active" data-v9-schedule-tab="agenda">Upcoming</button><button data-v9-schedule-tab="month">Month</button><button data-v9-schedule-tab="games">Games & Matrix</button></div>
 <div data-v9-schedule-panel="agenda" class="v9-schedule-panel active"><div id="v9UpcomingEvents" class="v9-event-list"></div></div>
 <div data-v9-schedule-panel="month" class="v9-schedule-panel"><div class="v9-calendar-head"><button id="v9PrevMonth">‹</button><h2 id="v9MonthLabel"></h2><button id="v9NextMonth">›</button></div><div class="v9-calendar-week"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div id="v9Calendar" class="v9-calendar"></div></div>
 <div data-v9-schedule-panel="games" class="v9-schedule-panel"><div id="v9ExistingGamesHost"></div></div>
 </section><div id="v9EventModal" class="v9-modal" hidden><div class="v9-modal-backdrop"></div><section class="v9-modal-card"><header><div><p class="eyebrow">Event Details</p><h2 id="v9EventTitle"></h2></div><button id="v9EventClose">×</button></header><div id="v9EventBody"></div></section></div>`}
function enhanceSchedule(){const view=$('[data-view-panel="games"]');if(!view)return;const existing=[...view.childNodes];view.innerHTML=scheduleMarkup();const host=$('#v9ExistingGamesHost');existing.forEach(n=>host.appendChild(n));$$('[data-v9-schedule-tab]').forEach(b=>b.onclick=()=>scheduleTab(b.dataset.v9ScheduleTab));$('#v9PrevMonth').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()-1);renderCalendar()};$('#v9NextMonth').onclick=()=>{monthCursor.setMonth(monthCursor.getMonth()+1);renderCalendar()};$('#v9ScheduleToday').onclick=()=>{monthCursor=new Date();scheduleTab('agenda');renderCalendar()};$('#v9EventClose').onclick=closeEvent;$('#v9EventModal .v9-modal-backdrop').onclick=closeEvent;loadEvents().then(()=>{renderAgenda();renderCalendar()})}
function scheduleTab(name){$$('[data-v9-schedule-tab]').forEach(b=>b.classList.toggle('active',b.dataset.v9ScheduleTab===name));$$('[data-v9-schedule-panel]').forEach(p=>p.classList.toggle('active',p.dataset.v9SchedulePanel===name));}
function renderAgenda(){const box=$('#v9UpcomingEvents');if(!box)return;const today=new Date().toISOString().slice(0,10),up=events.filter(e=>e.endDate>=today).sort((a,b)=>a.startDate.localeCompare(b.startDate)).slice(0,60);box.innerHTML=up.length?up.map((e,i)=>`<button class="v9-event-card" data-event-index="${events.indexOf(e)}"><div class="v9-event-date"><b>${new Date(e.startDate+'T12:00:00').toLocaleDateString('en-US',{month:'short'})}</b><strong>${new Date(e.startDate+'T12:00:00').getDate()}</strong></div><div><span>${esc(e.category||'Event')}</span><h3>${esc(e.title)}</h3><p>${esc(e.date||`${e.startDate} – ${e.endDate}`)}</p></div><em>›</em></button>`).join(''):'<p class="v9-empty">No upcoming website events.</p>';$$('[data-event-index]',box).forEach(b=>b.onclick=()=>openEvent(Number(b.dataset.eventIndex)))}
function renderCalendar(){const box=$('#v9Calendar');if(!box)return;const y=monthCursor.getFullYear(),m=monthCursor.getMonth(),first=new Date(y,m,1),last=new Date(y,m+1,0);$('#v9MonthLabel').textContent=first.toLocaleDateString('en-US',{month:'long',year:'numeric'});const cells=[];for(let i=0;i<first.getDay();i++)cells.push('<span class="v9-calendar-empty"></span>');for(let d=1;d<=last.getDate();d++){const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,dayEvents=events.filter(e=>e.startDate<=iso&&e.endDate>=iso);cells.push(`<button class="v9-calendar-day ${dayEvents.length?'has-events':''}" data-date="${iso}"><b>${d}</b>${dayEvents.slice(0,2).map(e=>`<small>${esc(e.title)}</small>`).join('')}${dayEvents.length>2?`<em>+${dayEvents.length-2} more</em>`:''}</button>`)}box.innerHTML=cells.join('');$$('.v9-calendar-day.has-events',box).forEach(b=>b.onclick=()=>{const e=events.find(x=>x.startDate<=b.dataset.date&&x.endDate>=b.dataset.date);openEvent(events.indexOf(e))})}
function openEvent(i){const e=events[i];if(!e)return;$('#v9EventTitle').textContent=e.title;$('#v9EventBody').innerHTML=`<div class="v9-event-detail"><span class="viz-badge">${esc(e.category||'Event')}</span><h3>${esc(e.date||`${e.startDate} – ${e.endDate}`)}</h3><p>${esc(e.description||'No event description has been added.')}</p><dl><div><dt>Location</dt><dd>${esc(e.location||'Adventure Sports & Entertainment')}</dd></div><div><dt>Dates</dt><dd>${esc(e.startDate)} through ${esc(e.endDate)}</dd></div><div><dt>Price</dt><dd>${esc(e.price||'See event details')}</dd></div></dl><div class="v9-event-actions">${e.register?`<a class="primary-btn" href="${esc(e.register)}" target="_blank" rel="noopener">Registration ↗</a>`:''}<button class="secondary-btn" data-event-games>Open Games & Matrix</button></div></div>`;$('#v9EventModal').hidden=false;document.body.classList.add('v9-modal-open');$('[data-event-games]')?.addEventListener('click',()=>{closeEvent();scheduleTab('games')})}
function closeEvent(){$('#v9EventModal').hidden=true;document.body.classList.remove('v9-modal-open')}

// Command palette
function paletteMarkup(){return `<div id="v9Palette" class="v9-palette" hidden><div class="v9-palette-backdrop"></div><section class="v9-palette-card"><div class="v9-palette-input"><span>⌕</span><input id="v9PaletteInput" placeholder="Search or run a command…" autocomplete="off"><kbd>ESC</kbd></div><div id="v9PaletteResults" class="v9-palette-results"></div></section></div>`}
function commands(){const c=[
 {label:'Open Home',hint:'Dashboard',icon:'⌂',view:'dashboard'}, {label:'View today’s schedule',hint:'Website events and games',icon:'▣',view:'games'}, {label:'Open Fields',hint:'Readiness and inspections',icon:'◇',view:'maintenance'}, {label:'Create work order',hint:'Maintenance issue',icon:'⚒',view:'maintenance',after:()=>$('#addMaintenanceIssue')?.click()}, {label:'Create incident report',hint:'All employees',icon:'!',view:'incidents',after:()=>$('#incidentCreateButton')?.click()}, {label:'View employees',hint:'Staff coverage and profiles',icon:'♙',view:'staff'}, {label:'Send notification',hint:'Manual alert',icon:'◉',view:'notifications'}, {label:'Open Weather Center',hint:'Forecast and alerts',icon:'☁',view:'weather'}, {label:'System health',hint:'Owner settings',icon:'✓',view:'settings'}, {label:'Maintenance mode',hint:'Owner control',icon:'⚙',view:'settings'}
 ];return c.filter(x=>$(`.nav-item[data-view="${x.view}"]`)&&!$(`.nav-item[data-view="${x.view}"]`).hidden)}
function openPalette(){const p=$('#v9Palette');p.hidden=false;document.body.classList.add('v9-modal-open');const input=$('#v9PaletteInput');input.value='';renderPalette('');setTimeout(()=>input.focus(),10)}
function closePalette(){$('#v9Palette').hidden=true;document.body.classList.remove('v9-modal-open')}
function renderPalette(q){const words=q.trim().toLowerCase(),items=commands().filter(x=>!words||`${x.label} ${x.hint}`.toLowerCase().includes(words));paletteIndex=0;$('#v9PaletteResults').innerHTML=items.length?items.map((x,i)=>`<button class="${i===0?'active':''}" data-command="${commands().indexOf(x)}"><span>${x.icon}</span><div><b>${esc(x.label)}</b><small>${esc(x.hint)}</small></div><em>↵</em></button>`).join(''):'<p class="v9-empty">No matching command.</p>';$$('[data-command]').forEach(b=>b.onclick=()=>runCommand(commands()[Number(b.dataset.command)]))}
function runCommand(c){if(!c)return;closePalette();go(c.view);if(c.after)setTimeout(c.after,250)}
function installPalette(){if($('#v9Palette'))return;document.body.insertAdjacentHTML('beforeend',paletteMarkup());const backdrop=$('#v9Palette .v9-palette-backdrop'),search=$('#v9SearchButton'),input=$('#v9PaletteInput');if(backdrop)backdrop.onclick=closePalette;if(search)search.onclick=openPalette;if(input)input.oninput=e=>renderPalette(e.target.value);document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette()}else if(e.key==='Escape'&&!$('#v9Palette').hidden)closePalette()})}

// Owner dashboard settings
function settingsMarkup(){const labels=Object.entries(CARD_META).map(([k,v])=>`<label class="v9-pref-check"><input type="checkbox" data-v9-pref-card="${k}"><span><b>${v.icon} ${v.label}</b><small>Show this card on the selected dashboard</small></span></label>`).join('');return `<article id="v9DashboardSettings" class="panel owner-only v9-settings-panel"><div class="panel-head"><div><p class="eyebrow">Owner Only</p><h2>Dashboard & Role Visibility</h2><p>Choose what each role sees. The app keeps the layout automatically organized.</p></div><span class="connection-badge ready">Option B</span></div><div class="v9-settings-row"><label><span>Configure role</span><select id="v9PrefRole"><option value="manager">Manager</option><option value="grounds">Grounds Crew</option><option value="kitchen">Kitchen</option><option value="cashier">Cashier</option></select></label><label><span>Employee exception (optional)</span><input id="v9PrefEmployee" type="email" placeholder="employee@email.com"><small>Leave blank to edit the whole role.</small></label></div><div id="v9PrefCards" class="v9-pref-grid">${labels}</div><div class="form-actions"><button id="v9PrefLoad" class="secondary-btn" type="button">Load Selection</button><button id="v9PrefSave" class="primary-btn" type="button">Save Dashboard Access</button></div><p id="v9PrefNotice" class="login-status"></p></article>`}
async function installSettings(){const grid=$('[data-view-panel="settings"] .settings-grid');if(!grid)return;grid.insertAdjacentHTML('afterend',settingsMarkup());if(role()!=='owner')return;let cfg=null;try{cfg=(await api(PREF)).configuration}catch{};if(!cfg)return;const roleSel=$('#v9PrefRole'),email=$('#v9PrefEmployee');function load(){const key=email.value.trim().toLowerCase(),cards=key?(cfg.employees[key]?.cards||cfg.roles[roleSel.value]):cfg.roles[roleSel.value];$$('[data-v9-pref-card]').forEach(x=>x.checked=(cards||[]).includes(x.dataset.v9PrefCard))}$('#v9PrefLoad').onclick=load;roleSel.onchange=load;$('#v9PrefSave').onclick=async()=>{const cards=$$('[data-v9-pref-card]:checked').map(x=>x.dataset.v9PrefCard),key=email.value.trim().toLowerCase();if(key)cfg.employees[key]={cards};else cfg.roles[roleSel.value]=cards;try{const d=await api(PREF,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(cfg)});cfg=d.configuration;$('#v9PrefNotice').textContent='Dashboard access saved.';$('#v9PrefNotice').className='login-status success';await loadPrefs()}catch(e){$('#v9PrefNotice').textContent=e.message;$('#v9PrefNotice').className='login-status error'}};load()}

function init(){
 if(v9Initialized)return;
 if(!window.ASE_OPS?.getProfile?.())return;
 v9Initialized=true;
 installNav();replaceDashboard();enhanceSchedule();installPalette();installSettings();loadPrefs();refreshHome();
}
function boot(){
 if(window.ASE_OPS?.getProfile?.())init();
 window.addEventListener('ase:profile-ready',()=>{init();loadPrefs();refreshHome()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();