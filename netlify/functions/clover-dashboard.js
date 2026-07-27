const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
const fail=(message,statusCode=500)=>Object.assign(new Error(message),{statusCode});

async function verify(event){
  const auth=event.headers.authorization||event.headers.Authorization;
  if(!auth?.startsWith('Bearer '))throw fail('You are not signed in.',401);
  const base=process.env.URL||process.env.DEPLOY_PRIME_URL;
  if(!base)throw fail('Netlify site URL is unavailable.');
  const r=await fetch(`${base}/.netlify/identity/user`,{headers:{Authorization:auth}});
  if(!r.ok)throw fail('Your login session could not be verified.',401);
}

function dayRange(){
  const now=new Date();
  const parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',
    year:'numeric',
    month:'2-digit',
    day:'2-digit'
  }).formatToParts(now).reduce((o,p)=>{
    if(p.type!=='literal')o[p.type]=p.value;
    return o;
  },{});

  const d=`${parts.year}-${parts.month}-${parts.day}`;
  const noon=new Date(`${d}T12:00:00Z`);
  const tz=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/New_York',
    timeZoneName:'longOffset'
  }).formatToParts(noon).find(p=>p.type==='timeZoneName')?.value||'GMT-04:00';

  const m=tz.match(/GMT([+-])(\d{2}):(\d{2})/);
  const sign=m?.[1]==='-'?'-':'+';
  const off=m?`${sign}${m[2]}:${m[3]}`:'-04:00';

  return{
    date:d,
    start:Date.parse(`${d}T00:00:00${off}`),
    end:Date.parse(`${d}T23:59:59.999${off}`)
  };
}

async function clover(path){
  const id=process.env.CLOVER_MERCHANT_ID;
  const token=process.env.CLOVER_ACCESS_TOKEN;
  if(!id||!token)throw fail('CLOVER_MERCHANT_ID or CLOVER_ACCESS_TOKEN is missing in Netlify.');

  const r=await fetch(
    `https://api.clover.com/v3/merchants/${encodeURIComponent(id)}${path}`,
    {headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}}
  );

  let d={};
  try{d=await r.json()}catch{}
  if(!r.ok)throw fail(d.message||d.error||`Clover request failed (${r.status}).`,r.status);
  return d;
}

const els=v=>Array.isArray(v?.elements)?v.elements:[];
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const isFrontGate=name=>/front\s*gate/i.test(String(name||''));

function lineAmount(line){
  if(!line||line.refunded||line.isRevenue===false)return 0;

  const quantity=Math.max(0,num(line.unitQty||1000)/1000);
  let amount=num(line.price)*quantity;

  for(const discount of els(line.discounts)){
    amount-=Math.abs(num(discount.amount));
  }

  return Math.max(0,amount);
}

exports.handler=async event=>{
  if(event.httpMethod!=='GET')return json(405,{error:'Method not allowed.'});

  try{
    await verify(event);
    const{date,start,end}=dayRange();

    const q=new URLSearchParams();
    q.append('filter',`createdTime>=${start}`);
    q.append('filter',`createdTime<=${end}`);
    q.set('expand','payments,payments.refunds,lineItems,lineItems.discounts,employee');
    q.set('limit','1000');

    const[merchant,orderData]=await Promise.all([
      clover(''),
      clover(`/orders?${q}`)
    ]);

    const orders=els(orderData);
    const counts=new Map();

    let sales=0;
    let refunds=0;
    let transactions=0;
    let frontGateSalesCents=0;

    for(const order of orders){
      for(const payment of els(order.payments)){
        if(payment.result==='SUCCESS'&&!payment.voided){
          sales+=num(payment.amount);
          transactions++;
          for(const refund of els(payment.refunds)){
            refunds+=Math.abs(num(refund.amount));
          }
        }
      }

      for(const line of els(order.lineItems)){
        if(line.refunded||line.isRevenue===false)continue;

        const itemName=line.name||line.item?.name||'Unnamed item';
        const quantity=Math.max(1,num(line.unitQty||1000)/1000);
        counts.set(itemName,(counts.get(itemName)||0)+quantity);

        if(isFrontGate(itemName)){
          frontGateSalesCents+=lineAmount(line);
        }
      }
    }

    const netSalesCents=Math.max(0,sales-refunds);

    // Never allow the item-based front-gate amount to exceed Clover's total net sales.
    frontGateSalesCents=Math.min(frontGateSalesCents,netSalesCents);
    const kitchenSalesCents=Math.max(0,netSalesCents-frontGateSalesCents);

    const recentOrders=orders
      .slice()
      .sort((a,b)=>num(b.createdTime)-num(a.createdTime))
      .slice(0,12)
      .map(o=>({
        id:o.id,
        time:o.createdTime,
        total:num(o.total)/100,
        employee:o.employee?.name||
          [o.employee?.firstName,o.employee?.lastName].filter(Boolean).join(' ')
      }));

    const topItems=[...counts]
      .map(([name,quantity])=>({name,quantity}))
      .sort((a,b)=>b.quantity-a.quantity)
      .slice(0,10);

    let inventoryAlerts=[];
    let inventoryAvailable=true;
    let inventoryMessage='';

    try{
      const items=await clover('/items?expand=itemStock&limit=1000');
      inventoryAlerts=els(items)
        .map(i=>({
          id:i.id,
          name:i.name||'Unnamed item',
          quantity:Number(i.itemStock?.quantity)
        }))
        .filter(i=>Number.isFinite(i.quantity)&&i.quantity<=20)
        .sort((a,b)=>a.quantity-b.quantity)
        .slice(0,20);
    }catch(e){
      inventoryAvailable=false;
      inventoryMessage='Sales are connected, but Clover inventory quantities are unavailable for this token.';
    }

    return json(200,{
      ok:true,
      merchant:{id:merchant.id,name:merchant.name||'Adventure Sports'},
      date,
      grossSales:sales/100,
      refunds:refunds/100,
      netSales:netSalesCents/100,
      frontGateSales:frontGateSalesCents/100,
      kitchenSales:kitchenSalesCents/100,
      transactions,
      averageTicket:transactions?sales/100/transactions:0,
      orderCount:orders.length,
      recentOrders,
      topItems,
      inventoryAlerts,
      inventoryAvailable,
      inventoryMessage,
      updatedAt:new Date().toISOString()
    });
  }catch(e){
    console.error(e);
    return json(e.statusCode||500,{error:e.message||'Clover could not be loaded.'});
  }
};
