(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const API='/.netlify/functions/system-diagnostics';
let report=null,running=false,installed=false;
const role=()=>window.ASE_OPS?.role?.()||document.body.dataset.role||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const formatDate=v=>{if(!v)return'Never';const d=new Date(v);return Number.isNaN(d.getTime())?'Never':d.toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})};
const categories={
 core:{label:'Core Platform & Home Screen App',ids:['database','storage','push','pwa']},
 tournament:{label:'Tournament & Automatic Alerts',ids:['matrix-live','matrix-crud','alert-dedupe','lightning-clear','automation']},
 operations:{label:'Live Operations Connections',ids:['operations-center','weather','clover','work-orders']}
};
function api(method='GET'){return window.ASE_OPS.api(API,{method,headers:{'Content-Type':'application/json'}})}
function badge(status){return status==='pass'?'Passed':status==='warn'?'Attention':'Failed'}
function setOverall(status='loading'){
 const el=$('#systemTestOverallBadge');if(!el)return;
 el.textContent=status==='pass'?'All systems ready':status==='warn'?'Review warnings':status==='fail'?'Action required':status==='running'?'Testing…':'Not tested';
 el.className='connection-badge '+(status==='pass'?'ready':status==='warn'?'loading':status==='fail'?'error':'neutral');
}
function showNotice(message,type='success'){
 const el=$('#systemTestNotice');if(!el)return;el.textContent=message;el.className='publish-notice '+type;el.hidden=false;
}
function summary(r){
 $('#systemTestLastRun').textContent=formatDate(r?.completedAt);
 $('#systemTestDuration').textContent=r?.durationMs!=null?`${(r.durationMs/1000).toFixed(1)} seconds`:'—';
 $('#systemTestPassed').textContent=r?.counts?.pass??0;
 $('#systemTestWarnings').textContent=r?.counts?.warn??0;
 $('#systemTestFailed').textContent=r?.counts?.fail??0;
 $('#systemTestBuild').textContent=`Build V${r?.version||'9.1.3'} · ${r?.build||'9130'}`;
 setOverall(r?.status||'idle');
}
function checkRow(c){
 const detail=c.detail||'No details returned.';
 return `<article class="system-test-row ${esc(c.status)}" data-test-status="${esc(c.status)}"><span class="system-test-icon" aria-hidden="true">${c.status==='pass'?'✓':c.status==='warn'?'!':'×'}</span><div><div class="system-test-row-title"><b>${esc(c.label)}</b><span>${badge(c.status)}</span></div><p>${esc(detail)}</p><small>${Number.isFinite(c.ms)?`${c.ms} ms`:'Completed'}</small></div></article>`;
}
function render(){
 const box=$('#systemTestResults');if(!box)return;
 if(!report?.checks?.length){box.innerHTML='<div class="system-test-empty"><b>No test results yet</b><p>Press Run Full System Test to check the live deployment.</p></div>';summary(null);return}
 const filter=$('#systemTestFilter')?.value||'all';
 const byId=new Map(report.checks.map(x=>[x.id,x]));
 let html='';
 for(const cat of Object.values(categories)){
  const rows=cat.ids.map(id=>byId.get(id)).filter(Boolean).filter(x=>filter==='all'||x.status===filter);
  if(!rows.length)continue;
  html+=`<section class="system-test-group"><div class="system-test-group-head"><h3>${esc(cat.label)}</h3><span>${rows.length} check${rows.length===1?'':'s'}</span></div>${rows.map(checkRow).join('')}</section>`;
 }
 const extras=report.checks.filter(x=>!Object.values(categories).some(c=>c.ids.includes(x.id))).filter(x=>filter==='all'||x.status===filter);
 if(extras.length)html+=`<section class="system-test-group"><div class="system-test-group-head"><h3>Additional Checks</h3><span>${extras.length} check${extras.length===1?'':'s'}</span></div>${extras.map(checkRow).join('')}</section>`;
 box.innerHTML=html||'<div class="system-test-empty"><b>No matching results</b><p>Choose another filter to view the remaining checks.</p></div>';
 summary(report);
}
async function loadLatest(silent=false){
 if(role()!=='owner')return;
 try{const d=await api('GET');report=d.latest||null;render();if(!silent&&!report)showNotice('No completed system test has been saved yet.','success')}
 catch(e){setOverall('fail');if(!silent)showNotice(e.message,'error')}
}
async function run(){
 if(running||role()!=='owner')return;running=true;const button=$('#systemTestRun');button.disabled=true;button.textContent='Running System Tests…';setOverall('running');showNotice('Testing the live deployment. This can take several seconds.','success');
 try{report=await api('POST');render();const c=report.counts||{};if(c.fail)showNotice(`${c.fail} test${c.fail===1?'':'s'} failed. Open the failed rows below for details.`,'error');else if(c.warn)showNotice(`Core tests passed with ${c.warn} warning${c.warn===1?'':'s'} to review.`,'success');else showNotice('All system tests passed. The Operations Hub is ready.','success')}
 catch(e){setOverall('fail');showNotice(e.message,'error')}
 finally{running=false;button.disabled=false;button.textContent='Run Full System Test'}
}
function openView(view){document.querySelector(`.nav-item[data-view="${view}"]`)?.click()}
function install(){
 if(installed||role()!=='owner'||!$('#systemTestCenter'))return;installed=true;
 $('#systemTestRun')?.addEventListener('click',run);
 $('#systemTestRefresh')?.addEventListener('click',()=>loadLatest(false));
 $('#systemTestFilter')?.addEventListener('change',render);
 $('#systemTestOpenGames')?.addEventListener('click',()=>openView('gamesmatrix'));
 $('#systemTestOpenNotifications')?.addEventListener('click',()=>openView('notifications'));
 document.addEventListener('click',e=>{const b=e.target.closest('[data-internal-target="systemtests"]');if(b)setTimeout(()=>loadLatest(true),50)});
 loadLatest(true);
}
function boot(){install()}
window.addEventListener('ase:profile-ready',boot);
document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,600));
})();
