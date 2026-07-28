(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app'), gate=$('#loginGate'), sidebar=$('#sidebar');
const AUTH_KEY='ase_ops_identity_session_v2';
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
  owner:['dashboard','website','clover','staff','games','maintenance','weather','reports','kitchen','notifications','users','settings'],
  manager:['dashboard','clover','staff','games','maintenance','weather','reports','kitchen','notifications','users'],
  grounds:['maintenance','weather','notifications'],
  kitchen:['kitchen','weather','notifications'],
  cashier:['dashboard','notifications']
};
const MODULES=[
  ['dashboard','Dashboard'],['website','Website Control'],['clover','Clover'],['staff','Staffing'],
  ['games','Games'],['maintenance','Fields & Maintenance'],['weather','Weather Center'],
  ['reports','Reports'],['kitchen','Kitchen'],['notifications','Notifications'],['users','People & Permissions'],['settings','Settings']
];

let session=null,profile=null,permissions=structuredClone(DEFAULT_PERMISSIONS);
let siteData=null,originalStatus='',originalAnnouncement='',publishing=false,cloverLoading=false,timer=null;
let teamUsers=[],auditEntries=[],selectedProfileUser=null;

const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const token=()=>session?.token?.access_token||'';
const authHeaders=(extra={})=>({Authorization:'Bearer '+token(),...extra});
const role=()=>profile?.role||'unassigned';
window.ASE_OPS={api,role,toast,getProfile:()=>profile,getSession:()=>session};
const allowed=view=>(permissions[role()]||[]).includes(view);
const defaultView=()=>(permissions[role()]||[])[0]||null;
const fullName=u=>(u?.user_metadata?.full_name||u?.user_metadata?.name||u?.name||u?.email?.split('@')[0]||'Team Member').trim();
const firstName=u=>fullName(u).split(/\s+/)[0];
const greet=()=>{const h=new Date().getHours();return h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'};
function save(t,u){session={token:t,user:u};localStorage.setItem(AUTH_KEY,JSON.stringify(session))}
function clear(){session=null;profile=null;localStorage.removeItem(AUTH_KEY)}
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
function showGate(message='Enter the email and password from your invitation.'){app.hidden=true;gate.hidden=false;if(timer)clearInterval(timer);$('#loginStatus').textContent=message}
function unauthorized(message){clear();showGate(message||'Your account does not have an assigned Adventure Sports role.');$('#loginStatus').className='login-status error'}
function renderUser(u){
  const n=firstName(u),r=ROLE_LABELS[role()]||'Access Not Assigned';
  $('#greeting').textContent=greet();$('#userName').textContent=n;$('#sidebarUserName').textContent=fullName(u);
  $('#sidebarRoleName').textContent=r;$('#accountEmail').textContent=u?.email||'';$('#publisherEmail').textContent=u?.email||'';
  $('#settingsRoleBadge').textContent=r;$('#settingsRoleBadge').dataset.role=role();$$('.avatar').forEach(x=>x.textContent=n[0].toUpperCase());
}
function applyPermissions(){
  $$('.nav-item').forEach(b=>b.hidden=!allowed(b.dataset.view));
  $$('.view').forEach(v=>v.dataset.authorized=allowed(v.dataset.viewPanel)?'true':'false');
  $$('[data-go]').forEach(b=>b.hidden=!allowed(b.dataset.go));
  $$('.owner-only').forEach(el=>el.hidden=role()!=='owner');
  document.body.dataset.role=role();
}
async function loadProfile(){
  const d=await api(PROFILE);
  profile=d;
  try{const p=await api(PERMS);permissions=p.permissions||permissions}catch{}
  return d;
}
async function show(u){
  try{
    await loadProfile();
    if(!ROLE_LABELS[role()])return unauthorized('Your account is active, but no app role has been assigned.');
    gate.hidden=true;app.hidden=false;renderUser(u);applyPermissions();
    const requested=location.hash.replace('#','');go(allowed(requested)?requested:defaultView());
    if(allowed('website'))loadSite();
    if(allowed('clover')){loadClover();timer=setInterval(loadClover,60000)}
    if(allowed('users'))loadUsers();
  }catch(e){unauthorized(e.message)}
}
async function restore(){showGate();const s=read();if(!s?.token)return;try{const u=await identityUser(s.token.access_token);save(s.token,u);await show(u)}catch{const f=await refresh(s).catch(()=>null);if(f)await show(f.user);else clear()}}
async function login(e){e.preventDefault();const b=$('#loginButton');b.disabled=true;b.textContent='Signing In…';try{const r=await fetch(IDENTITY+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',username:$('#loginEmail').value.trim(),password:$('#loginPassword').value})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error_description||'The email or password is incorrect.');const u=await identityUser(d.access_token);save(d,u);$('#loginStatus').className='login-status';await show(u)}catch(err){$('#loginStatus').textContent=err.message;$('#loginStatus').className='login-status error'}finally{b.disabled=false;b.textContent='Sign In'}}
function logout(){clear();showGate();$('#loginPassword').value=''}
function go(v){if(!v||!allowed(v))v=defaultView();if(!v)return unauthorized();$$('.view').forEach(x=>x.classList.toggle('active',x.dataset.viewPanel===v));$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===v));sidebar.classList.remove('open');history.replaceState(null,'','#'+v);if(v==='clover')loadClover();if(v==='users')loadUsers()}

async function loadSite(){if(!allowed('website'))return;$('#editorState').textContent='Loading';$('#editorState').className='connection-badge loading';try{const r=await fetch(LIVE+'&v='+Date.now(),{cache:'no-store'});const raw=await r.text();if(!r.ok)throw Error((()=>{try{return JSON.parse(raw).error}catch{return 'Website status service unavailable.'}})());siteData=JSON.parse(raw)}catch(firstError){try{const r=await fetch('/content/site.json?ops='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('Local fallback not found.');siteData=await r.json()}catch{siteData={fieldStatus:'OPEN',announcement:''};toast(firstError.message||'Safe default loaded.')}}originalStatus=String(siteData.fieldStatus||'OPEN').toUpperCase();originalAnnouncement=siteData.announcement||'';const radio=$(`input[name="fieldStatus"][value="${CSS.escape(originalStatus)}"]`)||$('input[value="OPEN"]');if(radio)radio.checked=true;$('#announcementInput').value=originalAnnouncement;$('#currentLiveStatus').textContent=originalStatus;$('#lastLoadedTime').textContent=new Date().toLocaleString();updatePreview();$('#facilityStatus').textContent=originalStatus;$('#dashboardLiveDot').dataset.status=originalStatus.toLowerCase().replace(/\s+/g,'-');$('#editorState').textContent='Live';$('#editorState').className='connection-badge ready';const notice=$('#publishNotice');if(notice&&notice.textContent.trim()==='Not Found')notice.hidden=true}
function current(){return $('input[name="fieldStatus"]:checked')?.value||'OPEN'}
function dirty(){return current()!==originalStatus||$('#announcementInput').value.trim()!==originalAnnouncement.trim()}
function updatePreview(){if(!$('#previewStatus'))return;const s=current(),a=$('#announcementInput').value.trim()||'No announcement is currently posted.',k=s.toLowerCase().replace(/\s+/g,'-');$('#previewStatus').textContent=s;$('#previewAnnouncement').textContent=a;$('#previewDot').dataset.status=k;$('#announcementCount').textContent=$('#announcementInput').value.length+' / 240';$('#changeState').textContent=dirty()?'Ready to publish':'None';$('#publishControlsButton').disabled=!dirty()||publishing;$('#resetControlsButton').disabled=!dirty()||publishing}
async function publish(e){e.preventDefault();if(role()!=='owner')return toast('Only an Owner can publish website changes.');publishing=true;updatePreview();const b=$('#publishControlsButton');b.textContent='Publishing…';try{const d=await api(PUBLISH,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fieldStatus:current(),announcement:$('#announcementInput').value.trim()})});if(!d.site)throw Error('Updated, but no site data returned.');siteData=d.site;originalStatus=d.site.fieldStatus;originalAnnouncement=d.site.announcement;$('#publishNotice').textContent='Public website updated live.';$('#publishNotice').className='publish-notice success';$('#publishNotice').hidden=false;await loadSite()}catch(e){$('#publishNotice').textContent=e.message;$('#publishNotice').className='publish-notice error';$('#publishNotice').hidden=false}finally{publishing=false;b.textContent='Publish Changes';updatePreview()}}

