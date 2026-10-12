export function initializeVolunteerFiles(db, getUser, navigate) {
 const $=id=>document.getElementById(id);
 let pending=null,busy=false,generation=0;
 const labels={form:'Form',document:'Document',sheet:'Sheet'};
 const status=message=>{$('cmFilesStatus').textContent=message||''};
 function authorized(){const u=getUser();return u&&['admin','volunteer'].includes(u.app_metadata?.pack873_role)&&u.app_metadata?.pack873_must_change_password!==true}
 async function call(body){
  const {data,error}=await db.functions.invoke('pack873-volunteer-files-dev',{body});
  if(error){
   let payload=data;
   if(!payload&&error.context?.json){try{payload=await error.context.json()}catch{}}
   const failure=new Error(payload?.error||'Google file creation is not connected yet. Contact the administrator.');failure.file=payload?.file;throw failure;
  }
  if(data?.error)throw new Error(data.error);return data;
 }
 function addFile(file){
  const expected=file.kind==='form'?'forms':file.kind==='sheet'?'spreadsheets':'document';
  if(!labels[file.kind]||typeof file.url!=='string'||!new RegExp('^https://docs\\.google\\.com/'+expected+'/d/[A-Za-z0-9_-]+/edit$').test(file.url))return;
  const card=document.createElement('article');card.className='cm-file-card';
  const title=document.createElement('h4');title.textContent=file.title;
  const link=document.createElement('a');link.className='cm-btn';link.href=file.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open '+labels[file.kind];
  const type=document.createElement('p');type.className='cm-help';type.textContent=labels[file.kind]+' · Saved in the Pack account';
  const url=document.createElement('a');url.href=file.url;url.target='_blank';url.rel='noopener noreferrer';url.textContent=file.url;url.style='display:block;overflow-wrap:anywhere;font-size:12px;margin-top:10px';
  card.append(title,type,link,url);
  if(file.state==='sharing'){const warning=document.createElement('p');warning.className='cm-help';warning.textContent='File created. Google editing access is pending. Ask the administrator to check your Google account email.';card.append(warning)}
  $('cmFilesList').append(card);
 }
 async function load(){
  if(!authorized())return;const current=++generation,userId=getUser().id;
  status('Loading your files…');$('cmFilesList').replaceChildren();
  try{const data=await call({action:'list'});if(current!==generation||getUser()?.id!==userId||!authorized())return;
   for(const file of data.files||[])addFile(file);status(data.files?.length?'':'Your created files will appear here.');
  }catch(error){if(current===generation&&getUser()?.id===userId)status(error.message)}
 }
 for(const id of ['cmDocuments','cmAdminDocuments'])$(id).addEventListener('click',()=>{if(!authorized())return;navigate('files');load()});
 $('cmFilesBack').addEventListener('click',()=>navigate('choices'));
 for(const button of $('cmFilesTypes').querySelectorAll('[data-file-kind]'))button.addEventListener('click',()=>{
  if(!authorized()||busy)return;const kind=button.dataset.fileKind;
  $('cmFilesKind').value=kind;$('cmFilesCreateTitle').textContent='Create '+labels[kind];$('cmFilesForm').hidden=false;status('');$('cmFilesTitle').focus();
 });
 $('cmFilesCancel').addEventListener('click',()=>{if(!busy){$('cmFilesForm').hidden=true;status('')}});
 $('cmFilesForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!authorized()||busy)return;
  const title=$('cmFilesTitle').value.trim(),kind=$('cmFilesKind').value;
  if(!title){status('Enter a file title.');return}
  const userId=getUser().id;
  if(!pending||pending.userId!==userId||pending.title!==title||pending.kind!==kind)pending={title,kind,userId,request_id:crypto.randomUUID()};
  busy=true;const request=pending;const current=++generation;
  const controls=[...$('cmFilesForm').querySelectorAll('button,input'),...$('cmFilesTypes').querySelectorAll('button')];controls.forEach(control=>control.disabled=true);status('Creating your file and giving you editing access…');
  try{
   const data=await call({action:'create',title,kind,request_id:request.request_id});
   if(current!==generation||getUser()?.id!==userId||!authorized())return;
   if(!data.file)throw new Error('The file link was not returned. Contact the administrator.');
   addFile(data.file);pending=null;$('cmFilesForm').hidden=true;$('cmFilesTitle').value='';status('Created. Use the Open link below. Sign in to Google with '+getUser().email+' to edit.');
  }catch(error){if(current===generation&&getUser()?.id===userId){if(error.file){$('cmFilesList').replaceChildren();addFile(error.file)}status(error.file?'File created. Its link is below; Google has not granted editing access yet. You can retry this request without creating another file.':error.message)}}finally{busy=false;controls.forEach(control=>control.disabled=false)}
 });
 return {reset(){generation++;pending=null;$('cmFilesList').replaceChildren();$('cmFilesTitle').value='';$('cmFilesForm').hidden=true;status('')}};
}
