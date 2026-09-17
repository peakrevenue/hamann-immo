(async()=>{
 const title=document.querySelector('#thanks-title'),message=document.querySelector('#thanks-message'),error=document.querySelector('#booking-error');
 try{
  const response=await fetch('/api/booking');const lead=await response.json();if(!response.ok)throw Error(lead.error||'Bitte stelle zuerst deine Gesprächsanfrage.');
  title.textContent='Danke, deine Anfrage ist angekommen.';
  message.textContent='Sichere dir jetzt deinen Termin für das persönliche Analysegespräch.';
  document.querySelector('#calendar-area').hidden=false;
  const calendarUrl=new URL('https://calendly.com/hamann-kollegen/erstgespraech');calendarUrl.searchParams.set('hide_gdpr_banner','0');calendarUrl.searchParams.set('primary_color','d0a065');for(const[k,v]of Object.entries(lead.attribution||{}))if(k.startsWith('utm_')&&v)calendarUrl.searchParams.set(k,v);document.querySelector('.calendar-fallback a').href=calendarUrl.href;
  const loadCalendar=()=>{if(!window.Calendly){error.textContent='Bitte öffne die Terminbuchung über den Link unter dem Kalender.';return;}window.Calendly.initInlineWidget({url:calendarUrl.href,parentElement:document.querySelector('#calendly-embed'),prefill:{name:lead.name,email:lead.email,customAnswers:{a1:lead.phone}}});};
  const script=document.createElement('script');script.src='https://assets.calendly.com/assets/external/widget.js';script.onload=loadCalendar;script.onerror=()=>error.textContent='Der Kalender konnte nicht geladen werden. Bitte nutze den direkten Buchungslink.';document.head.append(script);
 }catch(e){message.textContent=e.message;}
})();
