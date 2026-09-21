import {questions} from '../client/questions.js';
import {createHash} from 'node:crypto';
import {webinarPayload} from './webinar.mjs';
import {surveyPayload} from './webinar-survey.mjs';
export const utmKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id','utm_source_platform','utm_creative_format','utm_marketing_tactic'];
export function attribution(data={}) {const clean=Object.fromEntries(utmKeys.map(k=>[k,'']));for(const [k,v]of Object.entries(data||{}))if(/^utm_[a-z0-9_]{1,40}$/.test(k)&&typeof v==='string'&&Object.keys(clean).length<30)clean[k]=v.slice(0,250);return clean;}
export function webhookPayload(lead,event) {
 const utms=attribution(lead.attribution);
 if(event==='webinar_registered')return webinarPayload(lead,utms);
 if(event==='webinar_survey_completed')return surveyPayload(lead,utms);
 const answers=Object.fromEntries(questions.map(q=>[q.key,q.options.find(([code])=>code===lead[q.key])?.[1]||null]));
 const revision=createHash('sha256').update(JSON.stringify([lead.name,lead.email,lead.phone,lead.role,lead.experience,lead.income,lead.qualification,utms])).digest('hex').slice(0,16);
 return {event,event_id:lead.id+':'+event+':'+revision,lead_id:lead.id,name:lead.name,email:lead.email,phone:lead.phone,country:lead.country,role:answers.role,experience:answers.experience,income:answers.income,qualification:({qualified:'Qualifiziert',disqualified:'Nicht passend',pending:'Noch offen'})[lead.qualification||'pending'],stage:lead.stage==='completed'?'Abgeschlossen':'Kontaktdaten erfasst',role_code:lead.role||null,experience_code:lead.experience||null,income_code:lead.income||null,qualification_code:lead.qualification||'pending',antworten:questions.map(q=>({frage:q.title,antwort:answers[q.key],antwortmoeglichkeiten:q.options.map(([,label])=>label)})),created_at:lead.createdAt,updated_at:lead.updatedAt||lead.createdAt,consented_at:lead.consentedAt,consent_version:lead.consentVersion,experiment:lead.experiment,variant:lead.variant,attribution:utms,...utms};
}
export async function deliverEvent(store,config,key,fetcher=fetch) {
 const job=await store.get(key);if(!job||job.deliveredAt)return;
 const destination=destinationFor(job.payload.event,config);
 if(!destination || config.webhookDisabled)return;
 const rank={webinar_registered:0,webinar_survey_completed:1,contact_created:0,contact_updated:1,quiz_completed:2};
 const predecessors=await store.list('outbox/'+job.payload.lead_id+':');
 if(predecessors.some(other=>!other.deliveredAt&&other.payload.event_id!==job.payload.event_id&&(other.createdAt<job.createdAt||other.createdAt===job.createdAt&&rank[other.payload.event]<rank[job.payload.event])))return;
 const url=new URL(destination);if(url.protocol!=='https:'||url.hostname!=='hooks.zapier.com'||!url.pathname.startsWith('/hooks/catch/'))throw Error('Invalid webhook configuration');
 try {
  const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json','X-Hamann-Event-Id':job.payload.event_id},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok)throw Error('HTTP '+response.status);
  await store.set(key,{...job,attempts:job.attempts+1,deliveredAt:new Date().toISOString(),lastError:null});
 }catch(error){const attempts=job.attempts+1;await store.set(key,{...job,attempts,lastError:error.message.startsWith('HTTP ')?error.message:'Verbindung fehlgeschlagen',nextAttemptAt:Date.now()+Math.min(3600000,30000*2**Math.min(attempts,7))});}
}
export async function queueEvent(store,config,lead,event,fetcher=fetch) {
 const payload=webhookPayload(lead,event),key='outbox/'+payload.event_id;
 if(!await store.get(key)){const job={payload,attempts:0,createdAt:new Date().toISOString(),nextAttemptAt:0};if(store.create)await store.create(key,job);else await store.set(key,job);}
 await deliverEvent(store,config,key,fetcher);
}
export async function flushOutbox(store,config,fetcher=fetch) {
 if((!config.webhookUrl&&!config.quizWebhookUrl&&!config.webinarWebhookUrl&&!config.webinarSurveyWebhookUrl)||config.webhookDisabled)return;
 const jobs=(await store.list('outbox/')).filter(j=>!j.deliveredAt&&j.nextAttemptAt<=Date.now()&&destinationFor(j.payload.event,config)).slice(0,10);
 await Promise.all(jobs.map(job=>deliverEvent(store,config,'outbox/'+job.payload.event_id,fetcher)));
}
function destinationFor(event,config){return event==='webinar_survey_completed'?config.webinarSurveyWebhookUrl:event==='webinar_registered'?config.webinarWebhookUrl:event==='quiz_completed'?config.quizWebhookUrl:config.webhookUrl;}
