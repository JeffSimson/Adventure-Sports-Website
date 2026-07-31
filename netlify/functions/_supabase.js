function appError(message,statusCode=500,code='DATABASE_ERROR'){
  return Object.assign(new Error(message),{statusCode,code});
}
function config(){
  const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  if(!url||!key)throw appError('Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Netlify.',503,'CONFIG_ERROR');
  return {url,key};
}
async function supabase(path,{method='GET',body,headers={}}={}){
  const {url,key}=config();
  const response=await fetch(url+'/rest/v1/'+path,{
    method,
    headers:{
      apikey:key,
      Authorization:'Bearer '+key,
      'Content-Type':'application/json',
      Accept:'application/json',
      ...headers
    },
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const raw=await response.text();let data=null;
  if(raw){try{data=JSON.parse(raw)}catch{data=raw}}
  if(!response.ok){
    const message=(data&&typeof data==='object'&&(data.message||data.hint||data.details))||`Database request failed (${response.status}).`;
    throw appError(message,response.status,'SUPABASE_REQUEST_FAILED');
  }
  return {data,response};
}
async function health(){
  const {data}=await supabase('fields?select=id&limit=1');
  return {ok:true,reachable:true,sampleRows:Array.isArray(data)?data.length:0};
}
module.exports={supabase,health,config};
