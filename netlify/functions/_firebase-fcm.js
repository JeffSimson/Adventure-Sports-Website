const crypto=require('crypto');
function serviceAccount(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'';
  if(!raw)throw Object.assign(new Error('Firebase is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON in Netlify environment variables.'),{statusCode:500});
  try{return JSON.parse(raw)}catch{
    try{return JSON.parse(Buffer.from(raw,'base64').toString('utf8'))}
    catch{throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON or base64 JSON.'),{statusCode:500})}
  }
}
function b64url(input){return Buffer.from(input).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
async function accessToken(){
  const sa=serviceAccount(),now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=b64url(JSON.stringify({iss:sa.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:sa.token_uri||'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`;
  const signer=crypto.createSign('RSA-SHA256');signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${b64url(signer.sign(sa.private_key))}`;
  const response=await fetch(sa.token_uri||'https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})
  });
  const data=await response.json();if(!response.ok)throw new Error(data.error_description||data.error||'Could not authenticate with Firebase.');
  return {token:data.access_token,projectId:sa.project_id};
}
async function sendFCM(registration,payload,origin=''){
  const auth=await accessToken();
  const rawUrl=String(payload.url||'/ops/');
  const link=/^https:\/\//i.test(rawUrl)?rawUrl:`${String(origin||'').replace(/\/$/,'')}${rawUrl.startsWith('/')?rawUrl:'/'+rawUrl}`;
  const title=String(payload.title||'Adventure Sports');
  const body=String(payload.body||'');
  const data={
    title,body,url:rawUrl,
    notificationId:String(payload.notificationId||''),priority:String(payload.priority||'normal')
  };
  // Send a real Web Push notification payload, not data-only. Safari/iPhone
  // Home Screen apps are much more reliable when the visible notification is
  // included in webpush.notification and can be displayed by the push service
  // even while the app and service worker are suspended.
  const message={
    token:registration.token,
    data,
    webpush:{
      headers:{Urgency:payload.priority==='emergency'?'high':'normal',TTL:'86400'},
      notification:{
        title,body,
        icon:'https://adventurenj.com/uploads/branding/adventure-logo.png',
        badge:'https://adventurenj.com/uploads/branding/adventure-logo.png',
        tag:String(payload.notificationId||'ase-notification'),
        renotify:true,
        requireInteraction:payload.priority==='emergency',
        data:{url:rawUrl,notificationId:String(payload.notificationId||'')}
      }
    }
  };
  if(/^https:\/\//i.test(link))message.webpush.fcm_options={link};
  const response=await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(auth.projectId)}/messages:send`,{
    method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({message})
  });
  const responseData=await response.json().catch(()=>({}));
  if(!response.ok){const err=new Error(responseData?.error?.message||`Firebase send failed (${response.status}).`);err.code=responseData?.error?.status||'';err.details=responseData?.error?.details||[];throw err}
  return responseData;
}
module.exports={sendFCM,serviceAccount};
