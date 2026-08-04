(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let currentRole='unassigned';
function role(){return currentRole||window.ASE_OPS?.role?.()||document.body.dataset.role||'unassigned'}
function managementAllowed(){return ['owner','manager'].includes(role())}
function ownerAllowed(){return role()==='owner'}
function makeTabs(view,items){
  if(!view||view.querySelector(':scope > .internal-section-tabs'))return null;
  const tabs=document.createElement('div');tabs.className='internal-section-tabs';tabs.setAttribute('role','tablist');
  items.forEach((item,i)=>{
    const b=document.createElement('button');b.type='button';b.className='internal-section-tab'+(i===0?' active':'');
    if(item.access)b.dataset.internalAccess=item.access;
    b.dataset.internalTarget=item.key;b.textContent=item.label;tabs.appendChild(b);
  });
  const anchor=view.querySelector('.page-head,.users-hero,.staff-hero,.weather-hero');
  anchor?.insertAdjacentElement('afterend',tabs);
  const activate=b=>{
    if(!b||!tabs.contains(b))return;
    const key=b.dataset.internalTarget;
    $$('.internal-section-tab',tabs).forEach(x=>{
      const on=x===b;x.classList.toggle('active',on);x.setAttribute('aria-selected',on?'true':'false');
    });
    $$(':scope > .internal-section-panel',view).forEach(x=>{
      const on=x.dataset.internalPanel===key;x.classList.toggle('active',on);x.hidden=!on;
    });
    if(view.matches('[data-view-panel="games"]')){
      requestAnimationFrame(()=>{
        const target=view.querySelector(':scope > .internal-section-panel.active');
        target?.scrollIntoView?.({behavior:'smooth',block:'start'});
      });
    }
  };
  tabs.addEventListener('click',e=>{const b=e.target.closest('[data-internal-target]');if(b){e.preventDefault();activate(b)}});
  tabs.addEventListener('touchend',e=>{
    const b=e.target.closest('[data-internal-target]');if(!b)return;
    e.preventDefault();activate(b);
  },{passive:false});
  return tabs;
}
function panel(view,key,nodes){
  const p=document.createElement('div');p.className='internal-section-panel';p.dataset.internalPanel=key;
  nodes.filter(Boolean).forEach(n=>p.appendChild(n));view.appendChild(p);return p;
}
function games(){
 const view=$('[data-view-panel="gamesmatrix"]');if(!view)return;
 const tabs=view.querySelector(':scope > .gamesmatrix-section-tabs');
 const managerPanel=view.querySelector(':scope > [data-internal-panel="management"]');
 const managerTab=tabs?.querySelector('[data-internal-target="management"]');
 const canManage=managementAllowed();
 if(!canManage){managerTab?.remove();managerPanel?.remove()}
 const activate=key=>{
   const target=tabs?.querySelector(`[data-internal-target="${key}"]`);
   if(!target||target.hidden)return;
   $$('.internal-section-tab',tabs).forEach(x=>{const on=x===target;x.classList.toggle('active',on);x.setAttribute('aria-selected',on?'true':'false')});
   $$(':scope > .internal-section-panel',view).forEach(x=>{const on=x.dataset.internalPanel===key;x.classList.toggle('active',on);x.hidden=!on});
   requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,view.getBoundingClientRect().top+window.scrollY-18),left:0,behavior:'auto'}));
 };
 if(tabs&&!tabs.dataset.bound){
   tabs.dataset.bound='true';
   tabs.addEventListener('click',e=>{const b=e.target.closest('[data-internal-target]');if(!b)return;e.preventDefault();activate(b.dataset.internalTarget)});
 }
 window.ASE_GAMES_MATRIX_OPEN=()=>{activate('management');document.querySelector('.nav-item[data-view="gamesmatrix"]')?.click()};
 activate('overview');
}
function notifications(){
 const view=$('[data-view-panel="notifications"]');if(!view)return;
 const r=role(),owner=r==='owner';
 const hero=view.querySelector('.users-hero');
 const status=$('#notificationStatus');
 const command=view.querySelector('.notification-command-grid');
 const lower=view.querySelector('.notification-lower-grid');
 const devices=$('#notificationDevicesPanel');
 const history=lower?.querySelector('article:first-child');
 const access=$('#notificationAccessPanel');
 const deviceCard=command?.querySelector('.device-card');
 const privacy=command?.querySelector('.privacy-card');
 const deviceCount=command?.querySelector('article:last-child');
 const composer=$('#sendNotificationPanel');
 const historyNodes=[status,deviceCard,history].filter(Boolean);
 const historyPanel=panel(view,'history',historyNodes);historyPanel.classList.add('active');
 if(owner){
   const manageNodes=[composer,deviceCount,devices,access].filter(Boolean);
   manageNodes.forEach(n=>{n.hidden=false;n.classList.remove('owner-only','owner-manager-only')});
   const mp=panel(view,'management',manageNodes);mp.dataset.internalAccess='owner';
 }
 if(privacy)privacy.remove();
 if(command)command.remove();
 if(lower)lower.remove();
 if(!owner){composer?.remove();access?.remove();devices?.remove();deviceCount?.remove()}
 makeTabs(view,[{key:'history',label:'Notification History'},...(owner?[{key:'management',label:'Notification Management',access:'owner'}]:[])]);
 const title=view.querySelector('h1');const desc=view.querySelector('.notifications-hero p:not(.eyebrow)');
 if(title)title.textContent='Notifications';
 if(desc)desc.textContent='Review alerts and notification history.';
}
function users(){
 const view=$('[data-view-panel="users"]');if(!view)return;
 const r=role(),owner=r==='owner',manager=r==='manager';
 const hero=view.querySelector('.users-hero');
 const tabs=view.querySelector('.admin-tabs');
 const people=view.querySelector('[data-admin-panel="people"]');
 const adminPanels=$$('[data-admin-panel]',view).filter(x=>x!==people);
 const notice=$('#usersNotice');
 if(people){const p=panel(view,'directory',[notice,people]);p.classList.add('active')}
 if(owner){
   const adminWrap=document.createElement('div');adminWrap.className='owner-admin-wrap';
   if(tabs)adminWrap.appendChild(tabs);adminPanels.forEach(x=>adminWrap.appendChild(x));
   const ap=panel(view,'administration',[adminWrap]);ap.dataset.internalAccess='owner';
 }else{
   tabs?.remove();adminPanels.forEach(x=>x.remove());
   const invite=$('#openInviteModal');if(invite)invite.hidden=!manager;
 }
 makeTabs(view,[{key:'directory',label:'Employee Directory'},...(owner?[{key:'administration',label:'Roles & Permissions',access:'owner'}]:[])]);
}

