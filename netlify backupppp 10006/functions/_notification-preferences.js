const TZ='America/New_York';
function localParts(now=new Date()){return Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(now).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]))}
function categoryFor({category,url,title}={}){
  if(category)return category;
  const hay=`${url||''} ${title||''}`.toLowerCase();
  if(/weather|lightning|thunder|rain|wind|heat|snow|ice|fog/.test(hay))return'weather';
  if(/game|matrix|field opens|schedule/.test(hay))return'games';
  if(/work order|maintenance|equipment|inventory|field status/.test(hay))return'operations';
  if(/incident|emergency/.test(hay))return'safety';
  return'general';
}
function inQuiet(reg,now=new Date()){
  const q=reg?.preferences?.quietHours||reg?.quietHours||{};
  if(!q.enabled)return false;
  const p=localParts(now),cur=`${p.hour}:${p.minute}`,s=q.start||'22:00',e=q.end||'06:00';
  return s<e?cur>=s&&cur<e:cur>=s||cur<e;
}
function allowsRegistration(reg,message={},now=new Date()){
  if(reg?.enabled===false)return false;
  if(message.priority==='urgent'||message.priority==='emergency')return true;
  const category=categoryFor(message),cats=reg?.preferences?.categories||reg?.categories||{};
  if(cats&&cats[category]===false)return false;
  if(inQuiet(reg,now))return false;
  return true;
}
module.exports={categoryFor,allowsRegistration,inQuiet};
