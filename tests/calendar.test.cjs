const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(user=null){
 const nodes=new Map(),writes=[];const element=()=>({hidden:false,disabled:false,value:'',textContent:'',children:[],handlers:{},style:{},classList:{add(){}},setAttribute(){},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},addEventListener(name,fn){this.handlers[name]=fn},focus(){},closest(){return null},querySelectorAll(){return []}});
 const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};$('calendarOverlay').hidden=true;$('committeeOverlay').hidden=true;
 const future=new Date();future.setDate(future.getDate()+1);const key=`${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,'0')}-${String(future.getDate()).padStart(2,'0')}`;
 const data=[{id:1,event_name:'Pack outing',audience:'Whole Pack',event_date:key,place:'Park',address:'123 Main St',start_time:'10:00:00',end_time:'12:00:00'}];
 const link=element();
 const db={
  auth:{getUser:async()=>({data:{user}}),onAuthStateChange(){}},
  from(){return {
   select(){return {order(){return {order:async()=>({data})}}}},
   insert(payload){writes.push(payload);return {select:()=>({single:async()=>({data:{id:2}})})}},
   update(payload){writes.push(payload);return {eq:()=>({select:()=>({single:async()=>({data:{id:1}})})})}}
  }}
 };
 const ctx={db,Date,setTimeout,location:{hash:''},window:{addEventListener(){}},document:{activeElement:element(),body:{style:{}},getElementById:$,createElement:element,querySelectorAll:()=>[link],addEventListener(){}},};vm.createContext(ctx);vm.runInContext(fs.readFileSync('Pack873_Website_DEV/calendar.js','utf8').replace('export function','function')+';initializeCalendar(db);',ctx);
 return {$,writes,key,open:async()=>{await link.handlers.click({preventDefault(){}});await new Promise(r=>setImmediate(r))},flush:()=>new Promise(r=>setImmediate(r))};
}
test('Public monthly calendar exposes event details but no editing',async()=>{const s=setup();await s.open();assert.equal(s.$('calEdit').hidden,true);assert.equal(s.$('calendarOverlay').hidden,false);assert.ok(s.$('calGrid').children.length>28);const day=s.$('calGrid').children.find(x=>x.children.some(c=>c.textContent==='Pack outing'));day.handlers.click();assert.equal(s.$('calEventForm').hidden,true);assert.equal(s.$('calDateDetails').children[1].children[0].textContent,'Pack outing');assert.equal(s.$('upcomingEventList').children.length,1);assert.equal(s.writes.length,0)});
test('Only a completed admin login can save a selected calendar date',async()=>{const s=setup({app_metadata:{pack873_role:'admin',pack873_must_change_password:false}});await s.open();assert.equal(s.$('calEdit').hidden,false);await s.$('calEdit').handlers.click();s.$('calGrid').children.find(x=>x.children.some(c=>c.textContent==='Pack outing')).handlers.click();assert.equal(s.$('calEventForm').hidden,false);for(const [id,value] of [['calEventName','Den hike'],['calPlace','Trail'],['calAddress','456 Trail Rd'],['calStart','09:00'],['calEnd','11:00']])s.$(id).value=value;await s.$('calEventForm').handlers.submit({preventDefault(){}});assert.equal(s.writes.length,1);assert.equal(s.writes[0].event_date,s.key);assert.equal(s.writes[0].audience,'Whole Pack')});
test('Volunteer and pending admin logins cannot use calendar editing',async()=>{for(const meta of [{pack873_role:'volunteer'},{pack873_role:'admin',pack873_must_change_password:true}]){const s=setup({app_metadata:meta});await s.open();await s.$('calEdit').handlers.click();await s.$('calEventForm').handlers.submit({preventDefault(){}});assert.equal(s.$('calEdit').hidden,true);assert.equal(s.writes.length,0)}});
test('Invalid time range remains in the form and does not save',async()=>{const s=setup({app_metadata:{pack873_role:'admin'}});await s.open();await s.$('calEdit').handlers.click();s.$('calGrid').children.find(x=>x.children.some(c=>c.textContent==='Pack outing')).handlers.click();for(const [id,value] of [['calEventName','Test'],['calPlace','Place'],['calAddress','Address'],['calStart','11:00'],['calEnd','09:00']])s.$(id).value=value;await s.$('calEventForm').handlers.submit({preventDefault(){}});assert.equal(s.writes.length,0);assert.match(s.$('calFormStatus').textContent,/End time must/)});
