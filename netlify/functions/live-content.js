const {getStoreValue}=require('./_v2-storage');

const DEFAULT_SITE={fieldStatus:'OPEN',announcement:'',updatedAt:null,updatedBy:''};
const TZ='America/New_York';
const FIELDS=['A1','A2','B1','B2','C1','C2','D1','D2'];

const reply=(statusCode,body)=>({
  statusCode,
  headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store',
    'Pragma':'no-cache','Expires':'0','Access-Control-Allow-Origin':'*'
  },
  body:JSON.stringify(body)
});
const dateKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const offsetFor=key=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'longOffset'}).formatToParts(new Date(`${key}T12:00:00Z`));return (p.find(x=>x.type==='timeZoneName')?.value||'GMT-04:00').replace('GMT','')};
function normalizeTime(value){
  const raw=String(value||'').trim();let m=raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(m){let h=Number(m[1]),min=Number(m[2]);if(h<1||h>12||min>59)return null;return `${h}:${String(min).padStart(2,'0')} ${m[3].toUpperCase()}`}
  m=raw.match(/^(\d{1,2}):(\d{2})$/);if(!m)return null;let h=Number(m[1]),min=Number(m[2]);if(h>23||min>59)return null;const ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${String(min).padStart(2,'0')} ${ap}`;
}
function parseLocal(day,time){const m=normalizeTime(time)?.match(/^(\d+):(\d+) (AM|PM)$/);if(!m)return null;let h=Number(m[1])%12;if(m[3]==='PM')h+=12;return new Date(`${day}T${String(h).padStart(2,'0')}:${m[2]}:00${offsetFor(day)}`)}
function effective(game,day,minutes,now){
  if(game.manualStatus)return game.status||'upcoming';
  const start=parseLocal(day,game.time||game.scheduledTime);if(!start||Number.isNaN(start.getTime()))return game.status||'upcoming';
  if(now<start)return'upcoming';if(now<new Date(start.getTime()+minutes*60000))return'in-progress';return'complete';
}
function matrixGames(matrix,day){
  const found=matrix?.days?.find(x=>x.key===day),out=[];if(!found)return out;
  for(const row of found.rows||[]){const time=normalizeTime(row?.[0]);if(!time)continue;for(const field of row?.[1]||[])if(FIELDS.includes(field))out.push({id:`${day}-${time}-${field}`,field,time,scheduledTime:time,status:'upcoming',manualStatus:false,delayMinutes:0,note:''})}
  return out;
}
function buildGameDay(matrix,state,storedBoard,settings,now=new Date()){
  const day=dateKey(now),liveDay=state?.matrixId===matrix?.id?state?.days?.[day]:null;
  const sourceGames=liveDay?.games?.length?liveDay.games:matrixGames(matrix,day),gameMinutes=Math.max(30,Number(settings?.gameMinutes||105));
  const all=sourceGames.map(g=>({...g,effectiveStatus:effective(g,day,gameMinutes,now)})).sort((a,b)=>(parseLocal(day,a.time)||0)-(parseLocal(day,b.time)||0));
  const counts={upcoming:0,'in-progress':0,delayed:0,complete:0,canceled:0};for(const g of all)counts[g.effectiveStatus]=(counts[g.effectiveStatus]||0)+1;
  const lightning=state?.lightning||storedBoard?.lightning||{};
  const headline=state?.publicHeadline||((lightning.active||lightning.status==='clear-ready')?'Weather Delay':counts.delayed?'Game Day Delays':counts['in-progress']?'Games In Progress':'Today’s Game Schedule');
  const message=state?.publicMessage||'';
  return {
    enabled:Boolean(all.length||message||lightning.active),
    matrix:{id:matrix?.id||null,version:matrix?.version||0},matrixName:matrix?.name||'Game Day',date:day,headline,message,
    updatedAt:state?.publicUpdatedAt||liveDay?.updatedAt||storedBoard?.updatedAt||now.toISOString(),
    lightning:{active:Boolean(lightning.active),status:lightning.status||'inactive',clearAt:lightning.clearAt||null,clearMinutes:Number(lightning.clearMinutes||settings?.lightningClearMinutes||30)},
    summary:{...counts,total:all.length,active:(counts['in-progress']||0)+(counts.delayed||0),completed:counts.complete||0},
    games:all.filter(g=>!['complete','canceled'].includes(g.effectiveStatus)).slice(0,16).map(g=>({id:g.id,field:g.field,time:g.time,status:g.effectiveStatus,note:g.note||g.holdReason||'',delayMinutes:Number(g.delayMinutes||0)}))
  };
}

exports.handler=async event=>{
  if(event.httpMethod!=='GET')return reply(405,{error:'Method not allowed.'});
  try{
    const [stored,storedBoard,state,matrix,settings]=await Promise.all([
      getStoreValue('ase-ops-v2','site-status',null),
      getStoreValue('ase-game-day','public',null),
      getStoreValue('ase-game-day','state',null),
      getStoreValue('tournament-matrices','current',null),
      getStoreValue('ase-automation','settings',{})
    ]);
    const gameDay=matrix?buildGameDay(matrix,state,storedBoard,settings):storedBoard||null;
    return reply(200,{...DEFAULT_SITE,...(stored||{}),gameDay,source:stored?'netlify-live-storage':'default'});
  }catch(error){
    console.error('live-content error:',error);
    return reply(200,{...DEFAULT_SITE,gameDay:null,source:'safe-fallback'});
  }
};

module.exports._test={normalizeTime,parseLocal,effective,matrixGames,buildGameDay};
