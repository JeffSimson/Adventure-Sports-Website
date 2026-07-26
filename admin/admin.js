(function(){
  const sections=[
    {name:'Homepage & Facility Info',icon:'⌂',desc:'Homepage photos, facility information, links and detailed settings.',hash:'#/collections/content/entries/site',cls:''},
    {name:'Events & Registration',icon:'◫',desc:'Add tournaments, update dates, registration links, logos and featured events.',hash:'#/collections/content/entries/events',cls:'ase-card-events'},
    {name:'Photo Gallery',icon:'▣',desc:'Upload, remove and arrange the photos displayed in the public gallery.',hash:'#/collections/content/entries/gallery',cls:'ase-card-gallery'},
    {name:'Rentals & Pricing',icon:'◆',desc:'Update rental rates, request types and notification email addresses.',hash:'#/collections/content/entries/rentals',cls:'ase-card-rentals'},
    {name:'Clubhouse & Menu',icon:'☕',desc:'Manage clubhouse text, food menu link and featured clubhouse photos.',hash:'#/collections/content/entries/clubhouse',cls:'ase-card-clubhouse'},
    {name:'Partners & Resources',icon:'◎',desc:'Manage partner organizations, websites and resource logos.',hash:'#/collections/content/entries/resources',cls:'ase-card-partners'},
    {name:'Safety, Rules & Refunds',icon:'✓',desc:'Edit safety information, park rules, insurance and refund policies.',hash:'#/collections/content/entries/safety',cls:'ase-card-safety'}
  ];

  const shell=document.getElementById('ase-shell');
  shell.innerHTML=`<header class="ase-topbar"><a class="ase-brand" href="#/collections/content"><img src="/uploads/branding/adventure-logo.png" alt="Adventure Sports"><div><strong>Adventure Sports Website Manager</strong><span>Website Administration Center</span></div></a><nav class="ase-top-actions"><a class="ase-top-btn" href="/" target="_blank" rel="noopener">↗ <span>View Website</span></a><a class="ase-top-btn primary" href="/admin/events-import.html">⚡ <span>Bulk Event Import</span></a></nav></header>`;

  const loader=document.createElement('div');
  loader.className='ase-loader';
  loader.innerHTML=`<div class="ase-loader-card"><img src="/uploads/branding/adventure-logo.png" alt=""><h2>Opening Website Manager</h2><p>Loading your website content and administration tools.</p><div class="ase-progress"></div></div>`;
  document.body.appendChild(loader);

  const dash=document.getElementById('ase-dashboard');
  function card(s){return `<a class="ase-admin-card ${s.cls}" href="${s.hash}" data-name="${s.name.toLowerCase()}"><span class="ase-card-icon">${s.icon}</span><h3>${s.name}</h3><p>${s.desc}</p><span class="ase-card-link">Open section <span class="ase-card-arrow">→</span></span></a>`}

  dash.innerHTML=`
  <div class="ase-dashboard-wrap">
    <section class="ase-welcome">
      <div class="ase-welcome-copy"><span class="ase-kicker">● Website Control Center</span><h1>Manage your website quickly and confidently.</h1><p>Use Quick Edit for everyday updates. Open a full section only when you need to make detailed changes.</p></div>
      <div class="ase-live-status"><span>Website connection</span><strong><i class="ase-status-dot"></i> Online & Connected</strong></div>
    </section>

    <section class="ase-quick-editor" aria-labelledby="quick-edit-title">
      <div class="ase-quick-editor-head"><div><span class="ase-section-eyebrow">Everyday controls</span><h2 id="quick-edit-title">Quick Edit</h2><p>Change common information here without opening the full CMS editor.</p></div><div id="aseQuickState" class="ase-save-state">Loading website information…</div></div>
      <div class="ase-quick-form">
        <label class="ase-field"><span>Field Status</span><select id="aseFieldStatus"><option>OPEN</option><option>CLOSED</option><option>DELAYED</option><option>CHECK SCHEDULE</option></select></label>
        <label class="ase-field ase-wide"><span>Top Announcement</span><input id="aseAnnouncement" type="text" placeholder="Registration is now open…"></label>
        <label class="ase-field"><span>Facility Hours</span><input id="aseHours" type="text" placeholder="Mon–Sun: 7:00 AM–10:00 PM"></label>
        <label class="ase-field"><span>Kitchen Hours</span><input id="aseKitchenHours" type="text" placeholder="Kitchen closes at 9:00 PM"></label>
        <label class="ase-field"><span>Phone Number</span><input id="asePhone" type="text" placeholder="(732) 580-1731"></label>
        <div class="ase-quick-save-wrap"><button id="aseQuickSave" class="ase-save-btn" type="button"><span class="ase-save-icon">✓</span><span><b>Save Quick Changes</b><small>Publishes through GitHub & Netlify</small></span></button></div>
      </div>
      <div id="aseQuickMessage" class="ase-quick-message" role="status" aria-live="polite"></div>
    </section>

    <div class="ase-dashboard-heading"><div><span class="ase-section-eyebrow">Detailed management</span><h2>Website Sections</h2><p>Open these only when you need to edit photos, events, pricing or longer content.</p></div><label class="ase-search"><input id="aseSearch" placeholder="Search admin sections…" autocomplete="off"></label></div>
    <section class="ase-admin-grid">${sections.map(card).join('')}</section>

    <section class="ase-bottom-grid">
      <div class="ase-panel"><div class="ase-panel-head"><h3>Helpful Shortcuts</h3><small>Less common tasks</small></div><div class="ase-quick-row"><a class="ase-quick" href="/admin/events-import.html"><b>⚡ Import Multiple Events</b><span>Add a full tournament schedule faster</span></a><a class="ase-quick" href="#/collections/content/entries/gallery"><b>＋ Add New Photos</b><span>Upload photos to the public gallery</span></a><a class="ase-quick" href="#/collections/content/entries/events"><b>＋ Add One Event</b><span>Create or update a single event</span></a></div></div>
      <aside class="ase-panel"><div class="ase-panel-head"><h3>How Publishing Works</h3></div><div class="ase-tip"><span class="ase-tip-icon">1</span><div><b>Make your change</b><span>Use Quick Edit or open a detailed section.</span></div></div><div class="ase-tip"><span class="ase-tip-icon">2</span><div><b>Press Save or Publish</b><span>Your update is committed securely.</span></div></div><div class="ase-tip"><span class="ase-tip-icon">3</span><div><b>Wait for Netlify</b><span>The live site normally updates within a minute.</span></div></div></aside>
    </section>
  </div>`;

  const els={
    status:document.getElementById('aseFieldStatus'),announcement:document.getElementById('aseAnnouncement'),hours:document.getElementById('aseHours'),kitchen:document.getElementById('aseKitchenHours'),phone:document.getElementById('asePhone'),save:document.getElementById('aseQuickSave'),message:document.getElementById('aseQuickMessage'),state:document.getElementById('aseQuickState')
  };
  let siteData=null;

  function setMessage(text,type=''){
    els.message.textContent=text;
    els.message.className='ase-quick-message'+(type?' '+type:'');
  }
  function populate(data){
    siteData=data;
    els.status.value=data.fieldStatus||'OPEN';
    els.announcement.value=data.announcement||'';
    els.hours.value=data.hours||'';
    els.kitchen.value=data.kitchenHours||'';
    els.phone.value=data.phone||'';
    els.state.textContent='Ready to edit';
    els.state.className='ase-save-state ready';
  }
  async function loadSiteData(){
    try{
      const r=await fetch('/content/site.json?admin='+Date.now(),{cache:'no-store'});
      if(!r.ok) throw new Error('Could not load website information.');
      populate(await r.json());
    }catch(err){
      els.state.textContent='Could not load quick controls';
      els.state.className='ase-save-state error';
      setMessage(err.message+' You can still use the full Homepage section.','error');
      els.save.disabled=true;
    }
  }
  function utf8ToBase64(str){
    const bytes=new TextEncoder().encode(str);let binary='';
    for(let i=0;i<bytes.length;i++) binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  async function getToken(){
    if(!window.netlifyIdentity) throw new Error('Netlify Identity is not available. Refresh and sign in again.');
    const user=window.netlifyIdentity.currentUser();
    if(!user) throw new Error('Your login session expired. Refresh and log in again.');
    return user.jwt();
  }
  async function saveQuickChanges(){
    if(!siteData) return;
    els.save.disabled=true;els.save.classList.add('saving');
    els.state.textContent='Saving…';els.state.className='ase-save-state saving';
    setMessage('Securely saving your changes…','working');
    try{
      const updated={...siteData,fieldStatus:els.status.value,announcement:els.announcement.value.trim(),hours:els.hours.value.trim(),kitchenHours:els.kitchen.value.trim(),phone:els.phone.value.trim()};
      const token=await getToken();
      const api='/.netlify/git/github/contents/content/site.json';
      const current=await fetch(api+'?ref=main',{headers:{Authorization:'Bearer '+token}});
      if(!current.ok) throw new Error('Could not read the current website file ('+current.status+').');
      const meta=await current.json();
      const result=await fetch(api,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({message:'Update website quick settings',content:utf8ToBase64(JSON.stringify(updated,null,2)+'\n'),sha:meta.sha,branch:'main'})});
      if(!result.ok){let detail='';try{detail=(await result.json()).message||''}catch(e){}throw new Error('Could not save changes ('+result.status+'). '+detail)}
      siteData=updated;
      els.state.textContent='Saved successfully';els.state.className='ase-save-state success';
      setMessage('Saved! Netlify is publishing the update now. It should appear on the live website shortly.','success');
      setTimeout(()=>{els.state.textContent='Ready to edit';els.state.className='ase-save-state ready'},5000);
    }catch(err){
      els.state.textContent='Save failed';els.state.className='ase-save-state error';
      setMessage(err.message+' No changes were lost—you can try again or use the full Homepage section.','error');
    }finally{els.save.disabled=false;els.save.classList.remove('saving')}
  }
  els.save.addEventListener('click',saveQuickChanges);
  loadSiteData();

  document.getElementById('aseSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.ase-admin-card').forEach(c=>c.style.display=(!q||c.dataset.name.includes(q)||c.textContent.toLowerCase().includes(q))?'':'none')});
  function isDashboard(){const h=location.hash.replace(/\/$/,'');return h===''||h==='#'||h==='#/collections/content'||h==='#/collections/content/entries'}
  function route(){const on=isDashboard();document.body.classList.toggle('ase-dashboard-mode',on);dash.classList.toggle('active',on);if(on)window.scrollTo(0,0);setTimeout(()=>loader.classList.add('hidden'),500)}
  window.addEventListener('hashchange',route);route();
  const obs=new MutationObserver(()=>{if(document.querySelector('#nc-root'))setTimeout(()=>loader.classList.add('hidden'),450)});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>loader.classList.add('hidden'),4500);
})();
