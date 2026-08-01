(function(){'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let rows=[];
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const role=()=>window.ASE_OPS?.role?.()||'';
const canView=()=>['owner','manager'].includes(role());
const number=r=>r?.incident_number?`IR-${new Date(r.occurred_at||Date.now()).getFullYear()}-${String(r.incident_number).padStart(4,'0')}`:'Pending';
function setTab(tab){
  const viewAllowed=canView();
  if(tab==='all'&&!viewAllowed)tab='create';
  $$('.incident-hub-tab').forEach(b=>b.classList.toggle('active',b.dataset.incidentTab===tab));
  $$('.incident-hub-panel').forEach(p=>p.hidden=p.dataset.incidentPanel!==tab);
  if(tab==='all')load();
}
function render(){
 const q=($('#incidentHubSearch')?.value||'').toLowerCase();
 const filtered=rows.filter(r=>JSON.stringify(r).toLowerCase().includes(q));
 const body=$('#incidentHubBody');
 if(!body)return;
 body.innerHTML=filtered.length?filtered.map(r=>`<tr><td><b>${esc(number(r))}</b></td><td>${esc(new Date(r.occurred_at).toLocaleString())}</td><td>${esc(r.location||'—')}</td><td>${esc(r.incident_type||'—')}</td><td><span class="incident-mini-status ${esc(r.status||'open')}">${esc(String(r.status||'open').replaceAll('_',' '))}</span></td><td><div class="table-action-group"><button class="secondary-btn compact-btn" data-hub-view="${esc(r.id)}">View</button><button class="secondary-btn compact-btn" data-hub-edit="${esc(r.id)}">Edit</button></div></td></tr>`).join(''):`<tr><td colspan="6" class="empty-row">No incident reports match your search.</td></tr>`;
 $('#incidentHubCount').textContent=`${filtered.length} report${filtered.length===1?'':'s'}`;
 $$('[data-hub-view]').forEach(b=>b.onclick=()=>window.ASE_INCIDENTS.view(rows.find(r=>r.id===b.dataset.hubView)));
 $$('[data-hub-edit]').forEach(b=>b.onclick=()=>window.ASE_INCIDENTS.open(rows.find(r=>r.id===b.dataset.hubEdit)));
}
async function load(){
 if(!canView())return;
 const state=$('#incidentHubState');state.textContent='Loading…';
 try{const d=await ASE_DATA.list('incident_reports',{limit:250,order:'occurred_at'});rows=d.rows||[];render();state.textContent='Up to date'}catch(e){state.textContent=e.message;window.ASE_OPS.toast(e.message)}
}
function init(){
 const viewTab=$('[data-incident-tab="all"]');
 if(viewTab)viewTab.hidden=!canView();
 const privacy=$('#incidentViewPermissionNote');if(privacy)privacy.hidden=canView();
 $$('.incident-hub-tab').forEach(b=>b.onclick=()=>setTab(b.dataset.incidentTab));
 $('#incidentStartReport').onclick=()=>window.ASE_INCIDENTS.open(null);
 $('#incidentStartReportSecondary').onclick=()=>window.ASE_INCIDENTS.open(null);
 $('#incidentHubRefresh').onclick=load;
 $('#incidentHubSearch').oninput=render;
 window.addEventListener('ase:incidents-changed',()=>{if(canView())load()});
 window.addEventListener('ase:profile-ready',()=>{if(viewTab)viewTab.hidden=!canView()});
 setTab('create');
}
document.addEventListener('DOMContentLoaded',init);
})();