import {request} from './attribution.js';
import {takeMailingContext,setupVideos} from './webinar-followup.js';
takeMailingContext();setupVideos();
const title=document.getElementById('survey-thanks-title'),copy=document.getElementById('survey-confirmation-copy');
function confirm(){document.getElementById('survey-confirmation-label').textContent='DEINE ANTWORTEN SIND ANGEKOMMEN';title.textContent='Danke, das hat geklappt.';copy.textContent='Deine Umfrage wurde übermittelt.';document.getElementById('survey-confirmed').hidden=false;}
(async()=>{
 if(new URLSearchParams(location.search).get('vorschau')==='1'){confirm();return;}
 try{const result=await request('webinar/survey-confirmation');if(result.completed)confirm();}
 catch(e){title.textContent='Deine Webinar-Umfrage.';copy.textContent=[401,404].includes(e.status)?'Hier findest du die Bestätigung, sobald du deine Antworten abgesendet hast.':'Deine Bestätigung konnte gerade nicht geladen werden. Bitte lade diese Seite erneut.';document.getElementById('survey-incomplete').hidden=false;}
})();
