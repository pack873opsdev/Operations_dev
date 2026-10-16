const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(){
 const nodes=new Map(),calls=[],views=[];let user={id:'member',app_metadata:{pack873_role:'volunteer'}},hold=null;
 function element(){return {hidden:false,open:false,textContent:'',children:[],handlers:{},elements:{namedItem(){return {value:''}}},addEventListener(type,fn){this.handlers[type]=fn},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},setAttribute(){},reset(){},focus(){},showModal(){this.open=true},close(){this.open=false},querySelectorAll(){return []},querySelector(){return element()}}}
 const $=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const doc={body:element(),getElementById:$,createTextNode:text=>({textContent:text}),createElement:()=>{const e=element();Object.defineProperty(e,'id',{set(id){nodes.set(id,e)}});return e}};
 const db={rpc:async(name,args)=>{calls.push(args);if(hold)return await hold;return {data:{events:[],volunteers:[],notifications:[{id:'n1',message:'X assigned your venue task'}]}}}};
 const context={db,getUser:()=>user,navigate:v=>views.push(v),document:doc,console,setTimeout,Date,Error,Set,Blob,URL};vm.createContext(context);
 vm.runInContext(fs.readFileSync('Pack873_Website_DEV/event-tasks.js','utf8').replace('export function','function')+';api=initializeEventTasks(db,getUser,navigate)',context);
 return {$,calls,views,api:context.api,setUser:u=>user=u,setHold:p=>hold=p,flush:()=>new Promise(r=>setImmediate(r))};
}
test('New assignments prompt a signed-in volunteer; Later preserves unread activity',async()=>{
 const s=setup();s.api.session();await s.flush();assert(s.$('etPopup').open);assert.match(s.$('etPopupMessage').textContent,/X assigned/);assert.match(s.$('cmEventsTasks').textContent,/1 new/);
 s.$('etPopupLater').handlers.click();assert(!s.$('etPopup').open);assert.equal(s.calls.length,1);s.api.session();await s.flush();assert(!s.$('etPopup').open);
});
test('Signed-out and pending-password accounts cannot load task data',async()=>{
 const s=setup();s.setUser(null);s.api.session();await s.$('cmEventsTasks').handlers.click();assert.equal(s.calls.length,0);
 s.setUser({id:'pending',app_metadata:{pack873_role:'volunteer',pack873_must_change_password:true}});s.api.session();await s.$('cmEventsTasks').handlers.click();assert.equal(s.calls.length,0);
});
test('Sign-out clears notifications, panel contents and popup',async()=>{
 const s=setup();s.api.session();await s.flush();s.setUser(null);s.api.reset();assert(!s.$('etPopup').open);assert.equal(s.$('etNotifications').children.length,0);assert.equal(s.$('cmEventsTasks').textContent,'Events & Tasks');assert(s.$('cmTasksView').hidden);
});
test('An old response after sign-out cannot repopulate private task activity',async()=>{
 const s=setup();let release;s.setHold(new Promise(r=>release=r));s.api.session();s.setUser(null);s.api.reset();release({data:{events:[{title:'Private event'}],notifications:[{id:'private',message:'Private task'}]}});await s.flush();assert.equal(s.$('etEvents').children.length,0);assert.equal(s.$('etNotifications').children.length,0);assert(!s.$('etPopup').open);
});
