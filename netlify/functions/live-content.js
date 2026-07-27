const {getStoreValue}=require('./_v2-storage');

const reply=(statusCode,body)=>({
  statusCode,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
  body:JSON.stringify(body)
});

const DEFAULT_SITE={fieldStatus:'OPEN',announcement:'',updatedAt:null,updatedBy:''};

const cleanRepo=value=>{
  const raw=String(value||'').trim().replace(/^https?:\/\/github\.com\//,'').replace(/\.git$/,'').replace(/^\/+|\/+$/g,'');
  return raw.includes('/')?raw:'JeffSimson/Adventure-Sports-Website';
};

async function githubSite(){
  const repo=cleanRepo(process.env.GITHUB_REPOSITORY||process.env.GITHUB_REPO||process.env.REPOSITORY);
  if(!repo)return null;
  const branch=process.env.GITHUB_BRANCH||process.env.BRANCH||'main';
  const token=process.env.GITHUB_TOKEN||process.env.GITHUB_ACCESS_TOKEN||process.env.GH_TOKEN;
  const response=await fetch(`https://api.github.com/repos/${repo}/contents/content/site.json?ref=${encodeURIComponent(branch)}`,{
    headers:{Accept:'application/vnd.github.raw+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Adventure-Sports-Operations-Hub',...(token?{Authorization:`Bearer ${token}`}:{})}
  });
  if(!response.ok)return null;
  const raw=await response.text();
  try{return JSON.parse(raw)}catch{return null}
}

exports.handler=async event=>{
  if(event.httpMethod!=='GET')return reply(405,{error:'Method not allowed.'});
  try{
    // The public GitHub website is the source of truth so the editor always shows what visitors see.
    const fromGithub=await githubSite();
    if(fromGithub&&fromGithub.fieldStatus)return reply(200,{...DEFAULT_SITE,...fromGithub,source:'public-website'});

    // Private Netlify storage is only a fallback if GitHub is temporarily unavailable.
    const stored=await getStoreValue('ase-ops-v2','site-status',null);
    if(stored&&stored.fieldStatus)return reply(200,{...DEFAULT_SITE,...stored,source:'netlify-fallback'});

    // Always return a usable status instead of a 404.
    return reply(200,{...DEFAULT_SITE,source:'default'});
  }catch(error){
    console.error('live-content error:',error);
    return reply(200,{...DEFAULT_SITE,source:'safe-fallback',warning:error.message||'Fallback status loaded.'});
  }
};
