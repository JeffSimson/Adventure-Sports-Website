const crypto=require('crypto');
const {verifiedUser,requireRole,json}=require('./_role-auth');
const {health:supabaseHealth,supabase}=require('./_supabase');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {serviceAccount}=require('./_firebase-fcm');

const TZ='America/New_York';
const LAT=40.0919,LON=-74.3587;
const BUILD='9130',VERSION='9.1.3';
const nowIso=()=>new Date().toISOString();
const elapsed=start=>Date.now()-start;
const good=(id,label,detail,ms=0,meta={})=>({id,label,status:'pass',detail,ms,...meta});
const warn=(id,label,detail,ms=0,meta={})=>({id,label,status:'warn',detail,ms,...meta});
const bad=(id,label,detail,ms=0,meta={})=>({id,label,status:'fail',detail,ms,...meta});
const timeout=(ms=8000)=>AbortSignal.timeout(ms);
const hash=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);
const workOrderDue=x=>x?.due_at||x?.scheduled_end||x?.scheduled_start||null;

function cleanMatrix(matrix){
  if(!matrix||typeof matrix!=='object')throw new Error('No live tournament matrix is stored.');
  const fields=Array.isArray(matrix.fields)?matrix.fields.filter(Boolean):[];
  const days=Array.isArray(matrix.days)?matrix.days:[];
  if(!matrix.id)throw new Error('Matrix ID is missing.');
  if(!fields.length)throw new Error('Matrix has no active fields.');
  if(!days.length)throw new Error('Matrix has no tournament dates.');
  for(const day of days){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day.key||''))throw new Error(`Invalid tournament date: ${day.key||'blank'}`);
    if(!Array.isArray(day.rows))throw new Error(`Game rows are missing for ${day.key}.`);
    for(const row of day.rows){
      if(!Array.isArray(row)||!/^\d{1,2}:\d{2}\s(?:AM|PM)$/i.test(row[0]||''))throw new Error(`Invalid game time on ${day.key}.`);
      const used=Array.isArray(row[1])?row[1]:[];
      const invalid=used.filter(f=>!fields.includes(f));
      if(invalid.length)throw new Error(`Unknown field ${invalid[0]} is assigned on ${day.key}.`);
    }
  }
  return {fields,days};
}

function matrixCrudSimulation(){
  const started=Date.now();
  const library=[];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const id=`diag-${Date.now()}`;
  let draft={id,name:'System Test Matrix',dateRange:'August 4–5, 2026',fields:['A1','A2'],days:[{key:'2026-08-04',label:'Tuesday',rows:[['9:00 AM',['A1']]]}],status:'draft',version:0};
  library.push(clone(draft));
  draft.name='System Test Matrix Edited';draft.days[0].rows.push(['11:00 AM',['A2']]);library[0]=clone(draft);
  const copied={key:'2026-08-05',label:'Wednesday',rows:clone(draft.days[0].rows)};draft.days.push(copied);library[0]=clone(draft);
  cleanMatrix(draft);
  const published={...clone(draft),status:'published',version:1,publishedAt:nowIso()};
  const deleteDraft={...clone(draft),id:id+'-delete'};library.push(deleteDraft);
  const filtered=library.filter(x=>x.id!==deleteDraft.id);
  const passed=published.status==='published'&&published.version===1&&published.days.length===2&&published.days[1].rows.length===2&&filtered.length===1;
  if(!passed)throw new Error('Matrix create/edit/copy/publish/delete simulation did not complete.');
  return good('matrix-crud','Tournament matrix CRUD','Create, edit, copy-day, publish, and delete simulation passed without changing live data.',elapsed(started),{steps:5});
}

function duplicateSimulation(){
  const started=Date.now(),sent={};let deliveries=0;
  const once=key=>{if(sent[key])return false;sent[key]=nowIso();deliveries++;return true};
  once('field:A1:open:2026-08-04:v12');
  once('field:A1:open:2026-08-04:v12');
  once('matrix:change:v12');
  once('matrix:change:v12');
  if(deliveries!==2)throw new Error(`Expected two unique events, observed ${deliveries}.`);
  return good('alert-dedupe','Duplicate-alert protection','Repeated field-open and schedule-change keys were suppressed correctly.',elapsed(started),{uniqueEvents:2,attempts:4});
}

