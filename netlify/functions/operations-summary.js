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
  const [matrix,settings,workOrders,alerts,clover]=await Promise.all([
    getStoreValue('tournament-matrices','current',null),
    getStoreValue('ase-automation','settings',{}),
    safeTable('work_orders?select=*&status=not.in.(completed,closed,cancelled)&limit=100'),
    weather(),cloverStatus(actor)
  ]);
  const cfg={...SETTINGS_DEFAULT,...settings};
  const day=matrix?.days?.find(x=>x.key===today)||null;
  const slots=(day?.rows||[]).map(([time,fields])=>({time,fields,start:parseLocal(today,time)})).filter(x=>x.start).sort((a,b)=>a.start-b.start);
  const games=[];for(const slot of slots)for(const field of slot.fields||[])games.push({field,time:slot.time,start:slot.start.toISOString()});
  const fieldInfo=[];
  for(const field of matrix?.fields||[]){
    const starts=slots.filter(s=>(s.fields||[]).includes(field)).map(s=>s.start);
    if(!starts.length){fieldInfo.push({field,status:'idle',label:'No games today'});continue}
    const current=starts.find(s=>now>=s&&now<new Date(s.getTime()+cfg.gameMinutes*60000));
    const last=starts.at(-1),release=new Date(last.getTime()+(cfg.gameMinutes+cfg.releaseBufferMinutes)*60000);
    const next=starts.find(s=>s>now);
    if(current)fieldInfo.push({field,status:'in-use',label:`Game started ${formatTime(current)}`,currentStart:current.toISOString(),opensAt:release.toISOString()});
    else if(now<release)fieldInfo.push({field,status:'scheduled',label:next?`Next game ${formatTime(next)}`:`Opens ${formatTime(release)}`,nextStart:next?.toISOString()||null,opensAt:release.toISOString()});
    else fieldInfo.push({field,status:'open',label:'Open after final game',opensAt:release.toISOString()});
  }
  const openingSoon=fieldInfo.filter(x=>x.opensAt&&new Date(x.opensAt)>now&&new Date(x.opensAt)-now<=180*60000).sort((a,b)=>new Date(a.opensAt)-new Date(b.opensAt));
  const inUse=fieldInfo.filter(x=>x.status==='in-use');
  const normalizedWorkOrders=workOrders.map(x=>({...x,dueAt:workOrderDue(x)})).sort((a,b)=>{if(!a.dueAt&&!b.dueAt)return 0;if(!a.dueAt)return 1;if(!b.dueAt)return-1;return new Date(a.dueAt)-new Date(b.dueAt)});
  const overdue=normalizedWorkOrders.filter(x=>x.dueAt&&new Date(x.dueAt)<now).map(x=>({...x,overdueMinutes:Math.round((now-new Date(x.dueAt))/60000)}));
  return json(200,{ok:true,checkedAt:now.toISOString(),date:today,matrix:matrix?{id:matrix.id,name:matrix.name,version:matrix.version,dateRange:matrix.dateRange}:null,today:{dayLabel:day?.label||'',gameCount:games.length,slotCount:slots.length,firstStart:slots[0]?.start?.toISOString()||null,lastStart:slots.at(-1)?.start?.toISOString()||null,games:games.slice(0,100),fields:fieldInfo,fieldsInUse:inUse,fieldsOpeningSoon:openingSoon},weather:{activeAlerts:alerts,count:alerts.length},workOrders:{open:normalizedWorkOrders.length,overdue:overdue.length,items:overdue.slice(0,8)},clover});
 }catch(error){return json(error.statusCode||500,{error:error.message||'Operations summary could not be loaded.'})}
};
