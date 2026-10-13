const aboutView=document.getElementById('about');
const homeView=document.getElementById('home');
function updateAboutView(){
 const open=location.hash==='#about';
 aboutView.hidden=!open;homeView.hidden=open;
 const aboutLink=document.querySelector('.navlinks>a[href="#about"]');
 const homeLink=document.querySelector('.navlinks>a[href="#home"]');
 aboutLink.classList.toggle('active',open);homeLink.classList.toggle('active',!open);
 if(open){aboutLink.setAttribute('aria-current','page');homeLink.removeAttribute('aria-current')}else{aboutLink.removeAttribute('aria-current')}
}
window.addEventListener('hashchange',updateAboutView);
updateAboutView();
const leadersDialog=document.getElementById('leadersDialog');
const leadersGrid=document.getElementById('leadersGrid');
document.getElementById('leadersClose').addEventListener('click',()=>leadersDialog.close());
document.getElementById('meetLeaders').addEventListener('click',async()=>{
 leadersDialog.showModal();
 leadersGrid.textContent='Loading our leaders…';
 try{
  const response=await fetch('leaders.json');
  if(!response.ok)throw new Error('Could not load leaders');
  const leaders=await response.json();leadersGrid.replaceChildren();
  for(const leader of leaders){
   const card=document.createElement('article');card.className='leader-card';
   const portrait=document.createElement('div');portrait.className='leader-portrait';
   if(leader.photo&&/^assets\//.test(leader.photo)){
    const img=document.createElement('img');img.src=leader.photo;img.alt=leader.name||leader.role;img.loading='lazy';portrait.append(img);
   }else{portrait.textContent='☺';portrait.setAttribute('aria-label','Photo coming soon')}
   const role=document.createElement('h3');role.textContent=leader.role;
   const name=document.createElement('strong');name.textContent=leader.name||'Introduction coming soon';
   const bio=document.createElement('p');bio.textContent=leader.bio||'A photo and introduction will be added here soon.';
   card.append(portrait,role,name,bio);leadersGrid.append(card);
  }
 }catch{leadersGrid.textContent='Our leader introductions are unavailable right now. Please try again later.'}
});
