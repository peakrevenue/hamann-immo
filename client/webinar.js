import { AsYouType } from 'libphonenumber-js/max';
import { phoneNumber } from '../server/validation.mjs';
import {readAttribution, request} from './attribution.js';
import {workshop} from '../content/workshop.mjs';
const dialog=document.getElementById('webinar-anmeldung');
const form=document.getElementById('webinar-form');
const submit=document.getElementById('webinar-submit');
const error=document.getElementById('webinar-error');
const phone=form.elements.phone,country=form.elements.country;
let busy=false,opener=null;
readAttribution();
const validatePhone=()=>phone.setCustomValidity(phoneNumber(phone.value,country.value)?'':'Bitte gib eine gültige Telefonnummer für das gewählte Land ein.');
const formatPhone=()=>{phone.value=new AsYouType(country.value).input(phone.value.replace(/[^+0-9]/g,'').replace(/(?!^)\+/g,''));phone.setCustomValidity('');};
phone.addEventListener('input',formatPhone);phone.addEventListener('blur',validatePhone);country.addEventListener('change',formatPhone);submit.addEventListener('click',validatePhone);
phone.addEventListener('beforeinput',event=>{if(event.data&&/[a-zA-Z]/.test(event.data))event.preventDefault();});
function openRegistration(trigger){
 if(Date.now()>Date.parse(workshop.end)){error.textContent='Dieses Webinar ist bereits beendet.';submit.disabled=true;}
 opener=trigger;dialog.showModal();form.elements.firstName.focus();
}
for(const link of document.querySelectorAll('[data-webinar-open]'))link.addEventListener('click',event=>{event.preventDefault();openRegistration(link);});
dialog.querySelector('[data-webinar-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
dialog.addEventListener('close',()=>{opener?.focus();});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;validatePhone();if(!form.reportValidity())return;
 busy=true;submit.disabled=true;submit.textContent='Dein Platz wird gesichert …';error.textContent='';
 try{const data=Object.fromEntries(new FormData(form));const result=await request('webinar/register',{...data,attribution:readAttribution()});
 if(!result.ok)throw Error('Bitte versuche es erneut.');
 location.assign('/workshop-danke');
 }catch(e){error.textContent=e.message;busy=false;submit.disabled=false;submit.textContent='Jetzt kostenlos anmelden';}
});
submit.disabled=false;
if(location.hash==='#anmelden'||location.hash==='#webinar-anmeldung')openRegistration(document.querySelector('[data-webinar-open]'));
