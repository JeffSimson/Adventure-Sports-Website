const {verifiedUser,json}=require('./_role-auth');
const {setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');

const cleanRepo=value=>{
  const raw=String(value||'').trim()
    .replace(/^https?:\/\/github\.com\//,'')
    .replace(/\.git$/,'')
    .replace(/^\/+|\/+$/g,'');
  // This is the actual public website repository used by Adventure Sports.
  return raw.includes('/') ? raw : 'JeffSimson/Adventure-Sports-Website';
};

function githubToken(){
  return process.env.GITHUB_TOKEN||
    process.env.GITHUB_ACCESS_TOKEN||
    process.env.GH_TOKEN||
    '';
}

async function githubRequest(path,options={}){
  const token=githubToken();
  if(!token){
    throw Object.assign(
      new Error('Website publishing is not connected. Add the GITHUB_TOKEN environment variable in Netlify.'),
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
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });

  const raw=await response.text();
  let data={};
  if(raw){
    try{ data=JSON.parse(raw); }
    catch{ data={message:raw.slice(0,400)}; }
  }

  if(!response.ok){
    throw Object.assign(
      new Error(data.message||`GitHub website update failed (${response.status}).`),
      {statusCode:response.status}
    );
  }
  return data;
}

async function updatePublicWebsite(requested,actor){
  const repo=cleanRepo(
    process.env.GITHUB_REPOSITORY||
    process.env.GITHUB_REPO||
    process.env.REPOSITORY
  );
  const branch=process.env.GITHUB_BRANCH||process.env.BRANCH||'main';
  const filePath=process.env.WEBSITE_STATUS_PATH||'content/site.json';
  const encodedPath=filePath.split('/').map(encodeURIComponent).join('/');

  // Read the complete current website file so none of its other settings are erased.
  const current=await githubRequest(
    `/repos/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`
  );

  let existing={};
  try{
    existing=JSON.parse(
      Buffer.from(String(current.content||'').replace(/\n/g,''),'base64').toString('utf8')
    );
  }catch{
    throw Object.assign(
      new Error(`${filePath} contains invalid JSON and could not be safely updated.`),
      {statusCode:500}
    );
  }

  const updatedSite={
    ...existing,
    fieldStatus:requested.fieldStatus,
    announcement:requested.announcement,
    updatedAt:new Date().toISOString(),
    updatedBy:actor.user.email||''
  };

  const updated=await githubRequest(
    `/repos/${repo}/contents/${encodedPath}`,
    {
      method:'PUT',
      body:JSON.stringify({
        message:`Update facility status to ${requested.fieldStatus}`,
        content:Buffer.from(JSON.stringify(updatedSite,null,2)+'\n','utf8').toString('base64'),
        sha:current.sha,
        branch
      })
    }
  );

  return {
    site:updatedSite,
    repository:repo,
    branch,
    path:filePath,
    commit:updated.commit?.sha||null
  };
}

exports.handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});

  try{
    const actor=await verifiedUser(event);
    if(actor.role!=='owner'){
      return json(403,{error:'Only an Owner can publish website changes.'});
    }

    let body={};
    try{ body=JSON.parse(event.body||'{}'); }
    catch{ return json(400,{error:'The update request was not valid JSON.'}); }

    const fieldStatus=String(body.fieldStatus||'').trim().toUpperCase();
    const announcement=String(body.announcement||'').trim().slice(0,240);
    const allowed=['OPEN','DELAYED','CLOSED','CHECK SCHEDULE'];

    if(!allowed.includes(fieldStatus)){
      return json(400,{error:'Choose Open, Delayed, Closed, or Check Schedule.'});
    }

    // The public GitHub website MUST update first.
    // We never display success when only private storage changed.
    const result=await updatePublicWebsite({fieldStatus,announcement},actor);

    // Keep the Operations Hub's own stored copy synchronized after GitHub succeeds.
    await setStoreValue('ase-ops-v2','site-status',result.site).catch(error=>{
      console.warn('Private status storage sync failed:',error);
    });

    await appendAudit(
      actor,
      'website-status-published',
      `Published ${fieldStatus}${announcement?` — ${announcement}`:''}. Commit ${result.commit||'created'}.`,
      '🌐'
    ).catch(()=>{});

    return json(200,{
      ok:true,
      site:result.site,
      publishedToWebsite:true,
      repository:result.repository,
      branch:result.branch,
      path:result.path,
      commit:result.commit
    });
  }catch(error){
    console.error('publish-content error:',error);
    return json(error.statusCode||500,{
      error:error.message||'The public website could not be updated.'
    });
  }
};