function clover(){
 const view=$('[data-view-panel="clover"]');if(!view)return;
 const owner=role()==='owner';
 const tips=$('#cloverTipsPanel');
 const head=view.querySelector('.page-head');
 const general=[...view.children].filter(n=>n!==head&&n!==tips);
 const overview=panel(view,'sales',general);overview.classList.add('active');
 if(owner&&tips){tips.hidden=false;const tp=panel(view,'tips',[tips]);tp.dataset.internalAccess='owner'}
 else if(tips){tips.remove()}
 makeTabs(view,[{key:'sales',label:'Sales Dashboard'},...(owner?[{key:'tips',label:'Employee Tips',access:'owner'}]:[])]);
}

function website(){
 const view=$('[data-view-panel="website"]');if(!view)return;
 // This tab is already owner-only; group publishing controls clearly.
 const head=view.querySelector('.page-head'),notice=$('#publishNotice'),layout=view.querySelector('.editor-layout');
 if(layout){const p=panel(view,'management',[notice,layout]);p.classList.add('active');makeTabs(view,[{key:'management',label:'Website Management'}])}
}
function weather(){
 const view=$('[data-view-panel="weather"]');if(!view)return;
 const canManage=['owner','manager'].includes(role());
 const btn=view.querySelector('[data-weather-tab="fieldstatus"]');
 const pnl=view.querySelector('[data-weather-panel="fieldstatus"]');
 if(!canManage){btn?.remove();pnl?.remove()}
 else if(btn){btn.textContent='Management'}
}

function addAutoOpsTab(){
 const view=$('[data-view-panel="settings"]');
 const autoOps=$('#autoOpsSettings');
 if(!view||!autoOps)return;
 if(!ownerAllowed()){autoOps.remove();return}
 if(view.querySelector(':scope > .internal-section-panel[data-internal-panel="autoops"]'))return;
 autoOps.hidden=false;
 const p=panel(view,'autoops',[autoOps]);p.hidden=true;
 const tabs=view.querySelector(':scope > .internal-section-tabs');
 if(!tabs){settings();return}
 if(tabs.querySelector('[data-internal-target="autoops"]'))return;
 const b=document.createElement('button');
 b.type='button';b.className='internal-section-tab';b.dataset.internalTarget='autoops';b.dataset.internalAccess='owner';b.textContent='Auto Ops Alerts';
 tabs.appendChild(b);
}
function settings(){
 const view=$('[data-view-panel="settings"]');if(!view)return;
 if(view.querySelector(':scope > .internal-section-tabs')){addAutoOpsTab();return}
 const owner=role()==='owner';
 const base=view.querySelector('.settings-grid');
 const prefs=$('#v9DashboardSettings');
 const security=$('#securityCenter');
 const database=$('#databaseCenter');
 const autoOps=$('#autoOpsSettings');
 const account=panel(view,'account',[base]);account.classList.add('active');account.hidden=false;
 const items=[{key:'account',label:'Account & App'}];
 if(owner&&prefs){const p=panel(view,'visibility',[prefs]);p.hidden=true;items.push({key:'visibility',label:'Dashboard Access',access:'owner'})}
 if(owner&&security){security.hidden=false;const p=panel(view,'security',[security]);p.hidden=true;items.push({key:'security',label:'Security',access:'owner'})}else security?.remove();
 if(owner&&database){database.hidden=false;const p=panel(view,'database',[database]);p.hidden=true;items.push({key:'database',label:'Database',access:'owner'})}else database?.remove();
 if(owner&&autoOps){autoOps.hidden=false;const p=panel(view,'autoops',[autoOps]);p.hidden=true;items.push({key:'autoops',label:'Auto Ops Alerts',access:'owner'})}else if(autoOps&&!owner)autoOps.remove();
 makeTabs(view,items);
}

function dashboard(){
 const card=$('.ops73-checklist-card');if(card)card.remove();
}
function init(event){
 currentRole=event?.detail?.role||window.ASE_OPS?.role?.()||document.body.dataset.role||'unassigned';
 document.body.dataset.role=currentRole;
 dashboard();games();notifications();users();clover();website();weather();setTimeout(settings,0);
 document.body.classList.add('role-sections-ready');
}
window.addEventListener('ase:profile-ready',init);
document.addEventListener('ase:auto-alerts-ready',()=>setTimeout(addAutoOpsTab,0));
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.ASE_OPS?.getProfile?.())init({detail:{role:window.ASE_OPS.role()}})},500));
})();
