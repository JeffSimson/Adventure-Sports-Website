const {verifiedUser,requireRole,json}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');

const STORE='tournament-matrices';
const CURRENT='current';
const ARCHIVE='archive';
const DEFAULT_MATRIX={"id":"cup-championship-2026","name":"Tournament Field Matrix","dateRange":"July 28\u2013August 3, 2026","fields":["A1","A2","B1","B2","C1","C2","D1","D2"],"days":[{"key":"2026-07-28","label":"Tuesday","short":"Tue \u00b7 Jul 28","rows":[["8:00 AM",["C1","D1"]],["10:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["12:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["2:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["4:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["6:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["8:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-07-29","label":"Wednesday","short":"Wed \u00b7 Jul 29","rows":[["10:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["12:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["2:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["4:00 PM",["A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-07-30","label":"Thursday","short":"Thu \u00b7 Jul 30","rows":[["8:30 AM",["A2","B2","C1"]],["11:00 AM",["A2","B2","C1"]],["1:30 PM",["A2","B1","B2"]],["4:00 PM",["A2","B1","B2"]],["6:30 PM",["B2"]]]},{"key":"2026-07-31","label":"Friday","short":"Fri \u00b7 Jul 31","rows":[["3:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["7:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-08-01","label":"Saturday","short":"Sat \u00b7 Aug 1","rows":[["9:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["11:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["1:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["3:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["7:00 PM",["A1","A2","B1","B2","C1","D1","D2"]]]},{"key":"2026-08-02","label":"Sunday","short":"Sun \u00b7 Aug 2","rows":[["8:45 AM",["A1","A2","B1","B2"]],["9:00 AM",["C1","D1","D2"]],["10:45 AM",["A1","A2","B2"]],["11:00 AM",["B1","C1","D1","D2"]],["1:00 PM",["A1","A2","B1","B2","C1","D1","D2"]],["3:00 PM",["A1","A2","B1","B2","C1","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1"]]]},{"key":"2026-08-03","label":"Monday","short":"Mon \u00b7 Aug 3","rows":[["8:15 AM",["A2","C1"]],["8:30 AM",["B2"]],["10:45 AM",["A2","C1"]],["11:15 AM",["B2"]],["1:15 PM",["A2","B1"]],["1:45 PM",["B2"]],["3:45 PM",["A2","B1"]],["4:15 PM",["B2"]],["6:45 PM",["B2"]]]}],"updatedAt":"2026-07-28T12:00:00.000Z","updatedBy":"System","version":1};

function cleanMatrix(input){
  if(!input||typeof input!=='object')throw Object.assign(new Error('No matrix data was provided.'),{statusCode:400});
  const fields=Array.isArray(input.fields)?input.fields.map(String):[];
  if(fields.join('|')!=='A1|A2|B1|B2|C1|C2|D1|D2')throw Object.assign(new Error('Fields must be A1 through D2 in the standard order.'),{statusCode:400});
  const days=(input.days||[]).map(day=>({
    key:String(day.key||''),
    label:String(day.label||''),
    short:String(day.short||''),
    rows:(day.rows||[]).map(row=>[String(row[0]||''),(row[1]||[]).filter(f=>fields.includes(f))])
  })).filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day.key)&&day.rows.length);
  if(!days.length)throw Object.assign(new Error('The matrix did not contain any valid days or game times.'),{statusCode:400});
  for(const day of days){
    for(const row of day.rows){
      if(!/^\d{1,2}:\d{2}\s(?:AM|PM)$/i.test(row[0]))throw Object.assign(new Error(`Invalid time: ${row[0]}`),{statusCode:400});
    }
  }
  return {
    id:String(input.id||`matrix-${Date.now()}`),
    name:String(input.name||'Tournament Field Matrix').slice(0,100),
    dateRange:String(input.dateRange||'').slice(0,100),
    fields,days
  };
}

exports.handler=async(event,context)=>{
  try{
    const actor=await verifiedUser(event);
    if(event.httpMethod==='GET'){
      const current=await getStoreValue(STORE,CURRENT,DEFAULT_MATRIX);
      const archive=await getStoreValue(STORE,ARCHIVE,[]);
      return json(200,{matrix:current,archive:archive.slice(0,20),canManage:['owner','manager'].includes(actor.role)});
    }
    requireRole(actor,['owner','manager']);
    const body=JSON.parse(event.body||'{}');
    if(body.action==='restore'){
      const archive=await getStoreValue(STORE,ARCHIVE,[]);
      const selected=archive.find(x=>x.id===body.id);
      if(!selected)throw Object.assign(new Error('That archived matrix could not be found.'),{statusCode:404});
      const current=await getStoreValue(STORE,CURRENT,DEFAULT_MATRIX);
      const restored={...selected,id:`matrix-${Date.now()}`,version:Number(current.version||0)+1,updatedAt:new Date().toISOString(),updatedBy:actor.user.email||'Manager'};
      const nextArchive=[current,...archive.filter(x=>x.id!==body.id)].slice(0,20);
      await setStoreValue(STORE,CURRENT,restored);await setStoreValue(STORE,ARCHIVE,nextArchive);
      return json(200,{matrix:restored,archive:nextArchive,message:'Archived matrix restored.'});
    }
    const parsed=cleanMatrix(body.matrix);
    const current=await getStoreValue(STORE,CURRENT,DEFAULT_MATRIX);
    const archive=await getStoreValue(STORE,ARCHIVE,[]);
    const published={...parsed,id:`matrix-${Date.now()}`,version:Number(current.version||0)+1,updatedAt:new Date().toISOString(),updatedBy:actor.user.email||'Manager'};
    const nextArchive=[current,...archive].filter((x,i,a)=>x&&a.findIndex(y=>y.id===x.id)===i).slice(0,20);
    await setStoreValue(STORE,CURRENT,published);await setStoreValue(STORE,ARCHIVE,nextArchive);
    return json(200,{matrix:published,archive:nextArchive,message:'Tournament matrix published live.'});
  }catch(error){
    return json(error.statusCode||500,{error:error.message||'Tournament matrix request failed.'});
  }
};
