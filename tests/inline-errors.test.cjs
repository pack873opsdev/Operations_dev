const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('Pack873_Website_DEV/index.html','utf8');const source=html.slice(html.indexOf('const status='),html.indexOf('function openPanel'));
test('Field errors remain beneath their own field; other errors stay in the open form',()=>{
 const ids=['cmMasterEditForm','cmRoleMasterForm','cmVolunteerMasterForm','cmEditor','cmAnnouncementForm','cmPasswordChange','cmLogin'];const outputs=[];const elements=new Map();
 for(const id of ids){const output={textContent:''};outputs.push(output);elements.set(id,{hidden:id!=='cmMasterEditForm',querySelector:()=>output,closest(){return this.hidden?{}:null},addEventListener(){}})}
 for(const id of ['cmStatus','cmEditRoleError','cmEditVolunteerError']){const output={textContent:''};elements.set(id,output);if(id!=='cmStatus')outputs.push(output)}
 const ctx={$:id=>elements.get(id),document:{querySelectorAll:()=>outputs}};vm.createContext(ctx);vm.runInContext(source,ctx);
 vm.runInContext(`status('Enter a role name.','cmEditRoleError')`,ctx);assert.equal(elements.get('cmEditRoleError').textContent,'Enter a role name.');assert.equal(elements.get('cmStatus').textContent,'');
 vm.runInContext(`status('Email could not be saved.')`,ctx);assert.equal(elements.get('cmMasterEditForm').querySelector().textContent,'Email could not be saved.');assert.equal(elements.get('cmEditRoleError').textContent,'');assert.equal(elements.get('cmStatus').textContent,'');
});
