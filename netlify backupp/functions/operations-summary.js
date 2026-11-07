const {verifiedUser,json}=require('./_role-auth');
const {getStoreValue}=require('./_v2-storage');
const {supabase}=require('./_supabase');

const TZ='America/New_York';
const LAT=40.0919,LON=-74.3587;
const SETTINGS_DEFAULT={gameMinutes:105,releaseBufferMinutes:15};
const dateKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'longOffset'}).formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const offsetFor=key=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'longOffset'}).formatToParts(new Date(`${key}T12:00:00Z`));return (p.find(x=>x.type==='timeZoneName')?.value||'GMT-04:00').replace('GMT','')};
function parseLocal(key,time){const m=String(time||'').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m)return null;let h=Number(m[1])%12;if(m[3].toUpperCase()==='PM')h+=12;return new Date(`${key}T${String(h).padStart(2,'0')}:${m[2]}:00${offsetFor(key)}`)}
const formatTime=d=>new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit'}).format(d);
const workOrderDue=x=>x?.due_at||x?.scheduled_end||x?.scheduled_start||null;
async function safeTable(path){try{return (await supabase(path)).data||[]}catch{return []}}
async function weather(){
 try{
  const r=await fetch(`https://api.weather.gov/alerts/active?point=${LAT},${LON}`,{headers:{'User-Agent':'AdventureSportsOperations weather@adventurenj.com','Accept':'application/geo+json'},signal:AbortSignal.timeout(7000)});
  if(!r.ok)throw new Error('NWS unavailable');
  const d=await r.json();return (d.features||[]).map(x=>({id:x.id,event:x.properties?.event||'Weather Alert',severity:x.properties?.severity||'',headline:x.properties?.headline||'',expires:x.properties?.expires||null})).slice(0,8);
 }catch{return []}
}
async function cloverStatus(actor){
 if(!['owner','manager'].includes(actor.role))return {visible:false,status:'restricted',label:'Restricted'};
 const id=process.env.CLOVER_MERCHANT_ID,token=process.env.CLOVER_ACCESS_TOKEN;
 if(!id||!token)return {visible:true,status:'setup',label:'Needs setup'};
 try{
  const r=await fetch(`https://api.clover.com/v3/merchants/${encodeURIComponent(id)}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(7000)});
  if(!r.ok)return {visible:true,status:'error',label:`Connection issue (${r.status})`};
  const d=await r.json();return {visible:true,status:'live',label:'Live',merchant:d.name||'Adventure Sports'};
 }catch{return {visible:true,status:'error',label:'Connection issue'}}
}
exports.handler=async event=>{
 try{
  const actor=await verifiedUser(event),now=new Date(),today=dateKey(now);
  const [matrix,settings,gameDayState,workOrders,alerts,clover]=await Promise.all([
    getStoreValue('tournament-matrices','current',null),
    getStoreValue('ase-automation','settings',{}),
    getStoreValue('ase-game-day','state',null),
    safeTable('work_orders?select=*&status=not.in.(completed,closed,cancelled)&limit=100'),
    weather(),cloverStatus(actor)
  ]);
  const cfg={...SETTINGS_DEFAULT,...settings};
  const day=matrix?.days?.find(x=>x.key===today)||null;
  const slots=(day?.rows||[]).map(([time,fields])=>({time,fields,start:parseLocal(today,time)})).filter(x=>x.start).sort((a,b)=>a.start-b.start);
  const liveDay=gameDayState?.matrixId===matrix?.id?gameDayState?.days?.[today]:null;
  const effectiveStatus=g=>{if(g.manualStatus)return g.status;const start=parseLocal(today,g.time);if(!start||now<start)return'upcoming';return now<new Date(start.getTime()+cfg.gameMinutes*60000)?'in-progress':'complete'};
  const games=liveDay?.games?.length?liveDay.games.map(g=>({id:g.id,field:g.field,time:g.time,start:parseLocal(today,g.time)?.toISOString()||null,status:effectiveStatus(g),manualStatus:!!g.manualStatus,delayMinutes:g.delayMinutes||0,completedAt:g.completedAt||null,originalField:g.originalField,originalTime:g.originalTime,note:g.note||g.holdReason||''})):(()=>{const out=[];for(const slot of slots)for(const field of slot.fields||[])out.push({field,time:slot.time,start:slot.start.toISOString(),status:now>=slot.start&&now<new Date(slot.start.getTime()+cfg.gameMinutes*60000)?'in-progress':now>=new Date(slot.start.getTime()+cfg.gameMinutes*60000)?'complete':'upcoming'});return out})();
  const fieldInfo=[];
  for(const field of matrix?.fields||[]){
    const fieldGames=games.filter(g=>g.field===field&&g.status!=='canceled').sort((a,b)=>new Date(a.start)-new Date(b.start));
    const readiness=liveDay?.fields?.[field]||{};
    if(!fieldGames.length){fieldInfo.push({field,status:'idle',label:'No games today',cleanup:readiness.cleanup||'ready',setup:readiness.setup||'ready'});continue}
    const current=fieldGames.find(g=>g.status==='in-progress'),delayed=fieldGames.find(g=>g.status==='delayed'),next=fieldGames.find(g=>['upcoming','delayed'].includes(g.status));
    const last=fieldGames.at(-1);let release=null;
    if(last.status==='complete'&&last.completedAt)release=new Date(new Date(last.completedAt).getTime()+cfg.releaseBufferMinutes*60000);
    else if(!['upcoming','in-progress','delayed'].includes(last.status))release=new Date(new Date(last.start).getTime()+(cfg.gameMinutes+cfg.releaseBufferMinutes)*60000);
    else release=new Date(new Date(last.start).getTime()+(cfg.gameMinutes+cfg.releaseBufferMinutes)*60000);
    const readinessData={cleanup:readiness.cleanup||'ready',setup:readiness.setup||'ready'};
    if(current)fieldInfo.push({field,status:'in-use',label:`Game started ${current.time}`,currentStart:current.start,opensAt:release?.toISOString()||null,...readinessData});
    else if(delayed)fieldInfo.push({field,status:'delayed',label:`Delayed from ${delayed.originalTime||delayed.time}`,nextStart:delayed.start,opensAt:release?.toISOString()||null,...readinessData});
    else if(readiness.cleanup==='needed')fieldInfo.push({field,status:'cleanup',label:'Cleanup needed',opensAt:release?.toISOString()||null,...readinessData});
    else if(readiness.setup==='needed')fieldInfo.push({field,status:'setup',label:'Setup change needed',opensAt:release?.toISOString()||null,...readinessData});
    else if(next)fieldInfo.push({field,status:'scheduled',label:`Next game ${next.time}`,nextStart:next.start,opensAt:release?.toISOString()||null,...readinessData});
    else fieldInfo.push({field,status:'open',label:'Open after final game',opensAt:release?.toISOString()||null,...readinessData});
  }
  const openingSoon=fieldInfo.filter(x=>x.opensAt&&new Date(x.opensAt)>now&&new Date(x.opensAt)-now<=180*60000).sort((a,b)=>new Date(a.opensAt)-new Date(b.opensAt));
  const inUse=fieldInfo.filter(x=>x.status==='in-use');
  const delayedGames=games.filter(x=>x.status==='delayed');
  const cleanupNeeded=fieldInfo.filter(x=>x.cleanup==='needed');
  const setupNeeded=fieldInfo.filter(x=>x.setup==='needed');
  const normalizedWorkOrders=workOrders.map(x=>({...x,dueAt:workOrderDue(x)})).sort((a,b)=>{if(!a.dueAt&&!b.dueAt)return 0;if(!a.dueAt)return 1;if(!b.dueAt)return-1;return new Date(a.dueAt)-new Date(b.dueAt)});
  const overdue=normalizedWorkOrders.filter(x=>x.dueAt&&new Date(x.dueAt)<now).map(x=>({...x,overdueMinutes:Math.round((now-new Date(x.dueAt))/60000)}));
  return json(200,{ok:true,checkedAt:now.toISOString(),date:today,matrix:matrix?{id:matrix.id,name:matrix.name,version:matrix.version,dateRange:matrix.dateRange}:null,today:{dayLabel:day?.label||'',gameCount:games.length,slotCount:slots.length,firstStart:games[0]?.start||slots[0]?.start?.toISOString()||null,lastStart:games.at(-1)?.start||slots.at(-1)?.start?.toISOString()||null,games:games.slice(0,100),fields:fieldInfo,fieldsInUse:inUse,fieldsOpeningSoon:openingSoon,delayedGames,cleanupNeeded,setupNeeded,lightning:gameDayState?.lightning||null},weather:{activeAlerts:alerts,count:alerts.length},workOrders:{open:normalizedWorkOrders.length,overdue:overdue.length,items:overdue.slice(0,8)},clover});
 }catch(error){return json(error.statusCode||500,{error:error.message||'Operations summary could not be loaded.'})}
};
