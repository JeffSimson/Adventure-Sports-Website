
const $ = (id) => document.getElementById(id);

function staticHomeFallback(){
  const fallbackSlides = [
    "/uploads/home-slider/youth-baseball-players.jpg",
    "/uploads/home-slider/softball-player-smiling.jpg",
    "/uploads/home-slider/batter-at-field.jpg",
    "/uploads/home-slider/jersey-shore-mascot.jpg",
    "/uploads/home-slider/flag-football-player.jpg",
    "/uploads/home-slider/night-field.jpg"
  ];
  if ($('homeHero')) $('homeHero').style.backgroundImage = "linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.35)), url('/uploads/site/hero-aerial.jpg')";
  if ($('sliderTrack') && !$('sliderTrack').innerHTML.trim()) {
    const slides = [...fallbackSlides, ...fallbackSlides];
    $('sliderTrack').innerHTML = slides.map(s => `<div class="slide-card"><img src="${s}" alt="Adventure Sports photo"></div>`).join('');
  }
  if ($('heroTitle')) $('heroTitle').textContent = "A Premier Sporting Destination";
  if ($('heroCta')) $('heroCta').textContent = "Register for Baseball & Softball";
}

const esc = (s="") => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const img = (s="") => !s ? "" : (s.startsWith("/") || s.startsWith("http") ? s : "/" + s);
async function getJSON(path){ const r = await fetch(path+"?v="+Date.now()); if(!r.ok) throw new Error(path); return r.json(); }

function todayISO(){
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}
function eventEndDate(e){ return e.endDate || e.startDate || "9999-12-31"; }
function eventStartDate(e){ return e.startDate || e.endDate || "9999-12-31"; }
function sortEvents(list){
  return [...list].sort((a,b) => eventStartDate(a).localeCompare(eventStartDate(b)));
}
function filterEventsByTime(list, showPast){
  const today = todayISO();
  return list.filter(e => showPast ? eventEndDate(e) < today : eventEndDate(e) >= today);
}

