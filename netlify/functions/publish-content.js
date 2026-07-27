const {verifiedUser,json}=require('./_role-auth');
const {setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');

const cleanRepo=value=>{
  const raw=String(value||'').trim().replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/^\/+|\/+$/g,'');
  return raw.includes('/')?raw:'';
};

async function mirrorToGithub(site){
  const repo=cleanRepo(process.env.GITHUB_REPOSITORY||process.env.GITHUB_REPO||process.env.REPOSITORY);
  const token=process.env.GITHUB_TOKEN||process.env.GITHUB_ACCESS_TOKEN||process.env.GH_TOKEN;
  if(!repo||!token)return {mirrored:false,reason:'GitHub mirror not configured'};
  const branch=process.env.GITHUB_BRANCH||process.env.BRANCH||'main';
  const path='content/site.json';
  const encoded=path.split('/').map(encodeURIComponent).join('/');
  const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Adventure-Sports-Operations-Hub','Content-Type':'application/json'};
  const current=await fetch(`https://api.github.com/repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(branch)}`,{headers});
  let sha=null;
  if(current.ok){const d=await current.json();sha=d.sha||null}
  else if(current.status!==404){return {mirrored:false,reason:`GitHub read failed (${current.status})`}}
  const body={message:`Update facility status to ${site.fieldStatus}`,content:Buffer.from(JSON.stringify(site,null,2)+'\n').toString('base64'),branch,...(sha?{sha}:{})};
  const response=await fetch(`https://api.github.com/repos/${repo}/contents/${encoded}`,{method:'PUT',headers,body:JSON.stringify(body)});
  if(!response.ok){let msg=`GitHub mirror failed (${response.status})`;try{msg=(await response.json()).message||msg}catch{}return {mirrored:false,reason:msg}}
  const data=await response.json();return {mirrored:true,commit:data.commit?.sha||null};
}

exports.handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  try{
    const actor=await verifiedUser(event);
    if(actor.role!=='owner')return json(403,{error:'Only an Owner can publish website changes.'});
    let body={};try{body=JSON.parse(event.body||'{}')}catch{return json(400,{error:'The update request was not valid JSON.'})}
    const fieldStatus=String(body.fieldStatus||'').trim().toUpperCase();
    const announcement=String(body.announcement||'').trim().slice(0,240);
    const allowed=['OPEN','DELAYED','CLOSED','CHECK SCHEDULE'];
    if(!allowed.includes(fieldStatus))return json(400,{error:'Choose Open, Delayed, Closed, or Check Schedule.'});
    const site={fieldStatus,announcement,updatedAt:new Date().toISOString(),updatedBy:actor.user.email||''};

    // Save first. Publishing no longer fails because GitHub is missing or returns Not Found.
    await setStoreValue('ase-ops-v2','site-status',site);
    await appendAudit(actor,'website-status-published',`Published ${fieldStatus}${announcement?` — ${announcement}`:''}.`,'🌐').catch(()=>{});

    // Optional mirror for the public website repository. Its failure never blocks the editor.
    const mirror=await mirrorToGithub(site).catch(e=>({mirrored:false,reason:e.message}));
    return json(200,{ok:true,site,storage:'netlify',mirror});
  }catch(error){
    console.error('publish-content error:',error);
    return json(error.statusCode||500,{error:error.message||'The website could not be updated.'});
  }
};
