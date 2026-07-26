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
      <div class="ase-welcome-copy"><span class="ase-kicker">● Website Control Center</span><h1>Manage your website quickly and confidently.</h1><p>Use Quick Edit for everyday updates. Open a full section only for photos, events, long lists or advanced changes.</p></div>
      <div class="ase-live-status"><span>Website connection</span><strong><i class="ase-status-dot"></i> Online & Connected</strong></div>
    </section>

    <section class="ase-quick-editor" aria-labelledby="quick-edit-title">
      <div class="ase-quick-editor-head">
        <div><span class="ase-section-eyebrow">Everyday controls</span><h2 id="quick-edit-title">Quick Edit Center</h2><p>Update the most-used website information without opening the full CMS editor.</p></div>
        <div id="aseQuickState" class="ase-save-state">Loading website information…</div>
      </div>

      <div class="ase-quick-tabs" role="tablist" aria-label="Quick edit categories">
        <button class="ase-tab active" data-tab="status" type="button">Status & Notice</button>
        <button class="ase-tab" data-tab="contact" type="button">Contact & Hours</button>
        <button class="ase-tab" data-tab="homepage" type="button">Homepage Text</button>
        <button class="ase-tab" data-tab="links" type="button">Website Links</button>
        <button class="ase-tab" data-tab="rentals" type="button">Rentals</button>
        <button class="ase-tab" data-tab="clubhouse" type="button">Clubhouse</button>
        <button class="ase-tab" data-tab="safety" type="button">Safety</button>
      </div>

      <div class="ase-tab-panel active" data-panel="status">
        <div class="ase-quick-form two-col">
          <label class="ase-field"><span>Field Status</span><select id="aseFieldStatus"><option>OPEN</option><option>CLOSED</option><option>DELAYED</option><option>CHECK SCHEDULE</option></select></label>
          <label class="ase-field"><span>Top Announcement</span><input id="aseAnnouncement" type="text" placeholder="Registration is now open…"></label>
        </div>
      </div>

      <div class="ase-tab-panel" data-panel="contact">
        <div class="ase-quick-form three-col">
          <label class="ase-field"><span>Phone Number</span><input id="asePhone" type="text"></label>
          <label class="ase-field"><span>Email Address</span><input id="aseEmail" type="email"></label>
          <label class="ase-field"><span>Facility Hours</span><input id="aseHours" type="text"></label>
          <label class="ase-field"><span>Kitchen Hours</span><input id="aseKitchenHours" type="text"></label>
          <label class="ase-field ase-span-2"><span>Full Address</span><input id="aseAddress" type="text"></label>
          <label class="ase-field"><span>Short Location Name</span><input id="aseShortAddress" type="text"></label>
          <label class="ase-field ase-span-2"><span>City, State & ZIP</span><input id="aseCityStateZip" type="text"></label>
        </div>
      </div>

      <div class="ase-tab-panel" data-panel="homepage">
        <div class="ase-quick-form two-col">
          <label class="ase-field"><span>Complex Name</span><input id="aseName" type="text"></label>
          <label class="ase-field"><span>Legal Name</span><input id="aseLegalName" type="text"></label>
          <label class="ase-field ase-span-2"><span>Homepage Headline</span><input id="aseHeadline" type="text"></label>
          <label class="ase-field"><span>Hero Button Text</span><input id="aseHeroButtonText" type="text"></label>
          <label class="ase-field ase-span-2"><span>About Text</span><textarea id="aseAbout" rows="5"></textarea></label>
          <label class="ase-field ase-span-2"><span>Parking Notes</span><textarea id="aseParking" rows="4"></textarea></label>
        </div>
      </div>

      <div class="ase-tab-panel" data-panel="links">
        <div class="ase-quick-form two-col">
          <label class="ase-field"><span>Facebook Link</span><input id="aseFacebook" type="url"></label>
          <label class="ase-field"><span>LiveBarn / Video Streams Link</span><input id="aseVideoStreamsUrl" type="url"></label>
          <label class="ase-field"><span>Waiver Link</span><input id="aseWaiverUrl" type="url"></label>
          <label class="ase-field"><span>Menu Link</span><input id="aseMenuUrl" type="url"></label>
          <label class="ase-field ase-span-2"><span>Discount Hotel Link</span><input id="aseDiscountHotelUrl" type="url"></label>
        </div>
      </div>

      <div class="ase-tab-panel" data-panel="rentals">
        <div class="ase-quick-form two-col">
          <label class="ase-field ase-span-2"><span>Rentals Page Title</span><input id="aseRentalsTitle" type="text"></label>
          <label class="ase-field"><span>Rental Rates — one per line</span><textarea id="aseRentalRates" rows="6" placeholder="$50–$125/hr&#10;$60/hr&#10;$35/hr"></textarea></label>
          <label class="ase-field"><span>Notification Emails — one per line</span><textarea id="aseRentalEmails" rows="6"></textarea></label>
        </div>
      </div>

      <div class="ase-tab-panel" data-panel="clubhouse">
        <div class="ase-quick-form two-col">
          <label class="ase-field"><span>Clubhouse Title</span><input id="aseClubhouseTitle" type="text"></label>
          <label class="ase-field"><span>Clubhouse Tagline</span><input id="aseClubhouseTagline" type="text"></label>
          <label class="ase-field ase-span-2"><span>Clubhouse Introduction</span><textarea id="aseClubhouseIntro" rows="5"></textarea></label>
          <label class="ase-field ase-span-2"><span>Clubhouse Menu Link</span><input id="aseClubhouseMenuUrl" type="url"></label>
        </div>
      </div>

      <div class="ase-tab-panel" data-panel="safety">
        <div class="ase-quick-form two-col">
          <label class="ase-field ase-span-2"><span>Park Waiver Link</span><input id="aseSafetyWaiverUrl" type="url"></label>
          <label class="ase-field ase-span-2"><span>Insurance Requirement</span><textarea id="aseInsurance" rows="5"></textarea></label>
          <label class="ase-field"><span>Umpire Policy</span><textarea id="aseUmpires" rows="5"></textarea></label>
          <label class="ase-field"><span>Equipment Policy</span><textarea id="aseEquipment" rows="5"></textarea></label>
        </div>
      </div>

      <div class="ase-quick-save-wrap">
        <button id="aseQuickSave" class="ase-save-btn" type="button"><span class="ase-save-icon">✓</span><span><b>Save All Quick Changes</b><small>Only changed files are published</small></span></button>
      </div>
      <div id="aseQuickMessage" class="ase-quick-message" role="status" aria-live="polite"></div>
    </section>

    <div class="ase-dashboard-heading"><div><span class="ase-section-eyebrow">Detailed management</span><h2>Website Sections</h2><p>Open these when you need to edit photos, events, long lists, logos or advanced settings.</p></div><label class="ase-search"><input id="aseSearch" placeholder="Search admin sections…" autocomplete="off"></label></div>
    <section class="ase-admin-grid">${sections.map(card).join('')}</section>

    <section class="ase-bottom-grid">
      <div class="ase-panel"><div class="ase-panel-head"><h3>Helpful Shortcuts</h3><small>Less common tasks</small></div><div class="ase-quick-row"><a class="ase-quick" href="/admin/events-import.html"><b>⚡ Import Multiple Events</b><span>Add a full tournament schedule faster</span></a><a class="ase-quick" href="#/collections/content/entries/gallery"><b>＋ Add New Photos</b><span>Upload photos to the public gallery</span></a><a class="ase-quick" href="#/collections/content/entries/events"><b>＋ Add One Event</b><span>Create or update a single event</span></a></div></div>
      <aside class="ase-panel ase-publishing-panel"><div class="ase-panel-head"><h3>How Publishing Works</h3></div><div class="ase-tip"><span class="ase-tip-icon">1</span><div><b>Make your change</b><span>Use Quick Edit or open a detailed section.</span></div></div><div class="ase-tip"><span class="ase-tip-icon">2</span><div><b>Press Save or Publish</b><span>Your update is committed securely.</span></div></div><div class="ase-tip"><span class="ase-tip-icon">3</span><div><b>Wait for Netlify</b><span>The live site normally updates within a minute.</span></div></div></aside>
    </section>
  </div>`;

  const byId=id=>document.getElementById(id);
  const stateEl=byId('aseQuickState'), messageEl=byId('aseQuickMessage'), saveBtn=byId('aseQuickSave');
  const files={
    site:{path:'content/site.json',data:null,original:null},
    rentals:{path:'content/rentals.json',data:null,original:null},
    clubhouse:{path:'content/clubhouse.json',data:null,original:null},
    safety:{path:'content/safety.json',data:null,original:null}
  };

  function setMessage(text,type=''){
    messageEl.textContent=text;
    messageEl.className='ase-quick-message'+(type?' '+type:'');
  }
  function lines(value){return (value||'').split('\n').map(v=>v.trim()).filter(Boolean)}
  function setValue(id,value){const el=byId(id);if(el)el.value=value??''}

  function populate(){
    const s=files.site.data||{},r=files.rentals.data||{},c=files.clubhouse.data||{},safe=files.safety.data||{};
    setValue('aseFieldStatus',s.fieldStatus||'OPEN'); setValue('aseAnnouncement',s.announcement);
    setValue('asePhone',s.phone); setValue('aseEmail',s.email); setValue('aseHours',s.hours); setValue('aseKitchenHours',s.kitchenHours);
    setValue('aseAddress',s.address); setValue('aseShortAddress',s.shortAddress); setValue('aseCityStateZip',s.cityStateZip);
    setValue('aseName',s.name); setValue('aseLegalName',s.legalName); setValue('aseHeadline',s.headline); setValue('aseHeroButtonText',s.heroButtonText);
    setValue('aseAbout',s.about); setValue('aseParking',s.parking);
    setValue('aseFacebook',s.facebook); setValue('aseVideoStreamsUrl',s.videoStreamsUrl); setValue('aseWaiverUrl',s.waiverUrl);
    setValue('aseMenuUrl',s.menuUrl); setValue('aseDiscountHotelUrl',s.discountHotelUrl);
    setValue('aseRentalsTitle',r.title); setValue('aseRentalRates',(r.rates||[]).join('\n')); setValue('aseRentalEmails',(r.emails||[]).join('\n'));
    setValue('aseClubhouseTitle',c.title); setValue('aseClubhouseTagline',c.tagline); setValue('aseClubhouseIntro',c.intro); setValue('aseClubhouseMenuUrl',c.menuUrl);
    setValue('aseSafetyWaiverUrl',safe.waiverUrl); setValue('aseInsurance',safe.insurance); setValue('aseUmpires',safe.umpires); setValue('aseEquipment',safe.equipment);
    stateEl.textContent='Ready to edit'; stateEl.className='ase-save-state ready';
  }

  async function loadAll(){
    try{
      await Promise.all(Object.values(files).map(async f=>{
        const r=await fetch('/'+f.path+'?admin='+Date.now(),{cache:'no-store'});
        if(!r.ok) throw new Error('Could not load '+f.path);
        f.data=await r.json(); f.original=JSON.stringify(f.data);
      }));
      populate();
    }catch(err){
      stateEl.textContent='Could not load quick controls'; stateEl.className='ase-save-state error';
      setMessage(err.message+'. You can still use the detailed editing sections.','error'); saveBtn.disabled=true;
    }
  }

  function collect(){
    const s={...files.site.data,
      fieldStatus:byId('aseFieldStatus').value, announcement:byId('aseAnnouncement').value.trim(),
      phone:byId('asePhone').value.trim(), email:byId('aseEmail').value.trim(), hours:byId('aseHours').value.trim(),
      kitchenHours:byId('aseKitchenHours').value.trim(), address:byId('aseAddress').value.trim(),
      shortAddress:byId('aseShortAddress').value.trim(), cityStateZip:byId('aseCityStateZip').value.trim(),
      name:byId('aseName').value.trim(), legalName:byId('aseLegalName').value.trim(), headline:byId('aseHeadline').value.trim(),
      heroButtonText:byId('aseHeroButtonText').value.trim(), about:byId('aseAbout').value.trim(), parking:byId('aseParking').value.trim(),
      facebook:byId('aseFacebook').value.trim(), videoStreamsUrl:byId('aseVideoStreamsUrl').value.trim(),
      waiverUrl:byId('aseWaiverUrl').value.trim(), menuUrl:byId('aseMenuUrl').value.trim(),
      discountHotelUrl:byId('aseDiscountHotelUrl').value.trim()
    };
    const r={...files.rentals.data,title:byId('aseRentalsTitle').value.trim(),rates:lines(byId('aseRentalRates').value),emails:lines(byId('aseRentalEmails').value)};
    const c={...files.clubhouse.data,title:byId('aseClubhouseTitle').value.trim(),tagline:byId('aseClubhouseTagline').value.trim(),intro:byId('aseClubhouseIntro').value.trim(),menuUrl:byId('aseClubhouseMenuUrl').value.trim()};
    const safe={...files.safety.data,waiverUrl:byId('aseSafetyWaiverUrl').value.trim(),insurance:byId('aseInsurance').value.trim(),umpires:byId('aseUmpires').value.trim(),equipment:byId('aseEquipment').value.trim()};
    return {site:s,rentals:r,clubhouse:c,safety:safe};
  }

  function utf8ToBase64(str){
    const bytes=new TextEncoder().encode(str);let binary='';
    for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  async function getToken(){
    if(!window.netlifyIdentity)throw new Error('Netlify Identity is unavailable. Refresh and sign in again.');
    const user=window.netlifyIdentity.currentUser();
    if(!user)throw new Error('Your login session expired. Refresh and log in again.');
    return user.jwt();
  }
  async function saveFile(key,newData,token){
    const f=files[key], api='/.netlify/git/github/contents/'+f.path;
    const current=await fetch(api+'?ref=main',{headers:{Authorization:'Bearer '+token}});
    if(!current.ok)throw new Error('Could not read '+f.path+' ('+current.status+').');
    const meta=await current.json();
    const result=await fetch(api,{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({
      message:'Quick edit '+key+' settings',
      content:utf8ToBase64(JSON.stringify(newData,null,2)+'\n'),
      sha:meta.sha,branch:'main'
    })});
    if(!result.ok){let detail='';try{detail=(await result.json()).message||''}catch(e){}throw new Error('Could not save '+f.path+' ('+result.status+'). '+detail)}
    f.data=newData; f.original=JSON.stringify(newData);
  }

  async function saveQuickChanges(){
    saveBtn.disabled=true; saveBtn.classList.add('saving');
    stateEl.textContent='Checking changes…'; stateEl.className='ase-save-state saving';
    setMessage('Checking and securely saving your updates…','working');
    try{
      const updated=collect(), changed=Object.keys(updated).filter(k=>JSON.stringify(updated[k])!==files[k].original);
      if(!changed.length){
        stateEl.textContent='No changes to save'; stateEl.className='ase-save-state ready';
        setMessage('Everything is already up to date.','success'); return;
      }
      const token=await getToken();
      for(const key of changed){
        stateEl.textContent='Saving '+key+'…';
        await saveFile(key,updated[key],token);
      }
      stateEl.textContent='Saved successfully'; stateEl.className='ase-save-state success';
      setMessage('Saved '+changed.length+' section'+(changed.length===1?'':'s')+'! Netlify is publishing the update now.','success');
      setTimeout(()=>{stateEl.textContent='Ready to edit';stateEl.className='ase-save-state ready'},5000);
    }catch(err){
      stateEl.textContent='Save failed'; stateEl.className='ase-save-state error';
      setMessage(err.message+' Any files saved before the error are already safe.','error');
    }finally{
      saveBtn.disabled=false; saveBtn.classList.remove('saving');
    }
  }

  document.querySelectorAll('.ase-tab').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.ase-tab').forEach(b=>b.classList.toggle('active',b===btn));
    document.querySelectorAll('.ase-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===btn.dataset.tab));
  }));
  saveBtn.addEventListener('click',saveQuickChanges);
  loadAll();

  byId('aseSearch').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.ase-admin-card').forEach(c=>c.style.display=(!q||c.dataset.name.includes(q)||c.textContent.toLowerCase().includes(q))?'':'none')});
  function isDashboard(){const h=location.hash.replace(/\/$/,'');return h===''||h==='#'||h==='#/collections/content'||h==='#/collections/content/entries'}
  function route(){const on=isDashboard();document.body.classList.toggle('ase-dashboard-mode',on);dash.classList.toggle('active',on);if(on)window.scrollTo(0,0);setTimeout(()=>loader.classList.add('hidden'),500)}
  window.addEventListener('hashchange',route);route();
  const obs=new MutationObserver(()=>{if(document.querySelector('#nc-root'))setTimeout(()=>loader.classList.add('hidden'),450)});obs.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>loader.classList.add('hidden'),4500);
})();