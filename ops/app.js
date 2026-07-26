(function(){
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const app=$('#app'),gate=$('#loginGate'),sidebar=$('#sidebar'); let deferredPrompt=null;
  function displayName(user){const m=(user&&user.user_metadata)||{};const raw=m.full_name||m.name||m.display_name||'';if(raw.trim())return raw.trim().split(/\s+/)[0];if(user&&user.email)return user.email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());return 'Administrator'}
  function greeting(){const h=new Date().getHours();return h<12?'Good Morning':h<17?'Good Afternoon':'Good Evening'}
  function renderUser(user){$('#greeting').textContent=greeting();$('#userName').textContent=displayName(user);$('#accountEmail').textContent=(user&&user.email)||'Signed-in administrator';$$('.avatar').forEach(x=>x.textContent=displayName(user).charAt(0).toUpperCase())}
  function showApp(user){gate.hidden=true;app.hidden=false;renderUser(user);loadWebsiteData()}
  function showGate(){app.hidden=true;gate.hidden=false}
  function initIdentity(){if(!window.netlifyIdentity){showGate();return}window.netlifyIdentity.init();window.netlifyIdentity.on('init',u=>u?showApp(u):showGate());window.netlifyIdentity.on('login',u=>{showApp(u);window.netlifyIdentity.close()});window.netlifyIdentity.on('logout',showGate)}
  function openLogin(){window.netlifyIdentity&&window.netlifyIdentity.open('login')}
  function logout(){window.netlifyIdentity&&window.netlifyIdentity.logout()}
  function go(view){$$('.view').forEach(v=>v.classList.toggle('active',v.dataset.viewPanel===view));$$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===view));sidebar.classList.remove('open');history.replaceState(null,'','#'+view);window.scrollTo({top:0,behavior:'smooth'})}
  async function loadWebsiteData(){try{let r=await fetch('/.netlify/functions/live-content?file=site&ops='+Date.now(),{cache:'no-store'});if(!r.ok)r=await fetch('/content/site.json?ops='+Date.now(),{cache:'no-store'});if(!r.ok)throw 0;const d=await r.json();const status=d.fieldStatus||'OPEN',announcement=d.announcement||'No announcement is currently posted.';$('#facilityStatus').textContent=status;$('#websiteStatusTitle').textContent='Facility is '+status;$('#websiteAnnouncement').textContent=announcement}catch(e){$('#facilityStatus').textContent='Check website';$('#websiteStatusTitle').textContent='Website data unavailable';$('#websiteAnnouncement').textContent='Open the Website Manager to review current settings.'}}
  function install(){if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.finally(()=>deferredPrompt=null)}else{toast('On iPhone: Safari → Share → Add to Home Screen')}}
  function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
  $('#menuButton').addEventListener('click',()=>sidebar.classList.toggle('open'));$('#loginButton').addEventListener('click',openLogin);$('#logoutButton').addEventListener('click',logout);$('#settingsLogout').addEventListener('click',logout);$('#installButton').addEventListener('click',install);$('#settingsInstall').addEventListener('click',install);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installButton').hidden=false});
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/ops/sw.js').catch(()=>{});
  const initial=location.hash.replace('#','');if(initial&&$(`[data-view-panel="${initial}"]`))go(initial);
  initIdentity();
})();
