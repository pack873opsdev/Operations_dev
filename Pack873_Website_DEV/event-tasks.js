export function initializeEventTasks(db,getUser,navigate){
 const $=id=>document.getElementById(id);
 const view=document.createElement('section');view.id='cmTasksView';view.hidden=true;
 view.innerHTML=`<div class="cm-top"><h3>Events &amp; Tasks</h3><button type="button" class="cm-btn cm-secondary" id="etBack">Back</button></div>
 <p class="cm-help">Organize an event, assign shared tasks, and keep everyone updated. These planning events are private and do not publish to the public calendar.</p>
 <div class="cm-row"><button type="button" class="cm-btn" id="etNewEvent">Create event</button><button type="button" class="cm-btn cm-secondary" id="etRefresh">Refresh updates</button></div>
 <p id="etStatus" role="status" aria-live="polite"></p><div id="etNotifications"></div>
 <form id="etEventForm" hidden><h4>Create an event plan</h4><label>Event name<input name="title" required maxlength="200"></label><label>Event date<input name="event_date" type="date"></label><label>Event description<textarea name="description" rows="3"></textarea></label><div class="cm-row"><button class="cm-btn">Create event</button><button type="button" class="cm-btn cm-secondary" id="etCancelEvent">Cancel</button></div><p role="status" class="et-error"></p></form>
 <div id="etEvents"></div><section id="etDetail" hidden><div class="cm-top"><h4 id="etEventTitle"></h4><button type="button" class="cm-btn cm-secondary" id="etEventBack">All events</button></div><p id="etEventMeta" class="cm-help"></p><p id="etProgress"></p><div class="cm-row" id="etOrganizerTools"><button type="button" class="cm-btn" id="etAddTask">Add task</button><button type="button" class="cm-btn cm-secondary" id="etCloseEvent">Close event &amp; keep final report</button></div>
 <form id="etTaskForm" hidden><h4 id="etTaskFormTitle">Create task</h4><input name="task_id" type="hidden"><label>Task name<input name="title" required maxlength="200"></label><label>Instructions<textarea name="instructions" rows="3"></textarea></label><label>Due date<input name="due_date" type="date"></label><fieldset><legend>Assign volunteers — choose one or more</legend><div id="etAssignees"></div></fieldset><div class="cm-row"><button class="cm-btn">Save task</button><button type="button" class="cm-btn cm-secondary" id="etCancelTask">Cancel</button></div><p role="status" class="et-error"></p></form>
 <form id="etCloseForm" hidden><h4>Keep a concise final report</h4><p>The report keeps task owners, final status, due date, last update and its date. Detailed updates, assignments and notifications will be permanently removed. This cannot be undone on the website. The report remains available to the organizer, administrators and event participants.</p><label>Final event summary<textarea name="summary" rows="4" required></textarea></label><label>Type CLOSE AND CLEAN UP to confirm<input name="confirm" required autocomplete="off"></label><div class="cm-row"><button class="cm-btn cm-danger">Save report &amp; permanently clean up</button><button type="button" class="cm-btn cm-secondary" id="etCancelClose">Cancel</button></div><p role="status" class="et-error"></p></form>
 <div id="etTasks"></div><div id="etReport"></div></section>`;
 $('cmSignedIn').append(view);
 const popup=document.createElement('dialog');popup.id='etPopup';popup.setAttribute('aria-labelledby','etPopupTitle');popup.innerHTML='<h3 id="etPopupTitle">You have new task activity</h3><p id="etPopupMessage"></p><div class="cm-row"><button type="button" class="cm-btn" id="etPopupView">View tasks &amp; give updates</button><button type="button" class="cm-btn cm-secondary" id="etPopupLater">Remind me later</button></div>';document.body.append(popup);
 popup.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation()});
 const states=['Not started','In progress','Blocked','Completed'];
 let events=[],volunteers=[],notifications=[],selected=null,tasks=[],epoch=0,sessionId=null,popupSeen=new Set(),busy=false;
 const eligible=()=>{const u=getUser();return u&&['admin','volunteer'].includes(u.app_metadata?.pack873_role)&&u.app_metadata?.pack873_must_change_password!==true};
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
 const button=(text,fn,secondary=true)=>{const b=node('button',text,'cm-btn'+(secondary?' cm-secondary':''));b.type='button';b.addEventListener('click',()=>Promise.resolve(fn()).catch(error=>status(error.message)));return b};
 const field=(form,name)=>form.elements.namedItem(name);
 const status=text=>{$('etStatus').textContent=text||''};
 const date=value=>value?new Date(value.length===10?value+'T12:00:00':value).toLocaleString(undefined,value.length===10?{dateStyle:'medium'}:{dateStyle:'medium',timeStyle:'short'}):'—';
 async function call(action,data={}){
  if(!eligible())throw new Error('Sign in and complete password setup first.');
  const token=epoch,uid=getUser().id;
  const {data:result,error}=await db.rpc('pack873_event_tasks',{p_action:action,p_data:data});
  if(token!==epoch||getUser()?.id!==uid)throw new Error('Your session changed. Reopen Events & Tasks.');
  if(error)throw new Error(error.code==='PGRST202'?'Events & Tasks is awaiting database setup.':error.message);
  return result;
 }
 function badge(){for(const id of ['cmEventsTasks','cmAdminEventsTasks'])$(id).textContent='Events & Tasks'+(notifications.length?' ('+notifications.length+' new)':'')}
 function paintNotifications(){
  $('etNotifications').replaceChildren();
  if(!notifications.length)return;
  const box=node('section',null,'et-notices');box.append(node('h4','New activity'));
  for(const n of notifications){const row=node('div',null,'et-notice');row.append(node('span',n.message),button('View',async()=>{await acknowledge([n.id]);await load();await openEvent(n.event_id)}));box.append(row)}
  box.append(button('Mark all as read',async()=>{await acknowledge(notifications.map(n=>n.id));await load()}));$('etNotifications').append(box);
 }
 async function acknowledge(ids){if(ids.length)await call('read_notifications',{ids})}
 async function load(showPopup=false){
  const data=await call('list');events=data.events||[];volunteers=data.volunteers||[];notifications=data.notifications||[];badge();paintNotifications();paintEvents();
  if(showPopup&&notifications.some(n=>!popupSeen.has(n.id))&&!popup.open){
   notifications.forEach(n=>popupSeen.add(n.id));$('etPopupMessage').textContent=notifications.length+' new assignment or update'+(notifications.length===1?'':'s')+'. '+notifications[0].message;popup.showModal();
  }
 }
 function paintEvents(){
  $('etEvents').replaceChildren();
  if(!events.length)$('etEvents').append(node('p','No event plans yet. Create an event to get started.','cm-help'));
  for(const event of events){const card=node('article',null,'et-event');card.append(node('h4',event.title),node('p',event.owner_name+' · '+date(event.event_date)+' · '+(event.closed_at?'Closed — final report':'Open'),'cm-help'),button(event.closed_at?'View final report':'Open tasks',()=>openEvent(event.id),false));$('etEvents').append(card)}
 }
 async function openEvent(id){
  selected=events.find(e=>e.id===id);if(!selected)return;
  $('etEvents').hidden=true;$('etDetail').hidden=false;$('etEventForm').hidden=true;$('etTaskForm').hidden=true;$('etCloseForm').hidden=true;
  $('etEventTitle').textContent=selected.title;$('etEventMeta').textContent='Organizer: '+selected.owner_name+(selected.description?' · '+selected.description:'');
  $('etOrganizerTools').hidden=!selected.can_manage||!!selected.closed_at;$('etTasks').replaceChildren();$('etReport').replaceChildren();
  if(selected.closed_at){$('etProgress').textContent='Closed '+date(selected.closed_at);paintReport(selected.final_report);return}
  const data=await call('details',{event_id:id});tasks=data.tasks||[];
  $('etProgress').textContent=tasks.filter(t=>t.status==='Completed').length+' of '+tasks.length+' visible tasks completed'+(selected.can_manage?'':' · Showing tasks assigned to you');
  for(const task of tasks)paintTask(task);
  if(!tasks.length)$('etTasks').append(node('p','No tasks yet.','cm-help'));
 }
 function paintTask(task){
  const card=node('article',null,'et-task');card.append(node('h4',task.title));
  card.append(node('p',task.assignees.map(a=>a.name).join(', ')+' · Due '+date(task.due_date),'cm-help'));
  const state=node('span',task.status,'et-state');if(task.due_date&&task.status!=='Completed'&&task.due_date<new Date().toLocaleDateString('en-CA'))state.append(' · Overdue');card.append(state,node('p',task.instructions,'et-text'));
  if(selected.can_manage)card.append(button('Edit task / assignments',()=>editTask(task)));
  const history=document.createElement('details');history.append(node('summary','Updates ('+task.updates.length+')'));
  for(const update of task.updates){const entry=node('div',null,'et-update');entry.append(node('strong',update.author_name+' · '+update.status),node('small',date(update.created_at)),node('p',update.message,'et-text'));history.append(entry)}card.append(history);
  const form=document.createElement('form');form.className='et-update-form';
  const label=node('label','Status');const select=document.createElement('select');select.name='status';for(const value of states){const option=node('option',value);option.value=value;select.append(option)}select.value=task.status;label.append(select);
  const updateLabel=node('label',selected.can_manage?'Reply or final update':'Your update');const input=document.createElement('textarea');input.rows=3;input.required=true;input.name='message';updateLabel.append(input);
  const submit=node('button','Send update','cm-btn');submit.type='submit';const error=node('p','','et-error');error.setAttribute('role','status');
  form.append(label,updateLabel,submit,error);form.addEventListener('submit',e=>{e.preventDefault();mutate(form,async()=>{await call('update_task',{event_id:selected.id,task_id:task.id,status:select.value,message:input.value});await load();await openEvent(selected.id)})});card.append(form);$('etTasks').append(card);
 }
 function editTask(task){
  const form=$('etTaskForm');form.reset();form.querySelector('.et-error').textContent='';$('etCloseForm').hidden=true;
  field(form,'task_id').value=task?.id||'';field(form,'title').value=task?.title||'';field(form,'instructions').value=task?.instructions||'';field(form,'due_date').value=task?.due_date||'';
  $('etTaskFormTitle').textContent=task?'Edit task':'Create task';$('etAssignees').replaceChildren();
  for(const v of volunteers){const label=node('label',null,'et-check');const check=document.createElement('input');check.type='checkbox';check.value=v.id;check.checked=!!task?.assignees.some(a=>String(a.id)===String(v.id));label.append(check,document.createTextNode(v.name));$('etAssignees').append(label)}
  form.hidden=false;field(form,'title').focus();
 }
 async function mutate(form,fn){
  if(busy)return;busy=true;const controls=[...form.querySelectorAll('button,input,textarea,select')];controls.forEach(c=>c.disabled=true);const output=form.querySelector('.et-error');output.textContent='Saving…';
  try{await fn();output.textContent=''}catch(error){output.textContent=error.message}finally{busy=false;controls.forEach(c=>c.disabled=false)}
 }
 function paintReport(report){
  if(!report)return;const box=$('etReport');box.append(node('h4','Final event report'),node('p',report.summary,'et-text'));
  const table=document.createElement('table');const head=document.createElement('thead');const tr=document.createElement('tr');for(const title of ['Task','Owners','Final status','Due','Final update','Last update'])tr.append(node('th',title));head.append(tr);table.append(head);
  const body=document.createElement('tbody');for(const task of report.tasks||[]){const row=document.createElement('tr');for(const value of [task.title,task.owners,task.status,date(task.due_date),task.final_update||'No written update',date(task.last_update_at)])row.append(node('td',value));body.append(row)}table.append(body);const scroll=node('div',null,'cm-scroll');scroll.append(table);box.append(scroll);
  box.append(button('Download final sheet (CSV)',()=>{
   const safe=value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"'};
   const rows=[['Event',report.event],['Organizer',report.organizer],['Closed',report.closed_at],['Summary',report.summary],[],['Task','Owners','Final status','Due date','Final update','Last update'],...(report.tasks||[]).map(t=>[t.title,t.owners,t.status,t.due_date,t.final_update,t.last_update_at])];
   const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Pack873-final-event-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },false));
 }
 async function open(){if(!eligible())return;navigate('tasks');status('Loading…');try{await load();status('')}catch(error){status(error.message)}}
 for(const id of ['cmEventsTasks','cmAdminEventsTasks'])$(id).addEventListener('click',open);
 $('etBack').addEventListener('click',()=>navigate('choices'));
 $('etRefresh').addEventListener('click',async()=>{try{await load();if(selected)await openEvent(selected.id);status('Up to date.')}catch(error){status(error.message)}});
 $('etNewEvent').addEventListener('click',()=>{$('etEventForm').hidden=false;$('etEventForm').reset();$('etEventForm').querySelector('.et-error').textContent='';field($('etEventForm'),'title').focus()});
 $('etCancelEvent').addEventListener('click',()=>{$('etEventForm').hidden=true});
 $('etEventForm').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;mutate(form,async()=>{const data=await call('create_event',{title:field(form,'title').value,description:field(form,'description').value,event_date:field(form,'event_date').value});await load();await openEvent(data.id)})});
 $('etEventBack').addEventListener('click',()=>{selected=null;$('etDetail').hidden=true;$('etEvents').hidden=false});
 $('etAddTask').addEventListener('click',()=>editTask(null));$('etCancelTask').addEventListener('click',()=>{$('etTaskForm').hidden=true});
 $('etTaskForm').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;mutate(form,async()=>{await call('save_task',{event_id:selected.id,task_id:field(form,'task_id').value,title:field(form,'title').value,instructions:field(form,'instructions').value,due_date:field(form,'due_date').value,assignees:[...$('etAssignees').querySelectorAll('input:checked')].map(c=>c.value)});await load();await openEvent(selected.id)})});
 $('etCloseEvent').addEventListener('click',()=>{$('etTaskForm').hidden=true;$('etCloseForm').hidden=false;$('etCloseForm').reset();field($('etCloseForm'),'summary').focus()});
 $('etCancelClose').addEventListener('click',()=>{$('etCloseForm').hidden=true});
 $('etCloseForm').addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;mutate(form,async()=>{await call('close_event',{event_id:selected.id,summary:field(form,'summary').value,confirm:field(form,'confirm').value});await load();await openEvent(selected.id)})});
 $('etPopupLater').addEventListener('click',()=>popup.close());$('etPopupView').addEventListener('click',()=>{popup.close();open()});
 return {
  session(){if(!eligible())return;const id=getUser().id;if(sessionId===id)return;sessionId=id;load(true).catch(()=>{})},
  reset(){epoch++;sessionId=null;events=[];volunteers=[];notifications=[];selected=null;tasks=[];popupSeen.clear();popup.close();view.hidden=true;$('etDetail').hidden=true;$('etEvents').hidden=false;for(const id of ['etEvents','etTasks','etReport','etNotifications','etAssignees'])$(id).replaceChildren();for(const form of view.querySelectorAll('form'))form.reset();badge();status('')}
 };
}
