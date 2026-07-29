(function(){'use strict';
const ENDPOINT='/.netlify/functions/ops-data';
async function request(params={},options={}){
  const session=window.ASE_OPS?.getSession?.();const access=session?.token?.access_token;if(!access)throw Error('You are not signed in.');
  const url=new URL(ENDPOINT,location.origin);Object.entries(params).forEach(([k,v])=>v!==undefined&&v!==null&&url.searchParams.set(k,v));
  const response=await fetch(url,{cache:'no-store',...options,headers:{Authorization:'Bearer '+access,'Content-Type':'application/json',...(options.headers||{})}});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'The shared database request failed.');return data;
}
window.ASE_DATA={health:()=>request({action:'health'}),list:(table,params={})=>request({table,...params}),create:(table,data)=>request({table},{method:'POST',body:JSON.stringify({data})}),update:(table,id,data)=>request({table,id},{method:'PATCH',body:JSON.stringify({data})}),remove:(table,id)=>request({table,id},{method:'DELETE'})};
})();
