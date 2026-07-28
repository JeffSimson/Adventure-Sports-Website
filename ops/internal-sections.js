(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function role(){return window.ASE_OPS?.role?.()||document.body.dataset.role||'unassigned'}
function makeTabs(view,items){
  if(!view||view.querySelector(':scope > .internal-section-tabs'))return null;
  const tabs=document.createElement('div');tabs.className='internal-section-tabs';tabs.setAttribute('role','tablist');
  items.forEach((item,i)=>{
    const b=document.createElement('button');b.type='button';b.className='internal-section-tab'+(i===0?' active':'');b.dataset.internalTarget=item.key;b.textContent=item.label;tabs.appendChild(b);
  });
  const anchor=view.querySelector('.page-head,.users-hero,.staff-hero,.weather-hero');
  anchor?.insertAdjacentElement('afterend',tabs);
  tabs.addEventListener('click',e=>{
    const b=e.target.closest('[data-internal-target]');if(!b)return;
    $$('.internal-section-tab',tabs).forEach(x=>x.classList.toggle('active',x===b));
    $$(':scope > .internal-section-panel',view).forEach(x=>x.classList.toggle('active',x.dataset.internalPanel===b.dataset.internalTarget));
  });
  return tabs;
}
function panel(view,key,nodes){
  const p=document.createElement('div');p.className='internal-section-panel';p.dataset.internalPanel=key;
  nodes.filter(Boolean).forEach(n=>p.appendChild(n));view.appendChild(p);return p;
}
function games(){
 const view=$('[data-view-panel="games"]');if(!view)return;
 const manager=$('#gamesMatrixManager');const r=role();const canManage=['owner','manager'].includes(r);
 const head=view.querySelector('.page-head');
 const general=[...view.children].filter(n=>n!==head&&n!==manager);
 const overview=panel(view,'overview',general);overview.classList.add('active');
 if(canManage&&manager){manager.hidden=false;panel(view,'management',[manager])}
 else if(manager){manager.hidden=true}
 makeTabs(view,[{key:'overview',label:'Games & Fields'},...(canManage?[{key:'management',label:'Tournament Management'}]:[])]);
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
   panel(view,'management',manageNodes);
 }
 if(privacy)privacy.remove();
 if(command)command.remove();
 if(lower)lower.remove();
 if(!owner){composer?.remove();access?.remove();devices?.remove();deviceCount?.remove()}
 makeTabs(view,[{key:'history',label:'Notification History'},...(owner?[{key:'management',label:'Notification Management'}]:[])]);
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
   panel(view,'administration',[adminWrap]);
 }else{
   tabs?.remove();adminPanels.forEach(x=>x.remove());
   const invite=$('#openInviteModal');if(invite)invite.hidden=!manager;
 }
 makeTabs(view,[{key:'directory',label:'Employee Directory'},...(owner?[{key:'administration',label:'Roles & Permissions'}]:[])]);
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
function dashboard(){
 const card=$('.ops73-checklist-card');if(card)card.remove();
}
function init(){
 dashboard();games();notifications();users();website();weather();
 document.body.classList.add('role-sections-ready');
}
window.addEventListener('ase:profile-ready',init,{once:true});
document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.ASE_OPS?.getProfile?.())init()},500));
})();