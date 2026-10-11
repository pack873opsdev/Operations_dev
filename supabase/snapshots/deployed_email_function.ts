import { createClient } from "npm:@supabase/supabase-js@2";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const token=req.headers.get('authorization')?.replace(/^Bearer /i,'');
  if(!token)return reply({error:'Authentication required'},401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!service)return reply({error:'Service role secret missing'},500);
  const client=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false}});
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user)return reply({error:'Invalid session'},401);
  const body=await req.json().catch(()=>null);
  if(body?.action==='complete_password_change'){
   if(user.app_metadata?.pack873_role!=='volunteer'||user.app_metadata?.pack873_must_change_password!==true)return reply({error:'Password setup not required'},403);
   const newPassword=body.new_password;
   if(typeof newPassword!=='string'||newPassword.length<12||newPassword===Deno.env.get('PACK873_DEV_INITIAL_PASSWORD'))return reply({error:'Choose a different password of at least 12 characters'},400);
   // Server updates password and clears the first-login flag in one privileged operation.
   const {error:updateError}=await admin.auth.admin.updateUserById(user.id,{password:newPassword,app_metadata:{...user.app_metadata,pack873_must_change_password:false}});
   if(updateError)return reply({error:'Unable to finish password setup'},500);
   return reply({success:true});
  }
  if(body?.action!=='provision')return reply({error:'Unknown action'},400);
  if(user.app_metadata?.pack873_role!=='admin')return reply({error:'Admin only'},403);
  const email=String(body.email||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'Invalid email'},400);
  const {data:volunteer,error:lookupError}=await admin.from('volunteers').select('id,email').ilike('email',email).maybeSingle();
  if(lookupError||!volunteer)return reply({error:'Volunteer email not found in master list'},404);
  const password=Deno.env.get('PACK873_DEV_INITIAL_PASSWORD');
  if(!password)return reply({error:'Temporary password secret missing'},500);
  // Supabase Auth rejects duplicate emails; never reset or overwrite an existing user's password/role.
  const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{pack873_role:'volunteer',pack873_must_change_password:true}});
  if(createError){
   if(/already|registered|exists|duplicate/i.test(createError.message))return reply({success:true,created:false});
   console.error('Provision failed',createError.message);return reply({error:'Unable to create volunteer login'},500);
  }
  return reply({success:true,created:!!created.user});
 }catch(e){console.error('Volunteer access function error',e);return reply({error:'Unexpected server error'},500)}
});
