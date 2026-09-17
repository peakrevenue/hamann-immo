import { getCountries,getCountryCallingCode } from 'libphonenumber-js';
import { phoneNumber,qualifies } from '../server/validation.mjs';
(() => {
 const dialog=document.querySelector('#anmeldung');if(!dialog)return;
 const root=dialog.querySelector('#quiz-body'),progress=dialog.querySelector('#quiz-progress'),label=dialog.querySelector('#quiz-step');
 const state={role:'',experience:'',income:'',name:'',email:'',phone:'',country:'DE',consent:false};let step=0,sending=false,ready=false,previewMode=false;
 const questions=[
  {key:'role',title:'Welche Situation beschreibt dich?',hint:'Damit wir dein Analysegespräch passend vorbereiten können.',options:[['employed','Ich bin angestellt'],['self-employed','Ich bin selbstständig'],['unemployed','Ich bin aktuell arbeitslos'],['other','Sonstiges']]},
  {key:'experience',title:'Was beschreibt dich am besten?',hint:'Ganz gleich, wo du gerade stehst: Wir möchten dich kennenlernen.',options:[['property','Ich besitze bereits Immobilien und möchte weitere kaufen.'],['interested','Ich habe noch keine Immobilie, interessiere mich aber dafür.'],['etf','Ich investiere bisher in ETFs oder andere Wertpapiere.'],['none','Ich habe bisher noch gar nicht investiert.']]},
  {key:'income',title:'Wie hoch ist dein Monatsnettoeinkommen?',hint:'Gemeint ist dein regelmäßiges Einkommen nach Steuern.',options:[['under2500','Unter 2.500 €'],['2500to3500','2.500 bis unter 3.500 €'],['3500to5000','3.500 bis unter 5.000 €'],['over5000','5.000 € oder mehr'],['undisclosed','Will ich noch nicht sagen']]}
 ];
 const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=value;return el;};
 async function establish(){try{const params=new URLSearchParams(location.search);const query=params.has('preview')?'?'+new URLSearchParams({preview:params.get('preview'),variant:params.get('variant')||'B'}):'';const r=await fetch('/api/experiment'+query);if(!r.ok)throw Error();const exp=await r.json();ready=true;previewMode=!!exp.preview;if(previewMode){let notice=document.querySelector('.test-preview-notice');if(!notice){notice=document.createElement('div');notice.className='test-preview-notice';notice.textContent='Admin-Vorschau · Variante '+exp.variant+' · Anfragen und Besuche werden nicht gezählt';document.body.prepend(notice);}}if(exp.headline)document.querySelector('.hero-headline').textContent=exp.headline;if(exp.cta)document.querySelectorAll('a[href="#anmeldung"]').forEach(a=>a.textContent=exp.cta);}catch{ready=false;}}
 establish();
 const error=text('p','');error.className='quiz-error';error.setAttribute('role','alert');
 function focusTitle(){root.querySelector('h2').focus();}
 function backButton(){const b=text('button','← Zurück');b.type='button';b.className='quiz-back';b.addEventListener('click',()=>{save();step--;render();});return b;}
 function save(){if(step===3){for(const key of ['name','email','phone','country'])state[key]=root.querySelector(`[name="${key}"]`)?.value||state[key];state.consent=root.querySelector('[name="consent"]')?.checked||false;}}
 function render(){
  root.replaceChildren();error.textContent='';label.textContent=`Schritt ${step+1} von 4`;progress.value=step+1;
  const title=text('h2',step<3?questions[step].title:'Wie dürfen wir dich kontaktieren?');title.id='dialog-title';title.tabIndex=-1;root.append(title);
  root.append(text('p',step<3?questions[step].hint:'Dein erster Schritt zur individuellen Immobilienstrategie. Kostenlos und unverbindlich.'));
  if(step<3){
   const q=questions[step],form=document.createElement('form'),group=document.createElement('fieldset');group.className='quiz-options';const legend=text('legend',q.title);legend.className='sr-only';group.append(legend);
   q.options.forEach(([value,caption])=>{const option=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name=q.key;input.value=value;input.required=true;input.checked=state[q.key]===value;option.append(input,text('span',caption));group.append(option);});form.append(group);
   const actions=document.createElement('div');actions.className='quiz-actions';if(step>0)actions.append(backButton());const next=text('button','Weiter');next.className='button';next.type='submit';actions.append(next);form.append(actions);
   form.addEventListener('submit',event=>{event.preventDefault();state[q.key]=new FormData(form).get(q.key);if(state.role==='unemployed'||step===2&&!qualifies(state.role,state.income)){location.href=new URL('interesse/',document.baseURI).href;return;}step++;render();});root.append(form);
  }else{
   const form=document.createElement('form');form.className='contact-form';
   for(const [name,caption,type,autocomplete]of [['name','Vorname','text','given-name'],['email','E-Mail-Adresse','email','email']]){const l=text('label',caption),input=document.createElement('input');input.name=name;input.type=type;input.autocomplete=autocomplete;input.required=true;input.maxLength=name==='name'?80:254;input.value=state[name];l.append(input);form.append(l);}
   const row=document.createElement('div');row.className='phone-row';const countryLabel=text('label','Land / Vorwahl'),select=document.createElement('select');select.name='country';select.autocomplete='country';const names=new Intl.DisplayNames(['de'],{type:'region'});const countries=getCountries().sort((a,b)=>names.of(a).localeCompare(names.of(b),'de'));countries.splice(countries.indexOf('DE'),1);countries.unshift('DE');
   countries.forEach(country=>{const o=text('option',`${names.of(country)} +${getCountryCallingCode(country)}`);o.value=country;o.selected=country===state.country;select.append(o);});countryLabel.append(select);
   const phoneLabel=text('label','Telefonnummer'),phone=document.createElement('input');phone.name='phone';phone.type='tel';phone.inputMode='tel';phone.autocomplete='tel-national';phone.required=true;phone.maxLength=40;phone.placeholder='z. B. 0151 23456789';phone.value=state.phone;
   const checkPhone=()=>{phone.setCustomValidity(phoneNumber(phone.value,select.value)?'':'Bitte gib eine gültige Telefonnummer für das gewählte Land ein. Buchstaben sind nicht erlaubt.');};phone.addEventListener('input',()=>phone.setCustomValidity(''));phone.addEventListener('blur',checkPhone);select.addEventListener('change',()=>{phone.placeholder=select.value==='DE'?'z. B. 0151 23456789':'Telefonnummer mit Ortsvorwahl';phone.setCustomValidity('');});phoneLabel.append(phone);row.append(countryLabel,phoneLabel);form.append(row);
   const trap=document.createElement('input');trap.name='website';trap.tabIndex=-1;trap.autocomplete='off';trap.className='quiz-honey';trap.setAttribute('aria-hidden','true');form.append(trap);
   const consent=document.createElement('label');consent.className='consent';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.name='consent';checkbox.required=true;checkbox.checked=state.consent;
   const consentText=document.createElement('span');consentText.innerHTML='Ich möchte zum Analysegespräch per E-Mail oder Telefon von Hamann &amp; Kollegen kontaktiert werden. Hinweise zur Verarbeitung meiner Angaben finde ich in der <a href="https://www.hamann-kollegen.de/datenschutz" target="_blank" rel="noopener">Datenschutzerklärung</a>.';consent.append(checkbox,consentText);form.append(consent,error);
   const actions=document.createElement('div');actions.className='quiz-actions';actions.append(backButton());const submit=text('button','Analysegespräch anfragen');submit.type='submit';submit.className='button';submit.addEventListener('click',checkPhone);actions.append(submit);form.append(actions);
   const proof=text('p','Über 147 Angestellte haben mit uns ihre erste vermietete Immobilie gekauft.');proof.className='quiz-proof';form.append(proof);
   form.addEventListener('submit',async event=>{event.preventDefault();if(sending)return;checkPhone();if(!form.reportValidity())return;save();sending=true;submit.disabled=true;submit.textContent='Wird gesendet …';error.textContent='';
    try{if(previewMode)throw Error('Dies ist eine Testvorschau. Hier werden keine Anfragen gespeichert.');if(!ready)await establish();if(!ready)throw Error('Die Verbindung konnte nicht hergestellt werden. Bitte versuche es gleich noch einmal.');if(previewMode)throw Error('Dies ist eine Testvorschau. Hier werden keine Anfragen gespeichert.');const attribution={};const params=new URLSearchParams(location.search);for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])if(params.has(k))attribution[k]=params.get(k);const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...state,website:trap.value,attribution})});const result=await response.json();if(result.disqualified){location.href=new URL('interesse/',document.baseURI).href;return;}if(!response.ok)throw Error(result.error||'Das hat leider nicht geklappt.');location.href=new URL('danke/',document.baseURI).href;
    }catch(e){error.textContent=e.message;}finally{sending=false;submit.disabled=false;submit.textContent='Analysegespräch anfragen';}});
   root.append(form);
  }
  if(dialog.open)focusTitle();
 }
 document.querySelectorAll('a[href="#anmeldung"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();render();dialog.showModal();focusTitle();}));
 dialog.querySelector('.close').addEventListener('click',()=>{save();dialog.close();});dialog.addEventListener('cancel',save);
 render();
})();
