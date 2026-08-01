(function(){
'use strict';

const LAT = 40.0919;
const LON = -74.3587;
const LOCATION_NAME = 'Adventure Sports — Jackson, NJ';
const WEATHER_URL='/.netlify/functions/weather-center';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let weatherData=null;
let radarMap=null;
let radarLayer=null;
let radarFrames=[];
let radarIndex=0;
let radarTimer=null;
let lightningInterval=null;
let lightningEnd=null;
const LIGHTNING_KEY='ase-weather-lightning-v1';

const CODES={
  0:['Clear','☀'],1:['Mostly Clear','🌤'],2:['Partly Cloudy','⛅'],3:['Overcast','☁'],
  45:['Fog','🌫'],48:['Freezing Fog','🌫'],
  51:['Light Drizzle','🌦'],53:['Drizzle','🌦'],55:['Heavy Drizzle','🌧'],
  56:['Freezing Drizzle','🌧'],57:['Freezing Drizzle','🌧'],
  61:['Light Rain','🌦'],63:['Rain','🌧'],65:['Heavy Rain','🌧'],
  66:['Freezing Rain','🌧'],67:['Heavy Freezing Rain','🌧'],
  71:['Light Snow','🌨'],73:['Snow','🌨'],75:['Heavy Snow','❄'],77:['Snow Grains','❄'],
  80:['Rain Showers','🌦'],81:['Rain Showers','🌧'],82:['Heavy Showers','⛈'],
  85:['Snow Showers','🌨'],86:['Heavy Snow Showers','🌨'],
  95:['Thunderstorms','⛈'],96:['Thunderstorms with Hail','⛈'],99:['Severe Thunderstorms','⛈']
};

function codeInfo(code){ return CODES[code] || ['Weather','☁']; }
function round(v){ return Math.round(Number(v)||0); }
function fmtTime(value){
  if(!value)return '—';
  return new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
}
function fmtHour(value){
  return new Date(value).toLocaleTimeString([],{hour:'numeric'});
}
function fmtDay(value){
  return new Date(value+'T12:00:00').toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'});
}
function windDir(deg){
  const dirs=['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round((Number(deg)||0)/45)%8];
}
function uvLabel(v){
  v=Number(v)||0;
  if(v<3)return 'Low';
  if(v<6)return 'Moderate';
  if(v<8)return 'High';
  if(v<11)return 'Very High';
  return 'Extreme';
}
function nowHourlyIndex(){
  const now=Date.now();
  const times=weatherData.hourly.time.map(t=>new Date(t).getTime());
  let index=times.findIndex(t=>t>=now);
  return index<0?0:index;
}
function setLive(mode,text){
  const dot=$('#weatherLiveDot'),label=$('#weatherLiveText');
  if(dot)dot.className=`weather-live-dot ${mode}`;
  if(label)label.textContent=text;
}
function showError(message){
  const el=$('#weatherError');
  el.hidden=false;
  el.textContent=message;
}
function hideError(){ $('#weatherError').hidden=true; }

async function loadWeather(){
  setLive('loading','Refreshing live weather…');
  hideError();
  try{
    const response=await fetch(WEATHER_URL,{cache:'no-store'});
    if(!response.ok)throw new Error(`Weather service returned ${response.status}`);
    weatherData=await response.json();
    renderCurrent();
    renderHourly();
    renderDaily();
    renderSafety();
    renderAlerts();
    const source=weatherData.source||'Weather service';
    setLive('ready',`${source} • Updated ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`);
  }catch(error){
    console.error(error);
    setLive('error','Weather connection unavailable');
    showError('Live weather could not be loaded. Check the internet connection and press Refresh Weather.');
  }
}


function renderAlerts(){
  const box=$('#weatherAlerts');
  if(!box)return;
  const alerts=Array.isArray(weatherData?.alerts)?weatherData.alerts:[];
  if(!alerts.length){box.hidden=true;box.innerHTML='';return}
  box.hidden=false;
  box.innerHTML=alerts.map(a=>`<article class="weather-alert-card"><div><span>OFFICIAL NWS ALERT</span><h3>${String(a.event||'Weather Alert')}</h3><p>${String(a.headline||a.description||'Official weather alert is active.')}</p></div><strong>${String(a.severity||'Alert')}</strong></article>`).join('');
}

function renderCurrent(){
  const c=weatherData.current;
  const d=weatherData.daily;
  const hi=round(d.temperature_2m_max[0]),lo=round(d.temperature_2m_min[0]);
  const info=codeInfo(c.weather_code);
  const idx=nowHourlyIndex();
  $('#weatherCondition').textContent=info[0];
  $('#weatherIcon').textContent=info[1];
  $('#weatherUpdated').textContent=`${LOCATION_NAME} • Forecast time ${fmtTime(c.time)}`;
  $('#weatherTemperature').textContent=`${round(c.temperature_2m)}°`;
  $('#weatherFeels').textContent=`${round(c.apparent_temperature)}°`;
  $('#weatherHigh').textContent=`${hi}°`;
  $('#weatherLow').textContent=`${lo}°`;
  $('#weatherRainChance').textContent=`${round(weatherData.hourly.precipitation_probability[idx])}%`;
  $('#weatherRainAmount').textContent=`${Number(c.precipitation||0).toFixed(2)} in current hour`;
  $('#weatherWind').textContent=`${round(c.wind_speed_10m)} mph ${windDir(c.wind_direction_10m)}`;
  $('#weatherGust').textContent=`Gusts ${round(c.wind_gusts_10m)} mph`;
  $('#weatherHumidity').textContent=`${round(c.relative_humidity_2m)}%`;
  $('#weatherDewPoint').textContent=`Dew point ${round(weatherData.hourly.dew_point_2m[idx])}°`;
  $('#weatherUv').textContent=(Number(weatherData.hourly.uv_index[idx])||0).toFixed(1);
  $('#weatherUvLabel').textContent=uvLabel(weatherData.hourly.uv_index[idx]);
  $('#weatherSunset').textContent=fmtTime(d.sunset[0]);
  $('#weatherSunrise').textContent=`Sunrise ${fmtTime(d.sunrise[0])}`;
}

function renderHourly(){
  const h=weatherData.hourly;
  const start=nowHourlyIndex();
  const rows=[];
  for(let i=start;i<Math.min(start+24,h.time.length);i++){
    const info=codeInfo(h.weather_code[i]);
    const rain=round(h.precipitation_probability[i]);
    rows.push(`<article class="weather-hour-row">
      <time>${i===start?'Now':fmtHour(h.time[i])}</time>
      <div class="weather-hour-condition"><span>${info[1]}</span><div><b>${info[0]}</b><small>${round(h.temperature_2m[i])}° • Feels ${round(h.apparent_temperature[i])}°</small></div></div>
      <div class="weather-hour-rain"><div><span style="width:${rain}%"></span></div><b>${rain}%</b></div>
      <div class="weather-hour-wind"><b>${round(h.wind_speed_10m[i])} mph</b><small>Gust ${round(h.wind_gusts_10m[i])}</small></div>
    </article>`);
  }
  $('#weatherHourlyList').innerHTML=rows.join('');
}

function dailyOutlook(code,rain,gust,temp){
  if(code>=95)return ['Severe weather risk','danger'];
  if(rain>=70)return ['Likely rain impacts','warning'];
  if(gust>=30)return ['Wind monitoring','warning'];
  if(temp>=95)return ['Heat precautions','warning'];
  return ['Normal operations','safe'];
}
function renderDaily(){
  const d=weatherData.daily;
  $('#weatherDailyGrid').innerHTML=d.time.map((date,i)=>{
    const info=codeInfo(d.weather_code[i]);
    const outlook=dailyOutlook(d.weather_code[i],d.precipitation_probability_max[i],d.wind_gusts_10m_max[i],d.apparent_temperature_max[i]);
    return `<article class="weather-day-card">
      <div class="weather-day-top"><div><small>${i===0?'Today':fmtDay(date)}</small><h3>${info[0]}</h3></div><span>${info[1]}</span></div>
      <div class="weather-day-temps"><strong>${round(d.temperature_2m_max[i])}°</strong><span>${round(d.temperature_2m_min[i])}°</span></div>
      <dl><div><dt>Rain</dt><dd>${round(d.precipitation_probability_max[i])}%</dd></div><div><dt>Wind</dt><dd>${round(d.wind_speed_10m_max[i])} mph</dd></div><div><dt>Gusts</dt><dd>${round(d.wind_gusts_10m_max[i])} mph</dd></div></dl>
      <p class="weather-outlook ${outlook[1]}">${outlook[0]}</p>
    </article>`;
  }).join('');
}

function applySafetyCard(id,level,title,reason){
  const card=$(id);
  card.classList.remove('safe','watch','danger');
  card.classList.add(level);
  $('h2',card).textContent=title;
  $('p:last-child',card).textContent=reason;
}
function renderSafety(){
  const c=weatherData.current;
  const h=weatherData.hourly;
  const idx=nowHourlyIndex();
  const next6Codes=h.weather_code.slice(idx,idx+6);
  const next6Rain=h.precipitation_probability.slice(idx,idx+6);
  const thunder=next6Codes.some(v=>v>=95);
  const heavyRain=Math.max(...next6Rain.map(Number))>=75;
  const currentGust=Number(c.wind_gusts_10m)||0;
  const feels=Number(c.apparent_temperature)||0;

  if(thunder) applySafetyCard('#weatherPlayStatusCard','danger','Storm Risk — Monitor Closely','Thunderstorms appear in the next six-hour forecast. Use official alerts and direct observations before allowing play.');
  else if(heavyRain) applySafetyCard('#weatherPlayStatusCard','watch','Rain Impact Possible','High rain probability appears in the next six hours. Prepare for delays and monitor radar.');
  else applySafetyCard('#weatherPlayStatusCard','safe','Safe to Play','No major weather risk identified in the current six-hour forecast.');

  if(feels>=105) applySafetyCard('#weatherHeatCard','danger','Dangerous Heat',`Feels like ${round(feels)}°. Consider stopping or significantly modifying strenuous activity.`);
  else if(feels>=95) applySafetyCard('#weatherHeatCard','watch','Extra Heat Precautions',`Feels like ${round(feels)}°. Increase hydration, shade, and recovery breaks.`);
  else if(feels>=85) applySafetyCard('#weatherHeatCard','watch','Water Breaks Recommended',`Feels like ${round(feels)}°. Schedule regular hydration breaks.`);
  else applySafetyCard('#weatherHeatCard','safe','Normal Conditions',`Feels like ${round(feels)}°. Standard hydration breaks.`);

  if(currentGust>=40) applySafetyCard('#weatherWindCard','danger','High Wind Risk',`Current gusts near ${round(currentGust)} mph. Secure tents, signs, and loose equipment.`);
  else if(currentGust>=25) applySafetyCard('#weatherWindCard','watch','Monitor Wind',`Current gusts near ${round(currentGust)} mph. Check tents, inflatables, and loose equipment.`);
  else applySafetyCard('#weatherWindCard','safe','Normal Wind',`Current gusts near ${round(currentGust)} mph. No special action required.`);
}

function initRadar(){
  if(radarMap || typeof L==='undefined')return;
  radarMap=L.map('weatherRadarMap',{zoomControl:true}).setView([LAT,LON],9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:18,
    attribution:'© OpenStreetMap'
  }).addTo(radarMap);
  L.marker([LAT,LON]).addTo(radarMap).bindPopup('Adventure Sports<br>Jackson, NJ');
  loadRadar();
}
async function loadRadar(){
  try{
    const response=await fetch('https://api.rainviewer.com/public/weather-maps.json',{cache:'no-store'});
    const data=await response.json();
    radarFrames=(data.radar?.past||[]).slice(-12);
    if(!radarFrames.length)throw new Error('No radar frames');
    radarIndex=radarFrames.length-1;
    showRadarFrame(radarIndex,data.host);
    radarMap._rainHost=data.host;
  }catch(error){
    $('#weatherRadarTime').textContent='Radar temporarily unavailable';
  }
}
function showRadarFrame(index,host){
  if(!radarFrames.length||!radarMap)return;
  const frame=radarFrames[index];
  if(radarLayer)radarMap.removeLayer(radarLayer);
  radarLayer=L.tileLayer(`${host||radarMap._rainHost}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,{
    opacity:.72,zIndex:10,attribution:'Radar © RainViewer'
  }).addTo(radarMap);
  $('#weatherRadarTime').textContent=`Radar frame: ${new Date(frame.time*1000).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
}
function toggleRadar(){
  const btn=$('#weatherRadarPlay');
  if(radarTimer){
    clearInterval(radarTimer);radarTimer=null;btn.textContent='▶ Animate';return;
  }
  if(!radarFrames.length)return;
  btn.textContent='Ⅱ Pause';
  radarTimer=setInterval(()=>{
    radarIndex=(radarIndex+1)%radarFrames.length;
    showRadarFrame(radarIndex);
  },700);
}

function lightningState(){
  try{return JSON.parse(localStorage.getItem(LIGHTNING_KEY)||'{"log":[]}')}catch{return {log:[]}}
}
function saveLightning(s){localStorage.setItem(LIGHTNING_KEY,JSON.stringify(s))}
function logLightning(action){
  const s=lightningState();
  s.log.unshift({time:new Date().toISOString(),action});
  s.log=s.log.slice(0,40);
  saveLightning(s);
  renderLightningLog();
}
function renderLightningLog(){
  const s=lightningState();
  $('#lightningLog').innerHTML=s.log.length?s.log.map(x=>`<div><span>${x.action}</span><time>${new Date(x.time).toLocaleString()}</time></div>`).join(''):'<div class="weather-log-empty">No lightning timer activity recorded.</div>';
}
function setLightningTimer(end){
  lightningEnd=end;
  const s=lightningState();
  s.end=end;
  saveLightning(s);
  clearInterval(lightningInterval);
  updateLightning();
  lightningInterval=setInterval(updateLightning,1000);
}
function updateLightning(){
  const display=$('#lightningTimerDisplay'),status=$('#lightningTimerStatus');
  if(!lightningEnd){
    display.textContent='30:00';status.textContent='Ready to start';status.className='lightning-timer-status ready';return;
  }
  const remain=Math.max(0,lightningEnd-Date.now());
  const min=Math.floor(remain/60000),sec=Math.floor((remain%60000)/1000);
  display.textContent=`${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  if(remain>0){
    status.textContent='Fields should remain cleared';
    status.className='lightning-timer-status active';
  }else{
    clearInterval(lightningInterval);
    status.textContent='Timer complete — manager must confirm conditions are safe';
    status.className='lightning-timer-status complete';
    const s=lightningState();s.end=null;saveLightning(s);
    lightningEnd=null;
    logLightning('30-minute timer completed');
  }
}
function startLightning(restart=false){
  setLightningTimer(Date.now()+30*60*1000);
  logLightning(restart?'30-minute timer restarted':'Fields cleared and 30-minute timer started');
}
function resetLightning(){
  clearInterval(lightningInterval);lightningEnd=null;
  const s=lightningState();s.end=null;saveLightning(s);
  updateLightning();logLightning('Lightning timer reset');
}

function switchTab(name){
  $$('.weather-tab').forEach(b=>b.classList.toggle('active',b.dataset.weatherTab===name));
  $$('.weather-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.weatherPanel===name));
  if(name==='radar'){
    setTimeout(()=>{initRadar();radarMap?.invalidateSize()},100);
  }
}
function setFieldStatus(status){
  $$('.weather-status-option').forEach(b=>b.classList.toggle('active',b.dataset.weatherStatus===status));
  const messages={
    'OPEN':'All fields are open and operating as scheduled.',
    'DELAYED':'Games are currently delayed due to weather. Please remain clear of the fields and check back for updates.',
    'CLOSED':'Adventure Sports is currently closed due to weather conditions. Please check with your tournament director for schedule updates.',
    'CHECK SCHEDULE':'Weather may affect today’s schedule. Please check with your tournament director for the latest game and field information.'
  };
  $('#weatherAnnouncement').value=messages[status];
}
function openWebsiteControl(){
  const text=$('#weatherAnnouncement').value;
  sessionStorage.setItem('ase-weather-announcement-draft',text);
  const nav=$('[data-view="website"]');
  if(nav)nav.click();
  setTimeout(()=>{
    const input=$('#announcementInput');
    if(input){
      input.value=text;
      input.dispatchEvent(new Event('input',{bubbles:true}));
      input.focus();
    }
  },150);
}
function copyAnnouncement(){
  const text=$('#weatherAnnouncement').value;
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(text).then(()=>toast('Announcement copied.'));
  }else{
    $('#weatherAnnouncement').select();
    document.execCommand('copy');
    toast('Announcement copied.');
  }
}
function toast(message){
  const el=$('#toast');
  if(!el)return;
  el.textContent=message;el.classList.add('show');
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2500);
}

function init(){
  if(!$('#weatherRefresh'))return;
  $('#weatherRefresh').addEventListener('click',loadWeather);
  $$('.weather-tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.weatherTab)));
  $('#weatherRadarPlay').addEventListener('click',toggleRadar);
  $('#weatherRadarLatest').addEventListener('click',()=>{
    radarIndex=Math.max(0,radarFrames.length-1);showRadarFrame(radarIndex);
  });
  $('#lightningStart').addEventListener('click',()=>startLightning(false));
  $('#lightningRestart').addEventListener('click',()=>startLightning(true));
  $('#lightningReset').addEventListener('click',resetLightning);
  $$('.weather-status-option').forEach(b=>b.addEventListener('click',()=>setFieldStatus(b.dataset.weatherStatus)));
  $('#weatherCopyAnnouncement').addEventListener('click',copyAnnouncement);
  $('#weatherOpenWebsiteControl').addEventListener('click',openWebsiteControl);
  const s=lightningState();
  if(s.end && s.end>Date.now())setLightningTimer(s.end);
  else updateLightning();
  renderLightningLog();
  loadWeather();
  setInterval(loadWeather,10*60*1000);
}
document.addEventListener('DOMContentLoaded',init);
})();
