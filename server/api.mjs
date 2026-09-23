import { randomBytes, randomUUID, createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import { validateLead,validateContact,roles,experiences,incomes,qualifies } from './validation.mjs';
import {attribution,queueEvent,flushOutbox} from './webhook.mjs';
import {validateWebinar} from './webinar.mjs';
import {workshop} from '../content/workshop.mjs';
import {surveyAnswerLabels} from '../content/webinar-survey.mjs';
import {contactEmail,validateSurvey,surveyRevision} from './webinar-survey.mjs';
const statuses = ['incomplete','disqualified','new','webinar','contacted','appointment','won','lost','archived'];
const noCache = {'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
export function passwordHash(password) {const salt = randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
function same(a,b) {const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
function verifyPassword(password,encoded) {try {const [salt,hash]=encoded.split(':');return same(scryptSync(password,salt,64).toString('hex'),hash);}catch{return false;}}
export function createApi({store, config, fetcher=fetch}) {
  const sign = value => createHmac('sha256',config.secret).update(value).digest('base64url');
  const pack = value => {const data=Buffer.from(JSON.stringify(value)).toString('base64url');return data+'.'+sign(data);};
  const unpack = token => {try {const [data,mac]=token.split('.');if(!same(mac,sign(data)))return null;const value=JSON.parse(Buffer.from(data,'base64url'));return value.exp>Date.now()?value:null;}catch{return null;}};
  const cookie = (name,value,req,age=86400) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${new URL(req.url).protocol==='https:'?'; Secure':''}`;
  const readCookie=(req,name)=>{const v=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='));return v?.slice(name.length+1)||'';};
  const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...noCache,...headers}});
  async function rate(key,limit,windowMs) {
    const bucket=Math.floor(Date.now()/windowMs);const k=`rate/${sign(key)}/${bucket}`;
    const r=await store.get(k)||{count:0}; if(r.count>=limit)return false;
    await store.set(k,{count:r.count+1,expires:(bucket+1)*windowMs});return true;
  }
  async function visitor(req) {
    const v=unpack(readCookie(req,'hk_visit'));
    return v?.kind==='visitor'?v:{kind:'visitor',id:randomUUID(),exp:Date.now()+30*86400000};
  }
  async function experiment(v) {
    const active=await store.get('settings/active');
    if(!active?.id)return {id:'control',variant:'A',headline:'',cta:''};
    const e=await store.get('experiments/'+active.id);if(!e)return {id:'control',variant:'A',headline:'',cta:''};
    const variant=Buffer.from(sign(v.id+e.id),'base64url')[0]<128?'A':'B';
    return {id:e.id,variant,headline:variant==='B'?e.headline:'',cta:variant==='B'?e.cta:''};
  }
  async function auth(req) {const token=unpack(readCookie(req,'hk_admin'));return token?.kind==='admin'&& await store.get('sessions/'+token.id)?token:null;}
  return async function handle(req,context={}) {
    try {
      if (!config.secret || config.secret.length<32) return json({error:'Die Anwendung wird gerade eingerichtet.'},503);
      const url=new URL(req.url);const path=url.pathname.replace(/^\/.netlify\/functions\/api/,'').replace(/^\/api/,'')||'/';
      const method=req.method;
      if(!['GET','POST','PATCH'].includes(method))return json({error:'Methode nicht erlaubt.'},405);
      if(method!=='GET' && req.headers.get('origin')!==url.origin) return json({error:'Ungültiger Ursprung.'},403);
      if(method!=='GET' && !req.headers.get('content-type')?.startsWith('application/json'))return json({error:'JSON erforderlich.'},415);
      let data={};
      if(method!=='GET') {const raw=await req.text();if(raw.length>16000)return json({error:'Anfrage zu groß.'},413);try{data=JSON.parse(raw);}catch{return json({error:'Ungültige Anfrage.'},400);}if(!data||Array.isArray(data)||typeof data!=='object')return json({error:'Ungültige Anfrage.'},400);}
      const ip=context.ip||'unknown';
      if(path==='/webinar/register'&&method==='POST') {
        if(data.website)return json({error:'Bitte versuche es erneut.'},400);
        if(Date.now()>Date.parse(workshop.end))return json({error:'Dieses Webinar ist bereits beendet.'},410);
        if(!config.webinarWebhookUrl)return json({error:'Die Webinar-Anmeldung wird gerade vorbereitet. Bitte versuche es später erneut.'},503);
        if(!await rate('webinar:'+ip,12,3600000))return json({error:'Zu viele Anfragen. Bitte versuche es später erneut.'},429);
        const checked=validateWebinar(data);if(checked.error)return json(checked,422);
        const digest=createHmac('sha256',config.secret).update('webinar:'+workshop.id+':'+checked.value.email).digest('hex').slice(0,32);
        const id=[digest.slice(0,8),digest.slice(8,12),digest.slice(12,16),digest.slice(16,20),digest.slice(20)].join('-');
        const previous=await store.get('leads/'+id),now=new Date().toISOString();
        const lead={...previous,id,...checked.value,name:checked.value.firstName+' '+checked.value.lastName,source:'webinar',webinarId:workshop.id,
          createdAt:previous?.createdAt||now,updatedAt:now,consentedAt:now,consentVersion:'webinar-submit-2026-09-21',
          status:previous?.status||'webinar',stage:'webinar_registered',qualification:'not_applicable',notes:previous?.notes||'',
          experiment:'webinar',variant:null,attribution:attribution({...previous?.attribution,...data.attribution})};
        await store.set('leads/'+id,lead);
        await queueEvent(store,config,lead,'webinar_registered',fetcher);
        return json({ok:true,next:'/workshop-danke'},200,{'Set-Cookie':cookie('hk_webinar',pack({kind:'webinar',id,exp:Date.now()+7*86400000}),req,7*86400)});
      }
      if(path==='/webinar/registration'&&method==='GET') {
        const token=unpack(readCookie(req,'hk_webinar'));
        if(token?.kind!=='webinar')return json({error:'Bitte melde dich zuerst zum Webinar an.'},401);
        const lead=await store.get('leads/'+token.id);
        if(!lead||lead.webinarId!==workshop.id)return json({error:'Anmeldung nicht gefunden.'},404);
        const jobs=await store.list('outbox/'+lead.id+':webinar_registered:');
        const pending=jobs.some(job=>!job.deliveredAt);
        return json({registered:true,firstName:lead.firstName,deliveryPending:pending});
      }
      if(path==='/webinar/survey-context'&&['GET','POST'].includes(method)) {
        const token=unpack(readCookie(req,'hk_webinar_context'));
        let saved=token?.kind==='webinar-context'?await store.get('webinar-contexts/'+token.id):null;
        if(saved?.expires<=Date.now())saved=null;
        const registration=unpack(readCookie(req,'hk_webinar'));
        const lead=registration?.kind==='webinar'?await store.get('leads/'+registration.id):null;
        const own=lead?.webinarId===workshop.id?lead:null;
        if(method==='GET')return json({email:saved?.email||own?.email||'',firstName:saved?.firstName||own?.firstName||''});
        if(!await rate('survey-context:'+ip,50,3600000))return json({error:'Bitte versuche es später erneut.'},429);
        if(data.email&&!contactEmail(data.email))return json({error:'Bitte prüfe deine E-Mail-Adresse.'},422);
        const email=contactEmail(data.email)||saved?.email||own?.email||'';
        const firstName=typeof data.firstName==='string'&&!/[<>\r\n]/.test(data.firstName)?data.firstName.trim().slice(0,80):'';
        const value={id:saved?.id||randomUUID(),email,firstName:firstName||(saved?.email===email?saved.firstName:'')||(own?.email===email?own.firstName:'')||'',expires:Date.now()+7*86400000};
        await store.set('webinar-contexts/'+value.id,value);
        return json({email:value.email,firstName:value.firstName},200,{'Set-Cookie':cookie('hk_webinar_context',pack({kind:'webinar-context',id:value.id,exp:value.expires}),req,7*86400)});
      }
      if(path==='/webinar/survey'&&method==='POST') {
        if(data.website)return json({error:'Bitte versuche es erneut.'},400);
        if(!await rate('survey:'+ip,20,3600000))return json({error:'Zu viele Anfragen. Bitte versuche es später erneut.'},429);
        const token=unpack(readCookie(req,'hk_webinar_context'));
        const saved=token?.kind==='webinar-context'?await store.get('webinar-contexts/'+token.id):null;
        if(!saved||saved.expires<=Date.now())return json({error:'Bitte lade die Umfrage neu und erlaube notwendige Cookies.'},400);
        const checked=validateSurvey(data);if(checked.error)return json(checked,422);
        const {email,...answers}=checked.value;
        const registration=unpack(readCookie(req,'hk_webinar'));
        const lead=registration?.kind==='webinar'?await store.get('leads/'+registration.id):null;
        const own=lead?.webinarId===workshop.id&&lead.email===email?lead:null;
        const id=saved.id,now=new Date().toISOString(),prior=await store.get('surveys/'+id);
        const survey={id,email,answers,firstName:own?.firstName||(saved.email===email?saved.firstName:'')||'',registrationId:own?.id||null,
          createdAt:prior?.createdAt||now,updatedAt:now,revision:surveyRevision(checked.value),attribution:attribution({...own?.attribution,...data.attribution})};
        await store.set('surveys/'+id,survey);
        await queueEvent(store,config,survey,'webinar_survey_completed',fetcher);
        await store.set('webinar-contexts/'+id,{...saved,email,firstName:survey.firstName});
        return json({ok:true,next:'/workshop-umfrage-danke'},200,{'Set-Cookie':cookie('hk_webinar_survey',pack({kind:'webinar-survey',id,exp:Date.now()+7*86400000}),req,7*86400)});
      }
      if(path==='/webinar/survey-confirmation'&&method==='GET') {
        const token=unpack(readCookie(req,'hk_webinar_survey'));
        if(token?.kind!=='webinar-survey')return json({error:'Noch keine Umfrage übermittelt.'},401);
        const survey=await store.get('surveys/'+token.id);
        if(!survey)return json({error:'Umfrage nicht gefunden.'},404);
        return json({completed:true,firstName:survey.firstName});
      }
      if(path==='/experiment'&&method==='GET') {
        if(url.searchParams.has('preview')) {
          if(!await auth(req))return json({error:'Die Testvorschau ist nur nach Admin-Login verfügbar.'},401);
          const id=url.searchParams.get('preview');if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Test nicht gefunden.'},404);
          const e=await store.get('experiments/'+id);if(!e)return json({error:'Test nicht gefunden.'},404);
          const variant=url.searchParams.get('variant')==='B'?'B':'A';
          return json({id:e.id,variant,headline:variant==='B'?e.headline:'',cta:variant==='B'?e.cta:'',preview:true});
        }
        const v=await visitor(req),e=url.searchParams.get('funnel')==='1'&&v.experiment?{id:v.experiment,variant:v.variant,headline:'',cta:''}:await experiment(v);
        v.experiment=e.id;v.variant=e.variant;
        const previous=await store.get('attribution/'+v.id)||{};const incoming=Object.fromEntries([...url.searchParams].filter(([k])=>k.startsWith('utm_')));await store.set('attribution/'+v.id,attribution({...previous,...incoming}));
        const key=`visits/${e.id}/${v.id}`;
        if(!await store.get(key))await store.set(key,{experiment:e.id,variant:e.variant,createdAt:new Date().toISOString()});
        return json(e,200,{'Set-Cookie':cookie('hk_visit',pack(v),req,30*86400)});
      }
      if(path==='/contacts'&&method==='POST') {
        if(data.website)return json({error:'Bitte versuche es erneut.'},400);
        if(!await rate('contact:'+ip,20,3600000))return json({error:'Zu viele Anfragen. Bitte versuche es später erneut.'},429);
        const checked=validateContact(data);if(checked.error)return json(checked,422);
        const v=unpack(readCookie(req,'hk_visit'));if(v?.kind!=='visitor')return json({error:'Bitte lade die Seite neu und erlaube notwendige Cookies.'},400);let e;
        if(v.experiment)e={id:v.experiment,variant:v.variant};else {e=await experiment(v);const key=`visits/${e.id}/${v.id}`;if(!await store.get(key))await store.set(key,{experiment:e.id,variant:e.variant,createdAt:new Date().toISOString()});}
        const index='contact-index/'+sign(v.id+':'+checked.value.email);
        const prior=await store.get(index);const digest=createHmac('sha256',config.secret).update(index).digest('hex').slice(0,32);const stableId=[digest.slice(0,8),digest.slice(8,12),digest.slice(12,16),digest.slice(16,20),digest.slice(20)].join('-');
        const id=prior?.id||stableId,now=new Date().toISOString();const previous=await store.get('leads/'+id);
        const utms=attribution({...await store.get('attribution/'+v.id),...previous?.attribution,...data.attribution});
        const lead={...previous,id,...checked.value,createdAt:previous?.createdAt||now,consentedAt:now,updatedAt:now,status:previous?.status||'incomplete',notes:previous?.notes||'',role:previous?.role||null,experience:previous?.experience||null,income:previous?.income||null,qualification:previous?.qualification||'pending',stage:previous?.stage||'contact_saved',experiment:previous?.experiment||e.id,variant:previous?.variant||e.variant,attribution:utms};
        await store.set('leads/'+id,lead);await store.set(index,{id});
        const changed=previous&&['name','phone','country'].some(k=>previous[k]!==lead[k]);
        const event=changed?'contact_updated':'contact_created';const contactSnapshot={...lead,role:null,experience:null,income:null,qualification:'pending',stage:'contact_saved'};await queueEvent(store,config,contactSnapshot,event,fetcher);
        return json({ok:true},previous?200:201,{'Set-Cookie':cookie('hk_funnel',pack({kind:'funnel',id,exp:Date.now()+7200000}),req,7200)});
      }
      if(path==='/funnel'&&method==='GET') {
        const f=unpack(readCookie(req,'hk_funnel'));if(f?.kind!=='funnel')return json({error:'Bitte hinterlege zuerst deine Kontaktdaten.'},401);
        const l=await store.get('leads/'+f.id);if(!l)return json({error:'Bitte starte deine Anfrage erneut.'},404);
        return json({name:l.name,email:l.email,phone:l.phone,country:l.country,role:l.role,experience:l.experience,income:l.income,qualification:l.qualification,attribution:l.attribution});
      }
      if(path==='/quiz'&&method==='POST') {
        const f=unpack(readCookie(req,'hk_funnel'));if(f?.kind!=='funnel')return json({error:'Bitte hinterlege zuerst deine Kontaktdaten.'},401);
        if(!await rate('quiz:'+f.id,80,3600000))return json({error:'Zu viele Anfragen. Bitte versuche es später erneut.'},429);
        const l=await store.get('leads/'+f.id);if(!l)return json({error:'Anfrage nicht gefunden.'},404);
        if(!['role','experience','income'].includes(data.step))return json({error:'Ungültiger Schritt.'},422);
        const allowed={role:roles,experience:experiences,income:incomes};if(!allowed[data.step].includes(data.value))return json({error:'Bitte wähle eine Antwort.'},422);
        if(data.step!=='role'&&!l.role||data.step==='income'&&!l.experience)return json({error:'Bitte beantworte zuerst die vorherigen Fragen.'},422);
        const lead={...l,[data.step]:data.value,updatedAt:new Date().toISOString(),stage:data.step,attribution:attribution({...l.attribution,...data.attribution})};
        // Editing an earlier answer invalidates dependent answers and qualification.
        if(data.step==='role'){lead.experience=null;lead.income=null;}
        if(data.step==='experience')lead.income=null;
        const finished=lead.role==='unemployed'||data.step==='income';
        lead.qualification=finished?(qualifies(lead.role,lead.income)?'qualified':'disqualified'):'pending';
        lead.status=finished?(lead.qualification==='qualified'?'new':'disqualified'):'incomplete';
        if(finished){lead.stage='completed';lead.completedAt=new Date().toISOString();}
        await store.set('leads/'+lead.id,lead);
        if(finished)await queueEvent(store,config,lead,'quiz_completed',fetcher);
        return json({ok:true,qualification:lead.qualification,next:finished?(lead.qualification==='qualified'?'/termin/':'/interesse/'):null});
      }
      if(path==='/leads'&&method==='POST') {
        if(data.website)return json({error:'Bitte versuche es erneut.'},400);
        if(!await rate('lead:'+ip,12,3600000))return json({error:'Zu viele Anfragen. Bitte versuche es später erneut.'},429);
        const checked=validateLead(data);if(checked.error)return json(checked,422);
        const v=unpack(readCookie(req,'hk_visit'));if(v?.kind!=='visitor')return json({error:'Bitte lade die Seite neu und erlaube notwendige Cookies.'},400);
        const existing=await store.get('submissions/'+v.id);
        if(existing)return json({ok:true},200,{'Set-Cookie':cookie('hk_booking',pack({kind:'booking',id:existing.id,exp:Date.now()+7200000}),req,7200)});
        const e={id:v.experiment||'control',variant:v.variant||'A'},id=v.id,createdAt=new Date().toISOString();
        const attribution={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(typeof data.attribution?.[k]==='string')attribution[k]=data.attribution[k].slice(0,150);
        const lead={id,...checked.value,createdAt,consentedAt:createdAt,status:'new',notes:'',qualification:'qualified',stage:'completed',experiment:e.id,variant:e.variant,attribution};
        if (store.create) await store.create('leads/'+id,lead); else if(!await store.get('leads/'+id)) await store.set('leads/'+id,lead);
        await store.set('submissions/'+v.id,{id});
        await queueEvent(store,config,lead,'quiz_completed',fetcher);
        return json({ok:true},201,{'Set-Cookie':cookie('hk_booking',pack({kind:'booking',id,exp:Date.now()+7200000}),req,7200)});
      }
      if(path==='/booking'&&method==='GET') {
        const token=unpack(readCookie(req,'hk_funnel'))||unpack(readCookie(req,'hk_booking'));
        if(!['funnel','booking'].includes(token?.kind))return json({error:'Bitte stelle zuerst deine Gesprächsanfrage.'},403);
        const l=await store.get('leads/'+token.id);
        if(!l||!qualifies(l.role,l.income)||l.qualification&&l.qualification!=='qualified')return json({error:'Bitte schließe zuerst die Fragen zu deiner Situation ab.'},403);
        return json({name:l.name,email:l.email,phone:l.phone,attribution:attribution(l.attribution)});
      }
      if(path==='/login'&&method==='POST') {
        if(!config.adminEmail || !config.passwordHash)return json({error:'Der Admin-Zugang ist noch nicht eingerichtet.'},503);
        if(!await rate('login:'+ip,8,15*60000))return json({error:'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.'},429);
        const valid=typeof data.password==='string'&&data.password.length<=200&&verifyPassword(data.password,config.passwordHash);
        if(!valid||!same(String(data.email).toLowerCase(),config.adminEmail.toLowerCase()))return json({error:'E-Mail oder Passwort ist falsch.'},401);
        const id=randomUUID(),exp=Date.now()+8*3600000;await store.set('sessions/'+id,{expires:exp});
        return json({ok:true},200,{'Set-Cookie':cookie('hk_admin',pack({kind:'admin',id,exp}),req,8*3600)});
      }
      if(!path.startsWith('/admin/'))return json({error:'Nicht gefunden.'},404);
      const session=await auth(req);if(!session)return json({error:'Bitte melde dich an.'},401);
      if(path==='/admin/logout'&&method==='POST') {await store.delete('sessions/'+session.id);return json({ok:true},200,{'Set-Cookie':cookie('hk_admin','',req,0)});}
      if(path==='/admin/me'&&method==='GET')return json({email:config.adminEmail,local:!!config.local});
      if(path==='/admin/webhooks/retry'&&method==='POST'){await flushOutbox(store,config,fetcher);return json({ok:true});}
      if(path==='/admin/webhooks'&&method==='GET'){const jobs=await store.list('outbox/');return json({configured:!!config.webhookUrl&&!config.webhookDisabled,quizConfigured:!!config.quizWebhookUrl&&!config.webhookDisabled,webinarConfigured:!!config.webinarWebhookUrl&&!config.webhookDisabled,surveyConfigured:!!config.webinarSurveyWebhookUrl&&!config.webhookDisabled,pending:jobs.filter(j=>!j.deliveredAt).length,delivered:jobs.filter(j=>j.deliveredAt).length});}
      if(path==='/admin/surveys'&&method==='GET')return json({surveys:(await store.list('surveys/')).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(s=>({...s,answerLabels:surveyAnswerLabels(s.answers)}))});
      if(path==='/admin/leads'&&method==='GET')return json({leads:(await store.list('leads/')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
      if(path.startsWith('/admin/leads/')&&method==='PATCH') {
        const id=path.split('/').pop();if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Ungültige ID.'},400);
        const lead=await store.get('leads/'+id);if(!lead)return json({error:'Lead nicht gefunden.'},404);
        if(!statuses.includes(data.status)||typeof data.notes!=='string'||data.notes.length>4000)return json({error:'Bitte prüfe Status und Notiz (max. 4.000 Zeichen).'},400);
        await store.set('leads/'+id,{...lead,status:data.status,notes:data.notes,updatedAt:new Date().toISOString()});return json({ok:true});
      }
      if(path==='/admin/experiments'&&method==='GET') {
        const exps=await store.list('experiments/'),active=await store.get('settings/active');
        const [visits,leads]=await Promise.all([store.list('visits/'),store.list('leads/')]);
        const results=exps.map(e=>({...e,active:active?.id===e.id,results:['A','B'].map(variant=>({variant,visits:visits.filter(v=>v.experiment===e.id&&v.variant===variant).length,leads:leads.filter(l=>l.experiment===e.id&&l.variant===variant&&(!l.qualification||l.qualification==='qualified')).length}))}));
        return json({experiments:results.sort((a,b)=>b.createdAt.localeCompare(a.createdAt))});
      }
      if(path==='/admin/experiments'&&method==='POST') {
        if(typeof data.name!=='string'||!data.name.trim()||data.name.length>80||typeof data.headline!=='string'||data.headline.length>400||typeof data.cta!=='string'||data.cta.length>80||(!data.headline.trim()&&!data.cta.trim()))return json({error:'Bitte benenne den Test und ändere mindestens Headline oder Buttontext.'},400);
        const id=randomUUID();await store.set('experiments/'+id,{id,name:data.name.trim(),headline:data.headline.trim(),cta:data.cta.trim(),createdAt:new Date().toISOString()});return json({ok:true,id},201);
      }
      if(path==='/admin/active'&&method==='POST') {
        if(data.id!==null && (typeof data.id!=='string'||!/^[a-f0-9-]{36}$/.test(data.id)||!await store.get('experiments/'+data.id)))return json({error:'Test nicht gefunden.'},400);
        await store.set('settings/active',{id:data.id});return json({ok:true});
      }
      return json({error:'Nicht gefunden.'},404);
    } catch(error) {console.error('API request failed:',error.name);return json({error:'Speichern ist gerade nicht möglich. Bitte versuche es erneut. Deine Anfrage wurde noch nicht bestätigt.'},500);}
  };
}
