exports.handler=async()=>({
  statusCode:200,
  headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
  body:JSON.stringify({ok:true,service:'Adventure Sports Operations Backend',version:'10.0.6',authProfile:true,eventEngine:true})
});