function renderFixedStatus(site){
  if ($('fixedFieldStatus')) $('fixedFieldStatus').textContent = site.fieldStatus || 'OPEN';
  if ($('fixedAnnouncement')) $('fixedAnnouncement').textContent = site.announcement || '';
}
async function loadHome(){
  const [site, eventsData, resData] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/events.json'), getJSON('/content/resources.json')]);
  renderFixedStatus(site);
  document.title = site.name;
  $('homeHero').style.backgroundImage = `linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.35)), url('${img(site.heroImage)}')`;
  $('heroTitle').textContent = site.headline;
  $('heroCta').textContent = site.heroButtonText;
  $('aboutTitle').textContent = site.legalName;
  $('aboutText').textContent = site.about;
  $('facebookLink').href = site.facebook;
  $('videoLink').href = site.videoStreamsUrl || 'https://watch.livebarn.com/en/register';
  $('waiverQuick').href = site.waiverUrl;
  $('menuQuick').href = site.menuUrl;
  $('rentalQuick').href = '/private-rentals.html';
  $('eventsQuick').href = '/events.html';
  $('facilityHighlights').innerHTML = (site.facilityHighlights || []).map(x => `<div class="info-mini-card"><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('');
  $('planVisit').innerHTML = (site.planVisit || []).map(x => `<div class="visit-item">${esc(x)}</div>`).join('');
  $('whyChoose').innerHTML = (site.whyChoose || []).map(x => `<div class="why-card">${esc(x)}</div>`).join('');
  const slides = [...(site.homeSlider || []), ...(site.homeSlider || [])];
  $('sliderTrack').innerHTML = slides.map(s => `<div class="slide-card"><img src="${esc(img(s))}" alt="Adventure Sports photo"></div>`).join('');
  const catImages = {
    "Baseball": "/uploads/gallery/gallery-10.jpg",
    "Softball": "/uploads/gallery/gallery-2.jpg",
    "Flag Football": "/uploads/gallery/gallery-12.jpg",
    "Camps": "/uploads/gallery/gallery-5.jpg",
    "Tournaments": img(site.heroImage),
    "Private Rentals": img(site.facilityMap)
  };
  $('categoryGrid').innerHTML = eventsData.categories.map(c => `<a class="category-card" href="/events.html?category=${encodeURIComponent(c)}"><img src="${catImages[c] || img(site.heroImage)}" alt="${esc(c)}"><span>${esc(c)}<br>Events</span></a>`).join('');
  const featured = sortEvents(filterEventsByTime(eventsData.events, false)).filter(e => e.featured).slice(0,4);
  $('upcomingEvents').innerHTML = featured.map(e => `<div class="feature-card"><img src="${esc(img(e.logo || e.image))}" alt="${esc(e.title)}"><div><h3>${esc(e.title)}</h3><p><b>${esc(e.date)}</b></p><p>${esc(e.location || '')}</p></div><a class="btn red" href="${esc(e.register || '/events.html')}">View Event</a></div>`).join('');
  $('locName').textContent = site.name;
  $('locAddress').innerHTML = `${esc(site.shortAddress)}<br>${esc(site.cityStateZip)}`;
  $('locHours').textContent = site.hours;
  $('locPhone').textContent = site.phone;
  $('parkingNote').textContent = site.parking;
  $('resourcesGrid').innerHTML = resData.resources.map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(r.name)}"><img src="${esc(img(r.logo))}" alt="${esc(r.name)}"></a>`).join('');
  $('footerName').textContent = site.name;
  $('footerAddress').innerHTML = `${esc(site.shortAddress)}<br>${esc(site.cityStateZip)}`;
  $('footerPhone').textContent = site.phone;
  $('footerPhone').href = 'tel:' + site.phone.replace(/\D/g,'');
  $('footerEmail').textContent = site.email;
  $('footerEmail').href = 'mailto:' + site.email;
  $('footerHours').textContent = site.hours;
  $('footerLogo').src = img(site.logo);
}
async function loadEvents(){
  const [site, eventsData] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/events.json')]);
  renderFixedStatus(site); if ($('pageLogo')) $('pageLogo').src = img(site.logo);

  const params = new URLSearchParams(location.search);
  let selected = params.get('category') || 'All';
  const showPast = params.get('past') === '1';

  let events = selected === 'All' ? eventsData.events : eventsData.events.filter(e => e.category === selected);
  events = sortEvents(filterEventsByTime(events, showPast));

  const timeButtons = `
    <a class="btn ${!showPast ? 'red' : 'light'}" href="/events.html${selected !== 'All' ? '?category=' + encodeURIComponent(selected) : ''}">Upcoming Events</a>
    <a class="btn ${showPast ? 'red' : 'light'}" href="/events.html?past=1${selected !== 'All' ? '&category=' + encodeURIComponent(selected) : ''}">← Past Events</a>
  `;

  $('eventFilters').innerHTML =
    `<div class="quick-buttons" style="margin-top:0">${timeButtons}</div>
     <div class="quick-buttons">` +
    ['All', ...eventsData.categories].map(c => {
      const q = c === 'All' ? '' : `category=${encodeURIComponent(c)}`;
      const past = showPast ? (q ? '&past=1' : 'past=1') : '';
      const url = '/events.html' + (q || past ? '?' + q + past : '');
      return `<a class="btn ${c===selected?'red':'light'}" href="${url}">${esc(c)}</a>`;
    }).join('') + '</div>';

  $('eventsList').innerHTML = events.map(e => {
    const registerText = e.directRegister ? 'Register' : 'Event Info / Register';
    return `<div class="feature-card">
      <img src="${esc(img(e.logo || e.image))}" alt="${esc(e.title)}">
      <div>
        <h3>${esc(e.title)}</h3>
        <p><b>${esc(e.category)} • ${esc(e.date)}</b></p>
        <p>${esc(e.description || '')}</p>
        <p>${esc(e.location || '')}</p>
        <p><b>${esc(e.price || '')}</b></p>
      </div>
      <a class="btn red" href="${esc(e.register || '#')}" target="${(e.register||'').startsWith('http')?'_blank':'_self'}">${registerText}</a>
    </div>`;
  }).join('') || `<div class="card">No ${showPast ? 'past' : 'upcoming'} events found for this category.</div>`;
}
async function loadGallery(){
  const [site, galleryData] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/gallery.json')]);
  renderFixedStatus(site); if ($('pageLogo')) $('pageLogo').src = img(site.logo);
  $('galleryGrid').innerHTML = galleryData.gallery.map(g => `<img src="${esc(img(g.image))}" alt="${esc(g.title || 'Gallery photo')}">`).join('');
}
async function loadClubhouse(){
  const [site, club] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/clubhouse.json')]);
  renderFixedStatus(site); if ($('pageLogo')) $('pageLogo').src = img(site.logo);
  $('menuButton').href = club.menuUrl;
  $('clubIntro').textContent = club.intro;
  $('clubTagline').textContent = club.tagline;
  $('clubGrid').innerHTML = club.photos.map(p => `<div class="card"><img style="width:100%;height:260px;object-fit:cover;border-radius:14px" src="${esc(img(p.image))}" alt="${esc(p.caption)}"><h3>${esc(p.caption)}</h3></div>`).join('');
}
async function loadRentals(){
  const [site, rentals] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/rentals.json')]);
  renderFixedStatus(site); if ($('pageLogo')) $('pageLogo').src = img(site.logo);
  if ($('ratesList')) $('ratesList').innerHTML = rentals.rates.map(r => `<li>${esc(r)}</li>`).join('');
  $('typeDescriptions').innerHTML = (rentals.requestTypes || []).map(t => `<div class="type-help-item"><b>${esc(t.name)}</b><br>${esc(t.description)}</div>`).join('');
}
async function loadSafety(){
  const [site, safety] = await Promise.all([getJSON('/content/site.json'), getJSON('/content/safety.json')]);
  renderFixedStatus(site); if ($('pageLogo')) $('pageLogo').src = img(site.logo);
  $('waiverButton').href = safety.waiverUrl;
  $('safetyList').innerHTML = safety.safety.map(x=>`<p>${esc(x)}</p>`).join('');
  $('rulesIntro').innerHTML = (safety.rulesIntro || []).map(x=>`<p>${esc(x)}</p>`).join('');
  $('rulesList').innerHTML = safety.rules.map(x=>`<li>${esc(x)}</li>`).join('');
  $('insurance').textContent = safety.insurance;
  $('rosters').textContent = safety.rosters || '';
  $('umpires').textContent = safety.umpires;
  $('equipment').textContent = safety.equipment;
  $('refundSummary').innerHTML = safety.refundSummary.map(x=>`<li>${esc(x)}</li>`).join('');
  $('refundDetails').textContent = safety.refundDetails;
}
async function loadContact(){
  const site = await getJSON('/content/site.json');
  renderFixedStatus(site); if ($('pageLogo')) $('pageLogo').src = img(site.logo);
  $('contactAddress').innerHTML = `<b>${esc(site.name)}</b><br>${esc(site.shortAddress)}<br>${esc(site.cityStateZip)}`;
  $('contactPhone').textContent = site.phone;
  $('contactPhone').href = 'tel:' + site.phone.replace(/\D/g,'');
  $('contactEmail').textContent = site.email;
  $('contactEmail').href = 'mailto:' + site.email;
  $('contactHours').textContent = site.hours;
}

