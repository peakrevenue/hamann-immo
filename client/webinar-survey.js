import {request,readAttribution} from './attribution.js';
import {surveyQuestions} from '../content/webinar-survey.mjs';
import {takeMailingContext,prepareSurveyContext} from './webinar-followup.js';
const mailing=takeMailingContext();
const form=document.getElementById('webinar-survey'),steps=[...form.querySelectorAll('.survey-step')],next=document.getElementById('survey-next'),back=document.getElementById('survey-back'),error=document.getElementById('survey-error'),email=document.getElementById('survey-email');
let step=0,busy=false;
const context=prepareSurveyContext(mailing).then(value=>{
  if(!email.value&&value.email)email.value=value.email;
  return value;
}).catch(()=>null);
function values(){const f=new FormData(form);return {...Object.fromEntries(f),goals:f.getAll('goals'),attribution:readAttribution()};}
function show(index){step=index;steps.forEach((el,i)=>el.hidden=i!==step);back.hidden=step===0;document.querySelector('.survey-progress-head').hidden=step===5;document.getElementById('step-label').textContent=step===5?'':`Frage ${step+1} von 5`;document.getElementById('survey-progress-fill').style.width=(step+1)/6*100+'%';document.querySelector('.survey-progress').setAttribute('aria-valuenow',String(step+1));next.textContent=step===5?'Antworten absenden':'Weiter →';error.textContent='';const legend=steps[step].querySelector('legend');legend.tabIndex=-1;legend.focus({preventScroll:true});form.scrollIntoView({behavior:'auto',block:'start'});}
back.addEventListener('click',()=>{if(!busy)show(Math.max(0,step-1));});
document.getElementById('webinar-question').addEventListener('input',event=>document.getElementById('question-count').textContent=event.target.value.length.toLocaleString('de-DE'));
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;error.textContent='';
  if(step<5){const q=surveyQuestions[step];if(!q.text&&!form.querySelector(`input[name="${q.key}"]:checked`)){error.textContent=q.multiple?'Bitte wähle mindestens ein Ziel aus.':'Bitte wähle eine Antwort aus.';return;}show(step+1);return;}
  if(!email.reportValidity())return;
  busy=true;next.disabled=true;back.disabled=true;next.textContent='Wird gespeichert …';
  try{if(!await context)await prepareSurveyContext({email:email.value});const result=await request('webinar/survey',values());location.assign(result.next);}
  catch(e){error.textContent=e.message;busy=false;next.disabled=false;back.disabled=false;next.textContent='Antworten absenden';}
});
