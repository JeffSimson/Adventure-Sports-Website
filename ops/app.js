(function(){
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const app=$('#app'),gate=$('#loginGate'),sidebar=$('#sidebar'); let deferredPrompt=null;
  const AUTH_KEY='ase_ops_identity_session_v1';
  const IDENTITY_BASE='/.netlify/identity';

  function displayName(user){const m=(user&&user.user_metadata)||{};const raw=m.full_name||m.name||m.display_name||'';if(raw.trim())return raw.trim().split(/\s+/)[0];if(user&&user.email)return user.email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());return 'Administrator'}
  function greeting(){const h=new Date().getHours();return h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'}
  function renderUser(user){$('#greeting').textContent=greeting();$('#userName').textContent=displayName(user);$('#accountEmail').textContent=(user&&user.email)||'Signed-in administrator';$$('.avatar').forEach(x=>x.textContent=displayName(user).charAt(0).toUpperCase())}
  function showApp(user){gate.hidden=true;app.hidden=false;renderUser(user);loadWebsiteData()}
  function showGate(){app.hidden=true;gate.hidden=false}
  function setStatus(message,type=''){const el=$('#loginStatus');el.textContent=message;el.className='login-status'+(type?' '+type:'')}
  function saveSession(token,user){localStorage.setItem(AUTH_KEY,JSON.stringify({token,user,saved_at:Date.now()}))}
  function clearSession(){localStorage.removeItem(AUTH_KEY)}
  function readSession(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch{return null}}
  async function fetchUser(accessToken){const r=await fetch(IDENTITY_BASE+'/user',{headers:{Authorization:'Bearer '+accessToken},cache:'no-store'});if(!r.ok)throw new Error('Your login session could not be verified.');return r.json()}
  async function refreshSession(session){
    if(!session||!session.token||!session.token.refresh_token)return null;
    const body=new URLSearchParams({grant_type:'refresh_token',refresh_token:session.token.refresh_token});
    const r=await fetch(IDENTITY_BASE+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    if(!r.ok)return null;
    const token=await r.json();const user=await fetchUser(token.access_token);saveSession(token,user);return {token,user};
  }
  async function restoreSession(){
    showGate();const session=readSession();if(!session||!session.token){setStatus('Enter the email and password used for the website admin.');return}
    try{const user=await fetchUser(session.token.access_token);saveSession(session.token,user);showApp(user)}catch{try{const fresh=await refreshSession(session);if(fresh)showApp(fresh.user);else{clearSession();setStatus('Your session expired. Please sign in again.')}}catch{clearSession();setStatus('Your session expired. Please sign in again.')}}
  }
  async function login(email,password){
    const body=new URLSearchParams({grant_type:'password',username:email,password});
    const r=await fetch(IDENTITY_BASE+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok){const msg=data.error_description||data.msg||data.error||'The email or password is incorrect.';throw new Error(msg)}
    const user=await fetchUser(data.access_token);saveSession(data,user);return user;
  }
  async function handleLogin(e){
    e.preventDefault();const email=$('#loginEmail'),password=$('#loginPassword'),button=$('#loginButton');
    email.setAttribute('aria-invalid',String(!email.validity.valid));password.setAttribute('aria-invalid',String(!password.value));
    if(!email.validity.valid||!password.value){setStatus('Enter a valid email address and password.','error');return}
    button.disabled=true;button.textContent='Signing In…';setStatus('Checking your account securely…','loading');
    try{const user=await login(email.value.trim(),password.value);setStatus('Signed in successfully.','success');showApp(user)}catch(err){console.error(err);setStatus(err&&err.message?err.message:'Sign-in failed. Please try again.','error')}finally{button.disabled=false;button.textContent='Sign In'}
  }
  function logout(){clearSession();showGate();$('#loginPassword').value='';setStatus('You have been signed out.','success')}
  function go(view){$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.viewPanel===view));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));sidebar.classList.remove('open');history.replaceState(null,'','#'+view);window.scrollTo({top:0,behavior:'smooth'})}
  async function loadWebsiteData(){try{let r=await fetch('/.netlify/functions/live-content?file=site&ops='+Date.now(),{cache:'no-store'});if(!r.ok)r=await fetch('/content/site.json?ops='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;const d=await r.json();const status=d.fieldStatus||'OPEN',announcement=d.announcement||'No announcement is currently posted.';$('#facilityStatus').textContent=status;$('#websiteStatusTitle').textContent='Facility is '+status;$('#websiteAnnouncement').textContent=announcement}catch(e){$('#facilityStatus').textContent='Check website';$('#websiteStatusTitle').textContent='Website data unavailable';$('#websiteAnnouncement').textContent='Open the Website Manager to review current settings.'}}
  function install(){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.finally(()=>deferredPrompt=null)}else{toast('On iPhone: Safari → Share → Add to Home Screen')}}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('#menuButton').addEventListener('click',()=>sidebar.classList.toggle('open'));$('#loginForm').addEventListener('submit',handleLogin);$('#logoutButton').addEventListener('click',logout);$('#settingsLogout').addEventListener('click',logout);$('#installButton').addEventListener('click',install);$('#settingsInstall').addEventListener('click',install);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installButton').hidden=false});
  if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.filter(r=>r.scope.includes('/ops/')).forEach(r=>r.unregister())).catch(()=>{});if(window.caches)caches.keys().then(keys=>keys.filter(k=>k.startsWith('ase-ops-')).forEach(k=>caches.delete(k))).catch(()=>{});}
  const initial=location.hash.replace('#','');if(initial&&$(`[data-view-panel="${initial}"]`))go(initial);
  restoreSession();
})();
