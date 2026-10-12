const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('Pack873_Website_DEV/index.html','utf8');
const source=html.slice(html.indexOf('function renderCommitteeView()'),html.indexOf('db.auth.onAuthStateChange'));
function setup({admin=false,pending=false,items=[]}={}){
 const elements=new Map(),handlers=new Map(),timers=[];
 const $=id=>{if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',value:'',children:[],replaceChildren(){this.children=[]},append(...children){this.children.push(...children)},addEventListener:(event,fn)=>handlers.set(id+':'+event,fn),setAttribute(){},focus(){},reset(){},querySelector(){return {disabled:false}}});return elements.get(id)};
 const ctx={$,currentUser:{id:'member'},isAdmin:admin,mustChangePassword:pending,committeeView:'choices',status(){},document:{hidden:false,activeElement:null,body:{style:{}},addEventListener(){}},console,Date,setInterval:(fn,delay)=>{timers.push({fn,delay});return 1},clearInterval(){},db:{from:()=>({select:()=>({order:()=>({order:async()=>({data:items})}),eq:()=>({single:async()=>({data:{full_details:'Full detail\nNext line'}})})}),insert:async()=>({})})}};
 ctx.document.createElement=()=>({value:'',textContent:'',children:[],append(...children){this.children.push(...children)},addEventListener(){}});
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,$,handlers,timers};
}
test('Volunteers first see choices; directory and composer open independently',()=>{
 const {ctx,$}=setup();ctx.renderCommitteeView();assert.equal($('cmVolunteerChoices').hidden,false);assert.equal($('cmDirectoryView').hidden,true);
 ctx.chooseCommitteeView('directory');assert.equal($('cmDirectoryView').hidden,false);assert.equal($('cmAnnouncementForm').hidden,true);
 ctx.chooseCommitteeView('announcement');assert.equal($('cmAnnouncementForm').hidden,false);assert.equal($('cmDirectoryView').hidden,true);
});
test('Pending first-login users cannot see publishing or directory',()=>{const {ctx,$}=setup({pending:true});ctx.renderCommitteeView();assert.equal($('cmVolunteerChoices').hidden,true);assert.equal($('cmAnnouncementForm').hidden,true);assert.equal($('cmDirectoryView').hidden,true)});
test('Multiple roles require an explicit choice; edits use the original author roles',async()=>{
 const {ctx,$}=setup({admin:true});const calls=[];
 ctx.db.rpc=async(name,args)=>{calls.push({name,args});return {data:[{assignment_id:1,role_name:'Pinewood Derby Lead',status:'Active'},{assignment_id:2,role_name:'AOL Den Leader',status:'Active'}]}};
 await ctx.openAnnouncementEditor();assert.equal($('cmAnnouncementRole').children.length,3);assert.equal($('cmAnnouncementRole').value,'');
 await ctx.openAnnouncementEditor({id:'post',author_id:'original-author',role_master_id:2,topic_name:'Existing',full_details:'Long detail'});
 assert.equal(calls.at(-1).args.target_author,'original-author');assert.equal($('cmAnnouncementRole').value,'2');assert.equal($('cmTopicName').value,'Existing');assert.equal($('cmAnnouncementSubmit').textContent,'Save changes');
});
test('Carousel rotates every ten seconds, wraps manually and pauses for detail view',async()=>{
 const items=[{id:'a',role_name:'Cub Master',topic_name:'<b>Plain text</b>',topic_description:'Brief\nSecond line',created_at:'2026-10-11T12:00:00Z'},{id:'b',role_name:'Webmaster',topic_name:'Second',topic_description:'Another',created_at:'2026-10-10T12:00:00Z'}];
 const {ctx,$,handlers,timers}=setup({items});await ctx.loadAnnouncements();assert.equal($('announcementTopic').textContent,'<b>Plain text</b>');assert.equal(timers.at(-1).delay,10000);
 timers.at(-1).fn();assert.equal($('announcementTopic').textContent,'Second');handlers.get('announcementNext:click')();assert.equal($('announcementTopic').textContent,'<b>Plain text</b>');
 handlers.get('announcementPause:click')();assert.equal($('announcementPause').textContent,'Play');await handlers.get('announcementReadMore:click')();assert.equal($('announcementDetailFull').textContent,'Full detail\nNext line');assert.equal($('announcementOverlay').hidden,false);
});
