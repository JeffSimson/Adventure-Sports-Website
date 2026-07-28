
(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const AUTH_KEY='ase_ops_identity_session_v2';
const VAPID='BJ9KDmFgEczSShKwhai4KVQmattV1VsRMc9_QD72hB4MMZ333nceMiQsyrISotFAqcNofuqzwRMkf33Qnt2R8c8';
const FIREBASE_CONFIG={
  apiKey:'AIzaSyCJ2bzP2XdpSvbqdr4eg5ALHcQUBAFXQ1E',
  authDomain:'adventure-sports-operations.firebaseapp.com',
  projectId:'adventure-sports-operations',
  storageBucket:'adventure-sports-operations.firebasestorage.app',
  messagingSenderId:'366845908808',
  appId:'1:366845908808:web:bc9cbeeb1fafd67a64857d',
  measurementId:'G-JQTJGVS81M'
};
const ENDPOINTS={
  data:'/.netlify/functions/notification-data',
  send:'/.netlify/functions/notification-send',
  register:'/.netlify/functions/notification-register',
  settings:'/.netlify/functions/notification-settings'
};
const ROLES=['owner','manager','grounds','kitchen','cashier'];
const LABELS={owner:'Owner',manager:'Manager',grounds:'Grounds',kitchen:'Kitchen',cashier:'Cashier'};
let messaging=null,currentData=null,currentSettings=null,foregroundHandlerAttached=false;

function attachForegroundMessaging(reg){
  if(foregroundHandlerAttached||!messaging?.onMessage)return;
  foregroundHandlerAttached=true;
  messaging.onMessage(async payload=>{
    const n=payload?.notification||{};
    const d=payload?.data||{};
    const title=n.title||d.title||'Adventure Sports';
    const body=n.body||d.body||'Open the Operations Hub for details.';
    notice(`${title}: ${body}`,'success',true);
    // FCM does not automatically display an OS banner while the Home Screen
    // app is open. Display it ourselves so foreground and background delivery
    // behave the same on iPhone. This is independent of dashboard visibility
    // permissions; those controls only affect what the user can view in-app.
    if(Notification.permission==='granted'&&reg?.showNotification){
      await reg.showNotification(title,{
        body,
        icon:'/uploads/branding/adventure-logo.png',
        badge:'/uploads/branding/adventure-logo.png',
        tag:d.notificationId||`ase-foreground-${Date.now()}`,
        renotify:true,
        requireInteraction:d.priority==='emergency',
        data:{url:d.url||'/ops/'}
      }).catch(error=>console.warn('Foreground notification display failed',error));
    }
    loadData();
  });
}

function stableDeviceId(){
  let id=localStorage.getItem('asePushDeviceId');
  if(!id){id=(crypto.randomUUID?crypto.randomUUID():'dev_'+Date.now()+'_'+Math.random().toString(36).slice(2));localStorage.setItem('asePushDeviceId',id)}
  return id;
}

function session(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{return null}}
function token(){return session()?.token?.access_token||''}
function headers(extra={}){return {Authorization:'Bearer '+token(),...extra}}
async function api(url,options={}){
  const r=await fetch(url,{cache:'no-store',...options,headers:headers(options.headers||{})});
  const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch{d={error:raw}}
  if(!r.ok)throw Error(d.error||`Request failed (${r.status}).`);
  return d;
}
function role(){return document.querySelector('#settingsRoleBadge')?.dataset?.role||''}
function notice(msg,type='success',sticky=false){
  const el=$('#notificationStatus');if(!el)return;
  el.textContent=msg;el.className='publish-notice '+type;el.hidden=false;
  clearTimeout(el._t);if(!sticky)el._t=setTimeout(()=>el.hidden=true,9000);
}
function setEnableButton(text,busy=false){const b=$('#enableNotifications');if(!b)return;b.textContent=text;b.disabled=busy;}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function fmtDate(v){try{return new Date(v).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}catch{return v||''}}

async function initFirebase(){
  if(!window.isSecureContext)throw Error('Notifications require HTTPS. Open the live Netlify site, not a local file.');
  if(!('serviceWorker' in navigator))throw Error('This browser does not support service workers.');
  if(!('Notification' in window))throw Error('This browser does not support web notifications.');
  if(!window.firebase)throw Error('Firebase did not load. Refresh the page and try again.');
  if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
  messaging=firebase.messaging();
  // Remove the broken V7.1 root worker before installing the corrected /ops worker.
  const registrations=await navigator.serviceWorker.getRegistrations();
  for(const existing of registrations){
    if(existing.scope===location.origin+'/' || existing.active?.scriptURL?.includes('/firebase-messaging-sw.js')){
      await existing.unregister().catch(()=>false);
    }
  }
  const reg=await navigator.serviceWorker.register('/ops/firebase-messaging-sw.js?v=720',{scope:'/ops/',updateViaCache:'none'});
  await reg.update().catch(()=>{});
  await new Promise((resolve,reject)=>{
    const worker=reg.installing||reg.waiting||reg.active;
    if(!worker)return reject(Error('The notification service worker did not start.'));
    if(worker.state==='activated')return resolve();
    const timer=setTimeout(()=>reject(Error('The notification service worker timed out while starting.')),12000);
    worker.addEventListener('statechange',()=>{
      if(worker.state==='activated'){clearTimeout(timer);resolve()}
      if(worker.state==='redundant'){clearTimeout(timer);reject(Error('The notification service worker was rejected by the browser.'))}
    });
  });
  attachForegroundMessaging(reg);
  updateDeviceStatus();
  return reg;
}
async function enableNotifications(){
  setEnableButton('Enabling…',true);notice('Checking browser permission and registering this device…','info',true);
  try{
    const reg=await initFirebase();
    let permission=Notification.permission;
    if(permission==='default')permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error(permission==='denied'?'Notifications are blocked. Allow them in your browser/site settings, then try again.':'Notification permission was not granted.');
    // An explicit re-enrollment must create a fresh FCM/Web Push subscription.
    // iOS can keep returning a stale token after a Home Screen app is restored,
    // updated, or reinstalled. Delete the current token first, then request a new
    // one against the active /ops service worker and the configured VAPID key.
    try{
      const oldToken=await messaging.getToken({vapidKey:VAPID,serviceWorkerRegistration:reg});
      if(oldToken)await messaging.deleteToken().catch(()=>false);
    }catch(resetError){console.warn('Existing push token could not be reset',resetError)}
    await new Promise(resolve=>setTimeout(resolve,500));
    const fcmToken=await messaging.getToken({vapidKey:VAPID,serviceWorkerRegistration:reg});
    if(!fcmToken)throw Error('Firebase did not return a device token. Confirm the Firebase Cloud Messaging Registration API is enabled and this domain is allowed.');
    await api(ENDPOINTS.register,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      token:fcmToken,deviceId:stableDeviceId(),endpoint:reg.scope,device:navigator.userAgent.slice(0,220),platform:navigator.platform||''
    })});
    const verify=await api(ENDPOINTS.register);
    if(!verify.registrations?.length)throw Error('The browser allowed notifications, but the device registration did not save.');
    localStorage.setItem('asePushRegistered','1');
    notice('Success — this device is enrolled and ready to receive alerts.','success',true);
    updateDeviceStatus(true);await loadData();
    if(reg.showNotification){await reg.showNotification('Adventure Sports notifications enabled',{body:'This device is now registered for Operations Hub alerts.',icon:'/uploads/branding/adventure-logo.png',badge:'/uploads/branding/adventure-logo.png',tag:'ase-enabled-test'}).catch(()=>{});}
  }catch(e){console.error('Notification enrollment failed',e);let message=e&&e.message?e.message:String(e);if(/cors|cross-origin|network/i.test(message)){message='Firebase blocked the device registration request. The corrected service worker is installed, but Firebase must allow adventurenj.com and the Cloud Messaging Registration API must be enabled.';}notice(`Could not enable notifications: ${message}`,'error',true);updateDeviceStatus(false,message)}
  finally{setEnableButton(Notification.permission==='granted'?'Re-enroll This Device':'Enable on This Device',false)}
}
function updateDeviceStatus(registered,errorMessage=''){
  const text=$('#deviceStatusText'),dot=$('#deviceStatusDot'),help=$('#deviceStatusHelp');if(!text)return;
  if(!window.isSecureContext){text.textContent='HTTPS required';dot.dataset.state='off';help.textContent='Open the deployed HTTPS website.';return}
  if(!('Notification' in window)){text.textContent='Not supported';dot.dataset.state='off';help.textContent='Use a current browser. On iPhone, add the site to the Home Screen first.';return}
  const p=Notification.permission, saved=registered===true||localStorage.getItem('asePushRegistered')==='1';
  if(errorMessage){text.textContent='Enrollment failed';dot.dataset.state='off';help.textContent=errorMessage;return}
  if(p==='granted'&&saved){text.textContent='Device enrolled';dot.dataset.state='on';help.textContent='This device is registered and can receive Adventure Sports alerts.'}
  else if(p==='granted'){text.textContent='Permission allowed — enrollment needed';dot.dataset.state='pending';help.textContent='Press Re-enroll This Device to finish Firebase registration.'}
  else if(p==='denied'){text.textContent='Notifications blocked';dot.dataset.state='off';help.textContent='Allow notifications in browser/site settings, then press Enable again.'}
  else{text.textContent='Not enabled';dot.dataset.state='pending';help.textContent='Press Enable on This Device and approve the browser prompt.'}
}
function renderHistory(items=[],visibility={}){
  const box=$('#notificationHistory');if(!box)return;
  if(!visibility.notificationHistory){box.innerHTML='<div class="dashboard-empty">Your role does not have access to notification history.</div>';return}
  if(!items.length){box.innerHTML='<div class="dashboard-empty">No notifications have been sent yet.</div>';return}
  box.innerHTML=items.map(x=>`<article class="notification-history-item priority-${esc(x.priority)}">
    <div class="notification-history-icon">${x.priority==='emergency'?'🚨':'🔔'}</div>
    <div><div class="notification-history-head"><strong>${esc(x.title)}</strong><span>${esc(fmtDate(x.createdAt))}</span></div>
    <p>${esc(x.body)}</p><small>Sent by ${esc(x.createdBy?.name||x.createdBy?.email||'Manager')}${x.sent!=null?` · ${x.sent} delivered${x.failed?` · ${x.failed} failed`:''}`:''}</small></div>
  </article>`).join('');
}
function renderDevices(items=[]){
  const box=$('#notificationDevices'),count=$('#deviceCount');if(count)count.textContent=String(items.length);
  if(!box)return;
  if(!items.length){box.innerHTML='<div class="dashboard-empty">No employee devices are enrolled yet.</div>';return}
  box.innerHTML=items.map(x=>`<div class="notification-device-row"><div><strong>${esc(x.name||x.email)}</strong><span>${esc(x.email)} · ${esc(LABELS[x.role]||x.role)}</span></div><div><small>${esc(fmtDate(x.updatedAt))}</small><span class="device-enrolled-pill">Enabled</span></div></div>`).join('');
}
function renderAccess(settings){
  currentSettings=settings;
  const box=$('#notificationAccessMatrix');if(!box||!settings)return;
  const cols=['operationsFeed','staffPresence','deliveryReports','notificationHistory'];
  const labels={operationsFeed:'Operations Feed',staffPresence:'Staff Presence / Clocked In',deliveryReports:'Delivery Reports',notificationHistory:'Notification History'};
  box.innerHTML=`<div class="access-table"><div class="access-row access-head"><strong>Role</strong>${cols.map(c=>`<strong>${labels[c]}</strong>`).join('')}<strong>Can Send</strong></div>
  ${ROLES.map(r=>`<div class="access-row" data-role="${r}"><strong>${LABELS[r]}</strong>${cols.map(c=>`<label class="switch-cell"><input type="checkbox" data-access="${c}" ${settings.roleVisibility?.[r]?.[c]?'checked':''} ${r==='owner'?'disabled':''}><span></span></label>`).join('')}<label class="switch-cell"><input type="checkbox" data-send-role ${settings.sendRoles?.includes(r)?'checked':''} ${r==='owner'?'disabled':''}><span></span></label></div>`).join('')}</div>
  <p class="access-footnote">Owner access remains protected. Staff Presence is off by default for Grounds, Kitchen, and Cashier roles.</p>`;
}
function collectAccess(){
  const settings=JSON.parse(JSON.stringify(currentSettings||{}));settings.roleVisibility=settings.roleVisibility||{};settings.sendRoles=[];
  $$('.access-row[data-role]').forEach(row=>{
    const r=row.dataset.role;settings.roleVisibility[r]=settings.roleVisibility[r]||{};
    $$('[data-access]',row).forEach(i=>settings.roleVisibility[r][i.dataset.access]=i.checked);
    if($('[data-send-role]',row)?.checked)settings.sendRoles.push(r);
  });
  if(!settings.sendRoles.includes('owner'))settings.sendRoles.unshift('owner');
  settings.roleVisibility.owner={operationsFeed:true,staffPresence:true,deliveryReports:true,notificationHistory:true};
  return settings;
}
async function loadData(){
  try{
    const d=await api(ENDPOINTS.data);currentData=d;
    renderHistory(d.history,d.visibility||{});renderDevices(d.devices||[]);
    const canSend=!!d.canSend,composer=$('#sendNotificationPanel'),badge=$('#notificationPermissionBadge');
    if(composer)composer.classList.toggle('read-only',!canSend);
    if(badge){badge.textContent=canSend?'Can send alerts':'View only';badge.dataset.role=canSend?'owner':'grounds'}
    $$('#notificationForm input, #notificationForm textarea, #notificationForm select, #notificationForm button').forEach(el=>el.disabled=!canSend);
    if(d.settings)renderAccess(d.settings);
    const r=role();$$('.owner-manager-only').forEach(el=>el.hidden=!['owner','manager'].includes(r));
    $$('.owner-only').forEach(el=>{if(el.closest('[data-view-panel="notifications"]'))el.hidden=r!=='owner'});
  }catch(e){notice(e.message,'error')}
}
async function saveAccess(){
  try{
    const settings=collectAccess();
    await api(ENDPOINTS.settings,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({settings})});
    notice('Notification access controls saved.');loadData();
  }catch(e){notice(e.message,'error')}
}
async function sendNotification(e){
  e.preventDefault();
  try{
    const audience=$('input[name="notificationAudience"]:checked')?.value||'everyone';
    const roles=$$('#notificationRoleChoices input:checked').map(x=>x.value);
    if(audience==='roles'&&!roles.length)throw Error('Choose at least one role.');
    const payload={title:$('#notificationTitle').value,body:$('#notificationBody').value,priority:$('#notificationPriority').value,url:$('#notificationUrl').value,audience,roles};
    const btn=$('#sendNotificationButton');btn.disabled=true;btn.textContent='Sending…';
    const d=await api(ENDPOINTS.send,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    notice(`Notification accepted for ${d.record.sent} device${d.record.sent===1?'':'s'}${d.record.failed?`; ${d.record.failed} failed and ${d.record.removedInvalid||0} invalid registration${(d.record.removedInvalid||0)===1?' was':'s were'} removed`:''}.`);
    $('#notificationForm').reset();loadData();
  }catch(e){notice(e.message,'error')}
  finally{const btn=$('#sendNotificationButton');if(btn){btn.disabled=false;btn.textContent='Send Notification'}}
}
function wire(){
  $('#enableNotifications')?.addEventListener('click',enableNotifications);
  $('#refreshNotifications')?.addEventListener('click',loadData);
  $('#notificationForm')?.addEventListener('submit',sendNotification);
  $('#saveNotificationAccess')?.addEventListener('click',saveAccess);
  $$('.template-chip').forEach(b=>b.addEventListener('click',()=>{
    $('#notificationTitle').value=b.dataset.templateTitle||'';
    $('#notificationBody').value=b.dataset.templateBody||'';
    $('#notificationPriority').value=b.dataset.templatePriority||'normal';
  }));
  $$('.open-notification-controls').forEach(b=>b.addEventListener('click',()=>{
    document.querySelector('[data-view="notifications"]')?.click();
    setTimeout(()=>$('#notificationAccessPanel')?.scrollIntoView({behavior:'smooth'}),250);
  }));
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-view="notifications"]'))setTimeout(loadData,100);
  });
}
async function boot(){
  wire();updateDeviceStatus();
  try{await initFirebase();if(Notification.permission==='granted'){const mine=await api(ENDPOINTS.register);if(mine.registrations?.length){localStorage.setItem('asePushRegistered','1');updateDeviceStatus(true)}}}catch(e){console.warn(e)}
  const wait=setInterval(()=>{if(token()){clearInterval(wait);loadData()}},300);
  setTimeout(()=>clearInterval(wait),15000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
