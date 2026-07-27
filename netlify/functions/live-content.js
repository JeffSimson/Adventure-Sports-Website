const reply=(statusCode,body)=>({
  statusCode,
  headers:{
    'Content-Type':'application/json',
    'Cache-Control':'no-store'
  },
  body:JSON.stringify(body)
});

const cleanRepo=value=>{
  const raw=String(value||'').trim()
    .replace(/^https?:\/\/github\.com\//,'')
    .replace(/\.git$/,'')
    .replace(/^\/+|\/+$/g,'');
  return raw.includes('/')?raw:'JeffSimson/Adventure-Sports-Website';
};

exports.handler=async event=>{
  if(event.httpMethod!=='GET'){
    return reply(405,{error:'Method not allowed.'});
  }

  try{
    const file=(event.queryStringParameters?.file||'site')
      .replace(/[^a-zA-Z0-9_-]/g,'');
    const repo=cleanRepo(
      process.env.GITHUB_REPOSITORY||
      process.env.GITHUB_REPO||
      process.env.REPOSITORY
    );
    const branch=process.env.GITHUB_BRANCH||process.env.BRANCH||'main';
    const token=process.env.GITHUB_TOKEN||
      process.env.GITHUB_ACCESS_TOKEN||
      process.env.GH_TOKEN;

    const response=await fetch(
      `https://api.github.com/repos/${repo}/contents/content/${file}.json?ref=${encodeURIComponent(branch)}`,
      {
        headers:{
          Accept:'application/vnd.github.raw+json',
          'X-GitHub-Api-Version':'2022-11-28',
          'User-Agent':'Adventure-Sports-Operations-Hub',
          ...(token?{Authorization:`Bearer ${token}`}:{})
        }
      }
    );

    const raw=await response.text();

    if(!response.ok){
      let message=`Live content request failed (${response.status}).`;
      try{message=JSON.parse(raw).message||message}catch{}
      return reply(response.status,{error:message});
    }

    try{
      return reply(200,JSON.parse(raw));
    }catch{
      return reply(500,{error:`content/${file}.json contains invalid JSON.`});
    }
  }catch(error){
    console.error('live-content error:',error);
    return reply(500,{error:error.message||'Live content could not be loaded.'});
  }
};
