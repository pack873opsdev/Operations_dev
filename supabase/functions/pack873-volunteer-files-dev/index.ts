import { createClient } from 'npm:@supabase/supabase-js@2';

const owner = 'pack873ops.dev@gmail.com';
const cors = {'Access-Control-Allow-Origin':'https://pack873-operations-dev.pages.dev','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
const links=(file:any)=>({id:file.id,title:file.title,kind:file.kind,created_at:file.created_at,state:file.state,url:`https://docs.google.com/${file.kind==='form'?'forms':file.kind==='sheet'?'spreadsheets':'document'}/d/${file.google_file_id}/edit`});

async function googleToken(){
 const client_id=Deno.env.get('PACK873_DRIVE_CLIENT_ID'),client_secret=Deno.env.get('PACK873_DRIVE_CLIENT_SECRET'),refresh_token=Deno.env.get('PACK873_DRIVE_REFRESH_TOKEN');
 if(!client_id||!client_secret||!refresh_token)throw new Error('Google file creation is not connected yet. Ask the administrator to connect the Pack Google account.');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id,client_secret,refresh_token,grant_type:'refresh_token'}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('The Pack Google connection needs administrator attention.');
 const token=await response.json();if(!token.access_token)throw new Error('The Pack Google connection needs administrator attention.');
 return token.access_token;
}
async function google(token:string,url:string,method='GET',body?:unknown){
 const response=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Google could not complete this step. Ask the administrator to check API access and the volunteer’s Google account.');
 return response.json();
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const bearer=req.headers.get('authorization')?.replace(/^Bearer /i,'');if(!bearer)return reply({error:'Sign in first.'},401);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await admin.auth.getUser(bearer);
  if(authError||!user)return reply({error:'Please sign in again.'},401);
  if(!['admin','volunteer'].includes(user.app_metadata.pack873_role)||user.app_metadata.pack873_must_change_password===true)return reply({error:'Finish your password setup before creating files.'},403);
  const email=user.email?.trim().toLowerCase();if(!email)return reply({error:'Your login needs an email address.'},403);
  if(user.app_metadata.pack873_role!=='admin'){
   const {data:person,error}=await admin.from('volunteers').select('id').ilike('email',email).maybeSingle();
   if(error||!person)return reply({error:'Your volunteer record is not available. Contact the administrator.'},403);
   const {data:assignment,error:assignmentError}=await admin.from('committee_roles').select('id').eq('volunteer_id',person.id).limit(1);
   if(assignmentError||!assignment?.length)return reply({error:'Ask the administrator to assign you a role first.'},403);
  }
  const body=await req.json();
  if(body.action==='list'){
   const {data,error}=await admin.from('volunteer_files').select('id,title,kind,google_file_id,state,created_at').eq('user_id',user.id).in('state',['ready','sharing']).not('google_file_id','is',null).order('created_at',{ascending:false}).limit(100);
   if(error)return reply({error:'The document list is not ready yet. Contact the administrator.'},503);
   return reply({files:(data||[]).map(links)});
  }
  if(body.action!=='create')return reply({error:'Unknown action'},400);
  const title=typeof body.title==='string'?body.title.trim():'';
  if(!title||title.length>200)return reply({error:'Enter a title with 1 to 200 characters.'},400);
  if(!['form','document','sheet'].includes(body.kind)||typeof body.request_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.request_id))return reply({error:'Invalid file request.'},400);
  const token=await googleToken();
  // Never create in an accidentally connected personal account.
  const profile=await google(token,'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)');
  if(profile.user?.emailAddress?.toLowerCase()!==owner)return reply({error:'Connect pack873ops.dev@gmail.com as the file owner.'},503);
  const {data:file,error:reserveError}=await admin.rpc('pack873_reserve_file',{actor:user.id,request:body.request_id,file_title:title,file_kind:body.kind});
  if(reserveError||!file)return reply({error:reserveError?.message==='Daily creation limit reached'?'You have reached today’s file creation limit.':'The file service is not ready yet. Contact the administrator.'},503);
  if(file.kind!==body.kind||file.title!==title)return reply({error:'This request was already used for another file.'},409);
  if(file.state==='ready')return reply({file:links(file)});
  let reserved=file;
  // Claim once. Repeated clicks reuse the existing request instead of creating duplicates.
  const {data:claimed,error:claimError}=await admin.from('volunteer_files').update({state:'review'}).eq('id',file.id).in('state',['creating','sharing']).select('*').maybeSingle();
  if(claimError||!claimed)return reply({error:'This request is still being processed or needs administrator review. Do not create a duplicate.'},409);
  reserved=claimed;
  try{
   if(!reserved.google_file_id){
    const created=reserved.kind==='form'
     ?await google(token,'https://forms.googleapis.com/v1/forms?unpublished=true','POST',{info:{title,documentTitle:title}})
     :await google(token,'https://www.googleapis.com/drive/v3/files?fields=id','POST',{name:title,mimeType:reserved.kind==='sheet'?'application/vnd.google-apps.spreadsheet':'application/vnd.google-apps.document',description:'Created through the Pack 873 volunteer portal.'});
    const id=created.formId||created.id;if(typeof id!=='string'||!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Google did not return a file link. Contact the administrator.');
    reserved.google_file_id=id;
    const {error}=await admin.from('volunteer_files').update({google_file_id:id}).eq('id',reserved.id);
    if(error)throw new Error('A file was created in the Pack account, but its link could not be saved. Contact the administrator before trying again.');
   }
   if(email!==owner){
    // Access is limited to the signed-in volunteer; never publish an anyone-edit link.
    await google(token,`https://www.googleapis.com/drive/v3/files/${reserved.google_file_id}/permissions?sendNotificationEmail=false`,'POST',{type:'user',role:'writer',emailAddress:email});
   }
   const {error}=await admin.from('volunteer_files').update({state:'ready'}).eq('id',reserved.id);
   if(error)throw new Error('File access was granted, but the portal could not save the result. Try again to recover its link.');
   return reply({file:links(reserved)});
  }catch(error){
   // If the ID is saved, retry only sharing; never create a replacement file.
   if(reserved.google_file_id)await admin.from('volunteer_files').update({state:'sharing'}).eq('id',reserved.id).eq('google_file_id',reserved.google_file_id);
   return reply({error:(error as Error).message,...(reserved.google_file_id?{file:links({...reserved,state:'sharing'})}:{})},502);
  }
 }catch(error){return reply({error:(error as Error).message||'Could not create the file.'},503)}
});
