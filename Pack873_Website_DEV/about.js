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
