import {readAttribution,funnelUrl,request,experimentQuery} from './attribution.js';
readAttribution();
const links=document.querySelectorAll('a[data-funnel-cta]');
links.forEach(a=>a.href=funnelUrl('/anfrage/'));
request(experimentQuery()).then(exp=>{
 if(exp.headline)document.querySelector('.hero-headline').textContent=exp.headline;
 if(exp.cta)links.forEach(a=>a.textContent=exp.cta);
 if(exp.preview){const notice=document.createElement('div');notice.className='test-preview-notice';notice.textContent='Admin-Vorschau · Variante '+exp.variant+' · Anfragen und Besuche werden nicht gezählt';document.body.prepend(notice);}
}).catch(()=>{});
