import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendTemporaryPassword } from '../_shared/temporary-password-email.ts';

const cors = {'Access-Control-Allow-Origin':'https://pack873-operations-dev.pages.dev','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply = (body: unknown, status = 200) => Response.json(body, {status, headers:cors});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, {status:204, headers:cors});
  if (req.method !== 'POST') return reply({error:'Method not allowed'},405);
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer /i,'');
    if (!token) return reply({error:'Authentication required'},401);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error} = await admin.auth.getUser(token);
    if (error || !user) return reply({error:'Invalid session'},401);
    const body = await req.json();
    if (body.action === 'complete_password_change') {
      if (user.app_metadata.pack873_role !== 'volunteer' || user.app_metadata.pack873_must_change_password !== true) return reply({error:'Password setup not required'},403);
      if (typeof body.new_password !== 'string' || body.new_password.length === 0) return reply({error:'Enter a password'},400);
      const {error:updateError} = await admin.auth.admin.updateUserById(user.id, {password:body.new_password, app_metadata:{...user.app_metadata,pack873_must_change_password:false,pack873_temporary_password_sent_at:null,pack873_password_changed_at:new Date().toISOString()}});
      if (updateError) return reply({error:updateError.message||'Unable to finish password setup'},400);
      return reply({success:true});
    }
    if (user.app_metadata.pack873_role !== 'admin' || user.app_metadata.pack873_must_change_password === true) return reply({error:'Admin access required'},403);
    if (!['provision','provision_all','statuses','send_password','reset_password'].includes(body.action)) return reply({error:'Unknown action'},400);
    const {data:volunteers,error:lookupError} = await admin.from('volunteers').select('id,email,temporary_password_delivery_assumed');
    if (lookupError) return reply({error:'Unable to read volunteers'},500);
    const accounts = [];
    for (let page=1;;page++) {
      const {data,error:listError} = await admin.auth.admin.listUsers({page,perPage:1000});
      if (listError) return reply({error:'Unable to read login accounts'},500);
      accounts.push(...data.users);
      if (data.users.length < 1000) break;
    }
    const byEmail = new Map(accounts.map(u=>[(u.email||'').toLowerCase(),u]));
    if (body.action === 'statuses') return reply({success:true,statuses:(volunteers||[]).map(v=>{
      const u=byEmail.get(v.email.trim().toLowerCase());
      return {id:v.id,email:v.email,is_admin:u?.app_metadata.pack873_role==='admin',status:!u?'No login':u.app_metadata.pack873_role!=='volunteer'?'Existing account':u.app_metadata.pack873_must_change_password===true?(u.app_metadata.pack873_temporary_password_sent_at?'Temporary password sent — change pending':'Temporary password ready — not marked sent'):'Personal password set',sent_at:u?.app_metadata.pack873_must_change_password===true?u.app_metadata.pack873_temporary_password_sent_at:null};
    })});
    const email = typeof body.email==='string'?body.email.trim().toLowerCase():'';
    const volunteer = (volunteers||[]).find(v=>v.email.trim().toLowerCase()===email);
    if (body.action!=='provision_all' && !volunteer) return reply({error:'Volunteer email not found'},404);
    if (body.action==='reset_password') {
      const account=byEmail.get(email);
      if(!account || account.app_metadata.pack873_role!=='volunteer')return reply({error:'Select a volunteer login to reset'},409);
      const metadata={...account.app_metadata,pack873_must_change_password:true,pack873_temporary_password_sent_at:null,pack873_password_changed_at:null,pack873_initial_password_version:'fixed-dev-20261011'};
      const {error:resetError}=await admin.auth.admin.updateUserById(account.id,{password:'Pack873ops#Dev',app_metadata:metadata});
      if(resetError)return reply({error:'Unable to reset password'},400);
      try{await sendTemporaryPassword(email,'Pack873ops#Dev')}catch{return reply({error:'Password reset, but email delivery failed. Use Send temporary password to retry.'},502)}
      const {error:sentError}=await admin.auth.admin.updateUserById(account.id,{app_metadata:{...metadata,pack873_temporary_password_sent_at:new Date().toISOString()}});
      return sentError?reply({error:'Password reset and email accepted, but delivery status could not be recorded'},500):reply({success:true});
    }
    if (body.action==='send_password') {
      const account=byEmail.get(email);
      if (!account || account.app_metadata.pack873_role!=='volunteer' || account.app_metadata.pack873_must_change_password!==true) return reply({error:'No temporary password pending'},409);
      if(account.app_metadata.pack873_initial_password_version!=='fixed-dev-20261011')return reply({error:'Existing login uses an earlier temporary password; do not send a different password without resetting it explicitly'},409);
      await sendTemporaryPassword(email,'Pack873ops#Dev');
      const {error:updateError}=await admin.auth.admin.updateUserById(account.id,{app_metadata:{...account.app_metadata,pack873_temporary_password_sent_at:new Date().toISOString()}});
      return updateError?reply({error:'Unable to record delivery'},500):reply({success:true});
    }
    const initial='Pack873ops#Dev';
    const results=[];
    for (const v of body.action==='provision_all'?(volunteers||[]):[volunteer!]) {
      const address=v.email.trim().toLowerCase();
      if (byEmail.has(address)) {results.push({email:address,created:false});continue;}
      const {data,error:createError}=await admin.auth.admin.createUser({email:address,password:initial,email_confirm:true,app_metadata:{pack873_role:'volunteer',pack873_must_change_password:true,pack873_temporary_password_sent_at:v.temporary_password_delivery_assumed?new Date().toISOString():null,pack873_temporary_password_delivery_assumed:!!v.temporary_password_delivery_assumed,pack873_initial_password_version:'fixed-dev-20261011'}});
      if (createError) {results.push({email:address,created:false,error:'Unable to create account; retry provisioning'});continue;}
      if(data.user) byEmail.set(address,data.user);
      if(data.user&&!v.temporary_password_delivery_assumed){
        try{
          await sendTemporaryPassword(address,initial);
          const {error:sentError}=await admin.auth.admin.updateUserById(data.user.id,{app_metadata:{...data.user.app_metadata,pack873_temporary_password_sent_at:new Date().toISOString()}});
          if(sentError)throw new Error('Email accepted, but delivery status could not be recorded');
        }catch{results.push({email:address,created:true,error:'Login created, but email or delivery tracking failed. Use Send temporary password to retry.'});continue;}
      }
      results.push({email:address,created:true});
    }
    return reply({success:results.every(r=>!r.error),created:results[0]?.created||false,results});
  } catch { return reply({error:'Unexpected server error'},500); }
});
