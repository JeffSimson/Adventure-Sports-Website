const crypto=require('crypto');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {sendFCM}=require('./_firebase-fcm');
const {supabase}=require('./_supabase');

const STORE='ase-automation',LAT=40.0919,LON=-74.3587,TZ='America/New_York';
const DEFAULTS={
 enabled:true,
 fieldRelease:true,firstGameReminder:false,lastGameReminder:false,fieldNoGames:false,scheduleChange:true,
 gameMinutes:105,releaseBufferMinutes:15,firstGameLeadMinutes:60,lastGameLeadMinutes:30,fieldReleaseAudience:'staff',scheduleAudience:'management',
 lightningRisk:true,lightningClear:true,lightningClearMinutes:30,nwsWarnings:true,heavyRain:true,dangerousWind:true,extremeHeat:true,freezingCold:false,snowIce:true,poorVisibility:false,
 rainProbability:80,rainInches:.2,windMph:40,heatIndexF:95,coldF:32,visibilityMiles:1,weatherAudience:'everyone',
 overdueWorkOrders:true,urgentWorkOrders:true,unassignedUrgentWork:true,criticalIncidents:true,lowInventory:true,equipmentOutOfService:true,fieldStatusChanges:true,
 operationsAudience:'management',quietHoursEnabled:false,quietStart:'22:00',quietEnd:'06:00'
};
const fp=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex').slice(0,12);
const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'longOffset'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const dateKey=d=>{const p=parts(d);return `${p.year}-${p.month}-${p.day}`};
const offsetFor=key=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'longOffset'}).formatToParts(new Date(`${key}T12:00:00Z`));return (p.find(x=>x.type==='timeZoneName')?.value||'GMT-04:00').replace('GMT','')};
function parseLocal(date,time){const m=String(time).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return null;let h=Number(m[1])%12;if(m[3].toUpperCase()==='PM')h+=12;return new Date(`${date}T${String(h).padStart(2,'0')}:${m[2]}:00${offsetFor(date)}`)}
function audienceMatch(r,a){if(a==='everyone')return true;if(a==='management')return ['owner','manager'].includes(r.role);return ['owner','manager','grounds','kitchen','cashier','employee','staff'].includes(r.role)}
function quiet(settings,now){if(!settings.quietHoursEnabled)return false;const p=parts(now),cur=`${p.hour}:${p.minute}`,s=settings.quietStart,e=settings.quietEnd;return s<e?cur>=s&&cur<e:cur>=s||cur<e}
async function push({title,body,audience='staff',priority='normal',url='/ops/'},settings,now){
 if(quiet(settings,now)&&priority!=='urgent')return {sent:0,failed:0,quiet:true};
 const all=await getStoreValue('ase-notifications','registrations',[]),selected=all.filter(r=>r.enabled!==false&&audienceMatch(r,audience));
 const id=`auto_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,origin='https://adventurenj.com',payload={title,body,url,priority,notificationId:id};
 const settled=await Promise.allSettled(selected.map(r=>sendFCM(r,payload,origin))),invalid=[],accepted=[],failures=[];
 settled.forEach((res,i)=>{const r=selected[i]||{};if(res.status==='fulfilled')accepted.push({email:r.email||'',role:r.role||'',tokenFingerprint:fp(r.token)});else{const message=res.reason?.message||'Firebase error';failures.push({email:r.email||'',role:r.role||'',message});if(/UNREGISTERED|not found|registration-token-not-registered|Requested entity was not found/i.test(message))invalid.push(r.token)}});
 if(invalid.length)await setStoreValue('ase-notifications','registrations',all.filter(r=>!invalid.includes(r.token)));
 const history=await getStoreValue('ase-notifications','history',[]);history.unshift({id,title,body,audience,priority,url,createdAt:now.toISOString(),createdBy:{name:'Operations Automation',email:'automation@adventurenj.com',role:'system'},targeted:selected.length,sent:accepted.length,failed:failures.length,automatic:true});await setStoreValue('ase-notifications','history',history.slice(0,250));
 return {sent:accepted.length,failed:failures.length};
}
async function once(state,key,fn){
 if(state.sent[key])return null;
 // Reserve the alert key before delivery. This makes scheduled retries and most
 // overlapping invocations see the pending key instead of sending a duplicate.
 state.sent[key]=`pending:${new Date().toISOString()}`;
 await setStoreValue(STORE,'state',state);
 try{
  const out=await fn();state.sent[key]=new Date().toISOString();await setStoreValue(STORE,'state',state);return {key,...out};
 }catch(error){delete state.sent[key];await setStoreValue(STORE,'state',state).catch(()=>{});throw error}
}

async function matrixAlerts(s,now,state){
 const out=[],matrix=await getStoreValue('tournament-matrices','current',null);if(!matrix)return out;
 const version=String(matrix.version||matrix.id||'unknown');
 if(state.lastMatrixVersion===undefined)state.lastMatrixVersion=version;
 else if(state.lastMatrixVersion!==version){
  if(s.scheduleChange){const r=await once(state,`matrix-change:${version}`,()=>push({title:'Tournament schedule updated',body:`${matrix.name||'The live tournament matrix'} changed. Review field times and assignments.`,audience:s.scheduleAudience,priority:'high',url:'/ops/#gamesmatrix'},s,now));if(r)out.push(r)}
  state.lastMatrixVersion=version;
 }
 const day=matrix.days?.find(d=>d.key===dateKey(now));if(!day)return out;
 for(const field of matrix.fields||[]){
  const starts=(day.rows||[]).filter(r=>(r[1]||[]).includes(field)).map(r=>parseLocal(day.key,r[0])).filter(Boolean).sort((a,b)=>a-b);
  if(!starts.length){if(s.fieldNoGames&&Number(parts(now).hour)>=7){const r=await once(state,`no-games:${version}:${day.key}:${field}`,()=>push({title:`Field ${field} has no games today`,body:`No tournament games are scheduled on Field ${field}. Confirm whether it is open for rentals, practice, or maintenance.`,audience:s.fieldReleaseAudience,url:'/ops/#gamesmatrix'},s,now));if(r)out.push(r)}continue}
  const first=starts[0],last=starts.at(-1),firstAt=new Date(first.getTime()-s.firstGameLeadMinutes*60000),lastAt=new Date(last.getTime()-s.lastGameLeadMinutes*60000),release=new Date(last.getTime()+(s.gameMinutes+s.releaseBufferMinutes)*60000);
  if(s.firstGameReminder&&now>=firstAt&&now<first){const r=await once(state,`first:${version}:${day.key}:${field}`,()=>push({title:`Field ${field} starts soon`,body:`The first game on Field ${field} begins at ${day.rows.find(r=>(r[1]||[]).includes(field))?.[0]||'the scheduled time'}. Complete field and equipment opening checks.`,audience:s.fieldReleaseAudience,url:'/ops/#gamesmatrix'},s,now));if(r)out.push(r)}
  if(s.lastGameReminder&&now>=lastAt&&now<last){const r=await once(state,`last:${version}:${day.key}:${field}`,()=>push({title:`Final game approaching on Field ${field}`,body:`The last scheduled game on Field ${field} starts in about ${s.lastGameLeadMinutes} minutes. Prepare closing or field-release coverage.`,audience:s.fieldReleaseAudience,url:'/ops/#gamesmatrix'},s,now));if(r)out.push(r)}
  if(s.fieldRelease&&now>=release){const r=await once(state,`release:${version}:${day.key}:${field}`,()=>push({title:`Field ${field} is now open`,body:`The final scheduled game on Field ${field} should be complete, including the ${s.releaseBufferMinutes}-minute cleanup buffer. The field is available unless management changes its status.`,audience:s.fieldReleaseAudience,url:'/ops/#gamesmatrix'},s,now));if(r)out.push(r)}
 }
 return out;
}

async function weatherAlerts(s,now,state){
 const out=[];let nws={features:[]},m=null;
 try{const r=await fetch(`https://api.weather.gov/alerts/active?point=${LAT},${LON}`,{headers:{'User-Agent':'AdventureSportsOperations weather@adventurenj.com','Accept':'application/geo+json'},signal:AbortSignal.timeout(8000)});if(r.ok)nws=await r.json()}catch{}
 try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,weather_code,precipitation,rain,snowfall,wind_gusts_10m,visibility&hourly=precipitation_probability&forecast_hours=2&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America%2FNew_York`,{signal:AbortSignal.timeout(8000)});if(r.ok)m=await r.json()}catch{}
 const thunderAlerts=(nws.features||[]).filter(a=>/thunderstorm|tornado/i.test(a.properties?.event||''));
 for(const a of nws.features||[]){const p=a.properties||{},event=p.event||'',urgent=/tornado|severe thunderstorm|flash flood|extreme wind/i.test(event),lightning=/thunderstorm|tornado/i.test(event);if(s.nwsWarnings||s.lightningRisk&&lightning){const r=await once(state,`nws:${a.id}`,()=>push({title:lightning?'Lightning / severe weather alert':event,body:p.headline||`${event} is active near Adventure Sports. Review outdoor operations immediately.`,audience:s.weatherAudience,priority:urgent?'urgent':'high',url:'/ops/#weather'},s,now));if(r)out.push(r)}}
 const c=m?.current||{},code=Number(c.weather_code||0),prob=Number(m?.hourly?.precipitation_probability?.[0]||0),gust=Number(c.wind_gusts_10m||0),rain=Number(c.rain||c.precipitation||0),temp=Number(c.temperature_2m),feel=Number(c.apparent_temperature),snow=Number(c.snowfall||0),visMiles=Number(c.visibility||999999)/1609.344,hour=`${dateKey(now)}T${parts(now).hour}`;
 const lightningActive=Boolean(thunderAlerts.length||code>=95);
 state.lightning=state.lightning||{active:false,lastDetectedAt:null,episode:0};
 if(lightningActive){
  if(!state.lightning.active){state.lightning.active=true;state.lightning.episode=Number(state.lightning.episode||0)+1;state.lightning.startedAt=now.toISOString()}
  state.lightning.lastDetectedAt=now.toISOString();
  if(s.lightningRisk){const r=await once(state,`lightning-episode:${state.lightning.episode}`,()=>push({title:'Lightning risk detected',body:'Thunderstorm conditions are reported near Adventure Sports. Clear outdoor activity and begin or restart the facility lightning timer.',audience:s.weatherAudience,priority:'urgent',url:'/ops/#weather'},s,now));if(r)out.push(r)}
 }else if(state.lightning.active&&state.lightning.lastDetectedAt){
  const elapsed=now-new Date(state.lightning.lastDetectedAt),clearMs=Number(s.lightningClearMinutes||30)*60000;
  if(s.lightningClear&&elapsed>=clearMs){const r=await once(state,`lightning-clear:${state.lightning.episode}`,()=>push({title:'Lightning clear period complete',body:`No thunderstorm condition has been reported by the automated weather check for ${s.lightningClearMinutes} minutes. Management should confirm on-site conditions before reopening fields.`,audience:s.weatherAudience,priority:'high',url:'/ops/#weather'},s,now));if(r)out.push(r);state.lightning.active=false;state.lightning.clearedAt=now.toISOString()}
 }
 const emit=async(cond,key,title,body,priority='high')=>{if(!cond)return;const r=await once(state,`${key}:${hour}`,()=>push({title,body,audience:s.weatherAudience,priority,url:'/ops/#weather'},s,now));if(r)out.push(r)};
 await emit(s.heavyRain&&(prob>=s.rainProbability||rain>=s.rainInches),'rain','Heavy rain risk',`Rain risk has reached the alert threshold (${Math.round(prob)}% probability). Check drainage and field conditions.`);
 await emit(s.dangerousWind&&gust>=s.windMph,'wind','Dangerous wind conditions',`Wind gusts near ${Math.round(gust)} mph are being reported. Secure tents, signs, inflatables, and loose equipment.`);
 await emit(s.extremeHeat&&feel>=s.heatIndexF,'heat','Extreme heat conditions',`The apparent temperature is about ${Math.round(feel)}°F. Increase water breaks and monitor players and staff for heat illness.`);
 await emit(s.freezingCold&&temp<=s.coldF,'cold','Freezing temperature alert',`Temperature is about ${Math.round(temp)}°F. Check pipes, equipment, walkways, and cold-weather operations.`);
 await emit(s.snowIce&&(snow>0||[71,73,75,77,85,86,56,57,66,67].includes(code)),'snow','Snow or ice risk','Snow, freezing precipitation, or icy conditions may affect the complex. Check roads, walkways, and field access.');
 await emit(s.poorVisibility&&visMiles<=s.visibilityMiles,'visibility','Low visibility conditions',`Visibility is approximately ${visMiles.toFixed(1)} miles. Review driving, parking, and outdoor activity safety.`);
 return out;
}
async function table(path){try{return (await supabase(path)).data||[]}catch{return []}}
async function operationsAlerts(s,now,state){
 const out=[],aud=s.operationsAudience;
 const [wo,mr,inc,inv,eq,fh]=await Promise.all([table('work_orders?select=*&status=not.in.(completed,closed,cancelled)&limit=200'),table('maintenance_requests?select=*&status=not.in.(completed,closed,cancelled)&limit=200'),table('incident_reports?select=*&severity=in.(major,critical)&status=not.in.(closed,archived)&limit=100'),table('inventory_items?select=*&active=eq.true&limit=300'),table('equipment?select=*&limit=200'),table('field_status_history?select=*&order=created_at.desc&limit=50')]);
 for(const x of wo){
  if(s.overdueWorkOrders&&x.due_at&&new Date(x.due_at)<now){const r=await once(state,`wo-overdue:${x.id}:${String(x.updated_at||x.due_at).slice(0,16)}`,()=>push({title:'Work order overdue',body:`${x.title||'A work order'} is overdue. Review and reassign it.`,audience:aud,priority:'high',url:'/ops/#maintenance'},s,now));if(r)out.push(r)}
  if(s.urgentWorkOrders&&/urgent|critical|emergency/i.test(x.priority||'')){const r=await once(state,`wo-urgent:${x.id}`,()=>push({title:'Urgent work order open',body:`${x.title||'An urgent work order'} still needs attention.`,audience:aud,priority:'high',url:'/ops/#maintenance'},s,now));if(r)out.push(r)}
  if(s.unassignedUrgentWork&&!x.assigned_to&&/urgent|critical|emergency|high/i.test(x.priority||'')){const r=await once(state,`wo-unassigned:${x.id}`,()=>push({title:'Urgent work is unassigned',body:`${x.title||'A high-priority work order'} has no assigned employee.`,audience:aud,priority:'high',url:'/ops/#maintenance'},s,now));if(r)out.push(r)}
 }
 for(const x of mr)if(s.unassignedUrgentWork&&!x.assigned_to&&/urgent|critical|emergency|high/i.test(x.priority||'')){const r=await once(state,`mr-unassigned:${x.id}`,()=>push({title:'Maintenance request needs assignment',body:`${x.title||'A high-priority maintenance request'} has not been assigned.`,audience:aud,priority:'high',url:'/ops/#maintenance'},s,now));if(r)out.push(r)}
 for(const x of inc)if(s.criticalIncidents){const r=await once(state,`incident:${x.id}:${x.status}`,()=>push({title:`${String(x.severity||'Major').toUpperCase()} incident requires review`,body:`${x.incident_type||'An incident'} at ${x.location||'the facility'} is still ${x.status||'open'}.`,audience:'management',priority:x.severity==='critical'?'urgent':'high',url:'/ops/#incidents'},s,now));if(r)out.push(r)}
 for(const x of inv)if(s.lowInventory&&Number(x.quantity_on_hand)<=Number(x.reorder_level)&&x.reorder_level!=null){const r=await once(state,`inventory:${x.id}:${x.quantity_on_hand}`,()=>push({title:'Inventory reorder needed',body:`${x.name||'An inventory item'} is at ${x.quantity_on_hand??0} ${x.unit||'units'}, at or below its reorder level.`,audience:aud,url:'/ops/#settings'},s,now));if(r)out.push(r)}
 for(const x of eq)if(s.equipmentOutOfService&&/out.of.service|down|repair|broken/i.test(x.status||'')){const r=await once(state,`equipment:${x.id}:${x.status}`,()=>push({title:'Equipment unavailable',body:`${x.name||'Equipment'} is marked ${x.status}. Confirm repair and backup coverage.`,audience:aud,priority:'high',url:'/ops/#maintenance'},s,now));if(r)out.push(r)}
 if(s.fieldStatusChanges&&fh[0]){const x=fh[0],stamp=x.created_at||x.updated_at||'';if(stamp&&Date.now()-new Date(stamp).getTime()<15*60000){const r=await once(state,`field-status:${x.id||stamp}`,()=>push({title:'Field status changed',body:`A field status was updated${x.status?` to ${x.status}`:''}. Open the Operations Hub for details.`,audience:aud,priority:/closed|delayed/i.test(x.status||'')?'high':'normal',url:'/ops/#maintenance'},s,now));if(r)out.push(r)}}
 return out;
}
exports.handler=async()=>{
 const now=new Date(),runId=`run_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
 let state=null;
 try{
  const s={...DEFAULTS,...await getStoreValue(STORE,'settings',{})};
  state=await getStoreValue(STORE,'state',{sent:{}});state.sent=state.sent||{};
  if(!s.enabled){state.lastRunAt=now.toISOString();state.lastResult={disabled:true};await setStoreValue(STORE,'state',state);return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,disabled:true,checkedAt:now.toISOString()})}}
  const existingUntil=state.running?.until?new Date(state.running.until).getTime():0;
  if(existingUntil>Date.now())return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,skipped:true,reason:'Another automation check is already running.',checkedAt:now.toISOString()})};
  state.running={id:runId,startedAt:now.toISOString(),until:new Date(Date.now()+4*60000).toISOString()};
  await setStoreValue(STORE,'state',state);
  const lock=await getStoreValue(STORE,'state',state);
  if(lock.running?.id!==runId)return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,skipped:true,reason:'A newer automation check owns the run lock.',checkedAt:now.toISOString()})};
  state=lock;state.sent=state.sent||{};
  const cutoff=Date.now()-30*86400000;
  for(const[k,v]of Object.entries(state.sent)){const stamp=String(v).replace(/^pending:/,'');if(new Date(stamp).getTime()<cutoff)delete state.sent[k]}
  const matrix=await matrixAlerts(s,now,state);
  const weather=await weatherAlerts(s,now,state);
  const operations=await operationsAlerts(s,now,state);
  state.lastRunAt=new Date().toISOString();state.lastSuccessAt=state.lastRunAt;state.lastError='';state.lastResult={matrix:matrix.length,weather:weather.length,operations:operations.length};state.running=null;
  await setStoreValue(STORE,'state',state);
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,matrix,weather,operations,checkedAt:state.lastRunAt,lightning:state.lightning||null,dedupeKeys:Object.keys(state.sent).length})};
 }catch(e){
  console.error(e);
  if(state){state.lastRunAt=new Date().toISOString();state.lastErrorAt=state.lastRunAt;state.lastError=e.message;state.running=null;await setStoreValue(STORE,'state',state).catch(()=>{})}
  return {statusCode:500,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:e.message})}
 }
};
