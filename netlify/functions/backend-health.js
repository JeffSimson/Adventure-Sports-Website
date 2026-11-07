const {configured,adminRecipients}=require('./_event-email');
exports.handler=async()=>({
  statusCode:200,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
  body:JSON.stringify({ok:true,service:'Adventure Sports Operations Backend',version:'10.0.8',authProfile:true,eventEngine:true,signupEmailConfigured:configured(),signupEmailRecipients:adminRecipients().length})
});
