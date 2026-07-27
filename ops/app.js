(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app'),gate=$('#loginGate'),sidebar=$('#sidebar');
const AUTH_KEY='ase_ops_identity_session_v2';
const IDENTITY='/.netlify/identity';
const PROFILE='/.netlify/functions/auth-profile';
const USERS='/.netlify/functions/user-management';
const LIVE='/.netlify/functions/live-content?file=site';
const PUBLISH='/.netlify/functions/publish-content';
const CLOVER='/.netlify/functions/clover-dashboard';

const ROLE_LABELS={owner:'Owner',manager:'Manager',grounds:'Grounds Crew',kitchen:'Kitchen'};
const PERMISSIONS={
  owner:['dashboard','website','clover','staff','games','maintenance','weather','reports','kitchen','users','settings'],
  manager:['dashboard','clover','staff','games','maintenance','weather','reports','kitchen','users'],
  grounds:['maintenance','weather'],
  kitchen:['kitchen','weather']
};

let session=null,profile=null,siteData=null,originalStatus='',originalAnnouncement='';
let publishing=false,cloverLoading=false,timer=null,teamUsers=[];

const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function firstName(u){
  const m=u?.user_metadata||{},raw=m.full_name||m.name||m.display_name||'';
  return raw.trim()?raw.trim().split(/\s+/)[0]:(u?.email?u.email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'Team Member');
}
function fullName(u){
  const m=u?.user_metadata||{};
  return (m.full_name||m.name||m.display_name||'').trim()||u?.email?.split('@')[0]||'Team Member';
}
function greet(){const h=new Date().getHours();return h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'}
function role(){return profile?.role||'unassigned'}
function allowed(view){return (PERMISSIONS[role()]||[]).includes(view)}
function defaultView(){return PERMISSIONS[role()]?.[0]||null}
function token(){return session?.token?.access_token||''}
function authHeaders(extra={}){return {Authorization:'Bearer '+token(),...extra}}

function renderUser(u){
  const n=firstName(u),r=ROLE_LABELS[role()]||'Access Not Assigned';
  $('#greeting').textContent=greet();
  $('#userName').textContent=n;
  $('#sidebarUserName').textContent=fullName(u);
  $('#sidebarRoleName').textContent=r;
  $('#accountEmail').textContent=u?.email||'Team member';
  $('#publisherEmail').textContent=u?.email||'Team member';
  $('#settingsRoleBadge').textContent=r;
  $('#settingsRoleBadge').dataset.role=role();
  $$('.avatar').forEach(x=>x.textContent=n[0].toUpperCase());
}
function applyPermissions(){
  $$('.nav-item').forEach(button=>{
    button.hidden=!allowed(button.dataset.view);
  });
  $$('.view').forEach(view=>{
    view.dataset.authorized=allowed(view.dataset.viewPanel)?'true':'false';
  });
  $$('[data-go]').forEach(button=>{
    const v=button.dataset.go;
    button.hidden=!allowed(v);
  });
  // Grounds and kitchen should not see Clover metrics inside any shared content.
  document.body.dataset.role=role();
}
function save(tokenData,userData){
  session={token:tokenData,user:userData};
  localStorage.setItem(AUTH_KEY,JSON.stringify(session));
}
function clear(){
  session=null;profile=null;
  localStorage.removeItem(AUTH_KEY);
}
function read(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{return null}}
async function identityUser(accessToken){
  const r=await fetch(IDENTITY+'/user',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});
  if(!r.ok)throw Error('Your login session could not be verified.');
  return r.json();
}
async function loadProfile(){
  const r=await fetch(PROFILE,{headers:authHeaders(),cache:'no-store'});
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw Error(d.error||'Your role could not be verified.');
  profile=d;
  return d;
}
async function refresh(s){
  if(!s?.token?.refresh_token)return null;
  const r=await fetch(IDENTITY+'/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'refresh_token',refresh_token:s.token.refresh_token})
  });
  if(!r.ok)return null;
  const t=await r.json(),u=await identityUser(t.access_token);
  save(t,u);
  return session;
}
async function ensure(){
  if(session?.token?.access_token)return session;
  const s=read();if(!s)return null;
  try{const u=await identityUser(s.token.access_token);save(s.token,u);return session}
  catch{return refresh(s)}
}
function showGate(message='Enter the email and password from your invitation.'){
  app.hidden=true;gate.hidden=false;
  if(timer)clearInterval(timer);
  $('#loginStatus').textContent=message;
}
function unauthorized(message){
  clear();
  showGate(message||'Your account does not have an assigned Adventure Sports role. Ask an owner or manager for access.');
  $('#loginStatus').className='login-status error';
}
async function show(u){
  try{
    await loadProfile();
    if(!ROLE_LABELS[role()])return unauthorized('Your account is active, but no app role has been assigned. Ask an owner or manager to assign Grounds or Kitchen access.');
    gate.hidden=true;app.hidden=false;
    renderUser(u);applyPermissions();
    const requested=location.hash.replace('#','');
    go(allowed(requested)?requested:defaultView());
    if(allowed('website'))loadSite();
    if(allowed('clover')){
      loadClover();
      timer=setInterval(loadClover,60000);
    }
    if(allowed('users'))loadUsers();
  }catch(error){unauthorized(error.message)}
}
async function restore(){
  showGate();
  const s=read();if(!s?.token)return;
  try{
    const u=await identityUser(s.token.access_token);
    save(s.token,u);await show(u);
  }catch{
    const f=await refresh(s).catch(()=>null);
    if(f)await show(f.user);else clear();
  }
}
async function login(e){
  e.preventDefault();
  const b=$('#loginButton');
  b.disabled=true;b.textContent='Signing In…';
  try{
    const r=await fetch(IDENTITY+'/token',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({grant_type:'password',username:$('#loginEmail').value.trim(),password:$('#loginPassword').value})
    });
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error_description||'The email or password is incorrect.');
    const u=await identityUser(d.access_token);
    save(d,u);
    $('#loginStatus').className='login-status';
    await show(u);
  }catch(err){
    $('#loginStatus').textContent=err.message;
    $('#loginStatus').className='login-status error';
  }finally{
    b.disabled=false;b.textContent='Sign In';
  }
}
function logout(){clear();showGate();$('#loginPassword').value=''}
function go(v){
  if(!v||!allowed(v))v=defaultView();
  if(!v)return unauthorized();
  $$('.view').forEach(x=>x.classList.toggle('active',x.dataset.viewPanel===v));
  $$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===v));
  sidebar.classList.remove('open');
  history.replaceState(null,'','#'+v);
  if(v==='clover')loadClover();
  if(v==='users')loadUsers();
}

