(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const AUTO_KEY='ase_auto_notification_settings_v904';
function role(){return window.ASE_OPS?.role?.()||document.body.dataset.role||''}
function safeJson(v,d){try{return JSON.parse(v)}catch{return d}}
function settings(){return safeJson(localStorage.getItem(AUTO_KEY),{fieldChanges:true,lightning:true,heavyRain:true,severeWeather:true,audience:'everyone'})}
function saveSettings(){
 const card=$('#autoNotificationSettings');if(!card)return;
 const data={fieldChanges:$('#autoFieldChanges')?.checked!==false,lightning:$('#autoLightning')?.checked!==false,heavyRain:$('#autoHeavyRain')?.checked!==false,severeWeather:$('#autoSevereWeather')?.checked!==false,audience:$('#autoAlertAudience')?.value||'everyone'};
 localStorage.setItem(AUTO_KEY,JSON.stringify(data));
 const n=$('#autoNotificationNotice');if(n){n.textContent='Automatic alert settings saved.';n.className='publish-notice success';n.hidden=false}
}
function installAutoNotificationSettings(){
 if(role()!=='owner'||$('#autoNotificationSettings'))return;
 const panel=$('[data-view-panel="notifications"] [data-internal-panel="management"]');if(!panel)return;
 const cfg=settings();
 const article=document.createElement('article');article.id='autoNotificationSettings';article.className='panel';article.innerHTML=`<div class="panel-head"><div><p class="eyebrow">Owner automation</p><h2>Automatic Operations Alerts</h2><p>Automatically prepare and send operational alerts when important field or weather conditions change.</p></div><span class="connection-badge ready">Active</span></div><div class="auto-alert-grid"><label><input id="autoFieldChanges" type="checkbox" ${cfg.fieldChanges?'checked':''}><span><b>Field status changes</b><small>Open, delayed, closed, or check-schedule updates.</small></span></label><label><input id="autoLightning" type="checkbox" ${cfg.lightning?'checked':''}><span><b>Lightning in the area</b><small>Alert staff when the 30-minute lightning clear timer starts or restarts.</small></span></label><label><input id="autoHeavyRain" type="checkbox" ${cfg.heavyRain?'checked':''}><span><b>Heavy rain risk</b><small>Alert when short-term rain probability reaches the operations threshold.</small></span></label><label><input id="autoSevereWeather" type="checkbox" ${cfg.severeWeather?'checked':''}><span><b>Severe weather conditions</b><small>Alert for dangerous wind, heat, or severe forecast indicators.</small></span></label></div><label class="auto-alert-audience"><span>Default audience</span><select id="autoAlertAudience"><option value="everyone" ${cfg.audience==='everyone'?'selected':''}>Everyone</option><option value="staff" ${cfg.audience==='staff'?'selected':''}>All staff roles</option><option value="management" ${cfg.audience==='management'?'selected':''}>Owners and managers</option></select></label><div class="form-actions"><button id="saveAutoNotifications" class="primary-btn" type="button">Save Automatic Alerts</button></div><p id="autoNotificationNotice" class="publish-notice" hidden></p><p class="auto-alert-note">Alerts are evaluated whenever the Operations Hub refreshes weather or an owner/manager changes field or lightning status.</p>`;
 panel.appendChild(article);$('#saveAutoNotifications')?.addEventListener('click',saveSettings);
}
function fixTournamentTabs(){
 const view=$('[data-view-panel="games"]');if(!view)return;
 const tab=$('.internal-section-tab[data-internal-target="management"]',view),panel=$('.internal-section-panel[data-internal-panel="management"]',view),manager=$('#gamesMatrixManager');
 if(tab&&panel&&manager){tab.addEventListener('click',()=>{panel.hidden=false;manager.hidden=false;setTimeout(()=>manager.scrollIntoView({block:'start',behavior:'smooth'}),30)})}
}
function cleanWebsiteError(){
 const notice=$('[data-view-panel="website"] #publishNotice');
 if(notice&&/Cannot set properties of null/.test(notice.textContent||'')){notice.hidden=true;notice.textContent=''}
}
function init(){setTimeout(()=>{installAutoNotificationSettings();fixTournamentTabs();cleanWebsiteError()},350)}
window.addEventListener('ase:profile-ready',init);document.addEventListener('DOMContentLoaded',init);
})();