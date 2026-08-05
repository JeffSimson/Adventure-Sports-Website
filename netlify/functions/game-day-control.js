const crypto=require('crypto');
const {verifiedUser,requireRole,json}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const {sendFCM}=require('./_firebase-fcm');

const STORE='ase-game-day';
const STATE_KEY='state';
const PUBLIC_KEY='public';
const MATRIX_STORE='tournament-matrices';
const TZ='America/New_York';
const STANDARD_FIELDS=['A1','A2','B1','B2','C1','C2','D1','D2'];
const STATUS=['upcoming','in-progress','delayed','complete','canceled'];
const SETUP_NOTES={
  A2:'Confirm the current division setup before play. This field may change between 11U and 12U.',
  C2:'Confirm mound and division setup before play. This field may change from coach pitch to 9U.'
};
const DEFAULT_STATE={matrixId:null,matrixVersion:null,days:{},lightning:{status:'inactive',active:false,startedAt:null,lastStrikeAt:null,clearAt:null,clearMinutes:30,clearedAt:null,updatedAt:null,updatedBy:''},publicMessage:'',publicHeadline:'',publicUpdatedAt:null,audit:[]};

const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const clean=v=>String(v??'').trim();
const clamp=(v,min,max,fallback)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback};
const dateKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const offsetFor=key=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,timeZoneName:'longOffset'}).formatToParts(new Date(`${key}T12:00:00Z`));return (p.find(x=>x.type==='timeZoneName')?.value||'GMT-04:00').replace('GMT','')};
function normalizeTime(value){
  const raw=clean(value);
  let m=raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if(m){let h=Number(m[1]);const min=Number(m[2]);if(h<1||h>12||min>59)return null;return `${h}:${String(min).padStart(2,'0')} ${m[3].toUpperCase()}`}
  m=raw.match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return null;
  let h=Number(m[1]),min=Number(m[2]);if(h>23||min>59)return null;const ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${String(min).padStart(2,'0')} ${ap}`;
}
function time24(value){const m=normalizeTime(value)?.match(/^(\d+):(\d+) (AM|PM)$/);if(!m)return'09:00';let h=Number(m[1])%12;if(m[3]==='PM')h+=12;return `${String(h).padStart(2,'0')}:${m[2]}`}
function parseLocal(day,time){const t=time24(time);return new Date(`${day}T${t}:00${offsetFor(day)}`)}
function addMinutes(time,minutes){const [h,m]=time24(time).split(':').map(Number),d=new Date(Date.UTC(2020,0,1,h,m));d.setUTCMinutes(d.getUTCMinutes()+Number(minutes||0));let hour=d.getUTCHours(),ap=hour>=12?'PM':'AM';hour=hour%12||12;return `${hour}:${String(d.getUTCMinutes()).padStart(2,'0')} ${ap}`}
function sourceKey(day,time,field){return `${day}|${normalizeTime(time)||time}|${field}`}
function gameId(matrix,day,time,field){return 'g_'+crypto.createHash('sha1').update(`${matrix?.id||'matrix'}|${matrix?.version||0}|${sourceKey(day,time,field)}`).digest('hex').slice(0,16)}
function actorInfo(actor){return {id:actor.user.id,email:actor.user.email,name:actor.user.user_metadata?.full_name||actor.user.email,role:actor.role}}
function auditEntry(actor,action,summary,details={}){return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),actor:actorInfo(actor),action,summary,details}}
function safeState(value){return {...DEFAULT_STATE,...(value||{}),days:{...((value||{}).days||{})},lightning:{...DEFAULT_STATE.lightning,...((value||{}).lightning||{})},audit:Array.isArray(value?.audit)?value.audit:[]}}
function effectiveStatus(game,day,gameMinutes=105,now=new Date()){
  if(game.manualStatus)return game.status;
  const start=parseLocal(day,game.time||game.scheduledTime);
  if(Number.isNaN(start.getTime()))return game.status||'upcoming';
  if(now<start)return'upcoming';
  if(now<new Date(start.getTime()+gameMinutes*60000))return'in-progress';
  return'complete';
}
function baseGames(matrix,day){
  const d=matrix?.days?.find(x=>x.key===day);if(!d)return[];
  const out=[];
  for(const row of d.rows||[]){
    const time=normalizeTime(row?.[0]);if(!time)continue;
    for(const field of row?.[1]||[]){
      if(!STANDARD_FIELDS.includes(field))continue;
      const source=sourceKey(day,time,field);
      out.push({id:gameId(matrix,day,time,field),sourceKey:source,date:day,originalTime:time,scheduledTime:time,time,originalField:field,field,status:'upcoming',manualStatus:false,delayMinutes:0,note:'',holdReason:'',startedAt:null,completedAt:null,canceledAt:null,updatedAt:null,updatedBy:''});
    }
  }
  return out.sort((a,b)=>time24(a.time).localeCompare(time24(b.time))||STANDARD_FIELDS.indexOf(a.field)-STANDARD_FIELDS.indexOf(b.field));
}
function syncDay(state,matrix,day){
  const prior=state.days[day]||{date:day,games:[],fields:{},updatedAt:null,updatedBy:''};
  const bySource=new Map((prior.games||[]).map(g=>[g.sourceKey,g]));
  const games=baseGames(matrix,day).map(base=>{
    const old=bySource.get(base.sourceKey);if(!old)return base;
    return {...base,...old,id:base.id,sourceKey:base.sourceKey,date:day,originalTime:base.originalTime,originalField:base.originalField,scheduledTime:base.scheduledTime};
  });
  // Keep a manually moved or canceled game when its source slot was just removed from a republished matrix.
  for(const old of prior.games||[]){if(!games.some(g=>g.sourceKey===old.sourceKey)&&old.manualStatus)games.push(old)}
  games.sort((a,b)=>time24(a.time).localeCompare(time24(b.time))||STANDARD_FIELDS.indexOf(a.field)-STANDARD_FIELDS.indexOf(b.field));
  const fields={};
  for(const field of matrix?.fields||STANDARD_FIELDS){
    const old=prior.fields?.[field]||{};
    fields[field]={field,cleanup:old.cleanup||'ready',cleanupUpdatedAt:old.cleanupUpdatedAt||null,setup:old.setup||(SETUP_NOTES[field]?'needed':'ready'),setupNote:SETUP_NOTES[field]||'',setupUpdatedAt:old.setupUpdatedAt||null,updatedBy:old.updatedBy||''};
  }
  const next={...prior,date:day,games,fields};state.days[day]=next;return next;
}
function decorateDay(dayState,settings={},now=new Date()){
  const gameMinutes=clamp(settings.gameMinutes,30,240,105);
  const games=(dayState?.games||[]).map(g=>({...g,effectiveStatus:effectiveStatus(g,dayState.date,gameMinutes,now),startAt:parseLocal(dayState.date,g.time).toISOString()}));
  return {...dayState,games};
}
function stats(day){const counts={upcoming:0,'in-progress':0,delayed:0,complete:0,canceled:0};for(const g of day?.games||[])counts[g.effectiveStatus||g.status]=(counts[g.effectiveStatus||g.status]||0)+1;return {...counts,total:day?.games?.length||0,active:(counts['in-progress']||0)+(counts.delayed||0)}}
function publicData(state,matrix,dayState,settings={},now=new Date()){
  const day=decorateDay(dayState,settings,now),s=stats(day),lightning=state.lightning||{};
  const games=(day.games||[]).filter(g=>!['complete','canceled'].includes(g.effectiveStatus)).slice(0,16).map(g=>({id:g.id,field:g.field,time:g.time,status:g.effectiveStatus,note:g.note||'',delayMinutes:g.delayMinutes||0}));
  const completed=(day.games||[]).filter(g=>g.effectiveStatus==='complete').length;
  return {enabled:Boolean(day.games?.length||state.publicMessage||lightning.active),matrix:{id:matrix?.id||null,version:matrix?.version||0},matrixName:matrix?.name||'Game Day',date:day.date||dateKey(now),headline:state.publicHeadline||((lightning.active||lightning.status==='clear-ready')?'Weather Delay':s.delayed?'Game Day Delays':s['in-progress']?'Games In Progress':'Today’s Game Schedule'),message:state.publicMessage||'',updatedAt:state.publicUpdatedAt||state.updatedAt||now.toISOString(),lightning:{active:Boolean(lightning.active),status:lightning.status||'inactive',clearAt:lightning.clearAt||null,clearMinutes:lightning.clearMinutes||30},summary:{...s,completed},games};
}
async function saveAll(state,matrix,dayState,settings={}){
  state.updatedAt=new Date().toISOString();
  const publicBoard=publicData(state,matrix,dayState,settings);
  await Promise.all([setStoreValue(STORE,STATE_KEY,state),setStoreValue(STORE,PUBLIC_KEY,publicBoard)]);
  return publicBoard;
}
function findGame(day,id){const game=(day.games||[]).find(x=>x.id===id);if(!game)throw fail('That game could not be found.',404);return game}
function pushAudit(state,entry){state.audit.unshift(entry);state.audit=state.audit.slice(0,300)}
function audienceMatch(reg,audience){if(audience==='everyone'||audience==='teams-public')return true;if(audience==='management')return ['owner','manager'].includes(reg.role);return ['owner','manager','grounds','kitchen','cashier','employee','staff'].includes(reg.role)}
async function sendBroadcast(actor,{title,body,audience='staff',priority='normal',url='/ops/#gamesmatrix'}){
  const all=await getStoreValue('ase-notifications','registrations',[]),selected=all.filter(r=>r.enabled!==false&&audienceMatch(r,audience));
  const id=`gameday_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,origin='https://adventurenj.com',payload={title,body,url,priority,notificationId:id};
  const settled=await Promise.allSettled(selected.map(r=>sendFCM(r,payload,origin))),invalid=[],accepted=[],failures=[];
  settled.forEach((result,i)=>{const reg=selected[i]||{};if(result.status==='fulfilled')accepted.push({email:reg.email||'',role:reg.role||''});else{const message=result.reason?.message||'Push delivery error';failures.push({email:reg.email||'',role:reg.role||'',message});if(/UNREGISTERED|not found|registration-token-not-registered|Requested entity was not found/i.test(message))invalid.push(reg.token)}});
  if(invalid.length)await setStoreValue('ase-notifications','registrations',all.filter(r=>!invalid.includes(r.token)));
  const history=await getStoreValue('ase-notifications','history',[]);history.unshift({id,title,body,audience,priority,url,createdAt:new Date().toISOString(),createdBy:actorInfo(actor),targeted:selected.length,sent:accepted.length,failed:failures.length,gameDay:true});await setStoreValue('ase-notifications','history',history.slice(0,250));
  return {targeted:selected.length,sent:accepted.length,failed:failures.length};
}
function titleForStatus(game,status){const label=status.replace('-', ' ');return `Field ${game.field}: ${label[0].toUpperCase()+label.slice(1)}`}

