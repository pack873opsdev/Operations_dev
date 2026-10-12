const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{stripTypeScriptTypes}=require('node:module');
const request_id='e9866c12-9adf-471c-a4f9-1e5b239b4115';
function setup({role='volunteer',pending=false,configured=true,owner='pack873ops.dev@gmail.com',shareFails=false}={}){
 let handler,row=null;const calls=[];const user={id:'actor',email:'volunteer@example.org',app_metadata:{pack873_role:role,pack873_must_change_password:pending}};
 const admin={auth:{getUser:async token=>({data:{user:token==='valid'?user:null}})},rpc:async(name,args)=>{row||={id:'row',user_id:'actor',request_id:args.request,title:args.file_title,kind:args.file_kind,state:'creating'};return {data:{...row}}},from(table){
  if(table==='volunteers')return {select:()=>({ilike:()=>({maybeSingle:async()=>({data:{id:1}})})})};
  if(table==='committee_roles')return {select:()=>({eq:()=>({limit:async()=>({data:[{id:1}]})})})};
  return {update(payload){let matched=true;return {eq(key,value){matched&&=row?.[key]===value;return this},in(key,values){matched&&=values.includes(row?.[key]);return this},select(){return this},async maybeSingle(){if(!matched)return {data:null};Object.assign(row,payload);return {data:{...row}}},then(resolve){if(matched)Object.assign(row,payload);resolve({error:null})}}}};
 }};
 const source=fs.readFileSync('supabase/functions/pack873-volunteer-files-dev/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInNewContext(stripTypeScriptTypes(source),{createClient:()=>admin,Response,URLSearchParams,AbortSignal,Error,Deno:{env:{get:key=>configured?'configured':undefined},serve:fn=>handler=fn},fetch:async(url,options={})=>{
  calls.push({url,body:options.body});
  if(url.includes('oauth2'))return Response.json({access_token:'token'});
  if(url.includes('/about'))return Response.json({user:{emailAddress:owner}});
  if(url.includes('/permissions'))return shareFails?Response.json({}, {status:400}):Response.json({id:'permission'});
  return Response.json(url.includes('forms.googleapis')?{formId:'google_id'}:{id:'google_id'});
 }});
 return {calls,getRow:()=>row,setShareFails:v=>shareFails=v,call:async(body={},token='valid')=>{const response=await handler(new Request('https://example.org',{method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({action:'create',title:'Pack planning',kind:'document',request_id,...body})}));return {status:response.status,body:await response.json()}}};
}
test('Reject anonymous, pending-password, and unrelated accounts before Google calls',async()=>{for(const [options,token,status] of [[{},'invalid',401],[{pending:true},'valid',403],[{role:'other'},'valid',403]]){const s=setup(options);assert.equal((await s.call({},token)).status,status);assert.equal(s.calls.length,0)}});
test('Missing Google configuration and wrong owner never create a file',async()=>{for(const options of [{configured:false},{owner:'other@gmail.com'}]){const s=setup(options);assert.equal((await s.call()).status,503);assert.equal(s.getRow(),null);assert.ok(!s.calls.some(c=>c.url.includes('/files?')))}});
test('Create each native file and share only with authenticated email',async()=>{for(const kind of ['form','document','sheet']){const s=setup();const r=await s.call({kind,email:'attacker@example.org'});assert.equal(r.status,200);assert.match(r.body.file.url,/google_id\/edit$/);assert.equal(s.getRow().state,'ready');const share=s.calls.find(c=>c.url.includes('/permissions'));assert.deepEqual(JSON.parse(share.body),{type:'user',role:'writer',emailAddress:'volunteer@example.org'});if(kind==='form')assert.ok(s.calls.some(c=>c.url.includes('unpublished=true')))}});
test('Repeated requests and sharing retries never duplicate files',async()=>{const s=setup({shareFails:true});const failed=await s.call();assert.equal(failed.status,502);assert.equal(failed.body.file.state,'sharing');assert.match(failed.body.file.url,/google_id\/edit$/);assert.equal(s.getRow().state,'sharing');s.setShareFails(false);assert.equal((await s.call()).status,200);assert.equal((await s.call()).status,200);assert.equal(s.calls.filter(c=>c.url.includes('/files?')).length,1)});
test('An uncertain creation request requires review instead of silently duplicating',async()=>{const s=setup();await s.call();s.getRow().state='review';assert.equal((await s.call()).status,409);assert.equal(s.calls.filter(c=>c.url.includes('/files?')).length,1)});
