import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import path from 'node:path';
import {stories, questions as homeQuestions} from '../content/site.mjs';
import {workshop, questions as webinarQuestions} from '../content/workshop.mjs';
import {surveyQuestions} from '../content/webinar-survey.mjs';
import {socialImages, socialPages} from '../content/social.mjs';
import {icon,stepCards,surveyFields,preparationVideos} from './webinar-components.mjs';

const root = 'wireframe/perspective-abstrakt';
const origin = 'https://immobilien.hamann-kollegen.de';
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons = '<link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="/favicon.ico"><link rel="icon" type="image/png" sizes="32x32" href="/favicon.png"><link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"><meta name="theme-color" content="#1c3553">';
function socialMeta([imageKey, route, title, description]) {
 const image = socialImages[imageKey];
 const tags = {
  'og:type':'website','og:locale':'de_DE','og:site_name':'Hamann & Kollegen Immobilien',
  'og:title':title,'og:description':description,'og:url':origin+route,
  'og:image':origin+image.path,'og:image:secure_url':origin+image.path,
  'og:image:type':'image/png','og:image:width':'1200','og:image:height':'630','og:image:alt':image.alt,
  'twitter:card':'summary_large_image','twitter:title':title,'twitter:description':description,
  'twitter:image':origin+image.path,'twitter:image:alt':image.alt,
 };
 return Object.entries(tags).map(([key,value])=>`<meta ${key.startsWith('og:')?'property':'name'}="${key}" content="${escape(value)}">`).join('');
}
const org = {'@type':'Organization','@id':origin+'/#organization',name:'Hamann & Kollegen Immobilien GmbH',url:'https://www.hamann-kollegen.de/',logo:origin+'/assets/hamann-logo.svg'};
const person = {'@type':'Person','@id':origin+'/#henrik-hamann',name:'Henrik Hamann',jobTitle:'Geschäftsführer',worksFor:{'@id':org['@id']},image:origin+'/assets/henrik-house.avif'};
function structuredData(isWebinar, questions) {
 const url = isWebinar ? workshop.url : origin+'/';
 const nodes = [org,person,{'@type':'WebSite','@id':origin+'/#website',url:origin+'/',name:'Hamann & Kollegen Immobilien',inLanguage:'de-DE',publisher:{'@id':org['@id']}},
  {'@type':'WebPage','@id':url+'#webpage',url,name:isWebinar?'Kostenloses Immobilien-Webinar am 30. September':'Immobilien als Kapitalanlage für Angestellte',inLanguage:'de-DE',isPartOf:{'@id':origin+'/#website'},about:{'@id':org['@id']}},
  {'@type':'FAQPage','@id':url+'#fragen',isPartOf:{'@id':url+'#webpage'},mainEntity:questions.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))}];
 if(isWebinar) nodes.push({'@type':'EducationEvent','@id':url+'#event',name:workshop.name,description:'Kostenloses Live-Webinar für Angestellte ab 3.500 Euro netto: vermietete Immobilien systematisch bewerten, Finanzierung und steuerliche Effekte verstehen sowie Risiken prüfen.',url,startDate:workshop.start,endDate:workshop.end,eventStatus:'https://schema.org/EventScheduled',eventAttendanceMode:'https://schema.org/OnlineEventAttendanceMode',location:{'@type':'VirtualLocation',url},image:[origin+socialImages.webinar.path],inLanguage:'de-DE',isAccessibleForFree:true,organizer:{'@id':org['@id']},performer:{'@id':person['@id']},offers:{'@type':'Offer',url:url+'#anmelden',price:0,priceCurrency:'EUR',availability:'https://schema.org/InStock'}});
 return '<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':nodes}).replace(/</g,'\\u003c')+'</script>';
}
function testimonials(isWebinar = false) {
 const copy = value => escape(isWebinar ? String(value).replace(/ [–—] /g, ': ').replace(/(\d)[–—](?=\d)/g, '$1 bis ') : value);
 return stories.map(s=>`<article class="case testimonial" id="testimonial-${s.slug}"><div class="testimonial-left"><video class="testimonial-video" controls playsinline preload="metadata" aria-label="Kundeninterview mit ${copy(s.name)}"><source src="${copy(s.video)}" type="video/mp4">Dein Browser unterstützt dieses Video nicht.</video><p class="testimonial-error" role="status" hidden>Das Interview konnte nicht geladen werden. Bitte lade die Seite erneut.</p><div class="testimonial-quote"><span class="quote-mark" aria-hidden="true">”</span><blockquote>${copy(s.quote)}</blockquote><p class="person">${copy(s.name)}</p><p class="person-role">${copy(s.role)}</p></div></div><div class="testimonial-right"><h3>${copy(s.headline)}</h3><p>${copy(s.text)}</p><ul>${s.points.map(p=>'<li>'+copy(p)+'</li>').join('')}</ul><img src="/assets/testimonial-${s.slug}.avif" alt="${copy(s.alt)}" loading="lazy" width="1200" height="450"></div></article>`).join('\n');
}
const faq = questions => questions.map(([q,a])=>`<details><summary>${escape(q)}</summary><p>${escape(a)}</p></details>`).join('\n');
function footer() {
 return '<footer class="site-footer"><div class="footer-inner"><a href="/" aria-label="Hamann & Kollegen · Startseite"><img src="/assets/hamann-logo.svg" alt="Hamann & Kollegen Immobilien" width="295" height="36" loading="lazy"></a><nav aria-label="Footer"><a href="/">Analysegespräch</a><a href="/workshop/">Immobilien-Webinar</a><a href="https://www.hamann-kollegen.de/">Hauptseite</a><a href="https://www.hamann-kollegen.de/impressum" target="_blank" rel="noopener">Impressum</a><a href="https://www.hamann-kollegen.de/datenschutz" target="_blank" rel="noopener">Datenschutz</a></nav><p class="footer-meta">Diese Website ist kein Teil der Facebook-Website oder von Meta Platforms, Inc. und wird weder von Facebook noch von Meta unterstützt oder gesponsert. Facebook ist eine Marke von Meta Platforms, Inc.</p><small>© 2026 Hamann & Kollegen Immobilien GmbH</small></div></footer>';
}
function calendar() {
 const compact = value => new Date(value).toISOString().replace(/[-:]/g,'').replace('.000','');
 const text = value => value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 // Fold on UTF-8 byte boundaries, including the leading continuation space.
 const fold = line => {let result='',part='';for(const char of line){if(Buffer.byteLength(part+char)>75){result+=part+'\r\n';part=' ';}part+=char;}return result+part;};
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Hamann und Kollegen//Immobilien-Webinar//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+workshop.id+'@immobilien.hamann-kollegen.de','DTSTAMP:20260921T000000Z','DTSTART:'+compact(workshop.start),'DTEND:'+compact(workshop.end),'SUMMARY:'+text(workshop.name),'DESCRIPTION:'+text('Live-Webinar mit Henrik Hamann. Den persönlichen Zugangslink findest du in deiner E-Mail. Informationen: '+workshop.url),'LOCATION:'+text('Online, Zugangslink per E-Mail'),'URL:'+workshop.url,'STATUS:CONFIRMED','BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:Dein Immobilien-Webinar beginnt in 15 Minuten.','END:VALARM','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export async function renderPages() {
 const home = await readFile('templates/home.html','utf8');
 const press = home.match(/<div class="press-strip"[\s\S]*?<\/div><\/div>/)?.[0];
 const shortProof = home.match(/<section class="wide proof-grid"[\s\S]*?<\/section>/)?.[0];
 if(!press||!shortProof)throw Error('Gemeinsame Vertrauenselemente fehlen im Home-Template.');
 for(const [template,target,isWebinar] of [['home.html','index.html',false],['workshop.html','workshop/index.html',true],['workshop-danke.html','workshop/danke/index.html',true],['workshop-umfrage.html','workshop/umfrage/index.html',true],['workshop-umfrage-danke.html','workshop/umfrage/danke/index.html',true]]){
  let html = await readFile('templates/'+template,'utf8');
  const questions = isWebinar ? webinarQuestions : homeQuestions;
  for(const [marker,value] of Object.entries({ICONS:icons,STRUCTURED_DATA:structuredData(isWebinar,questions),TESTIMONIALS:testimonials(isWebinar),FAQ:faq(questions),PRESS:press.replaceAll('src="assets/','src="/assets/'),SHORT_PROOF:shortProof.replaceAll('src="assets/','src="/assets/').replace('Cashflow – mal','Cashflow: mal').replace(/<a class="proof-link"[\s\S]*?<\/a>/g,''),FOOTER:footer(),CHECK_ICON:icon('check'),CALENDAR_ICON:icon('calendar'),MAIL_ICON:icon('mail'),ARROW_ICON:icon('arrow'),PREPARATION:stepCards(),SURVEY_FIELDS:surveyFields(surveyQuestions),PREP_VIDEOS:preparationVideos()}))html=html.replaceAll('<!-- '+marker+' -->',value);
  if(/<!-- (?:ICONS|STRUCTURED_DATA|TESTIMONIALS|FAQ|PRESS|SHORT_PROOF|FOOTER) -->/.test(html))throw Error('Unaufgelöste Vorlage: '+template);
  await mkdir(path.dirname(path.join(root,target)),{recursive:true});
  await writeFile(path.join(root,target),html);
 }
 // Static metadata must be available to link-preview crawlers without JavaScript.
 async function addMetadata(directory) {
  for(const entry of await readdir(directory,{withFileTypes:true})){
   const file=path.join(directory,entry.name);
   if(entry.isDirectory()&&entry.name!=='assets')await addMetadata(file);
   else if(entry.isFile()&&entry.name.endsWith('.html')){
    let html=await readFile(file,'utf8');
    html=html.replace(/<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*>/gi,'').replace(/<meta\b[^>]*name="theme-color"[^>]*>/gi,'');
    const page=socialPages[path.relative(root,file).split(path.sep).join('/')];
    if(page)html=html.replace(/<meta\b[^>]*\b(?:property|name)=["'](?:og|twitter):[^"']*["'][^>]*>/gi,'');
    html=html.replace('</head>',icons+(page?socialMeta(page):'')+'</head>');
    await writeFile(file,html);
   }
  }
 }
 await addMetadata(root);
 await writeFile(path.join(root,'workshop/termin.ics'),calendar());
 await writeFile(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /.netlify/functions/\n\nSitemap: '+origin+'/sitemap.xml\n');
 await writeFile(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>'+origin+'/</loc></url>\n  <url><loc>'+workshop.url+'</loc></url>\n</urlset>\n');
}
