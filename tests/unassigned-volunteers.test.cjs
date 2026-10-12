const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
test('Unassigned list excludes active, inactive and legacy email assignments; selects only unassigned IDs',async()=>{
 const source=fs.readFileSync('Pack873_Website_DEV/index.html','utf8');const fragment=source.slice(source.indexOf('async function showUnassignedVolunteers(){'),source.indexOf("$('cmListUnassigned').addEventListener"));
 const nodes={};const el=()=>({children:[],hidden:true,disabled:false,textContent:'',append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},addEventListener(){},querySelector(){return null}});const $=id=>nodes[id]??=el();
 const volunteers=[{id:1,volunteer_name:'Assigned',email:'one@x.com'},{id:2,volunteer_name:'Inactive',email:'two@x.com'},{id:3,volunteer_name:'Legacy',email:'three@x.com'},{id:4,volunteer_name:'Unassigned',email:'four@x.com'}];
 const assignments=[{volunteer_id:1,email:'one@x.com'},{volunteer_id:2,email:'two@x.com'},{volunteer_id:null,email:' THREE@x.com '}];
 const ctx={$ ,isAdmin:true,scrollCommitteeToTop(){},normalizeVolunteerEmail:s=>(s||'').trim().toLowerCase(),formatPhone:s=>s,document:{createElement:el,createTextNode:s=>s},db:{from:t=>({select:()=>t==='volunteers'?{order:async()=>({data:volunteers})}:Promise.resolve({data:assignments})})}};
 vm.createContext(ctx);vm.runInContext(fragment,ctx);await ctx.showUnassignedVolunteers();assert.equal($('cmUnassignedList').children.length,1);assert.equal($('cmUnassignedList').children[0].children[0].value,'4');assert.match($('cmUnassignedStatus').textContent,/1 volunteer/);
});
