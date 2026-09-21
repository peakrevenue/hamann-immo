import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../server/api.mjs';
import {flushOutbox} from '../server/webhook.mjs';
const answers={email:'max@example.invalid',situation:'first-property',role:'employed',income:'3500to5000',goals:['wealth','retirement'],question:'Wie viel Rücklage sollte ich einplanen?',attribution:{utm_source:'klaviyo'}};
function setup(t){
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-09-22T10:00:00Z')});
 const db=new Map(),sent=[],cookies={};let offline=false;
 const store={get:async k=>structuredClone(db.get(k)||null),set:async(k,v)=>db.set(k,structuredClone(v)),create:async(k,v)=>{if(!db.has(k))db.set(k,structuredClone(v));},list:async p=>[...db].filter(([k])=>k.startsWith(p)).map(([,v])=>structuredClone(v)),delete:async k=>db.delete(k)};
 const config={secret:'survey-test-secret-longer-than-32-characters',webhookUrl:'https://hooks.zapier.com/hooks/catch/test/contact/',webinarWebhookUrl:'https://hooks.zapier.com/hooks/catch/test/webinar/',webinarSurveyWebhookUrl:'https://hooks.zapier.com/hooks/catch/test/survey/'};
 const fetcher=async(url,options)=>{sent.push({url:String(url),payload:JSON.parse(options.body)});return new Response('',{status:offline?503:200});};
 const api=createApi({store,config,fetcher});
 async function call(path,body,options={}){const r=await api(new Request('https://example.test/api/'+path,{method:body?'POST':'GET',headers:{Origin:options.origin||'https://example.test','Content-Type':'application/json',Cookie:options.cookie??Object.entries(cookies).map(([k,v])=>k+'='+v).join('; ')},...(body?{body:JSON.stringify(body)}:{})}),{ip:options.ip||'survey-test'});const c=r.headers.get('set-cookie');if(c){const pair=c.split(';')[0],i=pair.indexOf('=');cookies[pair.slice(0,i)]=pair.slice(i+1);}return {status:r.status,cookie:c,...await r.json()};}
 return {call,store,config,sent,cookies,fetcher,setOffline:v=>offline=v};
}
test('normal registration prefills survey through its cookie and sends answers only to the survey hook',async t=>{
 const s=setup(t);await s.call('webinar/register',{firstName:'Max',lastName:'Mustermann',email:answers.email,phone:'015123456789',country:'DE'});
 const context=await s.call('webinar/survey-context',{});assert.equal(context.email,answers.email);assert.equal(context.firstName,'Max');assert.match(context.cookie,/HttpOnly/);
 const response=await s.call('webinar/survey',answers);assert.equal(response.status,200);assert.equal(response.next,'/workshop/umfrage/danke/');
 assert.equal(s.sent.length,2);assert.equal(s.sent[1].url,s.config.webinarSurveyWebhookUrl);assert.equal(s.sent[1].payload.event,'webinar_survey_completed');assert.equal(s.sent[1].payload.role,'Angestellt');assert.deepEqual(s.sent[1].payload.goals,['Langfristig Vermögen aufbauen','Für meine Rente vorsorgen']);assert.equal(s.sent[1].payload.utm_source,'klaviyo');assert.ok(s.sent[1].payload.registration_id);assert.equal((await s.call('webinar/survey-confirmation')).completed,true);
 await s.call('webinar/survey',answers);assert.equal(s.sent.length,2);assert.equal((await s.store.list('surveys/')).length,1);
});
test('mailing prefill works without a registration and never reveals existing contact details',async t=>{
 const s=setup(t);await s.call('webinar/register',{firstName:'Existing',lastName:'Contact',email:answers.email,phone:'015123456789',country:'DE'});
 delete s.cookies.hk_webinar;
 const context=await s.call('webinar/survey-context',{email:answers.email});assert.equal(context.email,answers.email);assert.equal(context.firstName,'');assert.equal((await s.call('webinar/registration')).status,401);
 await s.call('webinar/survey',answers);const survey=(await s.store.list('surveys/'))[0];assert.equal(survey.firstName,'');assert.equal(survey.registrationId,null);
 assert.equal((await s.call('webinar/survey-confirmation',null,{cookie:''})).status,401);
 assert.equal((await s.call('webinar/survey-context',null,{cookie:''})).email,'');
});
test('manual email fallback and corrected email do not overwrite registration details',async t=>{
 const s=setup(t);assert.equal((await s.call('webinar/survey-context',{})).email,'');
 assert.equal((await s.call('webinar/survey',answers)).status,200);
 assert.equal((await s.call('webinar/survey-context')).email,answers.email);
 assert.equal((await s.store.list('leads/')).length,0);
});
test('invalid responses, missing sessions, honeypots and foreign origins are rejected',async t=>{
 const s=setup(t);assert.equal((await s.call('webinar/survey',answers)).status,400);await s.call('webinar/survey-context',{});
 for(const patch of [{email:'broken'},{situation:'unknown'},{role:'other.invalid'},{income:''},{goals:[]},{goals:['invalid']},{question:'x'.repeat(2001)}])assert.equal((await s.call('webinar/survey',{...answers,...patch})).status,422);
 assert.equal((await s.call('webinar/survey',{...answers,website:'bot'})).status,400);assert.equal((await s.call('webinar/survey',answers,{origin:'https://foreign.test'})).status,403);
 assert.equal((await s.store.list('surveys/')).length,0);assert.equal(s.sent.length,0);
});
test('missing survey hook retains responses without falling back to the registration or contact hook',async t=>{
 const s=setup(t),hook=s.config.webinarSurveyWebhookUrl;delete s.config.webinarSurveyWebhookUrl;
 await s.call('webinar/survey-context',{});assert.equal((await s.call('webinar/survey',answers)).status,200);assert.equal(s.sent.length,0);assert.equal((await s.store.list('outbox/')).length,1);
 s.config.webinarSurveyWebhookUrl=hook;await flushOutbox(s.store,s.config,s.fetcher);assert.equal(s.sent.length,1);assert.equal(s.sent[0].url,hook);
});
test('failed delivery retries the same survey event and failed durable storage never confirms success',async t=>{
 const s=setup(t);s.setOffline(true);await s.call('webinar/survey-context',{});assert.equal((await s.call('webinar/survey',answers)).status,200);s.setOffline(false);
 for(const job of await s.store.list('outbox/'))await s.store.set('outbox/'+job.payload.event_id,{...job,nextAttemptAt:0});
 await flushOutbox(s.store,s.config,s.fetcher);assert.equal(s.sent.length,2);assert.equal(s.sent[0].payload.event_id,s.sent[1].payload.event_id);
 s.store.create=async()=>{throw Error('Unavailable');};const response=await s.call('webinar/survey',{...answers,question:'Eine neue Frage'});assert.equal(response.status,500);assert.equal(response.cookie,null);
});
