const {verifiedUser,requireRole,json}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const STORE='ase-automation',KEY='settings';
const defaults={
 enabled:true,
 fieldRelease:true,firstGameReminder:false,lastGameReminder:false,fieldNoGames:false,scheduleChange:true,
 gameMinutes:105,releaseBufferMinutes:15,firstGameLeadMinutes:60,lastGameLeadMinutes:30,fieldReleaseAudience:'staff',scheduleAudience:'management',
 lightningRisk:true,lightningClear:true,lightningClearMinutes:30,nwsWarnings:true,heavyRain:true,dangerousWind:true,extremeHeat:true,freezingCold:false,snowIce:true,poorVisibility:false,
 rainProbability:80,rainInches:0.2,windMph:40,heatIndexF:95,coldF:32,visibilityMiles:1,weatherAudience:'everyone',
 overdueWorkOrders:true,urgentWorkOrders:true,unassignedUrgentWork:true,criticalIncidents:true,lowInventory:true,equipmentOutOfService:true,fieldStatusChanges:true,
 operationsAudience:'management',quietHoursEnabled:false,quietStart:'22:00',quietEnd:'06:00'
};
const bool=(b,k,d)=>b[k]===undefined?d:b[k]!==false;
const num=(v,min,max,f)=>{const x=Number(v);return Number.isFinite(x)?Math.min(max,Math.max(min,x)):f};
const audience=(v,f='staff')=>['everyone','staff','management'].includes(v)?v:f;
const time=v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v||''))?String(v):null;
function clean(b={}){return {
 enabled:bool(b,'enabled',defaults.enabled),
 fieldRelease:bool(b,'fieldRelease',defaults.fieldRelease),firstGameReminder:bool(b,'firstGameReminder',defaults.firstGameReminder),lastGameReminder:bool(b,'lastGameReminder',defaults.lastGameReminder),fieldNoGames:bool(b,'fieldNoGames',defaults.fieldNoGames),scheduleChange:bool(b,'scheduleChange',defaults.scheduleChange),
 gameMinutes:num(b.gameMinutes,30,240,105),releaseBufferMinutes:num(b.releaseBufferMinutes,0,120,15),firstGameLeadMinutes:num(b.firstGameLeadMinutes,5,240,60),lastGameLeadMinutes:num(b.lastGameLeadMinutes,5,180,30),fieldReleaseAudience:audience(b.fieldReleaseAudience,'staff'),scheduleAudience:audience(b.scheduleAudience,'management'),
 lightningRisk:bool(b,'lightningRisk',defaults.lightningRisk),lightningClear:bool(b,'lightningClear',defaults.lightningClear),lightningClearMinutes:num(b.lightningClearMinutes,10,120,30),nwsWarnings:bool(b,'nwsWarnings',defaults.nwsWarnings),heavyRain:bool(b,'heavyRain',defaults.heavyRain),dangerousWind:bool(b,'dangerousWind',defaults.dangerousWind),extremeHeat:bool(b,'extremeHeat',defaults.extremeHeat),freezingCold:bool(b,'freezingCold',defaults.freezingCold),snowIce:bool(b,'snowIce',defaults.snowIce),poorVisibility:bool(b,'poorVisibility',defaults.poorVisibility),
 rainProbability:num(b.rainProbability,10,100,80),rainInches:num(b.rainInches,0.05,2,0.2),windMph:num(b.windMph,10,100,40),heatIndexF:num(b.heatIndexF,80,130,95),coldF:num(b.coldF,-20,50,32),visibilityMiles:num(b.visibilityMiles,0.1,10,1),weatherAudience:audience(b.weatherAudience,'everyone'),
 overdueWorkOrders:bool(b,'overdueWorkOrders',defaults.overdueWorkOrders),urgentWorkOrders:bool(b,'urgentWorkOrders',defaults.urgentWorkOrders),unassignedUrgentWork:bool(b,'unassignedUrgentWork',defaults.unassignedUrgentWork),criticalIncidents:bool(b,'criticalIncidents',defaults.criticalIncidents),lowInventory:bool(b,'lowInventory',defaults.lowInventory),equipmentOutOfService:bool(b,'equipmentOutOfService',defaults.equipmentOutOfService),fieldStatusChanges:bool(b,'fieldStatusChanges',defaults.fieldStatusChanges),operationsAudience:audience(b.operationsAudience,'management'),
 quietHoursEnabled:bool(b,'quietHoursEnabled',defaults.quietHoursEnabled),quietStart:time(b.quietStart)||'22:00',quietEnd:time(b.quietEnd)||'06:00'
};}
exports.handler=async event=>{try{const actor=await verifiedUser(event);requireRole(actor,['owner']);if(event.httpMethod==='GET')return json(200,{settings:{...defaults,...await getStoreValue(STORE,KEY,{})}});if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});const settings=clean(JSON.parse(event.body||'{}'));await setStoreValue(STORE,KEY,settings);return json(200,{ok:true,settings});}catch(e){return json(e.statusCode||500,{error:e.message||'Automatic alert settings request failed.'})}};