window.addEventListener('error', staticHomeFallback);
setTimeout(staticHomeFallback, 1200);

/* 2026 visual polish: no content or data changes */
(function(){
  const nav=document.querySelector('.top-nav');
  const updateNav=()=>nav&&nav.classList.toggle('nav-scrolled',window.scrollY>24);
  window.addEventListener('scroll',updateNav,{passive:true});
  updateNav();

  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!reduce&&'IntersectionObserver' in window){
    const targets=document.querySelectorAll('.section-head,.about-card,.info-mini-card,.visit-item,.why-card,.category-card,.feature-card,.location-grid,.resource-grid a,.card,.rate-card');
    targets.forEach((el,i)=>{el.classList.add('ase-reveal');el.style.transitionDelay=((i%5)*45)+'ms';});
    const io=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('ase-visible');io.unobserve(entry.target);}
    }),{threshold:.08,rootMargin:'0px 0px -30px 0px'});
    targets.forEach(el=>io.observe(el));
  }
})();


function aseEnsureGameDayBoard(){
  let board=document.getElementById('aseLiveGameDayBoard');
  if(board)return board;
  board=document.createElement('section');
  board.id='aseLiveGameDayBoard';
  board.className='ase-live-game-day';
  board.hidden=true;
  const nav=document.querySelector('.top-nav');
  if(nav)nav.insertAdjacentElement('afterend',board);else document.body.prepend(board);
  return board;
}
function aseGameStatusLabel(value){return {'in-progress':'LIVE','delayed':'DELAYED','upcoming':'UPCOMING','complete':'FINAL','canceled':'CANCELED'}[value]||String(value||'').toUpperCase()}
function aseRenderGameDayBoard(gameDay){
  const board=aseEnsureGameDayBoard();
  if(!gameDay?.enabled){board.hidden=true;board.innerHTML='';return}
  const games=Array.isArray(gameDay.games)?gameDay.games:[],summary=gameDay.summary||{},lightning=gameDay.lightning||{};
  board.hidden=false;
  board.innerHTML=`<div class="wrap ase-live-game-day-inner">
    <div class="ase-live-game-day-head">
      <div><span class="ase-live-kicker">LIVE GAME DAY</span><h2>${esc(gameDay.headline||gameDay.matrixName||'Game Day Updates')}</h2><p>${esc(gameDay.message||'Live fields, times, delays, and weather status from Adventure Sports.')}</p></div>
      <div class="ase-live-game-day-stats"><span><b>${Number(summary['in-progress']||0)}</b> Live</span><span><b>${Number(summary.delayed||0)}</b> Delayed</span><span><b>${Number(summary.upcoming||0)}</b> Upcoming</span></div>
    </div>
    ${lightning.active?`<div class="ase-public-lightning" data-clear-at="${esc(lightning.clearAt||'')}"><strong>⚡ LIGHTNING HOLD</strong><span>Clearance timer: <b data-public-lightning-timer>Calculating…</b></span><small>Management must confirm conditions before fields reopen.</small></div>`:''}
    <div class="ase-live-game-grid">${games.length?games.map(g=>`<article class="ase-live-game ${esc(g.status)}"><span>Field ${esc(g.field)}</span><strong>${esc(g.time)}</strong><em>${esc(aseGameStatusLabel(g.status))}</em>${g.note?`<small>${esc(g.note)}</small>`:''}</article>`).join(''):'<p class="ase-live-no-games">No remaining games are currently listed.</p>'}</div>
    <small class="ase-live-updated">Updated ${gameDay.updatedAt?new Date(gameDay.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'live'}</small>
  </div>`;
  aseUpdatePublicLightningTimer();
}
function aseUpdatePublicLightningTimer(){
  const hold=document.querySelector('.ase-public-lightning[data-clear-at]'),out=hold?.querySelector('[data-public-lightning-timer]');if(!hold||!out)return;
  const clearAt=hold.dataset.clearAt;if(!clearAt){out.textContent='Active';return}
  const ms=new Date(clearAt)-new Date();if(ms<=0){out.textContent='Clear period complete — awaiting management';return}
  const total=Math.ceil(ms/1000),min=Math.floor(total/60),sec=total%60;out.textContent=`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/* V3 one-second live facility status — preserves all polished design markup. */
let aseLastLiveSignature='';

async function aseFetchLiveStatus(){
  try{
    const response=await fetch('/.netlify/functions/live-content?t='+Date.now(),{
      cache:'no-store',
      headers:{'Cache-Control':'no-cache'}
    });
    if(!response.ok)return null;
    return await response.json();
  }catch(error){
    return null;
  }
}

async function aseRefreshLiveStatus(){
  const live=await aseFetchLiveStatus();
  if(!live)return;
  const signature=[
    live.fieldStatus||'',
    live.announcement||'',
    live.updatedAt||'',
    JSON.stringify(live.gameDay||null)
  ].join('|');
  if(signature===aseLastLiveSignature){aseUpdatePublicLightningTimer();return;}
  aseLastLiveSignature=signature;

  if(typeof renderFixedStatus==='function'){
    renderFixedStatus(live);
  }
  aseRenderGameDayBoard(live.gameDay);
}

function aseStartLiveStatus(){
  aseRefreshLiveStatus();
  window.setInterval(aseRefreshLiveStatus,1000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',aseStartLiveStatus);
}else{
  aseStartLiveStatus();
}

document.addEventListener('visibilitychange',()=>{
  if(!document.hidden)aseRefreshLiveStatus();
});
