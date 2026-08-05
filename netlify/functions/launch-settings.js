const {verifiedUser,requireRole,json}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const STORE='ase-launch';
const KEY='settings';
const DEFAULTS={
  minimumBuild:'9300',forceUpdate:false,onboardingEnabled:true,
  supportEmail:'support@adventurenj.com',supportUrl:'https://adventurenj.com/contact.html',
  privacyUrl:'https://adventurenj.com/privacy.html',termsUrl:'https://adventurenj.com/terms.html',
  releaseChannel:'production',lastApprovedBuild:'9300',lastApprovedAt:null
};
const clean=v=>String(v??'').trim();
exports.handler=async event=>{try{
  const actor=await verifiedUser(event);
  const current={...DEFAULTS,...await getStoreValue(STORE,KEY,{})};
  if(event.httpMethod==='GET')return json(200,{ok:true,settings:current,version:'9.3.0',build:'9300',role:actor.role});
  requireRole(actor,['owner']);
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
  const b=JSON.parse(event.body||'{}');
  const next={...current,
    minimumBuild:clean(b.minimumBuild||current.minimumBuild).replace(/\D/g,'').slice(0,12)||'9300',
    forceUpdate:Boolean(b.forceUpdate),onboardingEnabled:b.onboardingEnabled!==false,
    supportEmail:clean(b.supportEmail||current.supportEmail).slice(0,160),
    supportUrl:clean(b.supportUrl||current.supportUrl).slice(0,500),
    privacyUrl:clean(b.privacyUrl||current.privacyUrl).slice(0,500),
    termsUrl:clean(b.termsUrl||current.termsUrl).slice(0,500),
    releaseChannel:['production','pilot','development'].includes(b.releaseChannel)?b.releaseChannel:'production',
    lastApprovedBuild:b.approveBuild?'9300':current.lastApprovedBuild,
    lastApprovedAt:b.approveBuild?new Date().toISOString():current.lastApprovedAt,
    updatedAt:new Date().toISOString(),updatedBy:actor.user.email
  };
  await setStoreValue(STORE,KEY,next);
  await appendAudit(actor,'launch-settings-updated',`Updated App Store launch settings for build ${next.minimumBuild}.`,'🚀');
  return json(200,{ok:true,settings:next,message:'Launch settings saved.'});
}catch(e){return json(e.statusCode||500,{error:e.message||'Launch settings could not be saved.'})}};
