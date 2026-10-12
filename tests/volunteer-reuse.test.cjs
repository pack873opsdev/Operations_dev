const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('Pack873_Website_DEV/index.html','utf8');
const handler=html.slice(html.indexOf("$('cmVolunteerMasterForm').addEventListener('submit'"),html.indexOf("function openRoleCreation("));
function setup({race=false}={}){
 const existing={id:7,volunteer_name:'Existing Volunteer',email:'volunteer@example.org',phone:'5551234567'};
 const fields={cmVolunteerMasterName:{value:'New entered name'},cmVolunteerMasterEmail:{value:' Volunteer@Example.org '},cmVolunteerMasterPhone:{value:'Different phone'}};
 let submit;const assigned=[],writes=[],messages=[];
 const ctx={isAdmin:true,volunteerMasterEditing:null,volunteers:race?[]:[existing],normalizeVolunteerEmail:email=>(email||'').trim().toLowerCase(),$:id=>id==='cmVolunteerMasterForm'?{addEventListener:(event,fn)=>submit=fn}:fields[id],status:msg=>messages.push(msg),assignAnotherRole:async v=>assigned.push(v),loadMasters:async()=>{ctx.volunteers=[existing]},db:{from:()=>({insert:payload=>{writes.push(payload);return Promise.resolve({error:{code:'23505'}})}})}};
 vm.createContext(ctx);vm.runInContext(handler,ctx);return {ctx,assigned,writes,messages,existing,run:()=>submit({preventDefault(){}})};
}
test('Existing email reuses volunteer for another assignment without writes or provisioning',async()=>{const s=setup();await s.run();assert.equal(s.writes.length,0);assert.equal(s.assigned[0],s.existing);assert.equal(s.existing.volunteer_name,'Existing Volunteer')});
test('Concurrent duplicate creation refreshes and reuses the existing volunteer',async()=>{const s=setup({race:true});await s.run();assert.equal(s.writes.length,1);assert.equal(s.assigned[0],s.existing)});
test('Editing another volunteer to an existing email gives a clear message',async()=>{const s=setup();s.ctx.volunteerMasterEditing=9;await s.run();assert.equal(s.writes.length,0);assert.equal(s.assigned.length,0);assert.match(s.messages[0],/belongs to Existing Volunteer/)});