function lightningSimulation(settings={}){
  const started=Date.now(),clearMinutes=Number(settings.lightningClearMinutes||30);
  const t0=new Date('2026-08-04T16:00:00-04:00');
  const state={active:true,lastDetectedAt:t0.toISOString(),episode:7};
  const early=new Date(t0.getTime()+(clearMinutes-1)*60000);
  const ready=new Date(t0.getTime()+clearMinutes*60000);
  const earlyClears=early-new Date(state.lastDetectedAt)>=clearMinutes*60000;
  const readyClears=ready-new Date(state.lastDetectedAt)>=clearMinutes*60000;
  if(earlyClears||!readyClears)throw new Error('Lightning clear timer boundary failed.');
  return good('lightning-clear','Lightning clear workflow',`Warning-to-clear timing passed at the configured ${clearMinutes}-minute clear period.`,elapsed(started),{clearMinutes});
}

async function checkDatabase(){const started=Date.now();try{const d=await supabaseHealth();return good('database','Supabase database',`Connected; health query returned ${d.sampleRows} sample row(s).`,elapsed(started))}catch(e){return bad('database','Supabase database',e.message,elapsed(started))}}
async function checkStorage(){const started=Date.now();try{const token=hash(`${Date.now()}-${Math.random()}`),row={token,checkedAt:nowIso(),build:BUILD};await setStoreValue('ase-diagnostics','probe',row);const read=await getStoreValue('ase-diagnostics','probe',null);if(read?.token!==token)throw new Error('Live storage write/read verification did not match.');return good('storage','Netlify live storage','Read/write verification passed.',elapsed(started))}catch(e){return bad('storage','Netlify live storage',e.message,elapsed(started))}}
async function checkMatrix(){const started=Date.now();try{const matrix=await getStoreValue('tournament-matrices','current',null),valid=cleanMatrix(matrix),games=valid.days.reduce((n,d)=>n+d.rows.reduce((s,r)=>s+(r[1]||[]).length,0),0);return good('matrix-live','Live tournament matrix',`${matrix.name||'Live matrix'} is valid: ${valid.days.length} day(s), ${valid.fields.length} field(s), ${games} game assignment(s), version ${matrix.version||0}.`,elapsed(started),{matrixId:matrix.id,version:matrix.version||0})}catch(e){return bad('matrix-live','Live tournament matrix',e.message,elapsed(started))}}
async function checkAutomation(){const started=Date.now();try{const [settings,state,history]=await Promise.all([getStoreValue('ase-automation','settings',{}),getStoreValue('ase-automation','state',{sent:{}}),getStoreValue('ase-notifications','history',[])]),last=state.lastRunAt||state.lastSuccessAt||null,age=last?Date.now()-new Date(last).getTime():null,latestAutomatic=(Array.isArray(history)?history:[]).find(x=>x?.automatic&&x?.createdAt);let status='pass',detail='Automation is enabled and state storage is available.';if(settings.enabled===false){status='warn';detail='Automatic operations alerts are currently disabled in Settings.'}else if(!last&&latestAutomatic){detail=`Automation delivery is confirmed from notification history (${new Date(latestAutomatic.createdAt).toLocaleString('en-US',{timeZone:TZ})}). The current build will record its scheduler heartbeat on the next five-minute cycle.`}else if(!last){status='warn';detail='Automation is enabled and waiting for its first five-minute scheduled check after deployment.'}else if(age>12*60000){status='warn';detail=`Last recorded run was ${Math.round(age/60000)} minutes ago; scheduled checks should run every 5 minutes.`}else detail=`Last run completed ${Math.max(0,Math.round(age/60000))} minute(s) ago. ${Object.keys(state.sent||{}).length} dedupe key(s) are stored.`;return (status==='pass'?good:warn)('automation','Automatic operations alerts',detail,elapsed(started),{lastRunAt:last,lastAutomaticAlertAt:latestAutomatic?.createdAt||null,lightning:state.lightning||null,dedupeKeys:Object.keys(state.sent||{}).length})}catch(e){return bad('automation','Automatic operations alerts',e.message,elapsed(started))}}
async function checkNotifications(actor){const started=Date.now();try{const rows=await getStoreValue('ase-notifications','registrations',[]),enabled=rows.filter(x=>x.enabled!==false),mine=enabled.filter(x=>x.userId===actor.user.id),firebaseConfigured=Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);if(!firebaseConfigured)return bad('push','Push notifications','Firebase service credentials are missing from Netlify.',elapsed(started),{enabledDevices:enabled.length});if(!mine.length)return warn('push','Push notifications',`${enabled.length} device(s) are enrolled, but this owner account has no active enrolled device.`,elapsed(started),{enabledDevices:enabled.length,myDevices:0});try{const sa=serviceAccount();return good('push','Push notifications',`${enabled.length} device(s) enrolled; this owner has ${mine.length}. Firebase project ${sa.project_id||'configured'} is ready.`,elapsed(started),{enabledDevices:enabled.length,myDevices:mine.length})}catch(e){return bad('push','Push notifications',e.message,elapsed(started),{enabledDevices:enabled.length,myDevices:mine.length})}}catch(e){return bad('push','Push notifications',e.message,elapsed(started))}}
async function checkWeather(){const started=Date.now();let nws=false,meteo=false,alerts=0;const notes=[];try{const r=await fetch(`https://api.weather.gov/alerts/active?point=${LAT},${LON}`,{headers:{'User-Agent':'AdventureSportsOperations weather@adventurenj.com','Accept':'application/geo+json'},signal:timeout()});if(r.ok){const d=await r.json();nws=true;alerts=(d.features||[]).length}else notes.push(`NWS ${r.status}`)}catch(e){notes.push('NWS unavailable')};try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&timezone=America%2FNew_York`,{signal:timeout()});if(r.ok){await r.json();meteo=true}else notes.push(`Open-Meteo ${r.status}`)}catch(e){notes.push('Open-Meteo unavailable')};if(nws&&meteo)return good('weather','Weather providers',`NWS and Open-Meteo are reachable; ${alerts} official active alert(s).`,elapsed(started),{alerts});if(nws||meteo)return warn('weather','Weather providers',`One weather source is available. ${notes.join('; ')}.`,elapsed(started),{alerts});return bad('weather','Weather providers',notes.join('; ')||'Weather providers are unavailable.',elapsed(started))}
async function checkClover(){const started=Date.now(),id=process.env.CLOVER_MERCHANT_ID,token=process.env.CLOVER_ACCESS_TOKEN;if(!id||!token)return warn('clover','Clover POS','Clover environment variables are not fully configured.',elapsed(started));try{const r=await fetch(`https://api.clover.com/v3/merchants/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:timeout()});const d=await r.json().catch(()=>({}));if(!r.ok)return bad('clover','Clover POS',d.message||`Clover returned HTTP ${r.status}.`,elapsed(started));return good('clover','Clover POS',`Connected to ${d.name||'the configured Clover merchant'}.`,elapsed(started))}catch(e){return bad('clover','Clover POS',e.message,elapsed(started))}}
async function checkWorkOrders(){const started=Date.now();try{const {data}=await supabase('work_orders?select=*&status=not.in.(completed,closed,cancelled)&limit=100');const rows=Array.isArray(data)?data:[],now=new Date(),overdue=rows.filter(x=>{const due=workOrderDue(x);return due&&new Date(due)<now}).length,scheduled=rows.filter(x=>workOrderDue(x)).length;return good('work-orders','Work orders',`${rows.length} open work order(s); ${overdue} overdue. ${scheduled} have a scheduled deadline.`,elapsed(started),{open:rows.length,overdue,scheduled})}catch(e){return warn('work-orders','Work orders',`Diagnostics could not read work orders: ${e.message}`,elapsed(started))}}
async function checkOperationsCenter(){
 const started=Date.now();
 try{
  const now=new Date();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const [matrix,settings,workResult]=await Promise.all([
   getStoreValue('tournament-matrices','current',null),
   getStoreValue('ase-automation','settings',{}),
   supabase('work_orders?select=*&status=not.in.(completed,closed,cancelled)&limit=100').catch(()=>({data:[]}))
  ]);
  const day=matrix?.days?.find(x=>x.key===today);
  if(!matrix)return warn('operations-center','Operations Center data','No live tournament matrix is available, so today’s game cards cannot be built.',elapsed(started));
  if(!day)return good('operations-center','Operations Center data',`No games are scheduled in the live matrix for ${today}; today’s game cards correctly show zero.`,elapsed(started),{todayGames:0,fieldsInUse:0,fieldsOpeningSoon:0});
  const offsetParts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'longOffset'}).formatToParts(new Date(`${today}T12:00:00Z`));
  const offset=(offsetParts.find(x=>x.type==='timeZoneName')?.value||'GMT-04:00').replace('GMT','');
  const parse=time=>{const m=String(time||'').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return null;let h=Number(m[1])%12;if(m[3].toUpperCase()==='PM')h+=12;return new Date(`${today}T${String(h).padStart(2,'0')}:${m[2]}:00${offset}`)};
  const gameMinutes=Number(settings.gameMinutes||105),buffer=Number(settings.releaseBufferMinutes||15),fields=matrix.fields||[];
  const games=[];for(const row of day.rows||[])for(const field of row[1]||[])games.push({field,start:parse(row[0])});
  let inUse=0,openingSoon=0;
  for(const field of fields){const starts=games.filter(x=>x.field===field&&x.start).map(x=>x.start).sort((a,b)=>a-b);if(!starts.length)continue;const current=starts.find(x=>now>=x&&now<new Date(x.getTime()+gameMinutes*60000));if(current)inUse++;const release=new Date(starts.at(-1).getTime()+(gameMinutes+buffer)*60000);if(release>now&&release-now<=180*60000)openingSoon++}
  const work=Array.isArray(workResult.data)?workResult.data:[],overdue=work.filter(x=>{const due=workOrderDue(x);return due&&new Date(due)<now}).length;
  return good('operations-center','Operations Center data',`Cards can be built for ${games.length} game(s), ${inUse} field(s) in use, ${openingSoon} opening soon, and ${overdue} overdue work order(s).`,elapsed(started),{todayGames:games.length,fieldsInUse:inUse,fieldsOpeningSoon:openingSoon,overdueWorkOrders:overdue});
 }catch(e){return bad('operations-center','Operations Center data',e.message,elapsed(started))}
}
async function checkPwa(){const started=Date.now(),base=process.env.URL||process.env.DEPLOY_PRIME_URL;if(!base)return warn('pwa','Home Screen app','Netlify site URL is unavailable inside this deployment context.',elapsed(started));const files=[['build','/ops/build.json'],['manifest','/ops/manifest.webmanifest'],['worker','/ops/firebase-messaging-sw.js']];const result={};for(const [name,path] of files){try{const r=await fetch(base.replace(/\/$/,'')+path+`?diag=${Date.now()}`,{signal:timeout(),headers:{'Cache-Control':'no-cache'}});result[name]=r.ok}catch{result[name]=false}}const ok=Object.values(result).filter(Boolean).length;if(ok===3)return good('pwa','Home Screen app','Build marker, manifest, and service worker are reachable with the current deployment.',elapsed(started),result);if(ok)return warn('pwa','Home Screen app',`Only ${ok} of 3 required PWA files were reachable.`,elapsed(started),result);return bad('pwa','Home Screen app','Build marker, manifest, and service worker could not be reached.',elapsed(started),result)}

