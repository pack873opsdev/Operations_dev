const imageCache=new Map();
export function fallbackEventImage(name){
 const title=name.toLowerCase();
 if(/pinewood|derby|race/.test(title))return 'assets/images/event-pinewood-derby.jpg';
 if(/hike|hiking|trail/.test(title))return 'assets/images/event-den-hike.jpg';
 if(/flag|ceremony/.test(title))return 'assets/images/event-flag-retirement.jpg';
 if(/stem|science|rocket/.test(title))return 'assets/images/gallery-stem-activities.jpg';
 return 'assets/images/event-pack-campout.jpg';
}
export function eventSearchTopic(name){
 if(/pinewood/i.test(name))return 'pinewood derby';
 if(/campout|campfire|camping/i.test(name))return 'campfire camping';
 if(/hike|hiking/i.test(name))return 'hiking trail';
 if(/flag.*retire/i.test(name))return 'flag retirement ceremony';
 return name.replace(/[^\p{L}\p{N}\s-]/gu,' ').trim().slice(0,100);
}
export async function findEventImage(name){
 const topic=eventSearchTopic(name),key='pack873-event-image-v1:'+topic;
 if(imageCache.has(key))return imageCache.get(key);
 const promise=(async()=>{
  try{
   const cached=JSON.parse(localStorage.getItem(key)||'null');if(cached&&Date.now()-cached.savedAt<7*86400000)return cached.image;
  }catch{}
  try{
   const params=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:topic+' filetype:bitmap',gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url|mime|size|extmetadata',iiurlwidth:'640'});
   const response=await fetch('https://commons.wikimedia.org/w/api.php?'+params,{signal:AbortSignal.timeout(6000)});if(!response.ok)throw Error('Image search unavailable');const data=await response.json();
   const pages=Object.values(data.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0));
   for(const page of pages){const info=page.imageinfo?.[0],meta=info?.extmetadata||{},license=meta.LicenseShortName?.value||'';
    if(!info||!['image/jpeg','image/png','image/webp'].includes(info.mime)||info.width/info.height<0.9||info.width<400||!(/^(?:CC0|public domain|CC BY(?:-SA)? \d)/i.test(license)))continue;
    if(/pinewood/i.test(topic)&&/axle|weights|wood fill|closeup/i.test(page.title||''))continue;
    const url=info.thumburl||info.url,source=info.descriptionurl;if(!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(url||'')||!source?.startsWith('https://commons.wikimedia.org/'))continue;
    const author=(meta.Artist?.value||'Wikimedia Commons contributor').replace(/<[^>]*>/g,'').trim().slice(0,160);
    const image={url,source,author,license};try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),image}))}catch{}return image;
   }
  }catch{}
  return null;
 })();imageCache.set(key,promise);return promise;
}
export function mapsURL(event){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(event.place+' '+event.address)}
export function eventCalendarFile(event){
 const escape=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 const stamp=(date,time)=>date.replace(/-/g,'')+'T'+time.replace(/:/g,'').padEnd(6,'0');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Pack873//Events//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:pack873-event-'+event.id+'@pack873-operations-dev.pages.dev','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z'),'DTSTART:'+stamp(event.event_date,event.start_time),'DTEND:'+stamp(event.event_date,event.end_time),'SUMMARY:'+escape(event.event_name),'LOCATION:'+escape(event.place+' — '+event.address),'DESCRIPTION:'+escape(event.audience),'END:VEVENT','END:VCALENDAR'];
 // Fold on UTF-8 byte boundaries for calendar applications, without splitting characters.
 return lines.map(line=>{let result='',bytes=0;for(const char of line){const size=new TextEncoder().encode(char).length;if(bytes+size>74){result+='\r\n ';bytes=1}result+=char;bytes+=size}return result}).join('\r\n')+'\r\n';
}
export function downloadEventCalendar(event){const url=URL.createObjectURL(new Blob([eventCalendarFile(event)],{type:'text/calendar;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=(event.event_name.replace(/[^a-z0-9]+/gi,'-')||'pack873-event')+'.ics';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
