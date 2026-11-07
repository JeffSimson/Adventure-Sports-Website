const {verifiedUser,json}=require('./_role-auth');
const {setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');

exports.handler=async event=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  try{
    const actor=await verifiedUser(event);
    if(actor.role!=='owner'){
      return json(403,{error:'Only an Owner can publish website changes.'});
    }

    let body={};
    try{body=JSON.parse(event.body||'{}')}
    catch{return json(400,{error:'The update request was not valid JSON.'})}

    const fieldStatus=String(body.fieldStatus||'').trim().toUpperCase();
    const announcement=String(body.announcement||'').trim().slice(0,240);
    const allowed=['OPEN','DELAYED','CLOSED','CHECK SCHEDULE'];

    if(!allowed.includes(fieldStatus)){
      return json(400,{error:'Choose Open, Delayed, Closed, or Check Schedule.'});
    }

    const site={
      fieldStatus,
      announcement,
      updatedAt:new Date().toISOString(),
      updatedBy:actor.user.email||''
    };

    await setStoreValue('ase-ops-v2','site-status',site);

    await appendAudit(
      actor,
      'website-status-published',
      `Published ${fieldStatus}${announcement?` — ${announcement}`:''}.`,
      '🌐'
    ).catch(()=>{});

    return json(200,{
      ok:true,
      live:true,
      site,
      updateMode:'one-second-live',
      message:'Public website updated live.'
    });
  }catch(error){
    console.error('publish-content error:',error);
    return json(error.statusCode||500,{
      error:error.message||'The live website status could not be updated.'
    });
  }
};
