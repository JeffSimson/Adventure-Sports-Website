const {json,verifiedUser,requireRole,error}=require('./_role-auth');
const {getStoreValue,setStoreValue}=require('./_v2-storage');
const {appendAudit}=require('./_audit');
const ROLES=['owner','manager','grounds','kitchen','cashier'];
const CARDS=['facility','weather','schedule','fields','staff','incidents','workorders','notifications','clover','system'];
const DEFAULT={
 owner:['facility','weather','schedule','fields','staff','incidents','workorders','notifications','clover','system'],
 manager:['facility','weather','schedule','fields','staff','incidents','workorders','notifications'],
 grounds:['weather','schedule','fields','workorders','notifications'],
 kitchen:['schedule','staff','notifications'],
 cashier:['schedule','notifications','facility']
};
const cleanCards=v=>Array.isArray(v)?[...new Set(v.filter(x=>CARDS.includes(x)))]:[];
exports.handler=async event=>{try{
 const actor=await verifiedUser(event);requireRole(actor,ROLES);
 const saved=await getStoreValue('ase-ops-v9','dashboard-preferences',{roles:DEFAULT,employees:{}});
 saved.roles={...DEFAULT,...(saved.roles||{})};saved.employees=saved.employees||{};
 if(event.httpMethod==='GET'){
   const email=String(actor.user.email||'').toLowerCase();
   const override=saved.employees[email];
   return json(200,{ok:true,role:actor.role,cards:cleanCards(override?.cards||saved.roles[actor.role]||DEFAULT[actor.role]),configuration:actor.role==='owner'?saved:undefined,availableCards:CARDS});
 }
 requireRole(actor,['owner']);if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed.'});
 let body={};try{body=JSON.parse(event.body||'{}')}catch{throw error('Invalid request.',400)}
 const next={roles:{...DEFAULT},employees:{}};
 for(const r of ROLES)next.roles[r]=r==='owner'?DEFAULT.owner:cleanCards(body.roles?.[r]||saved.roles[r]||DEFAULT[r]);
 for(const [email,value] of Object.entries(body.employees||{})){
   const key=String(email).trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(key))continue;
   const cards=cleanCards(value?.cards);if(cards.length)next.employees[key]={cards};
 }
 await setStoreValue('ase-ops-v9','dashboard-preferences',next);
 await appendAudit(actor,'dashboard-preferences-updated','Updated role and employee dashboard visibility.','⌂');
 return json(200,{ok:true,configuration:next});
}catch(e){return json(e.statusCode||500,{error:e.message})}};