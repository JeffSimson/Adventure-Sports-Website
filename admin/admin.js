(function(){
  const $ = (s, c=document) => c.querySelector(s);
  const $$ = (s, c=document) => Array.from(c.querySelectorAll(s));

  function addShell(){
    const bar = document.createElement('div');
    bar.className = 'ase-admin-bar';
    bar.innerHTML = `
      <div class="ase-admin-brand">
        <img src="/uploads/branding/adventure-logo.png" alt="Adventure Sports">
        <div class="ase-admin-brand-copy">
          <strong>Adventure Sports Website Manager</strong>
          <span>Simple, secure website administration</span>
        </div>
      </div>
      <div class="ase-admin-actions">
        <a class="ase-admin-action" href="/" target="_blank" rel="noopener" title="Open live website">🌐 <span>View Website</span></a>
        <a class="ase-admin-action primary" href="/admin/events-import.html" title="Import several events at once">⚡ <span>Bulk Event Import</span></a>
      </div>`;
    document.body.prepend(bar);

    const loader = document.createElement('div');
    loader.className = 'ase-loader';
    loader.innerHTML = `
      <div class="ase-loader-card">
        <img src="/uploads/branding/adventure-logo.png" alt="">
        <h1>Opening Website Manager</h1>
        <p>Loading your events, photos, field status and website content.</p>
        <div class="ase-loader-line"></div>
      </div>`;
    document.body.appendChild(loader);

    const tools = document.createElement('div');
    tools.className = 'ase-quick-tools';
    tools.innerHTML = `
      <a class="ase-tool-link import" href="/admin/events-import.html">⚡ Bulk Events</a>
      <a class="ase-tool-link" href="/" target="_blank" rel="noopener">↗ Live Site</a>
      <button class="ase-tool-link" id="aseHelp" type="button" style="border:0;cursor:pointer">? Help</button>`;
    document.body.appendChild(tools);

    const note = document.createElement('div');
    note.className = 'ase-help-note';
    note.innerHTML = `<strong>Admin quick guide</strong>Select a section on the left, make your changes, then press <b>Save</b> or <b>Publish</b>. Netlify will update the live website automatically after the change is published.`;
    document.body.appendChild(note);
    $('#aseHelp').addEventListener('click',()=>note.classList.toggle('open'));
  }

  function improveLabels(){
    const replacements = {
      'Website Content':'Website Manager',
      'Main Website Settings':'Homepage & Facility Info',
      'Events':'Events & Registration',
      'Resources':'Partners & Resources',
      'Gallery':'Photo Gallery',
      'Clubhouse':'Clubhouse & Menu',
      'Private Rentals':'Rentals & Pricing',
      'Safety / Rules / Refund':'Safety, Rules & Refunds'
    };
    $$('a,button,h1,h2,h3,span,div').forEach(el=>{
      if(el.children.length===0){
        const text=(el.textContent||'').trim();
        if(replacements[text] && el.dataset.aseRenamed!=='1'){
          el.textContent=replacements[text];
          el.dataset.aseRenamed='1';
        }
      }
    });
  }

  function addIcons(){
    const iconMap={
      'Homepage & Facility Info':'🏠',
      'Events & Registration':'📅',
      'Partners & Resources':'🤝',
      'Photo Gallery':'📸',
      'Clubhouse & Menu':'🍔',
      'Rentals & Pricing':'🏟️',
      'Safety, Rules & Refunds':'🛡️'
    };
    $$('a,button').forEach(el=>{
      const text=(el.textContent||'').trim();
      if(iconMap[text] && !el.dataset.aseIcon){
        el.textContent=`${iconMap[text]}  ${text}`;
        el.dataset.aseIcon='1';
      }
    });
  }

  function hideLoader(){
    const root=$('#nc-root');
    if(root && root.children.length){
      setTimeout(()=>$('.ase-loader')?.classList.add('hidden'),500);
    }
  }

  addShell();
  const observer=new MutationObserver(()=>{
    improveLabels();
    addIcons();
    hideLoader();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  setTimeout(hideLoader,4500);
})();