exports.handler=async event=>{
  try{
    const actor=await verifiedUser(event);requireRole(actor,['owner','manager']);
    const matrix=await getStoreValue(MATRIX_STORE,'current',null);if(!matrix)throw fail('Publish a tournament matrix before opening Game Day Control.',409);
    let state=safeState(await getStoreValue(STORE,STATE_KEY,DEFAULT_STATE));
    state.matrixId=matrix.id;state.matrixVersion=matrix.version||0;
    const settings={...await getStoreValue('ase-automation','settings',{})};
    const requestedDate=clean(event.queryStringParameters?.date)||dateKey(new Date());
    if(!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))throw fail('Choose a valid game date.');
    let day=syncDay(state,matrix,requestedDate);
    if(event.httpMethod==='GET'){
      const decorated=decorateDay(day,settings),board=await saveAll(state,matrix,day,settings);
      return json(200,{ok:true,matrix:{id:matrix.id,name:matrix.name,version:matrix.version||0,dateRange:matrix.dateRange,fields:matrix.fields||STANDARD_FIELDS,days:(matrix.days||[]).map(d=>({key:d.key,label:d.label,short:d.short}))},date:requestedDate,day:decorated,stats:stats(decorated),lightning:state.lightning,public:board,audit:state.audit.slice(0,100),canManage:true,settings:{gameMinutes:settings.gameMinutes||105,releaseBufferMinutes:settings.releaseBufferMinutes||15,lightningClearMinutes:settings.lightningClearMinutes||30}});
    }
    if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
    const body=JSON.parse(event.body||'{}'),action=clean(body.action);if(!action)throw fail('Choose a Game Day action.');
    const now=new Date(),who=actorInfo(actor);let summary='',broadcast=null;

    if(action==='status'){
      const game=findGame(day,body.gameId),status=clean(body.status);if(!STATUS.includes(status))throw fail('Choose a valid game status.');
      game.status=status;game.manualStatus=true;game.updatedAt=now.toISOString();game.updatedBy=who.name;
      if(status==='in-progress'){game.startedAt=game.startedAt||now.toISOString();game.completedAt=null;game.canceledAt=null;day.fields[game.field].cleanup='ready'}
      if(status==='complete'){game.completedAt=now.toISOString();game.canceledAt=null;day.fields[game.field].cleanup='needed';day.fields[game.field].cleanupUpdatedAt=now.toISOString()}
      if(status==='canceled'){game.canceledAt=now.toISOString();game.completedAt=null}
      if(status==='upcoming'){game.startedAt=null;game.completedAt=null;game.canceledAt=null;game.holdReason=''}
      if(status==='delayed')game.holdReason=clean(body.reason)||game.holdReason||'Game day delay';
      summary=`Marked Field ${game.field} at ${game.time} ${status}.`;
      if(body.notify){const title=titleForStatus(game,status),message=clean(body.message)||`${matrix.name}: the ${game.time} game on Field ${game.field} is ${status.replace('-',' ')}.`;broadcast=await sendBroadcast(actor,{title,body:message,audience:body.audience||'staff',priority:status==='canceled'||status==='delayed'?'high':'normal'});state.publicHeadline=title;state.publicMessage=message;state.publicUpdatedAt=now.toISOString()}
    }else if(action==='move'){
      const game=findGame(day,body.gameId),from=`Field ${game.field} at ${game.time}`,field=clean(body.field),time=normalizeTime(body.time);if(!STANDARD_FIELDS.includes(field)||!(matrix.fields||STANDARD_FIELDS).includes(field))throw fail('Choose a field included in the live matrix.');if(!time)throw fail('Choose a valid game time.');
      game.field=field;game.time=time;game.delayMinutes=Math.round((parseLocal(day.date,time)-parseLocal(day.date,game.scheduledTime))/60000);game.manualStatus=true;if(game.status==='complete')game.status='upcoming';game.updatedAt=now.toISOString();game.updatedBy=who.name;
      summary=`Moved ${from} to Field ${field} at ${time}.`;
      if(body.notify){const title='Game location/time updated',message=clean(body.message)||`${matrix.name}: ${from} has moved to Field ${field} at ${time}.`;broadcast=await sendBroadcast(actor,{title,body:message,audience:body.audience||'everyone',priority:'high'});state.publicHeadline=title;state.publicMessage=message;state.publicUpdatedAt=now.toISOString()}
    }else if(action==='delay-all'){
      const minutes=clamp(body.minutes,1,240,15);let changed=0;
      for(const game of day.games||[]){const status=effectiveStatus(game,day.date,settings.gameMinutes||105,now);if(['complete','canceled'].includes(status))continue;game.time=addMinutes(game.time,minutes);game.delayMinutes=Number(game.delayMinutes||0)+minutes;game.status='delayed';game.manualStatus=true;game.holdReason=clean(body.reason)||`${minutes}-minute facility delay`;game.updatedAt=now.toISOString();game.updatedBy=who.name;changed++}
      if(!changed)throw fail('There are no remaining games to delay.');summary=`Delayed ${changed} remaining game${changed===1?'':'s'} by ${minutes} minutes.`;
      if(body.notify!==false){const title=`All remaining games delayed ${minutes} minutes`,message=clean(body.message)||`${matrix.name}: all remaining games for ${day.date} are delayed approximately ${minutes} minutes. Check the live game-day board for updated fields and times.`;broadcast=await sendBroadcast(actor,{title,body:message,audience:body.audience||'everyone',priority:'high'});state.publicHeadline=title;state.publicMessage=message;state.publicUpdatedAt=now.toISOString()}
    }else if(action==='lightning-start'||action==='lightning-restart'){
      const clearMinutes=clamp(body.clearMinutes,10,120,settings.lightningClearMinutes||30);state.lightning={...state.lightning,status:'hold',active:true,startedAt:action==='lightning-start'||!state.lightning.startedAt?now.toISOString():state.lightning.startedAt,lastStrikeAt:now.toISOString(),clearAt:new Date(now.getTime()+clearMinutes*60000).toISOString(),clearMinutes,clearedAt:null,updatedAt:now.toISOString(),updatedBy:who.name};let changed=0;
      for(const game of day.games||[]){const s=effectiveStatus(game,day.date,settings.gameMinutes||105,now);if(['upcoming','in-progress','delayed'].includes(s)&&!['complete','canceled'].includes(game.status)){game.status='delayed';game.manualStatus=true;game.holdReason='Lightning hold';game.updatedAt=now.toISOString();game.updatedBy=who.name;changed++}}
      summary=`${action==='lightning-restart'?'Restarted':'Started'} the ${clearMinutes}-minute lightning hold timer.`;
      if(body.notify!==false){const title='Lightning hold — fields cleared',message=clean(body.message)||`Outdoor play is suspended at Adventure Sports because of lightning. The ${clearMinutes}-minute clearance timer has started and will restart after any new lightning report.`;broadcast=await sendBroadcast(actor,{title,body:message,audience:body.audience||'everyone',priority:'urgent'});state.publicHeadline=title;state.publicMessage=message;state.publicUpdatedAt=now.toISOString()}
    }else if(action==='lightning-resume'){
      state.lightning={...state.lightning,status:'inactive',active:false,clearedAt:now.toISOString(),clearAt:null,updatedAt:now.toISOString(),updatedBy:who.name};
      for(const game of day.games||[]){if(game.status==='delayed'&&game.holdReason==='Lightning hold'){game.status='upcoming';game.manualStatus=true;game.holdReason='';game.updatedAt=now.toISOString();game.updatedBy=who.name}}
      summary='Confirmed lightning clearance and reopened outdoor play.';
      if(body.notify!==false){const title='Play may resume',message=clean(body.message)||'Management has confirmed the lightning clear period and on-site conditions. Outdoor games may resume. Check the live board for updated field times.';broadcast=await sendBroadcast(actor,{title,body:message,audience:body.audience||'everyone',priority:'high'});state.publicHeadline=title;state.publicMessage=message;state.publicUpdatedAt=now.toISOString()}
    }else if(action==='field-task'){
      const field=clean(body.field),task=clean(body.task),status=clean(body.status);if(!day.fields[field])throw fail('Choose a valid field.');if(!['cleanup','setup'].includes(task)||!['needed','ready'].includes(status))throw fail('Choose a valid field task update.');day.fields[field][task]=status;day.fields[field][`${task}UpdatedAt`]=now.toISOString();day.fields[field].updatedBy=who.name;summary=`Marked Field ${field} ${task} ${status}.`;
    }else if(action==='broadcast'){
      const title=clean(body.title).slice(0,90),message=clean(body.message).slice(0,500);if(!title||!message)throw fail('Add a title and message.');const audience=body.audience||'staff';broadcast=await sendBroadcast(actor,{title,body:message,audience,priority:body.priority||'normal'});if(body.public!==false||audience==='teams-public'){state.publicHeadline=title;state.publicMessage=message;state.publicUpdatedAt=now.toISOString()}summary=`Sent “${title}” to ${broadcast.sent} enrolled device${broadcast.sent===1?'':'s'}${body.public!==false?' and updated the public board':''}.`;
    }else if(action==='clear-public-message'){
      state.publicHeadline='';state.publicMessage='';state.publicUpdatedAt=now.toISOString();summary='Cleared the manual public game-day message.';
    }else throw fail('That Game Day action is not supported.');

    day.updatedAt=now.toISOString();day.updatedBy=who.name;state.days[day.date]=day;const entry=auditEntry(actor,action,summary,{date:day.date,gameId:body.gameId||null,broadcast});pushAudit(state,entry);const board=await saveAll(state,matrix,day,settings);await appendAudit(actor,`game-day-${action}`,summary,'⚾');
    const decorated=decorateDay(day,settings);
    return json(200,{ok:true,message:summary,date:day.date,day:decorated,stats:stats(decorated),lightning:state.lightning,public:board,audit:state.audit.slice(0,100),broadcast});
  }catch(error){console.error('game-day-control:',error);return json(error.statusCode||500,{error:error.message||'Game Day Control request failed.'})}
};

module.exports._test={normalizeTime,addMinutes,effectiveStatus,baseGames,syncDay,publicData};
