const {verifiedUser,requireRole,json}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');

const STORE='tournament-matrices';
const CURRENT='current';
const LIBRARY='library';
const ARCHIVE='archive';
const STANDARD_FIELDS=['A1','A2','B1','B2','C1','C2','D1','D2'];
const DEFAULT_MATRIX={"id":"cup-championship-2026","name":"Tournament Field Matrix","dateRange":"July 28–August 3, 2026","fields":["A1","A2","B1","B2","C1","C2","D1","D2"],"days":[{"key":"2026-07-28","label":"Tuesday","short":"Tue · Jul 28","rows":[["8:00 AM",["C1","D1"]],["10:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["12:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["2:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["4:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["6:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["8:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-07-29","label":"Wednesday","short":"Wed · Jul 29","rows":[["10:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["12:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["2:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["4:00 PM",["A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-07-30","label":"Thursday","short":"Thu · Jul 30","rows":[["8:30 AM",["A2","B2","C1"]],["11:00 AM",["A2","B2","C1"]],["1:30 PM",["A2","B1","B2"]],["4:00 PM",["A2","B1","B2"]],["6:30 PM",["B2"]]]},{"key":"2026-07-31","label":"Friday","short":"Fri · Jul 31","rows":[["3:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["7:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]]]},{"key":"2026-08-01","label":"Saturday","short":"Sat · Aug 1","rows":[["9:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["11:00 AM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["1:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["3:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1","C2","D1","D2"]],["7:00 PM",["A1","A2","B1","B2","C1","D1","D2"]]]},{"key":"2026-08-02","label":"Sunday","short":"Sun · Aug 2","rows":[["8:45 AM",["A1","A2","B1","B2"]],["9:00 AM",["C1","D1","D2"]],["10:45 AM",["A1","A2","B2"]],["11:00 AM",["B1","C1","D1","D2"]],["1:00 PM",["A1","A2","B1","B2","C1","D1","D2"]],["3:00 PM",["A1","A2","B1","B2","C1","D1","D2"]],["5:00 PM",["A1","A2","B1","B2","C1"]]]},{"key":"2026-08-03","label":"Monday","short":"Mon · Aug 3","rows":[["8:15 AM",["A2","C1"]],["8:30 AM",["B2"]],["10:45 AM",["A2","C1"]],["11:15 AM",["B2"]],["1:15 PM",["A2","B1"]],["1:45 PM",["B2"]],["3:45 PM",["A2","B1"]],["4:15 PM",["B2"]],["6:45 PM",["B2"]]]}],"status":"published","updatedAt":"2026-07-28T12:00:00.000Z","updatedBy":"System","publishedAt":"2026-07-28T12:00:00.000Z","publishedBy":"System","version":1};

const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const unique=a=>[...new Set(a)];
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&!Number.isNaN(Date.parse(`${v}T12:00:00Z`));
const normalizeTime=value=>{
  const m=String(value||'').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if(!m)return null;
  let h=Number(m[1]);const min=Number(m[2]||0);
  if(h<1||h>12||min<0||min>59)return null;
  return `${h}:${String(min).padStart(2,'0')} ${m[3].toUpperCase()}`;
};
const timeMinutes=value=>{const m=normalizeTime(value).match(/^(\d+):(\d+) (AM|PM)$/);let h=Number(m[1])%12;if(m[3]==='PM')h+=12;return h*60+Number(m[2])};
const dayMeta=key=>{const d=new Date(`${key}T12:00:00Z`);return {label:d.toLocaleDateString('en-US',{weekday:'long',timeZone:'UTC'}),short:d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}).replace(',',' ·')}};
const dateRange=days=>{if(!days.length)return'';const first=new Date(`${days[0].key}T12:00:00Z`),last=new Date(`${days.at(-1).key}T12:00:00Z`);const a=first.toLocaleDateString('en-US',{month:'long',day:'numeric',timeZone:'UTC'}),b=last.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});return days[0].key===days.at(-1).key?b:`${a}–${b}`};
const slug=()=>`matrix-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

function cleanMatrix(input,{keepId=true}={}){
  if(!input||typeof input!=='object')throw fail('No matrix data was provided.');
  const fields=unique((Array.isArray(input.fields)?input.fields:STANDARD_FIELDS).map(String).filter(x=>STANDARD_FIELDS.includes(x)));
  if(!fields.length)throw fail('Choose at least one field.');
  fields.sort((a,b)=>STANDARD_FIELDS.indexOf(a)-STANDARD_FIELDS.indexOf(b));
  const rawDays=Array.isArray(input.days)?input.days:[];
  const days=rawDays.map(day=>{
    const key=String(day?.key||'');if(!validDate(key))return null;
    const rows=(Array.isArray(day.rows)?day.rows:[]).map(row=>{
      const time=normalizeTime(row?.[0]);if(!time)return null;
      const active=unique((Array.isArray(row?.[1])?row[1]:[]).map(String).filter(f=>fields.includes(f)));
      if(!active.length)throw fail(`Choose at least one field for ${time} on ${key}.`);
      return [time,active];
    }).filter(Boolean).sort((a,b)=>timeMinutes(a[0])-timeMinutes(b[0]));
    if(!rows.length)return null;
    const meta=dayMeta(key);
    return {key,label:String(day.label||meta.label).slice(0,30),short:String(day.short||meta.short).slice(0,40),rows};
  }).filter(Boolean).sort((a,b)=>a.key.localeCompare(b.key));
  if(!days.length)throw fail('Add at least one tournament day with a game time.');
  const keys=days.map(d=>d.key);if(unique(keys).length!==keys.length)throw fail('Each tournament date can only appear once.');
  return {
    id:keepId&&String(input.id||'').trim()?String(input.id).slice(0,100):slug(),
    name:String(input.name||'Tournament Field Matrix').trim().slice(0,100)||'Tournament Field Matrix',
    dateRange:dateRange(days),fields,days,
    status:input.status==='published'?'published':'draft'
  };
}
function upsert(list,item){return [item,...(Array.isArray(list)?list:[]).filter(x=>x?.id!==item.id)].slice(0,100)}
function summary(x){return {id:x.id,name:x.name,dateRange:x.dateRange,status:x.status||'draft',version:Number(x.version||0),updatedAt:x.updatedAt||null,updatedBy:x.updatedBy||'',publishedAt:x.publishedAt||null,publishedBy:x.publishedBy||'',days:x.days?.length||0,games:(x.days||[]).reduce((n,d)=>n+(d.rows||[]).reduce((t,r)=>t+(r[1]||[]).length,0),0)}}

exports.handler=async event=>{
  try{
    const actor=await verifiedUser(event);
    const canManage=['owner','manager'].includes(actor.role);
    if(event.httpMethod==='GET'){
      const current=await getStoreValue(STORE,CURRENT,DEFAULT_MATRIX);
      let library=await getStoreValue(STORE,LIBRARY,[]);
      if(!library.some(x=>x?.id===current?.id))library=upsert(library,current);
      const archive=await getStoreValue(STORE,ARCHIVE,[]);
      return json(200,{matrix:current,library:library.map(x=>({...x,summary:summary(x)})),archive:archive.slice(0,30),canManage,standardFields:STANDARD_FIELDS});
    }
    requireRole(actor,['owner','manager']);
    if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
    const body=JSON.parse(event.body||'{}'),action=String(body.action||'publish');
    const email=actor.user.email||'Manager',now=new Date().toISOString();
    let current=await getStoreValue(STORE,CURRENT,DEFAULT_MATRIX);
    let library=await getStoreValue(STORE,LIBRARY,[]);
    let archive=await getStoreValue(STORE,ARCHIVE,[]);
    if(!library.some(x=>x?.id===current?.id))library=upsert(library,current);

    if(action==='save'){
      const parsed=cleanMatrix(body.matrix);
      const editingLive=current?.id===parsed.id;
      const prior=library.find(x=>x.id===parsed.id);
      if(editingLive){parsed.id=slug();parsed.status='draft';}
      const saved={...prior,...parsed,status:'draft',version:Number(prior?.version||0),updatedAt:now,updatedBy:email,publishedAt:editingLive?null:(prior?.publishedAt||null),publishedBy:editingLive?'':(prior?.publishedBy||'')};
      library=upsert(library,saved);await setStoreValue(STORE,LIBRARY,library);
      return json(200,{ok:true,matrix:saved,current,library,archive:archive.slice(0,30),message:'Tournament matrix draft saved.'});
    }
    if(action==='delete'){
      const id=String(body.id||'');if(!id)throw fail('Choose a matrix to delete.');
      if(current?.id===id)throw fail('The live matrix cannot be deleted. Publish another matrix first.',409);
      const before=library.length;library=library.filter(x=>x?.id!==id);archive=archive.filter(x=>x?.id!==id);
      if(library.length===before)throw fail('That matrix could not be found.',404);
      await Promise.all([setStoreValue(STORE,LIBRARY,library),setStoreValue(STORE,ARCHIVE,archive)]);
      return json(200,{ok:true,current,library,archive:archive.slice(0,30),message:'Tournament matrix deleted.'});
    }
    if(action==='restore'){
      const selected=archive.find(x=>x?.id===body.id)||library.find(x=>x?.id===body.id);
      if(!selected)throw fail('That saved matrix could not be found.',404);
      const restored=cleanMatrix({...selected,id:selected.id});
      const published={...selected,...restored,status:'published',version:Number(current?.version||0)+1,updatedAt:now,updatedBy:email,publishedAt:now,publishedBy:email};
      archive=upsert(archive.filter(x=>x?.id!==selected.id),current).slice(0,30);library=upsert(library,published);
      await Promise.all([setStoreValue(STORE,CURRENT,published),setStoreValue(STORE,LIBRARY,library),setStoreValue(STORE,ARCHIVE,archive)]);
      return json(200,{ok:true,matrix:published,current:published,library,archive,message:'Saved matrix published live.'});
    }
    if(action==='new'){
      const blank={id:slug(),name:String(body.name||'New Tournament Matrix').slice(0,100),dateRange:'',fields:STANDARD_FIELDS,days:[],status:'draft',version:0,updatedAt:now,updatedBy:email};
      library=upsert(library,blank);await setStoreValue(STORE,LIBRARY,library);
      return json(200,{ok:true,matrix:blank,current,library,archive:archive.slice(0,30)});
    }

    const parsed=cleanMatrix(body.matrix);
    const prior=library.find(x=>x.id===parsed.id);
    const published={...prior,...parsed,status:'published',version:Number(current?.version||0)+1,updatedAt:now,updatedBy:email,publishedAt:now,publishedBy:email};
    if(current?.id||current?.days?.length)archive=upsert(archive,current).slice(0,30);
    library=upsert(library,published);
    await Promise.all([setStoreValue(STORE,CURRENT,published),setStoreValue(STORE,LIBRARY,library),setStoreValue(STORE,ARCHIVE,archive)]);
    return json(200,{ok:true,matrix:published,current:published,library,archive,message:'Tournament matrix published live.'});
  }catch(error){
    return json(error.statusCode||500,{error:error.message||'Tournament matrix request failed.'});
  }
};
