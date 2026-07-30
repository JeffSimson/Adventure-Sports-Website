(function(){
'use strict';
const originalFetch=window.fetch.bind(window);
let selectedRange='today',startDate='',endDate='';
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const compact=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(v||0);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const pct=(a,b)=>b?Math.max(0,Math.min(100,a/b*100)):0;

window.fetch=async function(input,init){
  let url=typeof input==='string'?input:input?.url||'';
  if(url.includes('/.netlify/functions/clover-dashboard')){
    const u=new URL(url,location.origin);
    u.searchParams.set('range',selectedRange);
    if(selectedRange==='custom'){u.searchParams.set('start',startDate);u.searchParams.set('end',endDate)}
    input=typeof input==='string'?u.pathname+u.search:new Request(u.toString(),input);
  }
  const response=await originalFetch(input,init);
  if(url.includes('/.netlify/functions/clover-dashboard')&&response.ok){
    response.clone().json().then(render).catch(()=>{});
  }
  return response
};

function chartData(d){
  if(d.range?.preset==='today'||d.range?.preset==='yesterday'){
    $('#cloverChartTitle').textContent='Sales by Hour';
    const a=d.hourlySales||[],first=a.findIndex(x=>x.sales>0),last=a.length-1-[...a].reverse().findIndex(x=>x.sales>0);
    return a.filter((x,i)=>first<0?(i>=7&&i<=21):(i>=Math.max(0,first-1)&&i<=Math.min(23,last+1)))
  }
  $('#cloverChartTitle').textContent='Net Sales by Day';
  return (d.salesTrend||[]).map(x=>({label:new Date(x.date+'T12:00:00').toLocaleDateString([],{month:'short',day:'numeric'}),sales:x.sales}))
}
function drawChart(d){
  const el=$('#cloverSalesChart');if(!el)return;
  const data=chartData(d);
  if(!data.length||!data.some(x=>x.sales>0)){el.innerHTML='<div class="chart-empty">No sales posted in this date range.</div>';return}
  const max=Math.max(...data.map(x=>x.sales||0),1);
  el.innerHTML='<div class="chart-y-label">'+compact(max)+'</div><div class="chart-bars">'+data.map(x=>{
    const h=Math.max(4,(x.sales/max)*100);
    return '<div class="chart-column" title="'+x.label+' • '+usd.format(x.sales||0)+'"><div class="chart-value">'+(x.sales?compact(x.sales):'')+'</div><div class="chart-bar-track"><div class="chart-bar-fill" style="height:'+h+'%"></div></div><small>'+x.label+'</small></div>'
  }).join('')+'</div>'
}
function render(d){
  if(!$('#cloverSplitRing'))return;
  const gate=Number(d.frontGateSales)||0,kitchen=Number(d.kitchenSales)||0,total=Number(d.netSales)||0,gp=pct(gate,total),kp=pct(kitchen,total);
  $('#cloverRangeLabel').textContent=d.range?.label||'Selected range';
  $('#cloverFrontGatePercent').textContent=gp.toFixed(1)+'% of net sales';
  $('#cloverKitchenPercent').textContent=kp.toFixed(1)+'% of net sales';
  $('#cloverSplitTotal').textContent=compact(total);
  $('#cloverGateLegend').textContent=usd.format(gate)+' • '+gp.toFixed(1)+'%';
  $('#cloverKitchenLegend').textContent=usd.format(kitchen)+' • '+kp.toFixed(1)+'%';
  $('#cloverSplitRing').style.setProperty('--gate-percent',gp+'%');
  drawChart(d);
  if(d.tips&&$('#cloverTipsPanel')){
    const rows=Array.isArray(d.tips.byEmployee)?d.tips.byEmployee:[];
    $('#cloverTipsTotal').textContent=usd.format(Number(d.tips.total)||0);
    $('#cloverTipsEmployees').textContent=String(rows.length);
    $('#cloverTipsRange').textContent=d.range?.label||'Selected range';
    $('#cloverTipsBody').innerHTML=rows.length?rows.map(x=>'<tr><td><strong>'+escapeHtml(x.name||'Needs Mapping')+'</strong></td><td>'+Number(x.transactions||0)+'</td><td class="money-cell">'+usd.format(Number(x.tips)||0)+'</td></tr>').join(''):'<tr><td colspan="3" class="empty-row">No employee-linked Clover tips were found in this date range.</td></tr>';
    const note=$('#cloverTipsNote');
    const unmatched=Number(d.tips.unmatched||0);
    if(note)note.textContent=d.tips.warning?'Clover returned the total, but employee detail could not be fully loaded: '+d.tips.warning:(unmatched?unmatched+' tipped payment'+(unmatched===1?'':'s')+' could not be connected to a Clover employee. The app checked both the payment and its associated order.':'Showing '+Number(d.tips.tipPayments||0)+' tipped Clover payment'+(Number(d.tips.tipPayments||0)===1?'':'s')+' matched through Clover payments and orders.');
    const mapping=$('#cloverMappingStatus');if(mapping){const employees=Array.isArray(d.tips.employees)?d.tips.employees:[];mapping.innerHTML='<div class="clover-diagnostic-grid"><div><small>Clover employees readable</small><strong>'+employees.length+'</strong></div><div><small>Tipped payments checked</small><strong>'+Number(d.tips.tipPayments||0)+'</strong></div><div><small>Still needs mapping</small><strong>'+unmatched+'</strong></div></div>'+(unmatched?'<p>These historical payments do not contain an employee on either the payment or order. Future sales should match automatically when each cashier uses their own PIN.</p>':'<p>Employee matching is working correctly for this date range.</p>');}
  }
  if(Array.isArray(d.topItems)&&$('#topItemsList'))$('#topItemsList').innerHTML=d.topItems.length?d.topItems.map((i,n)=>'<li><span class="rank-number">'+(n+1)+'</span><div><b>'+escapeHtml(i.name)+'</b><small>'+Number(i.quantity||0).toFixed(Number.isInteger(i.quantity)?0:1)+' sold</small></div><strong>'+usd.format(i.net||0)+'</strong></li>').join(''):'<li class="empty-list">No item-level sales data posted.</li>'
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function setRange(r){
  selectedRange=r;
  $$('.range-tab').forEach(b=>b.classList.toggle('active',b.dataset.cloverRange===r));
  $('#cloverCustomRange').hidden=r!=='custom';
  if(r!=='custom')$('#refreshClover')?.click()
}
document.addEventListener('DOMContentLoaded',()=>{
  $$('.range-tab').forEach(b=>b.addEventListener('click',()=>setRange(b.dataset.cloverRange)));
  $('#cloverCustomRange')?.addEventListener('submit',e=>{
    e.preventDefault();startDate=$('#cloverStartDate').value;endDate=$('#cloverEndDate').value;
    if(!startDate||!endDate)return;
    if(startDate>endDate){const n=$('#cloverNotice');n.textContent='Start date must be before end date.';n.className='publish-notice error';n.hidden=false;return}
    $('#refreshClover')?.click()
  })
});
})();