const SITE_ID=process.env.PROJECT_ID||process.env.SITE_ID||process.env.NETLIFY_SITE_ID||'';
const TOKEN=process.env.NETLIFY_AUTH_TOKEN||process.env.NETLIFY_BLOBS_TOKEN||'';
const BASE='https://api.netlify.com/api/v1/blobs';

function configurationError(){
  const missing=[];
  if(!SITE_ID)missing.push('PROJECT_ID');
  if(!TOKEN)missing.push('NETLIFY_AUTH_TOKEN');
  return new Error(`Live storage is not configured. Add ${missing.join(' and ')} in Netlify environment variables.`);
}

async function getStoreValue(store,key,fallback){
  if(!SITE_ID||!TOKEN)return fallback;
  const url=`${BASE}/${encodeURIComponent(SITE_ID)}/${encodeURIComponent(store)}/${encodeURIComponent(key)}`;
  const response=await fetch(url,{
    headers:{
      Authorization:`Bearer ${TOKEN}`,
      'Cache-Control':'no-cache'
    }
  });
  if(response.status===404)return fallback;
  if(!response.ok){
    throw new Error(`Live storage read failed (${response.status}).`);
  }
  const text=await response.text();
  try{return JSON.parse(text)}
  catch{return fallback}
}

async function setStoreValue(store,key,value){
  if(!SITE_ID||!TOKEN)throw configurationError();
  const url=`${BASE}/${encodeURIComponent(SITE_ID)}/${encodeURIComponent(store)}/${encodeURIComponent(key)}`;
  const response=await fetch(url,{
    method:'PUT',
    headers:{
      Authorization:`Bearer ${TOKEN}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify(value)
  });
  if(!response.ok){
    let details='';
    try{details=(await response.text()).slice(0,200)}catch{}
    throw Object.assign(
      new Error(`Live storage write failed (${response.status})${details?`: ${details}`:''}.`),
      {statusCode:500}
    );
  }
}

module.exports={getStoreValue,setStoreValue};
