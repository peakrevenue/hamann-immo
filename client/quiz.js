import {getCountries,getCountryCallingCode} from 'libphonenumber-js';
import {phoneNumber} from '../server/validation.mjs';
import {readAttribution,mergeAttribution,funnelUrl,request,experimentQuery} from './attribution.js';
const root=document.querySelector('#funnel-body'),kind=document.body.dataset.funnel;
const text=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
const state={role:'',experience:'',income:'',name:'',email:'',phone:'',country:'DE'};
let step=0,sending=false,preview=false;
const questions=[
 {key:'role',title:'Welche Situation beschreibt dich?',hint:'Damit wir dein Analysegespräch passend vorbereiten können.',options:[['employed','Ich bin angestellt'],['self-employed','Ich bin selbstständig'],['unemployed','Ich bin aktuell arbeitslos'],['other','Sonstiges']]},
 {key:'experience',title:'Was beschreibt dich am besten?',hint:'Ganz gleich, wo du gerade stehst: Wir möchten dich kennenlernen.',options:[['property','Ich besitze bereits Immobilien und möchte weitere kaufen.'],['interested','Ich habe noch keine Immobilie, interessiere mich aber dafür.'],['etf','Ich investiere bisher in ETFs oder andere Wertpapiere.'],['none','Ich habe bisher noch gar nicht investiert.']]},
 {key:'income',title:'Wie hoch ist dein Monatsnettoeinkommen?',hint:'Gemeint ist dein regelmäßiges Einkommen nach Steuern.',options:[['under2500','Unter 2.500 €'],['2500to3500','2.500 bis unter 3.500 €'],['3500to5000','3.500 bis unter 5.000 €'],['over5000','5.000 € oder mehr'],['undisclosed','Will ich noch nicht sagen']]}
];
function heading(title,hint,n){root.replaceChildren();const h=text('h1',title);h.tabIndex=-1;root.append(h,text('p',hint));document.querySelector('#funnel-progress').value=n;document.querySelector('#funnel-step').textContent=`Schritt ${n} von 4`;if(n>1)h.focus();}
function errorNode(){const p=text('p','');p.className='quiz-error';p.setAttribute('role','alert');return p;}
function proof(){const p=text('p','✓ Kostenlos & unverbindlich · Deine Angaben bleiben vertraulich.');p.className='quiz-proof';return p;}
function contact(){
 heading('Wie dürfen wir dich kontaktieren?','Hinterlege zuerst deine Kontaktdaten. Danach folgen drei kurze Fragen zu deiner Situation.',1);
 const form=document.createElement('form');form.className='contact-form';
 for(const[name,caption,type,autocomplete]of [['name','Vorname','text','given-name'],['email','E-Mail-Adresse','email','email']]){const l=text('label',caption),i=document.createElement('input');i.name=name;i.type=type;i.autocomplete=autocomplete;i.required=true;i.maxLength=name==='name'?80:254;i.value=state[name];l.append(i);form.append(l);}
 const row=document.createElement('div');row.className='phone-row';const cl=text('label','Land / Vorwahl'),select=document.createElement('select');select.name='country';select.autocomplete='country';const names=new Intl.DisplayNames(['de'],{type:'region'}),countries=getCountries().sort((a,b)=>names.of(a).localeCompare(names.of(b),'de'));countries.splice(countries.indexOf('DE'),1);countries.unshift('DE');
 countries.forEach(c=>{const o=text('option',`${names.of(c)} +${getCountryCallingCode(c)}`);o.value=c;o.selected=c===state.country;select.append(o);});cl.append(select);
 const pl=text('label','Telefonnummer'),phone=document.createElement('input');phone.name='phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel-national';phone.required=true;phone.maxLength=40;phone.placeholder='z. B. 0151 23456789';phone.value=state.phone;const validate=()=>phone.setCustomValidity(phoneNumber(phone.value,select.value)?'':'Bitte gib eine gültige Telefonnummer für das gewählte Land ein. Buchstaben sind nicht erlaubt.');phone.addEventListener('input',()=>phone.setCustomValidity(''));phone.addEventListener('blur',validate);select.addEventListener('change',()=>phone.setCustomValidity(''));pl.append(phone);row.append(cl,pl);form.append(row);
 const trap=document.createElement('input');trap.name='website';trap.tabIndex=-1;trap.autocomplete='off';trap.className='quiz-honey';trap.setAttribute('aria-hidden','true');form.append(trap);
 const consent=document.createElement('label');consent.className='consent';const box=document.createElement('input');box.type='checkbox';box.name='consent';box.required=true;const copy=document.createElement('span');copy.innerHTML='Ich möchte zum Analysegespräch per E-Mail oder Telefon von Hamann &amp; Kollegen kontaktiert werden. Meine Kontaktdaten werden mit Klick auf „Weiter zu den Fragen“ gespeichert, auch wenn ich die folgenden Fragen nicht abschließe. Hinweise finde ich in der <a href="https://www.hamann-kollegen.de/datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a>.';consent.append(box,copy);form.append(consent);const error=errorNode();form.append(error);
 const button=text('button','Weiter zu den Fragen');button.className='button';button.type='submit';button.addEventListener('click',validate);form.append(button,proof());
 form.addEventListener('submit',async event=>{event.preventDefault();if(sending)return;validate();if(!form.reportValidity())return;sending=true;button.disabled=true;button.textContent='Wird gespeichert …';error.textContent='';
  try{if(preview)throw Error('In der Admin-Vorschau werden keine Kontaktdaten gespeichert.');await request('contacts',{...Object.fromEntries(new FormData(form)),consent:box.checked,attribution:readAttribution()});location.href=funnelUrl('/quiz/');}catch(e){error.textContent=e.message;}finally{sending=false;button.disabled=false;button.textContent='Weiter zu den Fragen';}});root.append(form);
}
function quiz(){
 const q=questions[step];heading(q.title,q.hint,step+2);
 const saved=text('p',`Danke${state.name?', '+state.name:''}. Deine Kontaktdaten sind gespeichert.`);saved.className='saved-contact';root.append(saved);
 const form=document.createElement('form'),group=document.createElement('fieldset');group.className='quiz-options';const legend=text('legend',q.title);legend.className='sr-only';group.append(legend);
 q.options.forEach(([value,caption])=>{const label=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=q.key;input.value=value;input.required=true;input.checked=state[q.key]===value;label.append(input,text('span',caption));group.append(label);});form.append(group);const error=errorNode();form.append(error);const actions=document.createElement('div');actions.className='quiz-actions';
 const back=text('button','← Zurück');back.type='button';back.className='quiz-back';back.addEventListener('click',()=>{if(sending)return;if(step===0)location.href=funnelUrl('/anfrage/');else{step--;quiz();}});const button=text('button',step===2?'Weiter zum Termin':'Weiter');button.className='button';button.type='submit';actions.append(back,button);form.append(actions,proof());
 form.addEventListener('submit',async event=>{event.preventDefault();if(sending)return;sending=true;button.disabled=true;back.disabled=true;error.textContent='';
  try{const value=new FormData(form).get(q.key);const result=await request('quiz',{step:q.key,value,attribution:readAttribution()});state[q.key]=value;if(result.next){location.href=funnelUrl(result.next);return;}step++;quiz();}catch(e){error.textContent=e.message;}finally{sending=false;button.disabled=false;back.disabled=false;}});root.append(form);
}
(async()=>{
 readAttribution();document.querySelectorAll('[data-home]').forEach(a=>a.href=funnelUrl('/'));
 try{
  if(kind==='contact'){const exp=await request(experimentQuery({funnel:'1'}));preview=!!exp.preview;try{Object.assign(state,await request('funnel'));}catch(e){if(![401,404].includes(e.status))throw e;}contact();}
  else{const lead=await request('funnel');mergeAttribution(lead.attribution);Object.assign(state,lead);step=!lead.role||lead.role==='unemployed'?0:!lead.experience?1:!lead.income?2:0;quiz();}
 }catch(e){if(kind==='quiz'&&[401,404].includes(e.status)){location.replace(funnelUrl('/anfrage/'));return;}root.replaceChildren(text('h1','Kurz nicht erreichbar.'),text('p',e.message));const b=text('button','Erneut versuchen');b.className='button';b.addEventListener('click',()=>location.reload());root.append(b);}
})();
