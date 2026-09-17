import {AsYouType,getCountries,getCountryCallingCode} from 'libphonenumber-js';
import {phoneNumber} from '../server/validation.mjs';
import {readAttribution,mergeAttribution,funnelUrl,request,experimentQuery} from './attribution.js';
const root=document.querySelector('#funnel-body'),kind=document.body.dataset.funnel;
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
const state={role:'',experience:'',income:'',name:'',email:'',phone:'',country:'DE'};
let step=0,sending=false,preview=false;
import {questions} from './questions.js';
function heading(title){root.replaceChildren();const h=text('h1',title);h.tabIndex=-1;root.append(h);if(kind==='quiz')h.focus();}
function errorNode(){const p=text('p','');p.className='quiz-error';p.setAttribute('role','alert');return p;}
function proof(){const p=text('p','✓ Kostenlos & unverbindlich · Deine Angaben bleiben vertraulich.');p.className='quiz-proof';return p;}
function contact(){
 heading('Wie dürfen wir dich kontaktieren?');
 const form=document.createElement('form');form.className='contact-form';
 for(const[name,caption,type,autocomplete]of [['name','Vorname','text','given-name'],['email','E-Mail-Adresse','email','email']]){const l=text('label',caption),i=document.createElement('input');i.name=name;i.type=type;i.autocomplete=autocomplete;i.required=true;i.maxLength=name==='name'?80:254;i.value=state[name];l.append(i);form.append(l);}
 const row=document.createElement('div');row.className='phone-row';const cl=text('label','Land / Vorwahl'),select=document.createElement('select');select.name='country';select.autocomplete='country';const names=new Intl.DisplayNames(['de'],{type:'region'}),countries=getCountries().sort((a,b)=>names.of(a).localeCompare(names.of(b),'de'));countries.splice(countries.indexOf('DE'),1);countries.unshift('DE');
 countries.forEach(c=>{const o=text('option',`${names.of(c)} +${getCountryCallingCode(c)}`);o.value=c;o.selected=c===state.country;select.append(o);});cl.append(select);
 const pl=text('label','Telefonnummer'),phone=document.createElement('input');phone.name='phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel-national';phone.required=true;phone.maxLength=40;phone.placeholder='z. B. 0151 23456789';phone.value=state.phone;const validate=()=>phone.setCustomValidity(phoneNumber(phone.value,select.value)?'':'Bitte gib eine gültige Telefonnummer für das gewählte Land ein. Buchstaben sind nicht erlaubt.');phone.addEventListener('beforeinput',e=>{if(e.data&&/[a-zA-Z]/.test(e.data))e.preventDefault();});const formatPhone=()=>{const digits=phone.value.replace(/[^+0-9]/g,'').replace(/(?!^)\+/g,'');phone.value=new AsYouType(select.value).input(digits);phone.setCustomValidity('');};phone.addEventListener('input',formatPhone);phone.addEventListener('blur',validate);select.addEventListener('change',formatPhone);pl.append(phone);row.append(cl,pl);form.append(row);
 const trap=document.createElement('input');trap.name='website';trap.tabIndex=-1;trap.autocomplete='off';trap.className='quiz-honey';trap.setAttribute('aria-hidden','true');form.append(trap);
 const notice=document.createElement('p');notice.className='privacy-notice';notice.innerHTML='Mit dem Absenden stimmen Sie unseren <a href="https://www.hamann-kollegen.de/datenschutz" target="_blank" rel="noopener">Datenschutzerklärungen</a> zu.';const error=errorNode();form.append(error);
 const button=text('button','Weiter zu den Fragen');button.className='button';button.type='submit';button.addEventListener('click',validate);form.append(button,notice);
 form.addEventListener('submit',async event=>{event.preventDefault();if(sending)return;validate();if(!form.reportValidity())return;sending=true;button.disabled=true;button.textContent='Wird gespeichert …';error.textContent='';
  try{if(preview)throw Error('In der Admin-Vorschau werden keine Kontaktdaten gespeichert.');await request('contacts',{...Object.fromEntries(new FormData(form)),consent:true,attribution:readAttribution()});location.href=funnelUrl('/quiz/');}catch(e){error.textContent=e.message;}finally{sending=false;button.disabled=false;button.textContent='Weiter zu den Fragen';}});root.append(form);
}
function quiz(){
 const q=questions[step];heading(q.title);
 const group=document.createElement('div');group.className='quiz-options';group.setAttribute('role','group');group.setAttribute('aria-label',q.title);
 const error=errorNode(),back=text('button','← Zurück');back.type='button';back.className='quiz-back';back.addEventListener('click',()=>{if(sending)return;if(step===0)location.href=funnelUrl('/anfrage/');else{step--;quiz();}});
 q.options.forEach(([value,caption])=>{const button=text('button',caption);button.type='button';button.className='quiz-choice';button.setAttribute('aria-pressed',String(state[q.key]===value));button.addEventListener('click',async()=>{
 if(sending)return;sending=true;group.querySelectorAll('button').forEach(b=>b.disabled=true);back.disabled=true;error.textContent='';
 try{const result=await request('quiz',{step:q.key,value,attribution:readAttribution()});state[q.key]=value;if(result.next){location.href=funnelUrl(result.next);return;}step++;quiz();}catch(e){error.textContent=e.message;}finally{sending=false;group.querySelectorAll('button').forEach(b=>b.disabled=false);back.disabled=false;}
 });group.append(button);});root.append(group,error,back);
}
(async()=>{
 readAttribution();document.querySelectorAll('[data-home]').forEach(a=>a.href=funnelUrl('/'));
 try{
  if(kind==='contact'){const exp=await request(experimentQuery({funnel:'1'}));preview=!!exp.preview;try{Object.assign(state,await request('funnel'));}catch(e){if(![401,404].includes(e.status))throw e;}contact();}
  else{const lead=await request('funnel');mergeAttribution(lead.attribution);Object.assign(state,lead);step=!lead.role||lead.role==='unemployed'?0:!lead.experience?1:!lead.income?2:0;quiz();}
 }catch(e){if(kind==='quiz'&&[401,404].includes(e.status)){location.replace(funnelUrl('/anfrage/'));return;}root.replaceChildren(text('h1','Kurz nicht erreichbar.'),text('p',e.message));const b=text('button','Erneut versuchen');b.className='button';b.addEventListener('click',()=>location.reload());root.append(b);}
})();
