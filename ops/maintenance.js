(function(){
'use strict';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const STORAGE_KEY='ase-maintenance-operations-v1';
const FIELDS=['A1','A2','B1','B2','C1','C2','D1','D2'];
const CONDITIONS=[
  {value:'good',label:'Good'},
  {value:'attention',label:'Needs Attention'},
  {value:'urgent',label:'Maintenance Required'}
];
const BASE_CONDITIONS=[
  {value:'good',label:'Good'},
  {value:'replace-soon',label:'Replace Soon'},
  {value:'replace-now',label:'Replace Now'}
];
const FIELD_ITEMS=[
  ['baseballMound','Baseball mound'],
  ['softballMound','Softball mound'],
  ['firstBase','First base'],
  ['secondBase','Second base'],
  ['thirdBase','Third base'],
  ['homePlate','Home plate'],
  ['infield','Infield surface'],
  ['outfield','Outfield / turf'],
  ['fencing','Fence & gates'],
  ['dugouts','Dugouts']
];
const OPENING_TASKS=[
  'Unlock facility and field gates',
  'Inspect all playing surfaces',
  'Check mounds and bases',
  'Inspect fences and backstops',
  'Confirm dugouts are clear',
  'Check restrooms and clubhouse',
  'Verify field lights and power',
  'Confirm emergency access is clear'
];
const CLOSING_TASKS=[
  'Empty field and dugout trash',
  'Pick up all dugouts',
  'Clean benches and common areas',
  'Inspect and secure bases',
  'Drag / groom fields as required',
  'Check fences and gates',
  'Turn off field lights',
  'Turn off water and equipment',
  'Lock all facility gates'
];
const DEFAULT_EQUIPMENT=[
  {id:'eq-turf',name:'SMG Sports Champ',type:'Turf maintenance',status:'good',hours:'',fuel:'N/A',serviceDue:'',notes:''},
  {id:'eq-tractor',name:'John Deere Tractor',type:'Grounds equipment',status:'good',hours:'',fuel:'Full',serviceDue:'',notes:''},
  {id:'eq-mower',name:'Zero-Turn Mower',type:'Grounds equipment',status:'good',hours:'',fuel:'Full',serviceDue:'',notes:''},
  {id:'eq-turftank',name:'Turf Tank Robot',type:'Field marking',status:'good',hours:'',fuel:'Charged',serviceDue:'',notes:''}
];

let selectedDate='';
let state=null;
let activeField=null;
let formMode=null;
let formEditId=null;

function isoToday(){
  const now=new Date();
  const local=new Date(now.getTime()-now.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}
function nowIso(){return new Date().toISOString()}
function uid(prefix){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function currentUser(){
  try{
    const auth=JSON.parse(localStorage.getItem('adventure-ops-auth')||localStorage.getItem('ase-ops-auth')||'null');
    return auth?.user?.user_metadata?.full_name||auth?.user?.email||'Staff';
  }catch{return 'Staff'}
}
function blankField(name){
  const items={};
  FIELD_ITEMS.forEach(([key])=>items[key]='good');
  return {
    name,status:'good',notes:'',lastUpdated:null,updatedBy:'',
    items,
    flags:{needsClay:false,needsChalk:false,needsPacking:false,needsDragging:false,needsLining:false},
    checklist:{trash:false,dugouts:false,benches:false,gates:false,lights:false,water:false,dragged:false,lined:false}
  };
}
function blankDay(date){
  return {
    date,
    fields:Object.fromEntries(FIELDS.map(f=>[f,blankField(f)])),
    opening:Object.fromEntries(OPENING_TASKS.map((_,i)=>[i,false])),
    closing:Object.fromEntries(CLOSING_TASKS.map((_,i)=>[i,false]))
  };
}
function initialState(){
  return {
    version:1,
    days:{},
    issues:[],
    equipment:DEFAULT_EQUIPMENT,
    history:[],
    updatedAt:nowIso()
  };
}
function loadState(){
  try{
    const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    state=stored&&stored.version?stored:initialState();
  }catch{state=initialState()}
  if(!Array.isArray(state.equipment)||!state.equipment.length)state.equipment=DEFAULT_EQUIPMENT;
  if(!Array.isArray(state.issues))state.issues=[];
  if(!Array.isArray(state.history))state.history=[];
}
function saveState(message){
  state.updatedAt=nowIso();
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  setSync('ready','Saved on this device');
  if(message)toast(message);
}
function day(){
  if(!state.days[selectedDate])state.days[selectedDate]=blankDay(selectedDate);
  // Add missing fields/items safely after future upgrades.
  FIELDS.forEach(f=>{
    if(!state.days[selectedDate].fields[f])state.days[selectedDate].fields[f]=blankField(f);
    const fd=state.days[selectedDate].fields[f];
    fd.items=fd.items||{};
    FIELD_ITEMS.forEach(([key])=>{if(!fd.items[key])fd.items[key]='good'});
    fd.flags=Object.assign(blankField(f).flags,fd.flags||{});
    fd.checklist=Object.assign(blankField(f).checklist,fd.checklist||{});
  });
  state.days[selectedDate].opening=Object.assign(Object.fromEntries(OPENING_TASKS.map((_,i)=>[i,false])),state.days[selectedDate].opening||{});
  state.days[selectedDate].closing=Object.assign(Object.fromEntries(CLOSING_TASKS.map((_,i)=>[i,false])),state.days[selectedDate].closing||{});
  return state.days[selectedDate];
}
function log(action,detail,category='field'){
  state.history.unshift({id:uid('log'),time:nowIso(),date:selectedDate,user:currentUser(),action,detail,category});
  state.history=state.history.slice(0,250);
}
function toast(message){
  const el=$('#toast');
  if(!el)return;
  el.textContent=message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer=setTimeout(()=>el.classList.remove('show'),2800);
}
function setSync(mode,text){
  const dot=$('#maintenanceSyncDot'),label=$('#maintenanceSyncText');
  if(dot)dot.className=`maintenance-sync-dot ${mode}`;
  if(label)label.textContent=text;
}
function conditionLabel(value){
  return CONDITIONS.find(x=>x.value===value)?.label||
    BASE_CONDITIONS.find(x=>x.value===value)?.label||value;
}
function recalcFieldStatus(field){
  const values=Object.values(field.items);
  if(values.includes('urgent')||values.includes('replace-now'))field.status='urgent';
  else if(values.includes('attention')||values.includes('replace-soon')||Object.values(field.flags).some(Boolean))field.status='attention';
  else field.status='good';
}
function metrics(){
  const fields=Object.values(day().fields);
  const good=fields.filter(f=>f.status==='good').length;
  const attention=fields.filter(f=>f.status==='attention').length;
  const urgent=fields.filter(f=>f.status==='urgent').length;
  const issues=state.issues.filter(i=>i.status!=='resolved').length;
  const equipment=state.equipment.filter(e=>e.status!=='good').length;
  const completed=[
    ...Object.values(day().opening),
    ...Object.values(day().closing),
    ...fields.flatMap(f=>Object.values(f.checklist))
  ].filter(Boolean).length;
  $('#maintenanceGoodCount').textContent=`${good} / ${FIELDS.length}`;
  $('#maintenanceAttentionCount').textContent=attention+urgent;
  $('#maintenanceIssueCount').textContent=issues;
  $('#maintenanceEquipmentCount').textContent=equipment;
  $('#maintenanceCompletedCount').textContent=completed;
  const ready=urgent===0;
  $('#maintenanceReadyLabel').textContent=ready?'YES':'NO';
  $('#maintenanceReadyNote').textContent=ready?(attention?'usable with items to watch':'all fields operational'):`${urgent} field${urgent===1?'':'s'} require maintenance`;
  $('.maintenance-kpi.readiness')?.classList.toggle('not-ready',!ready);
}
function renderFields(){
  const fields=day().fields;
  $('#maintenanceFieldGrid').innerHTML=FIELDS.map(name=>{
    const f=fields[name];
    const checked=Object.values(f.checklist).filter(Boolean).length;
    const flags=Object.entries(f.flags).filter(([,v])=>v).map(([k])=>({
      needsClay:'Clay',needsChalk:'Chalk',needsPacking:'Pack',needsDragging:'Drag',needsLining:'Line'
    }[k]));
    return `<button class="maintenance-field-card ${esc(f.status)}" data-field="${name}" type="button">
      <div class="maintenance-field-top"><span class="maintenance-field-name">${name}</span><span class="maintenance-status-badge ${esc(f.status)}">${esc(conditionLabel(f.status))}</span></div>
      <div class="maintenance-field-diamond" aria-hidden="true"><i></i><b>${name}</b></div>
      <div class="maintenance-field-details">
        <div><small>Inspection</small><strong>${f.lastUpdated?new Date(f.lastUpdated).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'Not checked'}</strong></div>
        <div><small>Closing</small><strong>${checked} / ${Object.keys(f.checklist).length}</strong></div>
      </div>
      <div class="maintenance-field-flags">${flags.length?flags.map(x=>`<span>${esc(x)}</span>`).join(''):'<span class="clear">No active needs</span>'}</div>
      ${f.notes?`<p class="maintenance-field-note">${esc(f.notes)}</p>`:''}
    </button>`;
  }).join('');
  $$('.maintenance-field-card').forEach(b=>b.addEventListener('click',()=>openField(b.dataset.field)));
}
function checklistRow(task,index,group,checked){
  return `<label class="maintenance-task ${checked?'completed':''}">
    <input type="checkbox" data-check-group="${group}" data-check-index="${index}" ${checked?'checked':''}>
    <span class="maintenance-task-check">✓</span>
    <span><b>${esc(task)}</b><small>${checked?'Completed':'Tap when finished'}</small></span>
  </label>`;
}
function renderDaily(){
  const d=day();
  const openingDone=Object.values(d.opening).filter(Boolean).length;
  const closingDone=Object.values(d.closing).filter(Boolean).length;
  $('#openingProgress').textContent=`${openingDone} / ${OPENING_TASKS.length}`;
  $('#closingProgress').textContent=`${closingDone} / ${CLOSING_TASKS.length}`;
  $('#openingChecklist').innerHTML=OPENING_TASKS.map((t,i)=>checklistRow(t,i,'opening',d.opening[i])).join('');
  $('#closingChecklist').innerHTML=CLOSING_TASKS.map((t,i)=>checklistRow(t,i,'closing',d.closing[i])).join('');
  $$('[data-check-group]').forEach(input=>input.addEventListener('change',()=>{
    const group=input.dataset.checkGroup,index=input.dataset.checkIndex;
    d[group][index]=input.checked;
    log(input.checked?'Completed task':'Reopened task',`${group==='opening'?'Opening':'Closing'}: ${group==='opening'?OPENING_TASKS[index]:CLOSING_TASKS[index]}`,'checklist');
    saveState();
    renderAll();
  }));
}
function issueCard(i){
  return `<article class="maintenance-issue-card priority-${esc(i.priority)} ${i.status==='resolved'?'resolved':''}">
    <div class="maintenance-issue-head">
      <div><span class="maintenance-priority">${esc(i.priority.toUpperCase())}</span><span class="maintenance-issue-location">${esc(i.location)}</span></div>
      <span class="maintenance-issue-status">${i.status==='resolved'?'Resolved':'Open'}</span>
    </div>
    <h3>${esc(i.title)}</h3>
    <p>${esc(i.description||'No additional details.')}</p>
    <div class="maintenance-issue-meta"><span>Reported by ${esc(i.reportedBy)}</span><span>${new Date(i.createdAt).toLocaleString()}</span></div>
    <div class="maintenance-card-actions">
      <button class="secondary-btn compact-btn" data-edit-issue="${i.id}" type="button">Edit</button>
      ${i.status!=='resolved'?`<button class="primary-btn compact-btn" data-resolve-issue="${i.id}" type="button">Resolve</button>`:`<button class="secondary-btn compact-btn" data-reopen-issue="${i.id}" type="button">Reopen</button>`}
    </div>
  </article>`;
}
function renderIssues(){
  const search=($('#maintenanceIssueSearch')?.value||'').toLowerCase();
  const filter=$('#maintenanceIssueFilter')?.value||'open';
  let issues=state.issues.filter(i=>{
    if(filter==='open'&&i.status==='resolved')return false;
    if(filter==='resolved'&&i.status!=='resolved')return false;
    if(filter==='high'&&i.priority!=='high')return false;
    return `${i.title} ${i.description} ${i.location}`.toLowerCase().includes(search);
  });
  issues.sort((a,b)=>(a.status==='resolved')-(b.status==='resolved')||({high:0,medium:1,low:2}[a.priority]-({high:0,medium:1,low:2}[b.priority]))||new Date(b.createdAt)-new Date(a.createdAt));
  $('#maintenanceIssueList').innerHTML=issues.length?issues.map(issueCard).join(''):`<div class="staff-empty"><span>✓</span><h3>No matching issues</h3><p>There are no maintenance problems in this view.</p></div>`;
  $$('[data-edit-issue]').forEach(b=>b.addEventListener('click',()=>openIssueForm(b.dataset.editIssue)));
  $$('[data-resolve-issue]').forEach(b=>b.addEventListener('click',()=>setIssueStatus(b.dataset.resolveIssue,'resolved')));
  $$('[data-reopen-issue]').forEach(b=>b.addEventListener('click',()=>setIssueStatus(b.dataset.reopenIssue,'open')));
}
function setIssueStatus(id,status){
  const issue=state.issues.find(i=>i.id===id);
  if(!issue)return;
  issue.status=status;
  issue.resolvedAt=status==='resolved'?nowIso():null;
  log(status==='resolved'?'Resolved issue':'Reopened issue',`${issue.location}: ${issue.title}`,'issue');
  saveState(status==='resolved'?'Issue resolved.':'Issue reopened.');
  renderAll();
}
function equipmentCard(e){
  return `<article class="maintenance-equipment-card ${esc(e.status)}">
    <div class="maintenance-equipment-icon">⚙</div>
    <div class="maintenance-equipment-title"><div><h3>${esc(e.name)}</h3><p>${esc(e.type||'Equipment')}</p></div><span class="maintenance-status-badge ${esc(e.status)}">${esc(conditionLabel(e.status))}</span></div>
    <dl>
      <div><dt>Hours</dt><dd>${esc(e.hours||'Not entered')}</dd></div>
      <div><dt>Fuel / charge</dt><dd>${esc(e.fuel||'Not entered')}</dd></div>
      <div><dt>Service due</dt><dd>${esc(e.serviceDue||'Not entered')}</dd></div>
    </dl>
    <p class="maintenance-equipment-notes">${esc(e.notes||'No maintenance notes.')}</p>
    <button class="secondary-btn" data-edit-equipment="${e.id}" type="button">Update Equipment</button>
  </article>`;
}
function renderEquipment(){
  $('#maintenanceEquipmentGrid').innerHTML=state.equipment.map(equipmentCard).join('');
  $$('[data-edit-equipment]').forEach(b=>b.addEventListener('click',()=>openEquipmentForm(b.dataset.editEquipment)));
}
function renderHistory(){
  const items=state.history.filter(h=>!selectedDate||h.date===selectedDate).slice(0,100);
  $('#maintenanceHistory').innerHTML=items.length?items.map(h=>`<article class="maintenance-history-row">
    <div class="maintenance-history-icon ${esc(h.category)}">${h.category==='issue'?'!':h.category==='equipment'?'⚙':h.category==='checklist'?'✓':'◇'}</div>
    <div><h3>${esc(h.action)}</h3><p>${esc(h.detail)}</p><small>${esc(h.user)} • ${new Date(h.time).toLocaleString()}</small></div>
  </article>`).join(''):`<div class="staff-empty"><span>☷</span><h3>No activity recorded</h3><p>Changes made on this date will appear here.</p></div>`;
}
function renderAll(){
  renderFields();
  renderDaily();
  renderIssues();
  renderEquipment();
  renderHistory();
  metrics();
}
function selectOptions(options,value){
  return options.map(o=>`<option value="${o.value}" ${o.value===value?'selected':''}>${esc(o.label)}</option>`).join('');
}
function openField(name){
  activeField=name;
  const field=day().fields[name];
  $('#fieldModalTitle').textContent=`Field ${name}`;
  $('#fieldModalSubtitle').textContent=field.lastUpdated?`Last checked by ${field.updatedBy||'staff'} at ${new Date(field.lastUpdated).toLocaleString()}`:'This field has not been inspected yet.';
  const baseKeys=new Set(['firstBase','secondBase','thirdBase','homePlate']);
  $('#fieldModalBody').innerHTML=`
    <div class="field-inspection-status">
      <label><span>Overall field status</span><select id="fieldOverallStatus">${selectOptions(CONDITIONS,field.status)}</select></label>
      <label><span>Inspection notes</span><textarea id="fieldInspectionNotes" rows="3" placeholder="Add field-specific notes">${esc(field.notes||'')}</textarea></label>
    </div>
    <div class="field-inspection-grid">
      ${FIELD_ITEMS.map(([key,label])=>`<label class="field-condition-row"><span>${esc(label)}</span><select data-field-condition="${key}">${selectOptions(baseKeys.has(key)?BASE_CONDITIONS:CONDITIONS,field.items[key])}</select></label>`).join('')}
    </div>
    <div class="field-needs-block"><h3>Work Needed</h3><div class="field-needs-grid">
      ${[['needsClay','Needs clay'],['needsChalk','Needs chalk'],['needsPacking','Needs packing'],['needsDragging','Needs dragging'],['needsLining','Needs lining']].map(([key,label])=>`<label class="form-check"><input class="form-check-input" type="checkbox" data-field-flag="${key}" ${field.flags[key]?'checked':''}><span class="form-check-label">${label}</span></label>`).join('')}
    </div></div>
    <div class="field-needs-block"><h3>Field Closing Checklist</h3><div class="field-close-grid">
      ${[['trash','Trash emptied'],['dugouts','Dugouts picked'],['benches','Benches cleaned'],['gates','Gates checked'],['lights','Lights off'],['water','Water off'],['dragged','Field dragged'],['lined','Field lined']].map(([key,label])=>`<label class="form-check"><input class="form-check-input" type="checkbox" data-field-close="${key}" ${field.checklist[key]?'checked':''}><span class="form-check-label">${label}</span></label>`).join('')}
    </div></div>`;
  $('#fieldMaintenanceModal').hidden=false;
  document.body.classList.add('maintenance-modal-open');
}
function closeField(){
  $('#fieldMaintenanceModal').hidden=true;
  document.body.classList.remove('maintenance-modal-open');
  activeField=null;
}
function saveField(){
  if(!activeField)return;
  const field=day().fields[activeField];
  field.status=$('#fieldOverallStatus').value;
  field.notes=$('#fieldInspectionNotes').value.trim();
  $$('[data-field-condition]').forEach(el=>field.items[el.dataset.fieldCondition]=el.value);
  $$('[data-field-flag]').forEach(el=>field.flags[el.dataset.fieldFlag]=el.checked);
  $$('[data-field-close]').forEach(el=>field.checklist[el.dataset.fieldClose]=el.checked);
  recalcFieldStatus(field);
  // Let a manager explicitly set urgent even if item details are less severe.
  const selected=$('#fieldOverallStatus').value;
  if(selected==='urgent')field.status='urgent';
  field.lastUpdated=nowIso();
  field.updatedBy=currentUser();
  log('Updated field inspection',`${activeField} marked ${conditionLabel(field.status)}`,'field');
  saveState(`Field ${activeField} inspection saved.`);
  closeField();
  renderAll();
}
function openForm(mode,id=null){
  formMode=mode; formEditId=id;
  const form=$('#maintenanceDynamicForm');
  if(mode==='issue'){
    const i=id?state.issues.find(x=>x.id===id):null;
    $('#maintenanceFormEyebrow').textContent='Problem tracking';
    $('#maintenanceFormTitle').textContent=i?'Edit Issue':'Report Issue';
    form.innerHTML=`<div class="maintenance-form-grid">
      <label><span>Location</span><select name="location" required><option value="">Choose location</option>${FIELDS.map(f=>`<option ${i?.location===`Field ${f}`?'selected':''}>Field ${f}</option>`).join('')}<option ${i?.location==='Clubhouse'?'selected':''}>Clubhouse</option><option ${i?.location==='Parking Lot'?'selected':''}>Parking Lot</option><option ${i?.location==='Equipment'?'selected':''}>Equipment</option><option ${i?.location==='Other'?'selected':''}>Other</option></select></label>
      <label><span>Priority</span><select name="priority"><option value="low" ${i?.priority==='low'?'selected':''}>Low</option><option value="medium" ${!i||i.priority==='medium'?'selected':''}>Medium</option><option value="high" ${i?.priority==='high'?'selected':''}>High</option></select></label>
      <label class="full"><span>Issue title</span><input name="title" required maxlength="90" value="${esc(i?.title||'')}" placeholder="Example: Lip forming near first base"></label>
      <label class="full"><span>Description</span><textarea name="description" rows="5" placeholder="Describe what needs to be fixed">${esc(i?.description||'')}</textarea></label>
      <label class="full"><span>Reported by</span><input name="reportedBy" value="${esc(i?.reportedBy||currentUser())}" required></label>
    </div>`;
  }else{
    const e=id?state.equipment.find(x=>x.id===id):null;
    $('#maintenanceFormEyebrow').textContent='Equipment tracking';
    $('#maintenanceFormTitle').textContent=e?'Update Equipment':'Add Equipment';
    form.innerHTML=`<div class="maintenance-form-grid">
      <label class="full"><span>Equipment name</span><input name="name" required value="${esc(e?.name||'')}"></label>
      <label><span>Type</span><input name="type" value="${esc(e?.type||'Grounds equipment')}"></label>
      <label><span>Condition</span><select name="status">${selectOptions(CONDITIONS,e?.status||'good')}</select></label>
      <label><span>Hours / mileage</span><input name="hours" value="${esc(e?.hours||'')}" placeholder="Example: 128.4"></label>
      <label><span>Fuel / charge</span><input name="fuel" value="${esc(e?.fuel||'')}" placeholder="Full, 1/2, Charged"></label>
      <label class="full"><span>Service due</span><input name="serviceDue" value="${esc(e?.serviceDue||'')}" placeholder="Date, hours, or service description"></label>
      <label class="full"><span>Notes</span><textarea name="notes" rows="5">${esc(e?.notes||'')}</textarea></label>
    </div>`;
  }
  $('#maintenanceFormModal').hidden=false;
  document.body.classList.add('maintenance-modal-open');
}
function closeForm(){
  $('#maintenanceFormModal').hidden=true;
  document.body.classList.remove('maintenance-modal-open');
  formMode=null;formEditId=null;
}
function saveForm(){
  const form=$('#maintenanceDynamicForm');
  if(!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form).entries());
  if(formMode==='issue'){
    let issue=formEditId?state.issues.find(i=>i.id===formEditId):null;
    if(issue){
      Object.assign(issue,values);
      log('Updated maintenance issue',`${issue.location}: ${issue.title}`,'issue');
    }else{
      issue={id:uid('issue'),...values,status:'open',createdAt:nowIso(),resolvedAt:null};
      state.issues.unshift(issue);
      log('Reported maintenance issue',`${issue.location}: ${issue.title}`,'issue');
    }
    saveState(formEditId?'Issue updated.':'Issue reported.');
  }else{
    let equipment=formEditId?state.equipment.find(e=>e.id===formEditId):null;
    if(equipment){
      Object.assign(equipment,values);
      log('Updated equipment',`${equipment.name} marked ${conditionLabel(equipment.status)}`,'equipment');
    }else{
      equipment={id:uid('eq'),...values};
      state.equipment.push(equipment);
      log('Added equipment',equipment.name,'equipment');
    }
    saveState(formEditId?'Equipment updated.':'Equipment added.');
  }
  closeForm();
  renderAll();
}
function openIssueForm(id=null){openForm('issue',id)}
function openEquipmentForm(id=null){openForm('equipment',id)}
function switchTab(name){
  $$('.maintenance-tab').forEach(b=>b.classList.toggle('active',b.dataset.maintenanceTab===name));
  $$('.maintenance-tab-panel').forEach(p=>p.classList.toggle('active',p.dataset.maintenancePanel===name));
}
function init(){
  const date=$('#maintenanceDate');
  if(!date)return;
  loadState();
  selectedDate=isoToday();
  date.value=selectedDate;
  day();
  renderAll();

  date.addEventListener('change',()=>{selectedDate=date.value||isoToday();day();renderAll()});
  $('#maintenanceToday').addEventListener('click',()=>{selectedDate=isoToday();date.value=selectedDate;day();renderAll()});
  $('#maintenanceRefresh').addEventListener('click',()=>{loadState();day();renderAll();toast('Maintenance data refreshed.')});
  $$('.maintenance-tab').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.maintenanceTab)));
  $('#addMaintenanceIssue').addEventListener('click',()=>openIssueForm());
  $('#addEquipment').addEventListener('click',()=>openEquipmentForm());
  $('#maintenanceIssueSearch').addEventListener('input',renderIssues);
  $('#maintenanceIssueFilter').addEventListener('change',renderIssues);
  $('#clearMaintenanceHistory').addEventListener('click',()=>{
    if(confirm('Clear the activity history for all dates?')){
      state.history=[];
      saveState('Activity history cleared.');
      renderHistory();
    }
  });
  $('#saveFieldInspection').addEventListener('click',saveField);
  $('#saveMaintenanceForm').addEventListener('click',saveForm);
  $$('[data-close-maintenance-modal]').forEach(b=>b.addEventListener('click',closeField));
  $$('[data-close-form-modal]').forEach(b=>b.addEventListener('click',closeForm));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(!$('#fieldMaintenanceModal').hidden)closeField();
      if(!$('#maintenanceFormModal').hidden)closeForm();
    }
  });
}
document.addEventListener('DOMContentLoaded',init);
})();
