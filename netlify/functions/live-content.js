const {getStoreValue}=require('./_v2-storage');

const DEFAULT_SITE={
  fieldStatus:'OPEN',
  announcement:'',
  updatedAt:null,
  updatedBy:''
};

const reply=(statusCode,body)=>({
  statusCode,
  headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Cache-Control':'no-store',
    'Netlify-CDN-Cache-Control':'no-store',
    'Pragma':'no-cache',
    'Expires':'0',
    'Access-Control-Allow-Origin':'*'
  },
  body:JSON.stringify(body)
});

exports.handler=async event=>{
  if(event.httpMethod!=='GET')return reply(405,{error:'Method not allowed.'});

  try{
    const stored=await getStoreValue('ase-ops-v2','site-status',null);
    return reply(200,{
      ...DEFAULT_SITE,
      ...(stored||{}),
      source:stored?'netlify-live-storage':'default'
    });
  }catch(error){
    console.error('live-content error:',error);
    return reply(200,{
      ...DEFAULT_SITE,
      source:'safe-fallback',
      warning:error.message||'Live status temporarily unavailable.'
    });
  }
};
