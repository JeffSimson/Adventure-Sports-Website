(function(){
'use strict';

const $=selector=>document.querySelector(selector);
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const compact=new Intl.NumberFormat('en-US',{
  style:'currency',
  currency:'USD',
  notation:'compact',
  maximumFractionDigits:1
});

function esc(value){
  return String(value??'').replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));
}

function percent(part,total){
  return total ? Math.max(0,Math.min(100,(Number(part)||0)/(Number(total)||1)*100)) : 0;
}

function updateGreeting(){
  const hour=new Date().getHours();
  const greeting=hour<12?'Good Morning':hour<17?'Good Afternoon':'Good Evening';
  const target=$('#greeting');
  if(target)target.textContent=greeting;
}

function updateAnnouncement(){
  const source=$('#announcementInput');
  const target=$('#dashboardAnnouncement');
  if(!target)return;
  const value=source?.value?.trim();
  target.textContent=value||'No public announcement is currently posted.';
}

function renderMiniChart(data){
  const target=$('#dashboardMiniChart');
  if(!target)return;

  const hours=(data.hourlySales||[]);
  const active=hours.filter(item=>Number(item.sales)>0);
  let display;

  if(active.length){
    const first=Math.max(0,hours.findIndex(item=>Number(item.sales)>0)-1);
    const last=Math.min(23,hours.length-1-[...hours].reverse().findIndex(item=>Number(item.sales)>0)+1);
    display=hours.slice(first,last+1);
  }else{
    display=hours.slice(7,22);
  }

  if(!display.length||!display.some(item=>Number(item.sales)>0)){
    target.innerHTML='<div class="dashboard-no-sales"><span>$</span><b>No sales posted yet</b><small>Today’s chart will populate automatically.</small></div>';
    return;
  }

  const max=Math.max(...display.map(item=>Number(item.sales)||0),1);

  target.innerHTML=display.map(item=>{
    const sales=Number(item.sales)||0;
    const height=Math.max(6,(sales/max)*100);
    return `<div class="dashboard-chart-column" title="${esc(item.label)} • ${usd.format(sales)}">
      <div class="dashboard-chart-value">${sales?compact.format(sales):''}</div>
      <div class="dashboard-chart-track">
        <span style="height:${height}%"></span>
      </div>
      <small>${esc(item.label)}</small>
    </div>`;
  }).join('');
}

function renderRecentOrders(orders){
  const target=$('#dashboardRecentOrders');
  if(!target)return;

  if(!orders?.length){
    target.innerHTML='<div class="dashboard-empty">No Clover orders have posted today.</div>';
    return;
  }

  target.innerHTML=orders.slice(0,6).map(order=>`
    <div class="dashboard-order">
      <div class="dashboard-order-icon">$</div>
      <div>
        <b>${usd.format(Number(order.total)||0)}</b>
        <small>${new Date(order.time).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})} • ${esc(order.employee||'Clover order')}</small>
      </div>
      <span>…${esc(String(order.id||'').slice(-5).toUpperCase())}</span>
    </div>
  `).join('');
}

function renderDashboard(data){
  const net=Number(data.netSales)||0;
  const gate=Number(data.frontGateSales)||0;
  const kitchen=Number(data.kitchenSales)||0;
  const gateShare=percent(gate,net);
  const kitchenShare=percent(kitchen,net);
  const inventory=(data.inventoryAlerts||[]).length;

  const sales=$('#dashboardSales');
  if(sales)sales.textContent=usd.format(net);

  const note=$('#dashboardSalesNote');
  if(note)note.textContent=(data.merchant?.name||'Clover')+' • Live net sales';

  const gateEl=$('#dashboardFrontGate');
  if(gateEl)gateEl.textContent=usd.format(gate);

  const gateNote=$('#dashboardFrontGateShare');
  if(gateNote)gateNote.textContent=gateShare.toFixed(1)+'% of net sales';

  const kitchenEl=$('#dashboardKitchen');
  if(kitchenEl)kitchenEl.textContent=usd.format(kitchen);

  const kitchenNote=$('#dashboardKitchenShare');
  if(kitchenNote)kitchenNote.textContent=kitchenShare.toFixed(1)+'% of net sales';

  const transactions=$('#dashboardTransactions');
  if(transactions)transactions.textContent=Number(data.transactions)||0;

  const ticket=$('#dashboardTicket');
  if(ticket)ticket.textContent='Average ticket '+usd.format(Number(data.averageTicket)||0);

  const progress=$('#dashboardSalesProgress');
  if(progress)progress.style.width=Math.max(8,Math.min(100,gateShare+kitchenShare))+'%';

  const updated=$('#dashboardUpdated');
  if(updated)updated.textContent='Updated '+new Date(data.updatedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});

  const health=$('#dashboardCloverHealth');
  const healthText=$('#dashboardCloverHealthText');
  const healthIcon=$('#dashboardCloverHealthIcon');
  if(health)health.textContent='Live';
  if(healthText)healthText.textContent='Secure sales connection active';
  if(healthIcon)healthIcon.className='health-icon ready';

  const invCount=$('#dashboardInventoryCount');
  const invText=$('#dashboardInventoryText');
  const invIcon=$('#dashboardInventoryIcon');

  if(invCount)invCount.textContent=data.inventoryAvailable ? inventory+' alert'+(inventory===1?'':'s') : 'Unavailable';
  if(invText)invText.textContent=data.inventoryAvailable
    ? inventory ? 'Low-stock items need attention' : 'No low-stock items detected'
    : 'Inventory permission is unavailable';
  if(invIcon)invIcon.className='health-icon '+(
    !data.inventoryAvailable?'warning':inventory?'warning':'ready'
  );

  renderMiniChart(data);
  renderRecentOrders(data.recentOrders||[]);
}

function renderCloverFailure(){
  const health=$('#dashboardCloverHealth');
  const text=$('#dashboardCloverHealthText');
  const icon=$('#dashboardCloverHealthIcon');
  if(health)health.textContent='Issue';
  if(text)text.textContent='Open Clover V2 for connection details';
  if(icon)icon.className='health-icon warning';
}

const originalFetch=window.fetch.bind(window);
window.fetch=async function(input,init){
  const response=await originalFetch(input,init);
  const url=typeof input==='string'?input:input?.url||'';

  if(url.includes('/.netlify/functions/clover-dashboard')){
    if(response.ok){
      response.clone().json().then(renderDashboard).catch(renderCloverFailure);
    }else{
      renderCloverFailure();
    }
  }
  return response;
};

document.addEventListener('DOMContentLoaded',()=>{
  updateGreeting();
  updateAnnouncement();

  $('#announcementInput')?.addEventListener('input',updateAnnouncement);

  const observerTarget=$('#facilityStatus');
  if(observerTarget){
    new MutationObserver(updateAnnouncement).observe(observerTarget,{
      childList:true,
      characterData:true,
      subtree:true
    });
  }
});
})();