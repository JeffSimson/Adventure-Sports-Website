(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const ROLE_LABELS={owner:'Owner',manager:'Manager',grounds:'Grounds Crew',kitchen:'Kitchen',cashier:'Cashier'};
const ROLE_MODULES={
 owner:['dashboard','website','clover','staff','games','maintenance','weather','reports','kitchen','notifications','users','settings'],
 manager:['dashboard','clover','staff','games','maintenance','weather','reports','kitchen','notifications','users'],
 grounds:['maintenance','weather','notifications'],
 kitchen:['kitchen','weather','notifications'],
 cashier:['dashboard','notifications']
};
let previewRole=null;
function createTopbar(){
 const main=$('.main-area'); if(!main||$('.v71-command-strip'))return;
 const strip=document.createElement('div');strip.className='v71-command-strip';
 strip.innerHTML=`<div><span class="v71-live-pulse"></span><strong>Operations Center</strong><small id="v71Date"></small></div><div class="v71-strip-actions"><button type="button" data-go="notifications">Send Alert</button><button type="button" data-go="maintenance">New Work Order</button><button type="button" data-go="website">Update Facility</button></div>`;
 main.insertBefore(strip,main.firstChild.nextSibling);
 const d=$('#v71Date'); if(d)d.textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric'}).format(new Date());
 strip.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>document.querySelector(`.nav-item[data-view="${b.dataset.go}"]`)?.click());
}
function addDashboardSummary(){
 const hero=$('[data-view-panel="dashboard"] .dashboard-hero');if(!hero||$('.v71-status-ribbon'))return;
 const r=document.createElement('div');r.className='v71-status-ribbon';
 r.innerHTML=`<div><span>Facility</span><strong id="v71Facility">Syncing</strong></div><div><span>Weather</span><strong>Live Center</strong></div><div><span>Maintenance</span><strong>Active Queue</strong></div><div><span>Notifications</span><strong>Ready</strong></div>`;
 hero.after(r);
 const sync=()=>{const src=$('#facilityStatus');const dest=$('#v71Facility');if(src&&dest)dest.textContent=src.textContent||'Syncing'};sync();setInterval(sync,2000);
}
function addViewAs(){
 const head=$('[data-view-panel="users"] .page-head .head-actions')||$('[data-view-panel="users"] .page-head');if(!head||$('#v71ViewAs'))return;
 const wrap=document.createElement('div');wrap.className='v71-view-as owner-only';wrap.id='v71ViewAs';
 wrap.innerHTML=`<label><span>View as</span><select id="v71RolePreview"><option value="">Your access</option>${Object.entries(ROLE_LABELS).filter(([r])=>r!=='owner').map(([r,l])=>`<option value="${r}">${l}</option>`).join('')}</select></label><button id="v71ExitPreview" type="button" hidden>Exit Preview</button>`;
 head.appendChild(wrap);
 $('#v71RolePreview').onchange=e=>applyPreview(e.target.value||null);
 $('#v71ExitPreview').onclick=()=>{ $('#v71RolePreview').value='';applyPreview(null); };
}
function applyPreview(r){
 previewRole=r;document.body.classList.toggle('v71-previewing',!!r);document.body.dataset.previewRole=r||'';
 const banner=$('#v71PreviewBanner')||(()=>{const x=document.createElement('div');x.id='v71PreviewBanner';x.className='v71-preview-banner';document.body.appendChild(x);return x})();
 if(!r){banner.hidden=true;$('#v71ExitPreview').hidden=true;$$('.nav-item').forEach(n=>n.classList.remove('v71-preview-hidden'));return}
 banner.hidden=false;banner.innerHTML=`Previewing <strong>${ROLE_LABELS[r]}</strong> access. This does not change their account. <button type="button">Exit</button>`;banner.querySelector('button').onclick=()=>{$('#v71RolePreview').value='';applyPreview(null)};
 $('#v71ExitPreview').hidden=false;const allowed=ROLE_MODULES[r]||[];
 $$('.nav-item').forEach(n=>n.classList.toggle('v71-preview-hidden',!allowed.includes(n.dataset.view)));
 const active=$('.nav-item.active');if(active?.classList.contains('v71-preview-hidden'))document.querySelector(`.nav-item[data-view="${allowed[0]}"]`)?.click();
}
function polishTeamCards(){
 const list=$('#usersList');if(!list)return;
 list.querySelectorAll('.user-row').forEach(card=>{
  card.classList.remove('v71-team-card');
  card.querySelectorAll('.v71-team-status').forEach(el=>el.remove());
 });
}
function relabel(){
 const dashboard=$('.nav-item[data-view="dashboard"]');if(dashboard)dashboard.childNodes[dashboard.childNodes.length-1].textContent=' Operations Center';
 const users=$('.nav-item[data-view="users"]');if(users)users.childNodes[users.childNodes.length-1].textContent=' Team Management';
 const page=$('[data-view-panel="dashboard"] .dashboard-eyebrow');if(page)page.textContent='Adventure Sports Operations Center';
}
function installObserver(){
 const obs=new MutationObserver(()=>{polishTeamCards();relableSafe();});
 const list=$('#usersList');if(list)obs.observe(list,{childList:true,subtree:true});
}
function relableSafe(){try{relabel()}catch{}}
function keyboard(){document.addEventListener('keydown',e=>{if(e.key==='Escape'&&previewRole){const s=$('#v71RolePreview');if(s)s.value='';applyPreview(null)}})}
function init(){createTopbar();addDashboardSummary();addViewAs();polishTeamCards();relabel();installObserver();keyboard();document.body.classList.add('v71-ready')}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