async function loadSite(){
  if(!allowed('website'))return;
  try{
    let r=await fetch(LIVE+'&v='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw Error();
    siteData=await r.json();
  }catch{
    const r=await fetch('/content/site.json?ops='+Date.now(),{cache:'no-store'});
    siteData=await r.json();
  }
  originalStatus=siteData.fieldStatus||'OPEN';
  originalAnnouncement=siteData.announcement||'';
  const radio=$(`input[name="fieldStatus"][value="${CSS.escape(originalStatus)}"]`)||$('input[value="OPEN"]');
  if(radio)radio.checked=true;
  $('#announcementInput').value=originalAnnouncement;
  $('#currentLiveStatus').textContent=originalStatus;
  $('#lastLoadedTime').textContent=new Date().toLocaleString();
  updatePreview();
  $('#facilityStatus').textContent=originalStatus;
  $('#dashboardLiveDot').dataset.status=originalStatus.toLowerCase().replace(/\s+/g,'-');
  $('#editorState').textContent='Live';
  $('#editorState').className='connection-badge ready';
}
function current(){return $('input[name="fieldStatus"]:checked')?.value||'OPEN'}
function dirty(){return current()!==originalStatus||$('#announcementInput').value.trim()!==originalAnnouncement.trim()}
function updatePreview(){
  if(!$('#previewStatus'))return;
  const s=current(),a=$('#announcementInput').value.trim()||'No announcement is currently posted.',k=s.toLowerCase().replace(/\s+/g,'-');
  $('#previewStatus').textContent=s;$('#previewAnnouncement').textContent=a;$('#previewDot').dataset.status=k;
  $('#announcementCount').textContent=$('#announcementInput').value.length+' / 240';
  $('#changeState').textContent=dirty()?'Ready to publish':'None';
  $('#publishControlsButton').disabled=!dirty()||publishing;
  $('#resetControlsButton').disabled=!dirty()||publishing;
}
async function publish(e){
  e.preventDefault();
  if(role()!=='owner')return toast('Only an Owner can publish website changes.');
  const s=await ensure();if(!s)return;
  publishing=true;updatePreview();
  const button=$('#publishControlsButton');
  if(button){button.disabled=true;button.textContent='Publishing…'}
  try{
    const r=await fetch(PUBLISH,{
      method:'POST',
      headers:authHeaders({'Content-Type':'application/json','Accept':'application/json'}),
      body:JSON.stringify({fieldStatus:current(),announcement:$('#announcementInput').value.trim()})
    });
    const raw=await r.text();let d={};
    if(raw){try{d=JSON.parse(raw)}catch{d={error:raw.slice(0,300)}}}
    if(!r.ok)throw Error(d.error||d.message||`Publishing failed (${r.status}).`);
    if(!d.site)throw Error('The website updated, but the server did not return the updated site data.');
    siteData=d.site;originalStatus=siteData.fieldStatus;originalAnnouncement=siteData.announcement;
    $('#publishNotice').textContent='Website status updated successfully.';
    $('#publishNotice').className='publish-notice success';$('#publishNotice').hidden=false;
    await loadSite();
  }catch(err){
    $('#publishNotice').textContent=err.message||'The website could not be updated.';
    $('#publishNotice').className='publish-notice error';$('#publishNotice').hidden=false;
  }finally{
    publishing=false;if(button)button.textContent='Publish Changes';updatePreview();
  }
}

function badge(t,c){if(!$('#cloverConnection'))return;$('#cloverConnection').textContent=t;$('#cloverConnection').className='connection-badge '+c}
function listOrders(a){$('#recentOrdersBody').innerHTML=a.length?a.map(o=>`<tr><td>${new Date(o.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</td><td><span class="order-id">…${esc(String(o.id||'').slice(-6).toUpperCase())}</span></td><td>${esc(o.employee||'—')}</td><td class="money-cell">${usd.format(o.total||0)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-row">No Clover orders have posted today yet.</td></tr>'}
function topItems(a){$('#topItemsList').innerHTML=a.length?a.map((i,n)=>`<li><span class="rank-number">${n+1}</span><div><b>${esc(i.name)}</b><small>Sold today</small></div><strong>${Number(i.quantity||0).toFixed(Number.isInteger(i.quantity)?0:1)}</strong></li>`).join(''):'<li class="empty-list">No item-level sales data has posted yet.</li>'}
function inventory(d){
  const c=$('#inventoryAlerts');
  if(!d.inventoryAvailable){c.innerHTML=`<div class="inventory-empty">${esc(d.inventoryMessage)}</div>`;return}
  c.innerHTML=d.inventoryAlerts.length?d.inventoryAlerts.map(i=>`<div class="inventory-item ${i.quantity<=5?'critical':i.quantity<=10?'low':'warning'}"><span class="stock-dot"></span><div><b>${esc(i.name)}</b><small>Quantity remaining</small></div><strong>${esc(i.quantity)}</strong></div>`).join(''):'<div class="inventory-good"><span>✓</span><div><b>No low-stock alerts</b><small>No tracked Clover items are at 20 or fewer.</small></div></div>';
}
function renderClover(d){
  $('#dashboardSales').textContent=usd.format(d.netSales||0);
  $('#dashboardSalesNote').textContent=(d.merchant?.name||'Clover')+' • Net sales live';
  $('#dashboardTransactions').textContent=d.transactions||0;
  $('#dashboardTicket').textContent='Average ticket '+usd.format(d.averageTicket||0);
  $('#cloverGrossSales').textContent=usd.format(d.grossSales||0);
  $('#cloverNetSales').textContent=usd.format(d.netSales||0);
  $('#cloverFrontGateSales').textContent=usd.format(d.frontGateSales||0);
  $('#cloverKitchenSales').textContent=usd.format(d.kitchenSales||0);
  $('#cloverRefunds').textContent='Refunds '+usd.format(d.refunds||0);
  $('#cloverTransactions').textContent=d.transactions||0;
  $('#cloverOrders').textContent=(d.orderCount||0)+' Clover orders';
  $('#cloverAverageTicket').textContent=usd.format(d.averageTicket||0);
  $('#cloverMerchant').textContent=d.merchant?.name||'Adventure Sports';
  $('#cloverSubtitle').textContent='Live Clover results for '+d.date+' in Eastern Time.';
  $('#cloverUpdated').textContent='Updated '+new Date(d.updatedAt).toLocaleTimeString();
  listOrders(d.recentOrders||[]);topItems(d.topItems||[]);inventory(d);
  badge('Live','ready');$('#cloverNotice').hidden=true;
}
function cloverError(e){
  badge('Connection issue','error');
  $('#cloverNotice').textContent=e.message;$('#cloverNotice').className='publish-notice error';$('#cloverNotice').hidden=false;
  $('#dashboardSales').textContent='Connection issue';$('#dashboardSalesNote').textContent=e.message;
}
async function loadClover(){
  if(!allowed('clover')||cloverLoading)return;
  const s=await ensure();if(!s)return;
  cloverLoading=true;badge('Refreshing','loading');$('#refreshClover').disabled=true;
  try{
    const r=await fetch(CLOVER+'?v='+Date.now(),{headers:authHeaders(),cache:'no-store'});
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error||`Clover request failed (${r.status}).`);
    renderClover(d);
  }catch(e){cloverError(e)}
  finally{cloverLoading=false;$('#refreshClover').disabled=false}
}

function manageableRoles(){
  return role()==='owner'?['owner','manager','grounds','kitchen']:['grounds','kitchen'];
}
function renderInviteRoles(){
  const select=$('#inviteRole');
  const roles=role()==='owner'?['manager','grounds','kitchen']:['grounds','kitchen'];
  select.innerHTML=roles.map(r=>`<option value="${r}">${ROLE_LABELS[r]}</option>`).join('');
  $('#roleRulesText').textContent=role()==='owner'
    ?'Owners can invite and manage Managers, Grounds Crew, and Kitchen accounts. Owner accounts remain protected from other users.'
    :'Managers can invite, change, and terminate Grounds Crew or Kitchen accounts only. Managers cannot manage Owners or other Managers.';
}
function noticeUsers(message,type='success'){
  const el=$('#usersNotice');el.textContent=message;el.className='publish-notice '+type;el.hidden=false;
}
async function loadUsers(){
  if(!allowed('users')||!token())return;
  renderInviteRoles();
  $('#usersList').innerHTML='<div class="dashboard-empty">Loading users…</div>';
  try{
    const r=await fetch(USERS,{headers:authHeaders(),cache:'no-store'});
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error||'Team members could not be loaded.');
    teamUsers=d.users||[];
    renderUsers();
  }catch(error){
    $('#usersList').innerHTML=`<div class="dashboard-empty error-text">${esc(error.message)}</div>`;
  }
}
function userCanManage(u){
  if(u.id===profile?.user?.id)return false;
  if(role()==='owner')return u.role!=='owner';
  return ['grounds','kitchen'].includes(u.role);
}
function renderUsers(){
  const q=($('#usersSearch').value||'').trim().toLowerCase();
  const list=teamUsers.filter(u=>!q||`${u.name} ${u.email} ${u.role}`.toLowerCase().includes(q));
  $('#usersSummary').textContent=`${teamUsers.length} account${teamUsers.length===1?'':'s'} • ${list.length} shown`;
  $('#usersList').innerHTML=list.length?list.map(u=>{
    const can=userCanManage(u);
    const roleChoices=manageableRoles().filter(r=>role()==='owner'||r!=='owner');
    return `<article class="user-row" data-user-id="${esc(u.id)}">
      <div class="user-avatar">${esc((u.name||u.email||'?')[0].toUpperCase())}</div>
      <div class="user-info"><b>${esc(u.name||'Team Member')}</b><span>${esc(u.email)}</span><small>${u.confirmed?'Active account':'Invitation pending'}${u.lastSignIn?' • Last login '+esc(new Date(u.lastSignIn).toLocaleString()):''}</small></div>
      <div class="user-role-control">
        ${can?`<select data-user-role="${esc(u.id)}">${roleChoices.map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${ROLE_LABELS[r]}</option>`).join('')}</select>`:`<span class="role-badge" data-role="${esc(u.role)}">${esc(ROLE_LABELS[u.role]||'Unassigned')}</span>`}
      </div>
      <div class="user-actions">
        ${can?`<button class="secondary-btn user-save-role" data-user-save="${esc(u.id)}" type="button">Save Role</button><button class="user-terminate-btn" data-user-delete="${esc(u.id)}" type="button">Terminate</button>`:'<span class="protected-account">Protected</span>'}
      </div>
    </article>`;
  }).join(''):'<div class="dashboard-empty">No matching team members.</div>';

  $$('[data-user-save]').forEach(b=>b.onclick=()=>changeUserRole(b.dataset.userSave));
  $$('[data-user-delete]').forEach(b=>b.onclick=()=>terminateUser(b.dataset.userDelete));
}
async function inviteUser(e){
  e.preventDefault();
  const button=$('#inviteUserButton');
  button.disabled=true;button.textContent='Sending…';
  try{
    const payload={
      action:'invite',
      name:$('#inviteName').value.trim(),
      email:$('#inviteEmail').value.trim(),
      role:$('#inviteRole').value
    };
    const r=await fetch(USERS,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)});
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error||'Invitation could not be sent.');
    noticeUsers(`Invitation sent to ${payload.email}.`);
    $('#inviteUserForm').reset();renderInviteRoles();await loadUsers();
  }catch(error){noticeUsers(error.message,'error')}
  finally{button.disabled=false;button.textContent='Send Invitation'}
}
async function changeUserRole(id){
  const select=$(`[data-user-role="${CSS.escape(id)}"]`);
  const selected=teamUsers.find(u=>u.id===id);
  if(!select||!selected)return;
  if(!confirm(`Change ${selected.name||selected.email} to ${ROLE_LABELS[select.value]}?`))return;
  try{
    const r=await fetch(USERS,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({action:'set-role',userId:id,role:select.value})});
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error||'Role could not be changed.');
    noticeUsers('Employee role updated.');await loadUsers();
  }catch(error){noticeUsers(error.message,'error')}
}
async function terminateUser(id){
  const selected=teamUsers.find(u=>u.id===id);if(!selected)return;
  if(!confirm(`Terminate ${selected.name||selected.email}? Their login will be permanently deleted.`))return;
  const typed=prompt(`Type TERMINATE to permanently remove ${selected.email}.`);
  if(typed!=='TERMINATE')return;
  try{
    const r=await fetch(USERS,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({action:'terminate',userId:id})});
    let d={};try{d=await r.json()}catch{}
    if(!r.ok)throw Error(d.error||'Account could not be terminated.');
    noticeUsers('Employee account terminated.');await loadUsers();
  }catch(error){noticeUsers(error.message,'error')}
}
function toast(message){
  const el=$('#toast');if(!el)return;
  el.textContent=message;el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2500);
}

$$('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.view));
$$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
$('#menuButton').onclick=()=>sidebar.classList.toggle('open');
$('#loginForm').onsubmit=login;
$('#logoutButton').onclick=logout;
$('#settingsLogout').onclick=logout;
$('#quickControlsForm').onsubmit=publish;
$('#resetControlsButton').onclick=loadSite;
$('#refreshClover').onclick=loadClover;
$$('input[name="fieldStatus"]').forEach(x=>x.onchange=updatePreview);
$('#announcementInput').oninput=updatePreview;
$('#inviteUserForm').onsubmit=inviteUser;
$('#usersRefresh').onclick=loadUsers;
$('#usersSearch').oninput=renderUsers;
restore();
})();
