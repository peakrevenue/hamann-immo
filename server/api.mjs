import { randomBytes, randomUUID, createHmac, timingSafeEqual, scryptSync } from 'node:crypto';
import { validateLead } from './validation.mjs';
const statuses = ['new','contacted','appointment','won','lost','archived'];
const noCache = {'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
export function passwordHash(password) {const salt = randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
function same(a,b) {const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
function verifyPassword(password,encoded) {try {const [salt,hash]=encoded.split(':');return same(scryptSync(password,salt,64).toString('hex'),hash);}catch{return false;}}
export function createApi({store, config}) {
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
      if(path==='/experiment'&&method==='GET') {
        if(url.searchParams.has('preview')) {
          if(!await auth(req))return json({error:'Die Testvorschau ist nur nach Admin-Login verfügbar.'},401);
          const id=url.searchParams.get('preview');if(!/^[a-f0-9-]{36}$/.test(id))return json({error:'Test nicht gefunden.'},404);
          const e=await store.get('experiments/'+id);if(!e)return json({error:'Test nicht gefunden.'},404);
          const variant=url.searchParams.get('variant')==='B'?'B':'A';
          return json({id:e.id,variant,headline:variant==='B'?e.headline:'',cta:variant==='B'?e.cta:'',preview:true});
        }
        const v=await visitor(req),e=await experiment(v);
        v.experiment=e.id;v.variant=e.variant;
        const key=`visits/${e.id}/${v.id}`;
        if(!await store.get(key))await store.set(key,{experiment:e.id,variant:e.variant,createdAt:new Date().toISOString()});
        return json(e,200,{'Set-Cookie':cookie('hk_visit',pack(v),req,30*86400)});
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
        const lead={id,...checked.value,createdAt,consentedAt:createdAt,status:'new',notes:'',experiment:e.id,variant:e.variant,attribution};
        if (store.create) await store.create('leads/'+id,lead); else if(!await store.get('leads/'+id)) await store.set('leads/'+id,lead);
        await store.set('submissions/'+v.id,{id});
        return json({ok:true},201,{'Set-Cookie':cookie('hk_booking',pack({kind:'booking',id,exp:Date.now()+7200000}),req,7200)});
      }
      if(path==='/booking'&&method==='GET') {const b=unpack(readCookie(req,'hk_booking'));if(b?.kind!=='booking')return json({error:'Bitte stelle zuerst deine Gesprächsanfrage.'},403);const l=await store.get('leads/'+b.id);return l?json({name:l.name,email:l.email,phone:l.phone}):json({error:'Anfrage nicht gefunden.'},404);}
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
        const results=exps.map(e=>({...e,active:active?.id===e.id,results:['A','B'].map(variant=>({variant,visits:visits.filter(v=>v.experiment===e.id&&v.variant===variant).length,leads:leads.filter(l=>l.experiment===e.id&&l.variant===variant).length}))}));
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
