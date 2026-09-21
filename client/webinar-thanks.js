import {request,readAttribution} from './attribution.js';
import {takeMailingContext,prepareSurveyContext,setupCalendars,setupVideos} from './webinar-followup.js';
const mailing=takeMailingContext();readAttribution();
setupCalendars();setupVideos();
const context=prepareSurveyContext(mailing).catch(()=>null);
document.querySelectorAll('.survey-link').forEach(link=>link.addEventListener('click',async event=>{event.preventDefault();await context;location.assign(link.href);}));
function greet(firstName){document.getElementById('thanks-title').textContent=firstName?`${firstName}, du bist dabei.`:'Du bist dabei.';}
(async()=>{
 if(new URLSearchParams(location.search).get('vorschau')==='1'){return;}
 // Klaviyo/Zapier register mailing visitors externally. This page only prepares
 // their survey and must never create or resend a webinar registration.
 if(mailing.email){greet(mailing.firstName);return;}
 try{const result=await request('webinar/registration');if(result.registered)greet(result.firstName);}
 catch{/* Direct mailing traffic has no website registration cookie. */}
})();
