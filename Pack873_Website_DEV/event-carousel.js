export function initializeEventCarousel(track){
 const wrapper=document.createElement('div');wrapper.className='event-carousel';
 const viewport=document.createElement('div');viewport.className='event-carousel-viewport';
 const button=(label,text)=>{const el=document.createElement('button');el.type='button';el.className='event-carousel-arrow';el.setAttribute('aria-label',label);el.textContent=text;return el};
 const previous=button('Previous events','‹'),next=button('Next events','›');
 track.parentNode.insertBefore(wrapper,track);viewport.append(track);wrapper.append(previous,viewport,next);
 const pause=button('Pause event rotation','Pause');pause.className='event-carousel-pause';wrapper.append(pause);
 let moving=false,paused=false,hover=false,focused=false,timer=null,motionTimer=null;
 const visibleCount=()=>window.matchMedia('(max-width:900px)').matches?2:4;
 const enough=()=>track.children.length>visibleCount();
 function markVisible(){[...track.children].forEach((card,index)=>{card.inert=index>=visibleCount()})}
 function refresh(){clearTimeout(timer);clearTimeout(motionTimer);moving=false;track.style.transition='none';track.style.transform='translateX(0)';previous.disabled=next.disabled=!enough();pause.hidden=!enough();markVisible();schedule()}
 function schedule(){clearTimeout(timer);if(enough()&&!paused&&!hover&&!focused&&!document.hidden)timer=setTimeout(()=>move(1),10000)}
 function move(direction){
  if(moving||!enough())return;moving=true;clearTimeout(timer);
  const gap=parseFloat(getComputedStyle(track).gap)||14,step=track.children[0].getBoundingClientRect().width+gap;
  track.style.transition='none';
  if(direction<0){track.prepend(track.lastElementChild);track.style.transform=`translateX(-${step}px)`}else track.style.transform='translateX(0)';
  void track.offsetWidth;
  track.style.transition=window.matchMedia('(prefers-reduced-motion:reduce)').matches?'none':'transform 900ms ease-in-out';
  track.style.transform=direction>0?`translateX(-${step}px)`:'translateX(0)';
  motionTimer=setTimeout(()=>{if(direction>0)track.append(track.firstElementChild);track.style.transition='none';track.style.transform='translateX(0)';moving=false;markVisible();schedule()},950);
 }
 previous.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Play':'Pause';pause.setAttribute('aria-label',paused?'Resume event rotation':'Pause event rotation');schedule()});
 wrapper.addEventListener('mouseenter',()=>{hover=true;schedule()});wrapper.addEventListener('mouseleave',()=>{hover=false;schedule()});wrapper.addEventListener('focusin',()=>{focused=true;schedule()});wrapper.addEventListener('focusout',()=>{setTimeout(()=>{focused=wrapper.contains(document.activeElement);schedule()},0)});
 document.addEventListener('visibilitychange',schedule);window.addEventListener('resize',refresh);
 return {refresh};
}
