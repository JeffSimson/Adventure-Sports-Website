
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
let messaging=null,currentData=null,currentSettings=null;

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
function notice(msg,type='success'){
  const el=$('#notificationStatus');if(!el)return;
  el.textContent=msg;el.className='publish-notice '+type;el.hidden=false;
  clearTimeout(el._t);el._t=setTimeout(()=>el.hidden=true,5000);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function fmtDate(v){try{return new Date(v).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})}catch{return v||''}}

async function initFirebase(){
  if(!('serviceWorker' in navigator)||!('Notification' in window)||!window.firebase)return;
  if(!firebase.apps.length)firebase.initializeApp(FIREBASE_CONFIG);
  messaging=firebase.messaging();
  await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/'});
  updateDeviceStatus();
}
async function enableNotifications(){
  try{
    if(!messaging)await initFirebase();
    if(!messaging)throw Error('Push notifications are not supported in this browser.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw Error('Notifications were not allowed on this device.');
    const reg=await navigator.serviceWorker.ready;
    const fcmToken=await messaging.getToken({vapidKey:VAPID,serviceWorkerRegistration:reg});
    if(!fcmToken)throw Error('Firebase did not return a device token.');
    await api(ENDPOINTS.register,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      token:fcmToken,endpoint:reg.scope,device:navigator.userAgent.slice(0,220)
    })});
    notice('Notifications are enabled on this device.');
    updateDeviceStatus();loadData();
  }catch(e){notice(e.message,'error');updateDeviceStatus()}
}
function updateDeviceStatus(){
  const text=$('#deviceStatusText'),dot=$('#deviceStatusDot'),help=$('#deviceStatusHelp');
  if(!text)return;
  if(!('Notification' in window)){text.textContent='Not supported';dot.dataset.state='off';help.textContent='Use Safari, Chrome, Edge, or an installed Home Screen app.';return}
  const p=Notification.permission;
  if(p==='granted'){text.textContent='Notifications enabled';dot.dataset.state='on';help.textContent='This device can receive Adventure Sports alerts.'}
  else if(p==='denied'){text.textContent='Notifications blocked';dot.dataset.state='off';help.textContent='Open browser or phone settings to allow notifications.'}
  else{text.textContent='Notifications not enabled';dot.dataset.state='pending';help.textContent='Press Enable on This Device and approve the prompt.'}
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
    notice(`Notification sent to ${d.record.sent} device${d.record.sent===1?'':'s'}${d.record.failed?`; ${d.record.failed} failed`:''}.`);
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
  messaging?.onMessage?.(payload=>{
    notice(payload.notification?.title?`${payload.notification.title}: ${payload.notification.body||''}`:'New Adventure Sports notification');
    loadData();
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-view="notifications"]'))setTimeout(loadData,100);
  });
}
async function boot(){
  wire();updateDeviceStatus();
  try{await initFirebase()}catch{}
  const wait=setInterval(()=>{if(token()){clearInterval(wait);loadData()}},300);
  setTimeout(()=>clearInterval(wait),15000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
