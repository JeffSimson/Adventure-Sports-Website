(function(){'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app'),gate=$('#loginGate'),sidebar=$('#sidebar'),AUTH_KEY='ase_ops_identity_session_v1',IDENTITY='/.netlify/identity',LIVE='/.netlify/functions/live-content?file=site',PUBLISH='/.netlify/functions/publish-content',CLOVER='/.netlify/functions/clover-dashboard';
let session=null,siteData=null,originalStatus='',originalAnnouncement='',publishing=false,cloverLoading=false,timer=null;
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function name(u){const m=u?.user_metadata||{},raw=m.full_name||m.name||m.display_name||'';return raw.trim()?raw.trim().split(/\s+/)[0]:(u?.email?u.email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()):'Administrator')}
function greet(){const h=new Date().getHours();return h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'}
function renderUser(u){const n=name(u);$('#greeting').textContent=greet();$('#userName').textContent=n;$('#accountEmail').textContent=u?.email||'Administrator';$('#publisherEmail').textContent=u?.email||'Administrator';$$('.avatar').forEach(x=>x.textContent=n[0].toUpperCase())}
function save(token,user){session={token,user};localStorage.setItem(AUTH_KEY,JSON.stringify(session))}
function clear(){session=null;localStorage.removeItem(AUTH_KEY)}
function read(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{return null}}
async function user(token){const r=await fetch(IDENTITY+'/user',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!r.ok)throw Error('Your login session could not be verified.');return r.json()}
async function refresh(s){if(!s?.token?.refresh_token)return null;const r=await fetch(IDENTITY+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:s.token.refresh_token})});if(!r.ok)return null;const t=await r.json(),u=await user(t.access_token);save(t,u);return session}
async function ensure(){if(session?.token?.access_token)return session;const s=read();if(!s)return null;try{const u=await user(s.token.access_token);save(s.token,u);return session}catch{return refresh(s)}}
function show(u){gate.hidden=true;app.hidden=false;renderUser(u);loadSite();loadClover();timer=setInterval(loadClover,60000)}
function showGate(){app.hidden=true;gate.hidden=false;if(timer)clearInterval(timer)}
async function restore(){showGate();const s=read();if(!s?.token)return;try{const u=await user(s.token.access_token);save(s.token,u);show(u)}catch{const f=await refresh(s).catch(()=>null);if(f)show(f.user);else clear()}}
async function login(e){e.preventDefault();const b=$('#loginButton');b.disabled=true;b.textContent='Signing In…';try{const r=await fetch(IDENTITY+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',username:$('#loginEmail').value.trim(),password:$('#loginPassword').value})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error_description||'The email or password is incorrect.');const u=await user(d.access_token);save(d,u);show(u)}catch(err){$('#loginStatus').textContent=err.message;$('#loginStatus').className='login-status error'}finally{b.disabled=false;b.textContent='Sign In'}}
function logout(){clear();showGate();$('#loginPassword').value=''}
function go(v){$$('.view').forEach(x=>x.classList.toggle('active',x.dataset.viewPanel===v));$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===v));sidebar.classList.remove('open');history.replaceState(null,'','#'+v);if(v==='clover')loadClover()}

async function loadSite(){try{let r=await fetch(LIVE+'&v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error();siteData=await r.json()}catch{const r=await fetch('/content/site.json?ops='+Date.now(),{cache:'no-store'});siteData=await r.json()}originalStatus=siteData.fieldStatus||'OPEN';originalAnnouncement=siteData.announcement||'';const radio=$(`input[name="fieldStatus"][value="${CSS.escape(originalStatus)}"]`)||$('input[value="OPEN"]');if(radio)radio.checked=true;$('#announcementInput').value=originalAnnouncement;$('#currentLiveStatus').textContent=originalStatus;$('#lastLoadedTime').textContent=new Date().toLocaleString();updatePreview();$('#facilityStatus').textContent=originalStatus;$('#dashboardLiveDot').dataset.status=originalStatus.toLowerCase().replace(/\s+/g,'-');$('#editorState').textContent='Live';$('#editorState').className='connection-badge ready'}
function current(){return $('input[name="fieldStatus"]:checked')?.value||'OPEN'}
function dirty(){return current()!==originalStatus||$('#announcementInput').value.trim()!==originalAnnouncement.trim()}
function updatePreview(){const s=current(),a=$('#announcementInput').value.trim()||'No announcement is currently posted.',k=s.toLowerCase().replace(/\s+/g,'-');$('#previewStatus').textContent=s;$('#previewAnnouncement').textContent=a;$('#previewDot').dataset.status=k;$('#announcementCount').textContent=$('#announcementInput').value.length+' / 240';$('#changeState').textContent=dirty()?'Ready to publish':'None';$('#publishControlsButton').disabled=!dirty()||publishing;$('#resetControlsButton').disabled=!dirty()||publishing}
async function publish(e){e.preventDefault();const s=await ensure();if(!s)return;publishing=true;updatePreview();try{const r=await fetch(PUBLISH,{method:'POST',headers:{Authorization:'Bearer '+s.token.access_token,'Content-Type':'application/json'},body:JSON.stringify({fieldStatus:current(),announcement:$('#announcementInput').value.trim()})});const d=await r.json();if(!r.ok)throw Error(d.error||'Publishing failed.');siteData=d.site;originalStatus=siteData.fieldStatus;originalAnnouncement=siteData.announcement;$('#publishNotice').textContent='Website updated live.';$('#publishNotice').className='publish-notice success';$('#publishNotice').hidden=false;await loadSite()}catch(err){$('#publishNotice').textContent=err.message;$('#publishNotice').className='publish-notice error';$('#publishNotice').hidden=false}finally{publishing=false;updatePreview()}}

function badge(t,c){$('#cloverConnection').textContent=t;$('#cloverConnection').className='connection-badge '+c}
function listOrders(a){$('#recentOrdersBody').innerHTML=a.length?a.map(o=>`<tr><td>${new Date(o.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</td><td><span class="order-id">…${esc(String(o.id||'').slice(-6).toUpperCase())}</span></td><td>${esc(o.employee||'—')}</td><td class="money-cell">${usd.format(o.total||0)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty-row">No Clover orders have posted today yet.</td></tr>'}
function topItems(a){$('#topItemsList').innerHTML=a.length?a.map((i,n)=>`<li><span class="rank-number">${n+1}</span><div><b>${esc(i.name)}</b><small>Sold today</small></div><strong>${Number(i.quantity||0).toFixed(Number.isInteger(i.quantity)?0:1)}</strong></li>`).join(''):'<li class="empty-list">No item-level sales data has posted yet.</li>'}
function inventory(d){const c=$('#inventoryAlerts');if(!d.inventoryAvailable){c.innerHTML=`<div class="inventory-empty">${esc(d.inventoryMessage)}</div>`;return}c.innerHTML=d.inventoryAlerts.length?d.inventoryAlerts.map(i=>`<div class="inventory-item ${i.quantity<=5?'critical':i.quantity<=10?'low':'warning'}"><span class="stock-dot"></span><div><b>${esc(i.name)}</b><small>Quantity remaining</small></div><strong>${esc(i.quantity)}</strong></div>`).join(''):'<div class="inventory-good"><span>✓</span><div><b>No low-stock alerts</b><small>No tracked Clover items are at 20 or fewer.</small></div></div>'}
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
  listOrders(d.recentOrders||[]);
  topItems(d.topItems||[]);
  inventory(d);
  badge('Live','ready');
  $('#cloverNotice').hidden=true
}
function cloverError(e){badge('Connection issue','error');$('#cloverNotice').textContent=e.message;$('#cloverNotice').className='publish-notice error';$('#cloverNotice').hidden=false;$('#dashboardSales').textContent='Connection issue';$('#dashboardSalesNote').textContent=e.message}
async function loadClover(){if(cloverLoading)return;const s=await ensure();if(!s)return;cloverLoading=true;badge('Refreshing','loading');$('#refreshClover').disabled=true;try{const r=await fetch(CLOVER+'?v='+Date.now(),{headers:{Authorization:'Bearer '+s.token.access_token},cache:'no-store'});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||`Clover request failed (${r.status}).`);renderClover(d)}catch(e){cloverError(e)}finally{cloverLoading=false;$('#refreshClover').disabled=false}}

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
const initial=location.hash.replace('#','');
if(initial&&$(`[data-view-panel="${CSS.escape(initial)}"]`))go(initial);
restore();
})();