function badge(t,c){if(!$('#cloverConnection'))return;$('#cloverConnection').textContent=t;$('#cloverConnection').className='connection-badge '+c}
function renderClover(d){$('#dashboardSales').textContent=usd.format(d.netSales||0);$('#dashboardSalesNote').textContent=(d.merchant?.name||'Clover')+' • Net sales live';$('#dashboardTransactions').textContent=d.transactions||0;$('#dashboardTicket').textContent='Average ticket '+usd.format(d.averageTicket||0);$('#cloverGrossSales').textContent=usd.format(d.grossSales||0);$('#cloverNetSales').textContent=usd.format(d.netSales||0);$('#cloverFrontGateSales').textContent=usd.format(d.frontGateSales||0);$('#cloverKitchenSales').textContent=usd.format(d.kitchenSales||0);$('#cloverRefunds').textContent='Refunds '+usd.format(d.refunds||0);$('#cloverTransactions').textContent=d.transactions||0;$('#cloverOrders').textContent=(d.orderCount||0)+' Clover orders';$('#cloverAverageTicket').textContent=usd.format(d.averageTicket||0);$('#cloverMerchant').textContent=d.merchant?.name||'Adventure Sports';$('#cloverSubtitle').textContent='Live Clover results for '+d.date+' in Eastern Time.';$('#cloverUpdated').textContent='Updated '+new Date(d.updatedAt).toLocaleTimeString();badge('Live','ready');$('#cloverNotice').hidden=true}
async function loadClover(){if(!allowed('clover')||cloverLoading)return;cloverLoading=true;badge('Refreshing','loading');try{renderClover(await api(CLOVER+'?v='+Date.now()))}catch(e){badge('Connection issue','error');$('#cloverNotice').textContent=e.message;$('#cloverNotice').hidden=false}finally{cloverLoading=false}}

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

