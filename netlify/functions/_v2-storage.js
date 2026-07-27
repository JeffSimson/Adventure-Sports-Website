const SITE_ID=process.env.SITE_ID||process.env.PROJECT_ID||process.env.NETLIFY_SITE_ID||'';
const TOKEN=process.env.NETLIFY_AUTH_TOKEN||process.env.NETLIFY_BLOBS_TOKEN||'';
const BASE='https://api.netlify.com/api/v1/blobs';
const memory={};

async function getStoreValue(store,key,fallback){
  if(!SITE_ID||!TOKEN)return memory[store]?.[key]??fallback;
  const url=`${BASE}/${encodeURIComponent(SITE_ID)}/${encodeURIComponent(store)}/${encodeURIComponent(key)}`;
  const r=await fetch(url,{headers:{Authorization:`Bearer ${TOKEN}`}});
  if(r.status===404)return fallback;
  if(!r.ok)return fallback;
  const text=await r.text();
  try{return JSON.parse(text)}catch{return fallback}
}
async function setStoreValue(store,key,value){
  if(!SITE_ID||!TOKEN){memory[store]=memory[store]||{};memory[store][key]=value;return}
  const url=`${BASE}/${encodeURIComponent(SITE_ID)}/${encodeURIComponent(store)}/${encodeURIComponent(key)}`;
  const r=await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(value)});
  if(!r.ok)throw Object.assign(new Error(`Storage failed (${r.status}).`),{statusCode:500});
}
module.exports={getStoreValue,setStoreValue};
