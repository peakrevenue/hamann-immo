import {request} from './attribution.js';
import {workshop} from '../content/workshop.mjs';
// A supplied email is only prefill data. It never authorizes contact retrieval.
export function takeMailingContext() {
  const url=new URL(location.href),params=url.searchParams;
  const email=params.get('email')||params.get('email_address')||'';
  const firstName=params.get('first_name')||params.get('firstname')||params.get('vorname')||'';
  const keys=['email','email_address','first_name','firstname','vorname'];
  if(keys.some(k=>params.has(k))){keys.forEach(k=>params.delete(k));history.replaceState(null,'',url.pathname+(params.size?'?'+params.toString():'')+url.hash);}
  return {email,firstName};
}
export async function prepareSurveyContext(contact) {
  const value={};
  if(contact.email&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(contact.email.trim()))value.email=contact.email.trim();
  if(contact.firstName)value.firstName=contact.firstName;
  return request('webinar/survey-context',value);
}
export function setupCalendars() {
  const compact=date=>new Date(date).toISOString().replace(/[-:]/g,'').replace('.000','');
  const details='Live-Webinar mit Henrik Hamann. Den persönlichen Zugangslink findest du in deiner E-Mail. Informationen: '+workshop.url;
  const google=new URL('https://calendar.google.com/calendar/render');
  google.search=new URLSearchParams({action:'TEMPLATE',text:workshop.name,dates:compact(workshop.start)+'/'+compact(workshop.end),ctz:workshop.timeZone,details,location:'Online, Zugangslink per E-Mail'});
  const outlook=new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlook.search=new URLSearchParams({path:'/calendar/action/compose',rru:'addevent',subject:workshop.name,startdt:new Date(workshop.start).toISOString(),enddt:new Date(workshop.end).toISOString(),body:details,location:'Online, Zugangslink per E-Mail'});
  const g=document.getElementById('google-calendar'),o=document.getElementById('outlook-calendar');if(g)g.href=google.toString();if(o)o.href=outlook.toString();
}
export function setupVideos() {
  document.querySelectorAll('[data-youtube]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.youtube;if(!/^[a-zA-Z0-9_-]{11}$/.test(id))return;
    const frame=document.createElement('iframe');frame.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0';
    frame.title=button.getAttribute('aria-label');frame.allow='accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
    button.replaceWith(frame);frame.focus();
  }));
}