$$('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.view));$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$$('.admin-tab').forEach(b=>b.onclick=()=>adminTab(b.dataset.adminTab));
$('#menuButton').onclick=()=>sidebar.classList.toggle('open');$('#loginForm').onsubmit=login;$('#logoutButton').onclick=logout;$('#settingsLogout').onclick=logout;
$('#quickControlsForm').onsubmit=publish;$('#resetControlsButton').onclick=loadSite;$('#refreshClover').onclick=loadClover;
$$('input[name="fieldStatus"]').forEach(x=>x.onchange=updatePreview);$('#announcementInput').oninput=updatePreview;
$('#usersRefresh').onclick=loadUsers;$('#usersSearch').oninput=renderUsers;$('#openInviteModal').onclick=()=>openModal('#inviteModal');$('#closeInviteModal').onclick=()=>closeModal('#inviteModal');
$('#closeProfileModal').onclick=()=>closeModal('#profileModal');$('#inviteUserForm').onsubmit=inviteEmployee;$('#inviteOwnerForm').onsubmit=inviteOwner;$('#promoteOwnerForm').onsubmit=promoteOwner;
$('#profileForm').onsubmit=saveProfile;$('#toggleDisabledButton').onclick=toggleDisabled;$('#terminateFromProfile').onclick=terminateSelected;$('#sendRecoveryButton').onclick=sendRecovery;
$('#savePermissions').onclick=savePermissions;$('#refreshAudit').onclick=loadAudit;
$$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)closeModal('#'+m.id)}));
restore();
})();
