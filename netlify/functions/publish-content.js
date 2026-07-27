const headers={
  'Content-Type':'application/json',
  'Cache-Control':'no-store'
};

const reply=(statusCode,body)=>({
  statusCode,
  headers,
  body:JSON.stringify(body)
});

const cleanRepo=value=>{
  const raw=String(value||'').trim()
    .replace(/^https?:\/\/github\.com\//,'')
    .replace(/\.git$/,'')
    .replace(/^\/+|\/+$/g,'');
  return raw.includes('/')?raw:'JeffSimson/Adventure-Sports-Website';
};

async function verifyUser(event){
  const authorization=event.headers.authorization||event.headers.Authorization;
  if(!authorization?.startsWith('Bearer ')){
    throw Object.assign(new Error('You are not signed in.'),{statusCode:401});
  }

  const siteUrl=process.env.URL||process.env.DEPLOY_PRIME_URL;
  if(!siteUrl){
    throw Object.assign(new Error('Netlify site URL is unavailable.'),{statusCode:500});
  }

  const response=await fetch(`${siteUrl}/.netlify/identity/user`,{
    headers:{Authorization:authorization}
  });

  if(!response.ok){
    throw Object.assign(new Error('Your login session could not be verified.'),{statusCode:401});
  }
}

async function github(path,options={}){
  const token=process.env.GITHUB_TOKEN||
    process.env.GITHUB_ACCESS_TOKEN||
    process.env.GH_TOKEN;

  if(!token){
    throw Object.assign(
      new Error('The GitHub token is missing from Netlify environment variables.'),
      {statusCode:500}
    );
  }

  const response=await fetch(`https://api.github.com${path}`,{
    ...options,
    headers:{
      Accept:'application/vnd.github+json',
      Authorization:`Bearer ${token}`,
      'X-GitHub-Api-Version':'2022-11-28',
      'User-Agent':'Adventure-Sports-Operations-Hub',
      ...(options.headers||{})
    }
  });

  const raw=await response.text();
  let data={};
  if(raw){
    try{data=JSON.parse(raw)}
    catch{data={message:raw.slice(0,400)}}
  }

  if(!response.ok){
    const message=data.message||`GitHub request failed (${response.status}).`;
    throw Object.assign(new Error(message),{statusCode:response.status});
  }

  return data;
}

exports.handler=async event=>{
  if(event.httpMethod!=='POST'){
    return reply(405,{error:'Method not allowed.'});
  }

  try{
    await verifyUser(event);

    let requested={};
    try{
      requested=JSON.parse(event.body||'{}');
    }catch{
      return reply(400,{error:'The update request was not valid JSON.'});
    }

    const allowed=['OPEN','DELAYED','CLOSED','CHECK SCHEDULE'];
    const fieldStatus=String(requested.fieldStatus||'').trim().toUpperCase();
    const announcement=String(requested.announcement||'').trim().slice(0,240);

    if(!allowed.includes(fieldStatus)){
      return reply(400,{error:'Choose Open, Delayed, Closed, or Check Schedule.'});
    }

    const repo=cleanRepo(
      process.env.GITHUB_REPOSITORY||
      process.env.GITHUB_REPO||
      process.env.REPOSITORY
    );
    const branch=process.env.GITHUB_BRANCH||process.env.BRANCH||'main';
    const filePath='content/site.json';
    const encodedPath=filePath.split('/').map(encodeURIComponent).join('/');

    const current=await github(
      `/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
    );

    const decoded=Buffer.from(current.content||'','base64').toString('utf8');
    let site={};
    try{
      site=JSON.parse(decoded);
    }catch{
      throw Object.assign(
        new Error('content/site.json currently contains invalid JSON.'),
        {statusCode:500}
      );
    }

    site.fieldStatus=fieldStatus;
    site.announcement=announcement;

    const content=Buffer.from(
      JSON.stringify(site,null,2)+'\n',
      'utf8'
    ).toString('base64');

    const updated=await github(
      `/repos/${repo}/contents/${encodedPath}`,
      {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          message:`Update facility status to ${fieldStatus}`,
          content,
          sha:current.sha,
          branch
        })
      }
    );

    return reply(200,{
      ok:true,
      site,
      commit:updated.commit?.sha||null
    });
  }catch(error){
    console.error('publish-content error:',error);
    return reply(error.statusCode||500,{
      error:error.message||'The website could not be updated.'
    });
  }
};
