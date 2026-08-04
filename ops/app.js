(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app'), gate=$('#loginGate'), sidebar=$('#sidebar');
const AUTH_KEY='ase_ops_identity_session_v2';
const TRUSTED_DEVICE_KEY='ase_trusted_device_v1';
const APP_BUILD='913';
async function ensureFreshBuild(){
  try{
    const key='ase_ops_build';
    const previous=localStorage.getItem(key);
    if(previous!==APP_BUILD){
      localStorage.setItem(key,APP_BUILD);
      if(previous){
        const url=new URL(location.href);
        url.searchParams.set('build',APP_BUILD);
        location.replace(url.pathname+url.search+url.hash);
        return false;
      }
    }
  }catch{}
  return true;
}

const IDENTITY='/.netlify/identity';
const PROFILE='/.netlify/functions/auth-profile';
const USERS='/.netlify/functions/user-management-v2';
const PERMS='/.netlify/functions/permissions-v2';
const AUDIT='/.netlify/functions/audit-log';
const LIVE='/.netlify/functions/live-content?file=site';
const PUBLISH='/.netlify/functions/publish-content';
const CLOVER='/.netlify/functions/clover-dashboard';

const ROLE_LABELS={owner:'Owner',manager:'Manager',grounds:'Grounds Crew',kitchen:'Kitchen',cashier:'Cashier'};
const DEFAULT_PERMISSIONS={
  owner:['dashboard','website','clover','staff','games','gamesmatrix','maintenance','weather','reports','incidents','kitchen','notifications','users','settings'],
  manager:['dashboard','clover','staff','games','gamesmatrix','maintenance','weather','reports','incidents','kitchen','notifications','users'],
  grounds:['maintenance','weather','incidents','notifications'],
  kitchen:['kitchen','weather','incidents','notifications'],
  cashier:['dashboard','incidents','notifications']
};
const MODULES=[
  ['dashboard','Dashboard'],['website','Website Control'],['clover','Clover'],['staff','Staffing'],
  ['games','Games'],['gamesmatrix','Games & Matrix'],['maintenance','Fields & Maintenance'],['weather','Weather Center'],
  ['reports','Reports'],['incidents','Incident Reports'],['kitchen','Kitchen'],['notifications','Notifications'],['users','People & Permissions'],['settings','Settings']
];

let session=null,profile=null,permissions=structuredClone(DEFAULT_PERMISSIONS);
let stepupToken=sessionStorage.getItem('ase_stepup_token')||'',trustedDeviceToken=localStorage.getItem(TRUSTED_DEVICE_KEY)||'',securityChannel='email',securityResolve=null;
let siteData=null,originalStatus='',originalAnnouncement='',publishing=false,cloverLoading=false,timer=null;
let teamUsers=[],auditEntries=[],selectedProfileUser=null;

const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const token=()=>session?.token?.access_token||'';
const authHeaders=(extra={})=>{
  const securityToken=stepupToken||trustedDeviceToken;
  return {
    Authorization:'Bearer '+token(),
    ...(securityToken?{'X-ASE-Stepup':securityToken}:{}),
    ...(trustedDeviceToken?{'X-ASE-Trusted-Device':trustedDeviceToken}:{}),
    ...extra
  };
};
const role=()=>profile?.role||'unassigned';
window.ASE_OPS={api,role,toast,getProfile:()=>profile,getSession:()=>session,getStepupToken:()=>stepupToken||trustedDeviceToken,requireSecurity:requireSensitiveSecurity};
const allowed=view=>(permissions[role()]||[]).includes(view);
const defaultView=()=>(permissions[role()]||[])[0]||null;
const fullName=u=>(u?.user_metadata?.full_name||u?.user_metadata?.name||u?.name||u?.email?.split('@')[0]||'Team Member').trim();
const firstName=u=>fullName(u).split(/\s+/)[0];
const greet=()=>{const h=new Date().getHours();return h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'};
function save(t,u){session={token:t,user:u};localStorage.setItem(AUTH_KEY,JSON.stringify(session))}
function clear(){session=null;profile=null;stepupToken='';localStorage.removeItem(AUTH_KEY);sessionStorage.removeItem('ase_stepup_token')}
function read(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{return null}}
function toast(message){const el=$('#toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2600)}
function noticeUsers(message,type='success'){const el=$('#usersNotice');if(!el)return;el.textContent=message;el.className='publish-notice '+type;el.hidden=false}
async function identityUser(t){const r=await fetch(IDENTITY+'/user',{headers:{Authorization:'Bearer '+t},cache:'no-store'});if(!r.ok)throw Error('Your login session could not be verified.');return r.json()}
async function refresh(s){if(!s?.token?.refresh_token)return null;const r=await fetch(IDENTITY+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:s.token.refresh_token})});if(!r.ok)return null;const t=await r.json(),u=await identityUser(t.access_token);save(t,u);return session}
async function ensure(){if(session?.token?.access_token)return session;const s=read();if(!s)return null;try{const u=await identityUser(s.token.access_token);save(s.token,u);return session}catch{return refresh(s)}}
async function api(url,options={}){
  const s=await ensure();if(!s)throw Error('You are not signed in.');
  const r=await fetch(url,{cache:'no-store',...options,headers:authHeaders(options.headers||{})});
  let d={};const raw=await r.text();if(raw){try{d=JSON.parse(raw)}catch{d={error:raw.slice(0,300)}}}
  if(!r.ok)throw Error(d.error||d.message||`Request failed (${r.status}).`);
  return d;
}
function showGate(message='Enter the email and password from your invitation.'){if(app)app.hidden=true;if(gate)gate.hidden=false;if(timer)clearInterval(timer);const status=$('#loginStatus');if(status)status.textContent=message}
function unauthorized(message){clear();showGate(message||'Your account does not have an assigned Adventure Sports role.');const status=$('#loginStatus');if(status)status.className='login-status error'}
function renderUser(u){
  const n=firstName(u),r=ROLE_LABELS[role()]||'Access Not Assigned';
  const values={
    '#greeting':greet(),
    '#userName':n,
    '#sidebarUserName':fullName(u),
    '#sidebarRoleName':r,
    '#accountEmail':u?.email||'',
    '#publisherEmail':u?.email||'',
    '#settingsRoleBadge':r
  };
  Object.entries(values).forEach(([selector,value])=>{const el=$(selector);if(el)el.textContent=value});
  const roleBadge=$('#settingsRoleBadge');if(roleBadge)roleBadge.dataset.role=role();
  $$('.avatar').forEach(x=>x.textContent=(n[0]||'A').toUpperCase());
}
function applyPermissions(){
  $$('.nav-item').forEach(b=>b.hidden=!allowed(b.dataset.view));
  $$('.view').forEach(v=>v.dataset.authorized=allowed(v.dataset.viewPanel)?'true':'false');
  $$('[data-go]').forEach(b=>b.hidden=!allowed(b.dataset.go));
  $$('.owner-only').forEach(el=>el.hidden=role()!=='owner');
  document.body.dataset.role=role();
}
async function securityRequest(url,options={}){
  const s=await ensure();if(!s)throw Error('You are not signed in.');
  const r=await fetch(url,{cache:'no-store',...options,headers:authHeaders(options.headers||{})});
  const raw=await r.text();let d={};if(raw){try{d=JSON.parse(raw)}catch{d={error:raw.slice(0,300)}}}
  if(!r.ok)throw Error(d.error||d.message||`Request failed (${r.status}).`);return d;
}
function openSecurityModal(info){
  const modal=$('#securityModal');modal.hidden=false;$('#securityEmailDestination').textContent=info?.user?.email||session?.user?.email||'Your account email';$('#securityChannelChoices').hidden=false;$('#securityCodeForm').hidden=true;$('#securityModalText').textContent='Send a 6-digit code to your Owner email address.';$('#securityCode').value='';$('#securityCodeNotice').textContent='';const remember=$('#rememberTrustedDevice');if(remember)remember.checked=false;
}
function closeSecurityModal(){const m=$('#securityModal');if(m)m.hidden=true}
async function sendSecurityCode(){
  securityChannel='email';const btn=$('#sendEmailCode');btn.disabled=true;try{const d=await securityRequest('/.netlify/functions/security-challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:'email'})});$('#securityChannelChoices').hidden=true;$('#securityCodeForm').hidden=false;$('#securityModalText').textContent=`A 6-digit code was sent to ${d.destination}. It expires in 10 minutes.`;$('#securityCode').focus()}catch(e){$('#securityModalText').textContent=e.message}finally{btn.disabled=false}
}
async function verifySecurityCode(e){
  e.preventDefault();const b=$('#verifySecurityCode');b.disabled=true;b.textContent='Verifying…';$('#securityCodeNotice').textContent='';
  try{const rememberDevice=!!$('#rememberTrustedDevice')?.checked;const d=await securityRequest('/.netlify/functions/security-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel:securityChannel,code:$('#securityCode').value,trustDevice:rememberDevice})});
    stepupToken=d.stepup;sessionStorage.setItem('ase_stepup_token',stepupToken);
    if(d.trustedDevice){trustedDeviceToken=d.trustedDevice;localStorage.setItem(TRUSTED_DEVICE_KEY,trustedDeviceToken);toast('This device is trusted for 30 days.')}
    closeSecurityModal();securityResolve?.();securityResolve=null;
  }catch(err){$('#securityCodeNotice').textContent=err.message;$('#securityCodeNotice').className='login-status error'}finally{b.disabled=false;b.textContent='Verify and Continue'}
}
function requireOwnerVerification(info){
  if(!info?.mfaRequired||info?.mfaVerified)return Promise.resolve();
  openSecurityModal(info);return new Promise(resolve=>{securityResolve=resolve});
}
async function requireSensitiveSecurity(){
  if(role()!=='owner')return;
  if(stepupToken||trustedDeviceToken){
    try{
      const d=await api(PROFILE);
      if(d.mfaVerified)return;
    }catch{}
  }
  openSecurityModal({user:session?.user});
  return new Promise(resolve=>{securityResolve=resolve});
}
async function loadProfile(){
  let d=await api(PROFILE);profile=d;renderMaintenanceState(d.system||{});
  await requireOwnerVerification(d);
  if(d.mfaRequired&&!d.mfaVerified){d=await api(PROFILE);profile=d;renderMaintenanceState(d.system||{})}
  try{const p=await api(PERMS);permissions=p.permissions||permissions}catch{} Object.keys(DEFAULT_PERMISSIONS).forEach(r=>{permissions[r]=permissions[r]||[];if(!permissions[r].includes('incidents'))permissions[r].push('incidents')})
  return d;
}
async function show(u){
  try{
    await loadProfile();
    if(!ROLE_LABELS[role()])return unauthorized('Your account is active, but no app role has been assigned.');
    gate.hidden=true;app.hidden=false;renderUser(u);applyPermissions();window.dispatchEvent(new CustomEvent('ase:profile-ready',{detail:{role:role()}}));
    const requested=location.hash.replace('#','');go(allowed(requested)?requested:defaultView());
    if(allowed('website'))loadSite();
    if(allowed('clover')){loadClover();timer=setInterval(loadClover,60000)}
    if(allowed('users'))loadUsers();
  }catch(e){unauthorized(e.message)}
}
async function restore(){showGate();const s=read();if(!s?.token)return;try{const u=await identityUser(s.token.access_token);save(s.token,u);await show(u)}catch{const f=await refresh(s).catch(()=>null);if(f)await show(f.user);else clear()}}
async function login(e){e.preventDefault();const b=$('#loginButton');b.disabled=true;b.textContent='Signing In…';try{const r=await fetch(IDENTITY+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',username:$('#loginEmail').value.trim(),password:$('#loginPassword').value})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error_description||'The email or password is incorrect.');const u=await identityUser(d.access_token);save(d,u);$('#loginStatus').className='login-status';await show(u)}catch(err){$('#loginStatus').textContent=err.message;$('#loginStatus').className='login-status error'}finally{b.disabled=false;b.textContent='Sign In'}}
function logout(){clear();location.hash='';location.reload()}
function resetMenuDrag(){sidebar.style.removeProperty('--drawer-x');sidebar.classList.remove('dragging');document.body.style.removeProperty('--menu-progress')}
function closeMenu(){resetMenuDrag();sidebar.classList.remove('open');document.body.classList.remove('menu-open')}
function openMenu(){resetMenuDrag();sidebar.classList.add('open');document.body.classList.add('menu-open');sidebar.scrollTop=0}
function go(v){if(!v||!allowed(v))v=defaultView();if(!v)return unauthorized();$$('.view').forEach(x=>x.classList.toggle('active',x.dataset.viewPanel===v));$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===v));closeMenu();history.replaceState(null,'','#'+v);requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));if(v==='clover')loadClover();if(v==='users')loadUsers();if(v==='settings')loadSecurityProfile()}

async function loadSite(){if(!allowed('website'))return;const editorState=$('#editorState');if(editorState){editorState.textContent='Loading';editorState.className='connection-badge loading'}try{const r=await fetch(LIVE+'&v='+Date.now(),{cache:'no-store'});const raw=await r.text();if(!r.ok)throw Error((()=>{try{return JSON.parse(raw).error}catch{return 'Website status service unavailable.'}})());siteData=JSON.parse(raw)}catch(firstError){try{const r=await fetch('/content/site.json?ops='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Local fallback not found.');siteData=await r.json()}catch{siteData={fieldStatus:'OPEN',announcement:''};toast(firstError.message||'Safe default loaded.')}}originalStatus=String(siteData.fieldStatus||'OPEN').toUpperCase();originalAnnouncement=siteData.announcement||'';const radio=$(`input[name="fieldStatus"][value="${CSS.escape(originalStatus)}"]`)||$('input[value="OPEN"]');if(radio)radio.checked=true;const announcement=$('#announcementInput');if(announcement)announcement.value=originalAnnouncement;const liveStatus=$('#currentLiveStatus');if(liveStatus)liveStatus.textContent=originalStatus;const loaded=$('#lastLoadedTime');if(loaded)loaded.textContent=new Date().toLocaleString();updatePreview();const facility=$('#facilityStatus');if(facility)facility.textContent=originalStatus;const liveDot=$('#dashboardLiveDot');if(liveDot)liveDot.dataset.status=originalStatus.toLowerCase().replace(/\s+/g,'-');if(editorState){editorState.textContent='Live';editorState.className='connection-badge ready'}const notice=$('#publishNotice');if(notice&&notice.textContent.trim()==='Not Found')notice.hidden=true}
function current(){return $('input[name="fieldStatus"]:checked')?.value||'OPEN'}
function dirty(){return current()!==originalStatus||$('#announcementInput').value.trim()!==originalAnnouncement.trim()}
function updatePreview(){if(!$('#previewStatus'))return;const s=current(),a=$('#announcementInput').value.trim()||'No announcement is currently posted.',k=s.toLowerCase().replace(/\s+/g,'-');$('#previewStatus').textContent=s;$('#previewAnnouncement').textContent=a;$('#previewDot').dataset.status=k;$('#announcementCount').textContent=$('#announcementInput').value.length+' / 240';$('#changeState').textContent=dirty()?'Ready to publish':'None';$('#publishControlsButton').disabled=!dirty()||publishing;$('#resetControlsButton').disabled=!dirty()||publishing}
async function publish(e){e.preventDefault();if(role()!=='owner')return toast('Only an Owner can publish website changes.');publishing=true;updatePreview();const b=$('#publishControlsButton');b.textContent='Publishing…';try{const d=await api(PUBLISH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fieldStatus:current(),announcement:$('#announcementInput').value.trim()})});if(!d.site)throw Error('Updated, but no site data returned.');siteData=d.site;originalStatus=d.site.fieldStatus;originalAnnouncement=d.site.announcement;$('#publishNotice').textContent='Public website updated live.';$('#publishNotice').className='publish-notice success';$('#publishNotice').hidden=false;await loadSite()}catch(e){$('#publishNotice').textContent=e.message;$('#publishNotice').className='publish-notice error';$('#publishNotice').hidden=false}finally{publishing=false;b.textContent='Publish Changes';updatePreview()}}

function badge(t,c){const el=$('#cloverConnection');if(!el)return;el.textContent=t;el.className='connection-badge '+c}
function setCloverText(selector,value){const el=$(selector);if(el)el.textContent=value}
function renderClover(d){
  if(!d||typeof d!=='object')throw Error('Clover returned an invalid response.');
  setCloverText('#dashboardSales',usd.format(d.netSales||0));
  setCloverText('#dashboardSalesNote',(d.merchant?.name||'Clover')+' • Net sales live');
  setCloverText('#dashboardTransactions',d.transactions||0);
  setCloverText('#dashboardTicket','Average ticket '+usd.format(d.averageTicket||0));
  setCloverText('#cloverGrossSales',usd.format(d.grossSales||0));
  setCloverText('#cloverNetSales',usd.format(d.netSales||0));
  setCloverText('#cloverFrontGateSales',usd.format(d.frontGateSales||0));
  setCloverText('#cloverKitchenSales',usd.format(d.kitchenSales||0));
  setCloverText('#cloverRefunds','Refunds '+usd.format(d.refunds||0));
  setCloverText('#cloverTransactions',d.transactions||0);
  setCloverText('#cloverOrders',(d.orderCount||0)+' Clover orders');
  setCloverText('#cloverAverageTicket',usd.format(d.averageTicket||0));
  setCloverText('#cloverMerchant',d.merchant?.name||'Adventure Sports');
  const rangeLabel=d.range?.label||d.date||'the selected range';
  setCloverText('#cloverSubtitle','Live Clover results for '+rangeLabel+' in Eastern Time.');
  const updated=new Date(d.updatedAt||Date.now());
  setCloverText('#cloverUpdated','Updated '+(Number.isNaN(updated.getTime())?'just now':updated.toLocaleTimeString()));
  badge('Live','ready');
  const notice=$('#cloverNotice');if(notice)notice.hidden=true;
}
async function loadClover(){
  if(!allowed('clover')||cloverLoading)return;
  cloverLoading=true;badge('Refreshing','loading');
  try{renderClover(await api(CLOVER+'?v='+Date.now()))}
  catch(e){
    badge('Connection issue','error');
    const notice=$('#cloverNotice');if(notice){notice.textContent=e?.message||'Clover could not be loaded.';notice.className='publish-notice error';notice.hidden=false}
  }finally{cloverLoading=false}
}

function adminTab(name){$$('.admin-tab').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===name));$$('.admin-panel').forEach(p=>p.classList.toggle('active',p.dataset.adminPanel===name));if(name==='owners')renderOwners();if(name==='permissions')renderPermissions();if(name==='audit')loadAudit()}
function manageableRoles(){return role()==='owner'?['owner','manager','grounds','kitchen']:['grounds','kitchen']}
function canManageUser(u){if(u.id===profile?.user?.id)return false;if(role()==='owner')return u.role!=='owner'||teamUsers.filter(x=>x.role==='owner'&&!x.disabled).length>1;return ['grounds','kitchen'].includes(u.role)}
function renderInviteRoles(){const roles=role()==='owner'?['manager','grounds','kitchen']:['grounds','kitchen'];$('#inviteRole').innerHTML=roles.map(r=>`<option value="${r}">${ROLE_LABELS[r]}</option>`).join('')}
async function loadUsers(){if(!allowed('users'))return;renderInviteRoles();try{const d=await api(USERS);teamUsers=d.users||[];renderUsers();if(role()==='owner'){renderOwners();renderPromoteOptions()}}catch(e){$('#usersList').innerHTML=`<div class="dashboard-empty error-text">${esc(e.message)}</div>`}}
function renderUsers(){
  const q=($('#usersSearch').value||'').trim().toLowerCase();
  const list=teamUsers.filter(u=>!q||`${u.name} ${u.email} ${u.role} ${u.status}`.toLowerCase().includes(q));
  $('#usersSummary').textContent=`${teamUsers.length} account${teamUsers.length===1?'':'s'} • ${list.length} shown`;
  $('#usersList').innerHTML=list.length?list.map(u=>{
    const can=canManageUser(u),status=u.disabled?'Disabled':u.confirmed?'Active':'Invitation pending';
    const choices=manageableRoles().filter(r=>role()==='owner'||r!=='owner');
    return `<article class="user-row ${u.disabled?'disabled-user':''}">
      <div class="user-avatar">${esc((u.name||u.email||'?')[0].toUpperCase())}</div>
      <div class="user-info"><b>${esc(u.name||'Team Member')}</b><span>${esc(u.email)}</span><small>${esc(status)}${u.lastSignIn?' • Last login '+esc(new Date(u.lastSignIn).toLocaleString()):''}</small></div>
      <div class="user-role-control">${can?`<select data-user-role="${esc(u.id)}">${choices.map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${ROLE_LABELS[r]}</option>`).join('')}</select>`:`<span class="role-badge" data-role="${esc(u.role)}">${esc(ROLE_LABELS[u.role]||'Unassigned')}</span>`}</div>
      <div class="user-actions"><button class="secondary-btn" data-profile="${esc(u.id)}">Manage</button>${can?`<button class="secondary-btn" data-user-save="${esc(u.id)}">Save Role</button>`:'<span class="protected-account">Protected</span>'}</div>
    </article>`;
  }).join(''):'<div class="dashboard-empty">No matching team members.</div>';
  $$('[data-user-save]').forEach(b=>b.onclick=()=>changeRole(b.dataset.userSave));
  $$('[data-profile]').forEach(b=>b.onclick=()=>openProfile(b.dataset.profile));
}
function renderOwners(){
  const owners=teamUsers.filter(u=>u.role==='owner');
  $('#ownersList').innerHTML=owners.length?owners.map(u=>`<article class="owner-card"><div class="user-avatar">👑</div><div><b>${esc(u.name)}</b><span>${esc(u.email)}</span><small>${u.disabled?'Disabled':'Active'}${u.lastSignIn?' • Last login '+esc(new Date(u.lastSignIn).toLocaleString()):''}</small></div><div>${u.id===profile.user.id?'<span class="protected-account">You</span>':owners.filter(x=>!x.disabled).length>1?`<button class="user-terminate-btn" data-demote-owner="${esc(u.id)}">Demote</button>`:'<span class="protected-account">Last Owner</span>'}</div></article>`).join(''):'<div class="dashboard-empty">No owners found.</div>';
  $$('[data-demote-owner]').forEach(b=>b.onclick=()=>demoteOwner(b.dataset.demoteOwner));
}
function renderPromoteOptions(){const candidates=teamUsers.filter(u=>u.role!=='owner'&&!u.disabled);$('#promoteOwnerUser').innerHTML=candidates.length?candidates.map(u=>`<option value="${esc(u.id)}">${esc(u.name)} — ${esc(ROLE_LABELS[u.role]||'Unassigned')}</option>`).join(''):'<option value="">No eligible users</option>'}
async function inviteEmployee(e){e.preventDefault();const b=$('#inviteUserButton');b.disabled=true;b.textContent='Sending…';try{await api(USERS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',name:$('#inviteName').value.trim(),email:$('#inviteEmail').value.trim(),role:$('#inviteRole').value,phone:$('#invitePhone').value.trim(),hireDate:$('#inviteHireDate').value})});noticeUsers('Invitation sent.');closeModal('#inviteModal');e.target.reset();await loadUsers()}catch(err){noticeUsers(err.message,'error')}finally{b.disabled=false;b.textContent='Send Invitation'}}
async function inviteOwner(e){e.preventDefault();try{await api(USERS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'invite',name:$('#inviteOwnerName').value.trim(),email:$('#inviteOwnerEmail').value.trim(),role:'owner'})});noticeUsers('Owner invitation sent.');e.target.reset();await loadUsers()}catch(err){noticeUsers(err.message,'error')}}
async function promoteOwner(e){e.preventDefault();const id=$('#promoteOwnerUser').value;if(!id)return;const u=teamUsers.find(x=>x.id===id);if(!confirm(`Promote ${u?.name||u?.email} to Owner?`))return;await userAction({action:'set-role',userId:id,role:'owner'},'User promoted to Owner.')}
async function demoteOwner(id){const owners=teamUsers.filter(u=>u.role==='owner'&&!u.disabled);if(owners.length<=1)return noticeUsers('The last active Owner cannot be demoted.','error');const u=teamUsers.find(x=>x.id===id);if(!confirm(`Demote ${u?.name||u?.email} to Manager?`))return;await userAction({action:'set-role',userId:id,role:'manager'},'Owner demoted to Manager.')}
async function changeRole(id){const sel=$(`[data-user-role="${CSS.escape(id)}"]`),u=teamUsers.find(x=>x.id===id);if(!sel||!u)return;if(!confirm(`Change ${u.name||u.email} to ${ROLE_LABELS[sel.value]}?`))return;await userAction({action:'set-role',userId:id,role:sel.value},'Role updated.')}
async function userAction(payload,message){try{await api(USERS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});noticeUsers(message);await loadUsers()}catch(e){noticeUsers(e.message,'error')}}
function openModal(sel){$(sel).hidden=false;document.body.classList.add('modal-open')}
function closeModal(sel){$(sel).hidden=true;document.body.classList.remove('modal-open')}
function openProfile(id){
  const u=teamUsers.find(x=>x.id===id);if(!u)return;selectedProfileUser=u;
  $('#profileUserId').value=u.id;$('#profileModalTitle').textContent=u.name||u.email;$('#profileName').value=u.name||'';$('#profileEmail').value=u.email||'';
  $('#profilePhone').value=u.profile?.phone||'';$('#profileHireDate').value=u.profile?.hireDate||'';$('#profileEmergencyContact').value=u.profile?.emergencyContact||'';
  $('#profileEmergencyPhone').value=u.profile?.emergencyPhone||'';$('#profileNotes').value=u.profile?.notes||'';
  $('#toggleDisabledButton').textContent=u.disabled?'Re-enable Account':'Disable Account';
  const can=canManageUser(u);$('#toggleDisabledButton').hidden=!can;$('#terminateFromProfile').hidden=!can;$('#sendRecoveryButton').hidden=!(role()==='owner'||['grounds','kitchen'].includes(u.role));
  openModal('#profileModal');
}
async function saveProfile(e){e.preventDefault();try{await api(USERS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'update-profile',userId:$('#profileUserId').value,profile:{name:$('#profileName').value.trim(),phone:$('#profilePhone').value.trim(),hireDate:$('#profileHireDate').value,emergencyContact:$('#profileEmergencyContact').value.trim(),emergencyPhone:$('#profileEmergencyPhone').value.trim(),notes:$('#profileNotes').value.trim()}})});noticeUsers('Profile updated.');closeModal('#profileModal');await loadUsers()}catch(e){noticeUsers(e.message,'error')}}
async function toggleDisabled(){if(!selectedProfileUser)return;const action=selectedProfileUser.disabled?'enable':'disable';if(!confirm(`${action==='disable'?'Disable':'Re-enable'} ${selectedProfileUser.name||selectedProfileUser.email}?`))return;await userAction({action,userId:selectedProfileUser.id},`Account ${action==='disable'?'disabled':'re-enabled'}.`);closeModal('#profileModal')}
async function terminateSelected(){if(!selectedProfileUser)return;if(prompt(`Type TERMINATE to permanently remove ${selectedProfileUser.email}.`)!=='TERMINATE')return;await userAction({action:'terminate',userId:selectedProfileUser.id},'Account terminated.');closeModal('#profileModal')}
async function sendRecovery(){if(!selectedProfileUser)return;try{await api(USERS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'send-recovery',userId:selectedProfileUser.id})});noticeUsers('Password reset email sent.')}catch(e){noticeUsers(e.message,'error')}}
function renderPermissions(){
  const roles=['owner','manager','grounds','kitchen','cashier'];
  $('#permissionMatrix').innerHTML=`<table class="permission-table"><thead><tr><th>Module</th>${roles.map(r=>`<th>${ROLE_LABELS[r]}</th>`).join('')}</tr></thead><tbody>${MODULES.map(([key,label])=>`<tr><td><b>${label}</b><small>${key}</small></td>${roles.map(r=>`<td><input type="checkbox" data-perm-role="${r}" data-perm-module="${key}" ${(permissions[r]||[]).includes(key)?'checked':''} ${r==='owner'?'disabled':''}></td>`).join('')}</tr>`).join('')}</tbody></table>`;
}
async function savePermissions(){
  const next=structuredClone(permissions);
  ['manager','grounds','kitchen','cashier'].forEach(r=>{next[r]=$$(`[data-perm-role="${r}"]:checked`).map(x=>x.dataset.permModule)});
  next.owner=DEFAULT_PERMISSIONS.owner;
  try{const d=await api(PERMS,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({permissions:next})});permissions=d.permissions;applyPermissions();noticeUsers('Permissions saved.');toast('Permissions updated')}catch(e){noticeUsers(e.message,'error')}
}
async function loadAudit(){if(role()!=='owner')return;try{const d=await api(AUDIT);auditEntries=d.entries||[];renderAudit()}catch(e){$('#auditList').innerHTML=`<div class="dashboard-empty error-text">${esc(e.message)}</div>`}}
function renderAudit(){$('#auditList').innerHTML=auditEntries.length?auditEntries.map(x=>`<article class="audit-entry"><div class="audit-icon">${esc(x.icon||'•')}</div><div><b>${esc(x.actionLabel||x.action)}</b><p>${esc(x.summary||'')}</p><small>${esc(x.actorName||x.actorEmail||'System')} • ${esc(new Date(x.createdAt).toLocaleString())}</small></div></article>`).join(''):'<div class="dashboard-empty">No recorded account changes yet.</div>'}


let maintenanceTimer=null,maintenanceSettings={};
function renderMaintenanceState(st={}){maintenanceSettings=st||{};const lock=$('#maintenanceLockScreen');if(!lock)return;const active=!!st.maintenance_mode;lock.hidden=!active;document.body.classList.toggle('maintenance-locked',active);if(!active){clearInterval(maintenanceTimer);return}$('#maintenanceLockMessage').textContent=st.maintenance_message||'The system is temporarily unavailable while maintenance is completed.';$('#maintenanceLockReason').textContent=st.maintenance_reason||'System maintenance';$('#maintenanceLockStarted').textContent=st.maintenance_started_at?new Date(st.maintenance_started_at).toLocaleString():'Recently';$('#maintenanceLockEnd').textContent=st.maintenance_expected_end?new Date(st.maintenance_expected_end).toLocaleString():'To be announced';$('#maintenanceResume').hidden=role()!=='owner';const update=()=>{const start=new Date(st.maintenance_started_at||Date.now()).getTime(),end=new Date(st.maintenance_expected_end||0).getTime(),now=Date.now();if(end>start){const pct=Math.max(2,Math.min(100,((now-start)/(end-start))*100));$('#maintenanceProgressBar').style.width=pct+'%';const left=end-now;if(left>0){const mins=Math.ceil(left/60000);$('#maintenanceCountdown').textContent=mins>60?`${Math.floor(mins/60)} hr ${mins%60} min remaining`:`${mins} minute${mins===1?'':'s'} remaining`;$('#maintenanceProgressText').textContent=`Estimated progress: ${Math.round(pct)}%` }else{$('#maintenanceCountdown').textContent='Expected finish time reached';$('#maintenanceProgressText').textContent='An Owner will resume operations when work is complete.'}}else{$('#maintenanceProgressBar').style.width='18%';$('#maintenanceCountdown').textContent='Completion time not set';$('#maintenanceProgressText').textContent='Only Owners can resume operations.'}};update();clearInterval(maintenanceTimer);maintenanceTimer=setInterval(update,30000)}
async function loadSecurityProfile(){if(role()!=='owner')return;const note=$('#securityProfileNotice');try{const d=await api('/.netlify/functions/security-control');const st=d.settings||{},cfg=d.configuration||{};renderMaintenanceState(st);$('#securityMfaState').textContent='Email required';$('#securityDbState').textContent=d.database?.ok?'Connected':'Check setup';$('#securityMaintenanceState').textContent=st.maintenance_mode?'ON':'Off';$('#securityBackupState').textContent=d.backups?.[0]?new Date(d.backups[0].created_at).toLocaleString():'None';$('#securityStatusBadge').textContent=Object.values(cfg).every(Boolean)&&d.database?.ok?'Protected':'Needs setup';$('#securityStatusBadge').className='connection-badge '+(Object.values(cfg).every(Boolean)&&d.database?.ok?'connected':'error');$('#securityMaintenance').textContent=st.maintenance_mode?'Resume Operations':'Configure Maintenance Mode';$('#securityMaintenance').dataset.enabled=st.maintenance_mode?'true':'false';$('#securityConfigList').innerHTML=Object.entries(cfg).map(([k,v])=>`<div class="security-event-row"><b>${esc(k)}</b><span>${v?'✅ Configured':'❌ Missing'}</span></div>`).join('');$('#securityEventsList').innerHTML=(d.events||[]).map(x=>`<div class="security-event-row"><div><b>${esc(x.event_type)}</b><small>${esc(x.email||'System')} • ${new Date(x.created_at).toLocaleString()}</small></div><span>${x.outcome==='success'?'✅':'⚠️'}</span></div>`).join('')||'<p>No security events yet.</p>';$('#securityBackupsList').innerHTML=(d.backups||[]).map(x=>`<div class="security-event-row"><div><b>${esc(x.label||'Security backup')}</b><small>${x.row_count} rows • ${new Date(x.created_at).toLocaleString()}</small></div><button class="secondary-btn compact-btn" data-download-backup="${x.id}">Download</button></div>`).join('')||'<p>No backups yet.</p>';$$('[data-download-backup]').forEach(b=>b.onclick=()=>downloadSecurityBackup(b.dataset.downloadBackup))}catch(e){$('#securityStatusBadge').textContent='Check setup';$('#securityStatusBadge').className='connection-badge error';note.hidden=false;note.className='publish-notice error';note.textContent=e.message}}
async function securityAction(action,payload={}){return api('/.netlify/functions/security-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})})}
async function createSecurityBackup(){const note=$('#securityProfileNotice');note.hidden=false;note.className='publish-notice';note.textContent='Creating database backup…';try{const d=await securityAction('backup',{label:'Manual V8 security backup'});note.textContent=`Backup created: ${d.backup?.row_count||0} rows protected.`;await loadSecurityProfile()}catch(e){note.className='publish-notice error';note.textContent=e.message}}
async function toggleMaintenance(){const active=$('#securityMaintenance').dataset.enabled==='true';if(active){if(!confirm('Resume normal Operations Hub access now?'))return;await securityAction('maintenance',{enabled:false});renderMaintenanceState({maintenance_mode:false});toast('Operations resumed');await loadSecurityProfile();return}openMaintenanceSetup()}
function openMaintenanceSetup(){const d=new Date(Date.now()+30*60000),pad=n=>String(n).padStart(2,'0');$('#maintenanceExpectedEnd').value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;$('#maintenanceSetupModal').hidden=false;document.body.classList.add('modal-open')}
function closeMaintenanceSetup(){$('#maintenanceSetupModal').hidden=true;document.body.classList.remove('modal-open')}
async function submitMaintenanceSetup(e){e.preventDefault();const reason=$('#maintenanceReason').value,message=$('#maintenanceMessage').value.trim(),expectedEnd=$('#maintenanceExpectedEnd').value;await securityAction('maintenance',{enabled:true,reason,message,expectedEnd});closeMaintenanceSetup();toast('Maintenance mode enabled');await loadSecurityProfile()}
async function resumeOperations(){if(role()!=='owner')return;await securityAction('maintenance',{enabled:false});renderMaintenanceState({maintenance_mode:false});toast('Operations resumed');await loadSecurityProfile()}
async function panicLock(){if(prompt('This revokes every active Owner security session. Type PANIC LOCK to continue.')!=='PANIC LOCK')return;await securityAction('panic-lock',{confirmation:'PANIC LOCK'});sessionStorage.removeItem('ase_stepup_token');stepupToken='';toast('All Owner security sessions revoked');location.reload()}
async function downloadSecurityBackup(id){const d=await securityAction('download-backup',{id});const blob=new Blob([JSON.stringify(d.backup,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`adventure-security-backup-${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

$$('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$$('.admin-tab').forEach(b=>b.onclick=()=>adminTab(b.dataset.adminTab));
const menuBackdrop=document.createElement('button');menuBackdrop.type='button';menuBackdrop.className='menu-backdrop';menuBackdrop.setAttribute('aria-label','Close menu');document.body.appendChild(menuBackdrop);
$('#menuButton').onclick=()=>sidebar.classList.contains('open')?closeMenu():openMenu();menuBackdrop.onclick=closeMenu;
document.querySelector('.main-area')?.addEventListener('click',e=>{if(sidebar.classList.contains('open')&&!e.target.closest('#menuButton'))closeMenu()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
document.addEventListener('gesturestart',e=>e.preventDefault(),{passive:false});
document.addEventListener('gesturechange',e=>e.preventDefault(),{passive:false});
document.addEventListener('gestureend',e=>e.preventDefault(),{passive:false});

// V7.4 mobile edge-swipe drawer. It waits for a clearly horizontal gesture so
// field tables, vertical scrolling, text inputs, maps, and drag controls keep working.
(function installMobileDrawerGestures(){
  const coarse=()=>window.matchMedia('(max-width: 860px)').matches;
  const width=()=>Math.min(318,Math.max(260,sidebar.getBoundingClientRect().width||300));
  let tracking=false,dragging=false,startX=0,startY=0,lastX=0,startedOpen=false,pointerId=null;
  const blocked=t=>!!t.closest('input,textarea,select,[contenteditable="true"],.leaflet-container,[data-no-drawer-swipe]');
  function begin(e){
    if(!coarse()||blocked(e.target)||e.pointerType==='mouse'&&e.button!==0)return;
    startedOpen=sidebar.classList.contains('open');
    if(!startedOpen&&e.clientX>28)return;
    tracking=true;dragging=false;startX=lastX=e.clientX;startY=e.clientY;pointerId=e.pointerId;
  }
  function move(e){
    if(!tracking||e.pointerId!==pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;lastX=e.clientX;
    if(!dragging){
      if(Math.abs(dx)<9&&Math.abs(dy)<9)return;
      if(Math.abs(dy)>Math.abs(dx)*1.15){tracking=false;return;}
      dragging=true;sidebar.classList.add('dragging');document.body.classList.add('menu-dragging');
      try{document.body.setPointerCapture?.(e.pointerId)}catch{}
    }
    e.preventDefault();
    const w=width();
    const translated=startedOpen?Math.min(0,Math.max(-w,dx)):Math.min(0,Math.max(-w,-w+dx));
    const progress=Math.max(0,Math.min(1,(translated+w)/w));
    sidebar.style.setProperty('--drawer-x',translated+'px');
    document.body.style.setProperty('--menu-progress',String(progress));
  }
  function finish(e){
    if(!tracking&& !dragging)return;
    const dx=lastX-startX,w=width();
    const shouldOpen=dragging?(startedOpen?dx>-w*.32:dx>w*.32):startedOpen;
    tracking=false;dragging=false;pointerId=null;document.body.classList.remove('menu-dragging');
    resetMenuDrag();shouldOpen?openMenu():closeMenu();
  }
  document.addEventListener('pointerdown',begin,{passive:true});
  document.addEventListener('pointermove',move,{passive:false});
  document.addEventListener('pointerup',finish,{passive:true});
  document.addEventListener('pointercancel',finish,{passive:true});
  window.addEventListener('resize',()=>{if(!coarse())closeMenu()});
})();
$('#loginForm').onsubmit=login;$('#logoutButton').onclick=logout;$('#settingsLogout').onclick=logout;
$('#sendEmailCode').onclick=()=>sendSecurityCode();$('#securityCodeForm').onsubmit=verifySecurityCode;$('#securityResend').onclick=()=>sendSecurityCode();$('#securityRefresh').onclick=loadSecurityProfile;$('#securityBackup').onclick=createSecurityBackup;$('#securityMaintenance').onclick=toggleMaintenance;$('#securityPanic').onclick=panicLock;$('#maintenanceSetupForm').onsubmit=submitMaintenanceSetup;$$('[data-maintenance-setup-close]').forEach(x=>x.onclick=closeMaintenanceSetup);$('#maintenanceResume').onclick=resumeOperations;$('#maintenanceLockLogout').onclick=logout;
$('#quickControlsForm').onsubmit=publish;$('#resetControlsButton').onclick=loadSite;$('#refreshClover').onclick=loadClover;
$$('input[name="fieldStatus"]').forEach(x=>x.onchange=updatePreview);$('#announcementInput').oninput=updatePreview;
$('#usersRefresh').onclick=loadUsers;$('#usersSearch').oninput=renderUsers;$('#openInviteModal').onclick=()=>openModal('#inviteModal');$('#closeInviteModal').onclick=()=>closeModal('#inviteModal');
$('#closeProfileModal').onclick=()=>closeModal('#profileModal');$('#inviteUserForm').onsubmit=inviteEmployee;$('#inviteOwnerForm').onsubmit=inviteOwner;$('#promoteOwnerForm').onsubmit=promoteOwner;
$('#profileForm').onsubmit=saveProfile;$('#toggleDisabledButton').onclick=toggleDisabled;$('#terminateFromProfile').onclick=terminateSelected;$('#sendRecoveryButton').onclick=sendRecovery;
$('#savePermissions').onclick=savePermissions;$('#refreshAudit').onclick=loadAudit;
$$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal('#'+m.id)}));
ensureFreshBuild().then(ok=>{if(ok)restore()});
})();
