(()=>{
'use strict';
const API='/.netlify/functions/game-day-control';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const role=()=>window.ASE_OPS?.role?.()||document.body.dataset.role||'';
const canManage=()=>['owner','manager'].includes(role());
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let data=null,loading=false,countdownTimer=null,initialized=false;

async function api(options={}){
  const date=$('#gameDayDate')?.value||today();
  const url=`${API}?date=${encodeURIComponent(date)}&v=${Date.now()}`;
  if(window.ASE_OPS?.api)return window.ASE_OPS.api(url,options);
  throw new Error('Game Day Control is not connected to your signed-in session.');
}
function notice(message,type='success'){
  const el=$('#gameDayNotice');if(!el)return;el.textContent=message;el.className=`publish-notice ${type}`;el.hidden=false;
  clearTimeout(el._hide);if(type==='success')el._hide=setTimeout(()=>el.hidden=true,5000);
}
function localDateTime(value){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}
function timeValue(value){const m=String(value||'').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return'09:00';let h=Number(m[1])%12;if(m[3].toUpperCase()==='PM')h+=12;return`${String(h).padStart(2,'0')}:${m[2]}`}
function statusLabel(status){return {'upcoming':'Upcoming','in-progress':'In Progress','delayed':'Delayed','complete':'Complete','canceled':'Canceled'}[status]||status}
function setBusy(on,label='Working…'){
  loading=on;const badge=$('#gameDayLiveBadge');if(badge){badge.textContent=on?label:'Live';badge.className=`connection-badge ${on?'loading':'ready'}`}
  $$('#gameDayControl button,#gameDayControl select,#gameDayControl input,#gameDayControl textarea').forEach(el=>{if(el.id==='gameDayDate')return;el.disabled=on});
}
function renderDates(){
  const input=$('#gameDayDate');if(!input||!data?.matrix)return;
  if(!input.value)input.value=data.date||today();
  const valid=(data.matrix.days||[]).some(d=>d.key===input.value);
  if(!valid&&data.matrix.days?.length)input.value=data.date||data.matrix.days[0].key;
}
function renderStats(){
  const s=data?.stats||{},box=$('#gameDayStats');if(!box)return;
  const items=[['Total Games',s.total||0,'Scheduled on selected day'],['In Progress',s['in-progress']||0,'Games currently active'],['Delayed',s.delayed||0,'Games needing attention'],['Completed',s.complete||0,'Games finished']];
  box.innerHTML=items.map(([label,value,note])=>`<article><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`).join('');
}
function renderLightning(){
  const l=data?.lightning||{},state=$('#gameDayLightningState'),timer=$('#gameDayLightningTimer'),start=$('#gameDayLightningStart'),restart=$('#gameDayLightningRestart'),resume=$('#gameDayLightningResume'),minutes=$('#gameDayLightningMinutes');
  if(minutes&&l.clearMinutes)minutes.value=String(l.clearMinutes);
  const active=Boolean(l.active),ready=l.status==='clear-ready'||(active&&l.clearAt&&new Date(l.clearAt)<=new Date());
  if(state){state.textContent=ready?'Clear Period Complete':active?'Hold Active':'Inactive';state.className=`game-day-status-pill ${ready?'ready':active?'danger':'neutral'}`}
  if(start)start.hidden=active;if(restart)restart.hidden=!active;if(resume)resume.hidden=!active;
  if(timer){timer.dataset.clearAt=l.clearAt||'';timer.dataset.active=active?'true':'false';timer.innerHTML=active?`<strong>--:--</strong><span>${ready?'Management may confirm reopening':'Time remaining until clearance review'}</span>`:'<strong>—</strong><span>No active hold</span>'}
  updateCountdown();
}
function updateCountdown(){
  const timer=$('#gameDayLightningTimer');if(!timer||timer.dataset.active!=='true'||!timer.dataset.clearAt)return;
  const ms=new Date(timer.dataset.clearAt)-new Date(),ready=ms<=0,total=Math.max(0,Math.ceil(ms/1000)),min=Math.floor(total/60),sec=total%60;
  const strong=$('strong',timer),span=$('span',timer);if(strong)strong.textContent=ready?'CLEAR':`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;if(span)span.textContent=ready?'Clear period complete — confirm conditions before reopening':'Time remaining until clearance review';
  const state=$('#gameDayLightningState');if(ready&&state){state.textContent='Clear Period Complete';state.className='game-day-status-pill ready'}
}
function fields(){return data?.matrix?.fields||[]}
function renderFilters(){
  const select=$('#gameDayFieldFilter');if(!select)return;const current=select.value||'all';select.innerHTML='<option value="all">All fields</option>'+fields().map(f=>`<option value="${f}">Field ${f}</option>`).join('');select.value=fields().includes(current)?current:'all';
}
function gameCard(g){
  const status=g.effectiveStatus||g.status||'upcoming',moved=g.field!==g.originalField||g.time!==g.originalTime;
  return `<article class="game-day-game-card status-${esc(status)}" data-game-id="${esc(g.id)}">
    <div class="game-day-game-main">
      <div class="game-day-game-identity"><span class="game-day-field-badge">${esc(g.field)}</span><div><strong>${esc(g.time)}</strong><small>${moved?`Originally ${esc(g.originalField)} at ${esc(g.originalTime)}`:'Live matrix assignment'}</small></div></div>
      <span class="game-day-status-pill ${esc(status)}">${esc(statusLabel(status))}</span>
    </div>
    ${g.holdReason?`<p class="game-day-game-note">${esc(g.holdReason)}</p>`:''}
    <div class="game-day-status-actions" role="group" aria-label="Update game status">
      ${['upcoming','in-progress','delayed','complete','canceled'].map(x=>`<button type="button" data-game-status="${x}" class="${status===x?'active':''}">${statusLabel(x)}</button>`).join('')}
    </div>
    <div class="game-day-card-options">
      <label class="game-day-inline-check"><input type="checkbox" data-game-notify><span>Notify staff/public about status</span></label>
      <button type="button" class="secondary-btn compact-btn" data-toggle-game-move>Move Field / Time</button>
    </div>
    <div class="game-day-move-editor" hidden>
      <label><span>New field</span><select data-move-field>${fields().map(f=>`<option value="${f}" ${f===g.field?'selected':''}>${f}</option>`).join('')}</select></label>
      <label><span>New time</span><span class="date-input-shell"><input data-move-time type="time" value="${timeValue(g.time)}"></span></label>
      <label class="game-day-inline-check"><input type="checkbox" data-move-notify checked><span>Notify everyone + public board</span></label>
      <div class="game-day-button-row"><button type="button" class="primary-btn compact-btn" data-save-game-move>Save Move</button><button type="button" class="secondary-btn compact-btn" data-cancel-game-move>Cancel</button></div>
    </div>
  </article>`;
}
function filteredGames(){const field=$('#gameDayFieldFilter')?.value||'all',status=$('#gameDayStatusFilter')?.value||'all';return(data?.day?.games||[]).filter(g=>(field==='all'||g.field===field)&&(status==='all'||(g.effectiveStatus||g.status)===status))}
function renderGames(){const box=$('#gameDayGameList');if(!box)return;const games=filteredGames();box.innerHTML=games.length?games.map(gameCard).join(''):'<div class="dashboard-empty"><b>No games match this filter.</b><p>Change the field or status filter, or publish a matrix containing this date.</p></div>'}
function fieldCard(f){
  const attention=f.cleanup==='needed'||f.setup==='needed';
  return `<article class="game-day-readiness-card ${attention?'attention':'ready'}" data-field="${f.field}">
    <div><span class="game-day-field-badge">${f.field}</span><div><strong>Field ${f.field}</strong><small>${attention?'Attention needed':'Ready for play'}</small></div></div>
    <div class="readiness-task ${f.cleanup==='needed'?'needed':'ready'}"><span><b>Cleanup</b><small>${f.cleanup==='needed'?'Cleanup is needed after a completed game.':'Marked ready.'}</small></span><button type="button" data-field-task="cleanup" data-task-status="${f.cleanup==='needed'?'ready':'needed'}">${f.cleanup==='needed'?'Mark Clean':'Reopen Task'}</button></div>
    <div class="readiness-task ${f.setup==='needed'?'needed':'ready'}"><span><b>Setup</b><small>${esc(f.setupNote||'Standard field setup.')}</small></span><button type="button" data-field-task="setup" data-task-status="${f.setup==='needed'?'ready':'needed'}">${f.setup==='needed'?'Mark Ready':'Reopen Task'}</button></div>
  </article>`;
}
function renderFields(){const box=$('#gameDayFieldReadiness');if(!box)return;const list=Object.values(data?.day?.fields||{});box.innerHTML=list.length?list.map(fieldCard).join(''):'<p class="dashboard-empty">No field readiness data is available for this date.</p>'}
function renderPublic(){const p=data?.public||{},box=$('#gameDayPublicPreview');if(!box)return;box.innerHTML=`<span>Public board preview</span><strong>${esc(p.headline||'Live game-day board')}</strong><p>${esc(p.message||'The live schedule, active games, delays, and lightning status appear automatically.')}</p><small>Last updated ${esc(localDateTime(p.updatedAt))}</small>`}
function renderAudit(){const box=$('#gameDayAudit');if(!box)return;const list=data?.audit||[];box.innerHTML=list.length?list.slice(0,60).map(x=>`<article><span>${esc((x.action||'update').replace(/^game-day-/,'').replace(/-/g,' '))}</span><div><strong>${esc(x.summary||'Game day updated')}</strong><small>${esc(x.actor?.name||x.actor?.email||'Unknown user')} · ${esc(localDateTime(x.createdAt))}</small></div></article>`).join(''):'<p class="dashboard-empty">No game-day changes recorded yet.</p>'}
function render(){if(!data)return;renderDates();renderStats();renderLightning();renderFilters();renderGames();renderFields();renderPublic();renderAudit();const badge=$('#gameDayLiveBadge');if(badge){badge.textContent='Live';badge.className='connection-badge ready'}}
async function load(){if(!canManage()||loading||!$('#gameDayControl'))return;setBusy(true,'Loading');try{data=await api();render()}catch(e){notice(e.message,'error');const box=$('#gameDayGameList');if(box)box.innerHTML=`<div class="dashboard-empty"><b>Game Day Control could not load.</b><p>${esc(e.message)}</p></div>`}finally{setBusy(false)}}
async function action(payload,success){if(loading)return;setBusy(true);try{data={...data,...await api({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,date:$('#gameDayDate')?.value||today()})})};render();notice(success||data.message||'Game day updated.','success');window.dispatchEvent(new CustomEvent('ase:game-day-updated',{detail:data}))}catch(e){notice(e.message,'error')}finally{setBusy(false)}}
function cardFrom(el){return el.closest('[data-game-id]')}
function bind(){
  $('#gameDayRefresh')?.addEventListener('click',load);$('#gameDayToday')?.addEventListener('click',()=>{$('#gameDayDate').value=today();load()});$('#gameDayDate')?.addEventListener('change',load);
  $('#gameDayFieldFilter')?.addEventListener('change',renderGames);$('#gameDayStatusFilter')?.addEventListener('change',renderGames);
  $('#gameDayGameList')?.addEventListener('click',e=>{
    const card=cardFrom(e.target);if(!card)return;const id=card.dataset.gameId;
    const status=e.target.closest('[data-game-status]');if(status){const notify=$('[data-game-notify]',card)?.checked||false;action({action:'status',gameId:id,status:status.dataset.gameStatus,notify,audience:notify?'everyone':'staff'});return}
    if(e.target.closest('[data-toggle-game-move]')){$('.game-day-move-editor',card).hidden=false;return}
    if(e.target.closest('[data-cancel-game-move]')){$('.game-day-move-editor',card).hidden=true;return}
    if(e.target.closest('[data-save-game-move]')){const field=$('[data-move-field]',card).value,time=$('[data-move-time]',card).value,notify=$('[data-move-notify]',card).checked;action({action:'move',gameId:id,field,time,notify,audience:'everyone'});return}
  });
  $('#gameDayFieldReadiness')?.addEventListener('click',e=>{const b=e.target.closest('[data-field-task]'),card=e.target.closest('[data-field]');if(!b||!card)return;action({action:'field-task',field:card.dataset.field,task:b.dataset.fieldTask,status:b.dataset.taskStatus})});
  $$('[data-delay-all]').forEach(b=>b.addEventListener('click',()=>{const minutes=Number(b.dataset.delayAll),notify=$('#gameDayDelayNotify')?.checked!==false,reason=$('#gameDayDelayReason')?.value.trim()||'';if(confirm(`Delay every remaining game by ${minutes} minutes?`))action({action:'delay-all',minutes,notify,reason,audience:'everyone'})}));
  $('#gameDayLightningStart')?.addEventListener('click',()=>{if(confirm('Clear all outdoor fields and start the lightning timer?'))action({action:'lightning-start',clearMinutes:Number($('#gameDayLightningMinutes').value),notify:$('#gameDayLightningNotify').checked,audience:'everyone'})});
  $('#gameDayLightningRestart')?.addEventListener('click',()=>action({action:'lightning-restart',clearMinutes:Number($('#gameDayLightningMinutes').value),notify:$('#gameDayLightningNotify').checked,audience:'everyone'}));
  $('#gameDayLightningResume')?.addEventListener('click',()=>{if(confirm('Have you confirmed on-site conditions are safe to reopen fields?'))action({action:'lightning-resume',notify:$('#gameDayLightningNotify').checked,audience:'everyone'})});
  const templates={schedule:['Tournament schedule updated','The live game schedule has been updated. Check the game-day board for current fields and times.'],delay:['Game day delay','Games are currently delayed. Check the live game-day board for updated fields and start times.'],resume:['Play has resumed','Management has cleared play to resume. Check the live board for updated game times.'],field:['Field assignment updated','A game has moved to a different field or time. Check the live game-day board for details.']};
  $$('[data-broadcast-template]').forEach(b=>b.addEventListener('click',()=>{const t=templates[b.dataset.broadcastTemplate];$('#gameDayBroadcastTitle').value=t[0];$('#gameDayBroadcastMessage').value=t[1]}));
  $('#gameDayBroadcastSend')?.addEventListener('click',()=>{const title=$('#gameDayBroadcastTitle').value.trim(),message=$('#gameDayBroadcastMessage').value.trim();if(!title||!message)return notice('Add a title and message first.','error');action({action:'broadcast',title,message,audience:$('#gameDayBroadcastAudience').value,priority:$('#gameDayBroadcastPriority').value,public:$('#gameDayBroadcastPublic').checked})});
  $('#gameDayClearPublic')?.addEventListener('click',()=>action({action:'clear-public-message'}));
}
function init(){if(initialized||!$('#gameDayControl')||!canManage())return;initialized=true;bind();$('#gameDayDate').value=today();countdownTimer=setInterval(updateCountdown,1000);load()}
document.addEventListener('click',e=>{if(e.target.closest('[data-internal-target="gameday"]'))setTimeout(()=>{init();load()},50)});
window.addEventListener('ase:profile-ready',init);document.addEventListener('DOMContentLoaded',()=>setTimeout(init,700));
})();
