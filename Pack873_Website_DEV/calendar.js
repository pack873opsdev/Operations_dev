import {fallbackEventImage,findEventImage,mapsURL,downloadEventCalendar} from './event-media.js';
export function initializeCalendar(db){
 const $=id=>document.getElementById(id),overlay=$('calendarOverlay');
 let month=new Date();month=new Date(month.getFullYear(),month.getMonth(),1);
 let events=[],canEdit=false,editing=false,eventId=null,selectedDate=null,returnFocus=null;
 const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const dateLabel=s=>new Date(s+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'});
 const timeLabel=t=>new Date('2000-01-01T'+t).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
 const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el};
 async function verifyAdmin(){const {data,error}=await db.auth.getUser();canEdit=!error&&data?.user?.app_metadata?.pack873_role==='admin'&&!data.user.app_metadata.pack873_must_change_password;$('calEdit').hidden=!canEdit;if(!canEdit){editing=false;$('calEventForm').hidden=true}renderMonth()}
 async function loadEvents(){
  $('calStatus').textContent='Loading events…';
  const {data,error}=await db.from('calendar_events').select('id,event_name,audience,event_date,place,address,start_time,end_time').order('event_date').order('start_time');
  if(error){$('calStatus').textContent='Unable to load calendar events. Please try again.';$('upcomingEventStatus').textContent='Unable to load upcoming events.';return}
  events=data||[];$('calStatus').textContent='';renderMonth();renderUpcoming();
 }
 function renderMonth(){
  $('calMonth').textContent=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});$('calEdit').textContent=editing?'Done editing':'Edit';
  const grid=$('calGrid');grid.replaceChildren();for(const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])grid.append(make('div',day,'cal-weekday'));
  for(let i=0;i<month.getDay();i++)grid.append(make('div','','cal-empty'));
  const days=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  for(let day=1;day<=days;day++){
   const key=dateKey(new Date(month.getFullYear(),month.getMonth(),day)),items=events.filter(e=>e.event_date===key),button=make('button',undefined,'cal-day');button.type='button';button.setAttribute('aria-label',dateLabel(key)+', '+items.length+' event(s)');if(key===dateKey(new Date()))button.classList.add('cal-today');button.append(make('span',String(day),'cal-day-number'));
   for(const event of items)button.append(make('span',event.event_name,'cal-event-label'));button.addEventListener('click',()=>{selectedDate=key;if(editing&&canEdit)showForm(null,key);else showDetails(key)});grid.append(button);
  }
 }
 function showDetails(key){$('calEventForm').hidden=true;const box=$('calDateDetails');box.hidden=false;box.replaceChildren(make('h3',dateLabel(key)));const items=events.filter(e=>e.event_date===key);if(!items.length)box.append(make('p','No events scheduled for this date.'));
  for(const event of items){const card=make('article',undefined,'cal-detail-card');card.append(make('h4',event.event_name),make('p',event.audience),make('p',event.place+' — '+event.address),make('p',timeLabel(event.start_time)+' – '+timeLabel(event.end_time)));if(editing&&canEdit){const edit=make('button','Edit event','cm-btn');edit.type='button';edit.addEventListener('click',()=>showForm(event,key));card.append(edit)}box.append(card)}
 }
 function showForm(event,key){if(!canEdit||!editing)return;eventId=event?.id??null;selectedDate=key;$('calFormTitle').textContent=(event?'Edit event — ':'New event — ')+dateLabel(key);$('calEventName').value=event?.event_name||'';$('calAudience').value=event?.audience||'Whole Pack';$('calPlace').value=event?.place||'';$('calAddress').value=event?.address||'';$('calStart').value=event?.start_time?.slice(0,5)||'';$('calEnd').value=event?.end_time?.slice(0,5)||'';$('calFormStatus').textContent='';showDetails(key);$('calEventForm').hidden=false;$('calEventName').focus()}
 function renderUpcoming(){const list=$('upcomingEventList');list.replaceChildren();const today=dateKey(new Date()),currentTime=new Date().toTimeString().slice(0,8),upcoming=events.filter(e=>e.event_date>today||(e.event_date===today&&e.end_time>currentTime));$('upcomingEventStatus').textContent=upcoming.length?'':'No upcoming events yet.';
  for(const event of upcoming){
   const card=make('article',undefined,'event calendar-event-card'),imageBox=make('div',undefined,'event-image'),image=make('img');image.src=fallbackEventImage(event.event_name);image.alt=event.event_name+' event illustration';image.loading='lazy';imageBox.append(image);
   const date=new Date(event.event_date+'T12:00:00'),badge=make('div',undefined,'date');badge.append(make('small',date.toLocaleDateString('en-US',{month:'short'}).toUpperCase()),document.createTextNode(String(date.getDate())));imageBox.append(badge);
   const body=make('div',undefined,'event-body'),place=make('a',event.place,'event-map-link');place.href=mapsURL(event);place.target='_blank';place.rel='noopener noreferrer';place.title='Open '+event.place+' in Google Maps';
   const audience=make('p'),location=make('p'),time=make('p');audience.append(make('b','♟'),document.createTextNode(event.audience));location.append(make('b','📍'),place);time.append(make('b','◷'),document.createTextNode(date.toLocaleDateString(undefined,{weekday:'short'})+', '+timeLabel(event.start_time)+' – '+timeLabel(event.end_time)));
   const add=make('button','▦ Add to Calendar','cal-btn');add.type='button';add.addEventListener('click',()=>downloadEventCalendar(event));body.append(make('h3',event.event_name),audience,location,time,add);
   const credit=make('a',undefined,'event-image-credit');credit.hidden=true;credit.target='_blank';credit.rel='noopener noreferrer';body.append(credit);image.addEventListener('error',()=>{image.src=fallbackEventImage(event.event_name);credit.hidden=true},{once:true});
   card.append(imageBox,body);list.append(card);
   findEventImage(event.event_name).then(found=>{if(!found)return;image.src=found.url;credit.href=found.source;credit.textContent='Photo: '+found.author+' · '+found.license;credit.hidden=false});
  }
 }
 async function open(){returnFocus=document.activeElement;overlay.hidden=false;document.body.style.overflow='hidden';$('calClose').focus();await verifyAdmin();await loadEvents()}
 function close(){overlay.hidden=true;$('calEventForm').hidden=true;$('calDateDetails').hidden=true;editing=false;document.body.style.overflow=$('committeeOverlay').hidden?'':'hidden';returnFocus?.focus()}
 for(const link of document.querySelectorAll('a[href="#calendar"]'))link.addEventListener('click',e=>{e.preventDefault();open()});
 $('calClose').addEventListener('click',close);overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
 $('calPrev').addEventListener('click',()=>{month.setMonth(month.getMonth()-1);$('calEventForm').hidden=true;$('calDateDetails').hidden=true;renderMonth()});$('calNext').addEventListener('click',()=>{month.setMonth(month.getMonth()+1);$('calEventForm').hidden=true;$('calDateDetails').hidden=true;renderMonth()});$('calToday').addEventListener('click',()=>{month=new Date();month.setDate(1);renderMonth()});
 $('calEdit').addEventListener('click',async()=>{await verifyAdmin();if(!canEdit)return;editing=!editing;$('calEventForm').hidden=true;renderMonth();$('calStatus').textContent=editing?'Select a date to add an event. Existing events can be edited below the form.':''});
 $('calCancel').addEventListener('click',()=>{$('calEventForm').hidden=true});
 $('calEventForm').addEventListener('submit',async e=>{e.preventDefault();await verifyAdmin();if(!canEdit){$('calFormStatus').textContent='Only administrators can save events.';return}const payload={event_name:$('calEventName').value.trim(),audience:$('calAudience').value,event_date:selectedDate,place:$('calPlace').value.trim(),address:$('calAddress').value.trim(),start_time:$('calStart').value,end_time:$('calEnd').value};if(!payload.event_name||!payload.place||!payload.address){$('calFormStatus').textContent='Enter the event name, place and address.';return}if(payload.end_time<=payload.start_time){$('calFormStatus').textContent='End time must be after start time.';return}const button=$('calSave');button.disabled=true;try{const result=eventId?await db.from('calendar_events').update(payload).eq('id',eventId).select('id').single():await db.from('calendar_events').insert(payload).select('id').single();if(result.error)throw result.error;await loadEvents();$('calEventForm').hidden=true;showDetails(selectedDate);$('calStatus').textContent='Event saved.'}catch(error){$('calFormStatus').textContent='Could not save event: '+error.message}finally{button.disabled=false}});
 document.addEventListener('keydown',e=>{if(overlay.hidden)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close()}if(e.key==='Tab'){const focusable=[...overlay.querySelectorAll('button,input,select')].filter(el=>!el.disabled&&!el.closest('[hidden]'));const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}},true);
 db.auth.onAuthStateChange(()=>{if(!overlay.hidden)setTimeout(verifyAdmin,0)});window.addEventListener('hashchange',()=>{if(location.hash==='#calendar')open()});loadEvents();if(location.hash==='#calendar')open();
}
