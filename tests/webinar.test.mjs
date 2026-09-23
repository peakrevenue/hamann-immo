import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../server/api.mjs';
import {flushOutbox} from '../server/webhook.mjs';
import {workshop} from '../content/workshop.mjs';

const registration = {firstName:'Max',lastName:'Mustermann',email:'max@example.invalid',phone:'015123456789',country:'DE',attribution:{utm_source:'meta',utm_campaign:'webinar-september',utm_custom:'creative-4'}};
function setup(t) {
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-09-22T10:00:00Z')});
 const db=new Map(),sent=[],cookies={};
 let offline=false;
 const store={get:async k=>structuredClone(db.get(k)||null),set:async(k,v)=>db.set(k,structuredClone(v)),create:async(k,v)=>{if(!db.has(k))db.set(k,structuredClone(v));},list:async p=>[...db].filter(([k])=>k.startsWith(p)).map(([,v])=>structuredClone(v)),delete:async k=>db.delete(k)};
 const config={secret:'webinar-test-secret-longer-than-32-characters',webhookUrl:'https://hooks.zapier.com/hooks/catch/test/contact/',quizWebhookUrl:'https://hooks.zapier.com/hooks/catch/test/quiz/',webinarWebhookUrl:'https://hooks.zapier.com/hooks/catch/test/webinar/'};
 const fetcher=async(url,options)=>{sent.push({url:String(url),payload:JSON.parse(options.body)});return new Response('',{status:offline?503:200});};
 const api=createApi({store,config,fetcher});
 async function call(path,body,options={}) {
  const response=await api(new Request('https://example.test/api/'+path,{method:body?'POST':'GET',headers:{Origin:options.origin||'https://example.test','Content-Type':'application/json',Cookie:options.cookie??Object.entries(cookies).map(([k,v])=>k+'='+v).join('; ')},...(body?{body:JSON.stringify(body)}:{})}),{ip:options.ip||'webinar-test'});
  const c=response.headers.get('set-cookie');if(c){const pair=c.split(';')[0],i=pair.indexOf('=');cookies[pair.slice(0,i)]=pair.slice(i+1);}
  return {status:response.status,cookie:c,...await response.json()};
 }
 return {call,db,store,config,fetcher,sent,cookies,setOffline:value=>offline=value};
}

test('webinar saves all four fields, sends only to webinar hook and confirms through signed cookie',async t=>{
 const s=setup(t);
 assert.equal((await s.call('webinar/registration')).status,401);
 const response=await s.call('webinar/register',registration);
 assert.equal(response.status,200);assert.equal(response.next,'/workshop-danke');assert.match(response.cookie,/HttpOnly/);assert.match(response.cookie,/Secure/);
 const leads=await s.store.list('leads/');assert.equal(leads.length,1);assert.equal(leads[0].status,'webinar');assert.equal(leads[0].phone,'+4915123456789');assert.equal(leads[0].lastName,'Mustermann');
 assert.equal(s.sent.length,1);assert.equal(s.sent[0].url,s.config.webinarWebhookUrl);
 const payload=s.sent[0].payload;
 for(const [key,value] of Object.entries({event:'webinar_registered',first_name:'Max',last_name:'Mustermann',email:registration.email,phone:'+4915123456789',utm_source:'meta',utm_custom:'creative-4',webinar_start:workshop.start,webinar_timezone:'Europe/Berlin'}))assert.equal(payload[key],value);
 assert.equal(payload.qualification,undefined);assert.equal(payload.antworten,undefined);
 assert.deepEqual(await s.call('webinar/registration'),{status:200,cookie:null,registered:true,firstName:'Max',deliveryPending:false});
 assert.equal((await s.call('webinar/registration',null,{cookie:'hk_webinar='+s.cookies.hk_webinar+'tampered'})).status,401);
 assert.equal((await s.call('booking')).status,403);
});

test('invalid registration, honeypot and foreign origin never store contacts or call Zapier',async t=>{
 const s=setup(t);
 for(const patch of [{firstName:''},{lastName:'<script>'},{email:'not an email'},{phone:'1234'},{country:'DE',phone:'+436641234567'}])assert.equal((await s.call('webinar/register',{...registration,...patch})).status,422);
 assert.equal((await s.call('webinar/register',{...registration,website:'bot'})).status,400);
 assert.equal((await s.call('webinar/register',registration,{origin:'https://other.test'})).status,403);
 assert.equal((await s.store.list('leads/')).length,0);assert.equal(s.sent.length,0);
});

test('double submission does not duplicate the contact or resend a delivered event',async t=>{
 const s=setup(t);
 await s.call('webinar/register',registration);
 await s.call('webinar/register',{...registration,email:registration.email.toUpperCase()});
 assert.equal((await s.store.list('leads/')).length,1);assert.equal(s.sent.length,1);
 await s.call('webinar/register',{...registration,lastName:'Musterfrau'});
 assert.equal((await s.store.list('leads/')).length,1);assert.equal(s.sent.length,2);assert.equal(s.sent[1].payload.last_name,'Musterfrau');
 assert.equal(s.sent[0].payload.lead_id,s.sent[1].payload.lead_id);
});

test('Zapier downtime preserves registration and retries the same event identifier',async t=>{
 const s=setup(t);s.setOffline(true);
 assert.equal((await s.call('webinar/register',registration)).status,200);
 assert.equal((await s.call('webinar/registration')).deliveryPending,true);
 assert.equal((await s.store.list('leads/')).length,1);
 s.setOffline(false);
 for(const job of await s.store.list('outbox/'))await s.store.set('outbox/'+job.payload.event_id,{...job,nextAttemptAt:0});
 await flushOutbox(s.store,s.config,s.fetcher);await flushOutbox(s.store,s.config,s.fetcher);
 assert.equal(s.sent.length,2);assert.equal(s.sent[0].payload.event_id,s.sent[1].payload.event_id);
 assert.equal((await s.call('webinar/registration')).deliveryPending,false);
});

test('missing hook and failed persistent storage do not show a successful registration',async t=>{
 const s=setup(t),hook=s.config.webinarWebhookUrl;delete s.config.webinarWebhookUrl;
 assert.equal((await s.call('webinar/register',registration)).status,503);
 s.config.webinarWebhookUrl=hook;const save=s.store.set;
 s.store.set=async(k,v)=>{if(k.startsWith('outbox/'))throw Error('storage unavailable');return save(k,v);};
 s.store.create=s.store.set;
 const result=await s.call('webinar/register',registration);
 assert.equal(result.status,500);assert.equal(result.cookie,null);assert.equal(s.sent.length,0);
});

test('expired webinar rejects new registrations and rate limit blocks repeated spam',async t=>{
 const s=setup(t);
 for(let i=0;i<12;i++)await s.call('webinar/register',{...registration,firstName:''});
 assert.equal((await s.call('webinar/register',registration)).status,429);
 t.mock.timers.setTime(Date.parse('2026-10-01T00:00:00Z'));
 assert.equal((await s.call('webinar/register',registration,{ip:'other'})).status,410);assert.equal(s.sent.length,0);
});
