const {error}=require('./_role-auth');
function config(){
  const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!url||!key)throw error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify.',503);
  return {url,key};
}
async function supabase(path,{method='GET',body,headers={}}={}){
  const {url,key}=config();
  const response=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Accept:'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await response.text();let data=null;
  if(raw){try{data=JSON.parse(raw)}catch{data=raw}}
  if(!response.ok)throw error(data?.message||data?.hint||`Database request failed (${response.status}).`,response.status);
  return {data,response};
}
async function health(){const {data}=await supabase('fields?select=id&limit=1');return {ok:true,reachable:true,sampleRows:Array.isArray(data)?data.length:0}}
module.exports={supabase,health,config};