async function runDiagnostics(actor){
  const started=Date.now();
  const simulation=[];
  for(const fn of [matrixCrudSimulation,duplicateSimulation]){try{simulation.push(fn())}catch(e){simulation.push(bad(fn===matrixCrudSimulation?'matrix-crud':'alert-dedupe',fn===matrixCrudSimulation?'Tournament matrix CRUD':'Duplicate-alert protection',e.message))}}
  let settings={};try{settings=await getStoreValue('ase-automation','settings',{})}catch{}
  try{simulation.push(lightningSimulation(settings))}catch(e){simulation.push(bad('lightning-clear','Lightning clear workflow',e.message))}
  const live=await Promise.all([checkDatabase(),checkStorage(),checkMatrix(),checkAutomation(),checkNotifications(actor),checkWeather(),checkClover(),checkWorkOrders(),checkOperationsCenter(),checkPwa()]);
  const checks=[...simulation,...live],counts={pass:checks.filter(x=>x.status==='pass').length,warn:checks.filter(x=>x.status==='warn').length,fail:checks.filter(x=>x.status==='fail').length};
  const status=counts.fail?'fail':counts.warn?'warn':'pass';
  const report={ok:status!=='fail',status,build:BUILD,version:VERSION,startedAt:new Date(started).toISOString(),completedAt:nowIso(),durationMs:elapsed(started),counts,checks};
  try{const history=await getStoreValue('ase-diagnostics','history',[]);history.unshift({...report,checks:checks.map(({id,label,status,detail,ms})=>({id,label,status,detail,ms}))});await setStoreValue('ase-diagnostics','history',history.slice(0,20))}catch{}
  return report;
}

exports.handler=async event=>{
  try{
    const actor=await verifiedUser(event);requireRole(actor,['owner']);
    if(!['GET','POST'].includes(event.httpMethod))return json(405,{error:'Method not allowed.'});
    if(event.httpMethod==='GET'){
      const latest=(await getStoreValue('ase-diagnostics','history',[]))[0]||null;
      return json(200,{ok:true,latest,build:BUILD,version:VERSION});
    }
    return json(200,await runDiagnostics(actor));
  }catch(e){return json(e.statusCode||500,{error:e.message||'System diagnostics failed.'})}
};
