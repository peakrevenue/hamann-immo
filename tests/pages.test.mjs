import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, access} from 'node:fs/promises';
import path from 'node:path';
import {workshop} from '../content/workshop.mjs';

const root='wireframe/perspective-abstrakt';
test('public pages expose testimonials, FAQ and matching structured data without JavaScript',async()=>{
 for(const file of ['index.html','workshop/index.html']){
  const html=await readFile(path.join(root,file),'utf8');
  assert.equal((html.match(/<h1\b/g)||[]).length,1);
  assert.equal((html.match(/class="case testimonial"/g)||[]).length,4);
  assert.equal((html.match(/<details>/g)||[]).length,8);
  assert.match(html,/<meta name="robots" content="index,follow/);
  assert.match(html,/href="\/favicon.png"/);
  const json=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const faq=json['@graph'].find(node=>node['@type']==='FAQPage');
  assert.equal(faq.mainEntity.length,8);
  for(const item of faq.mainEntity){assert.ok(html.includes(item.name));assert.ok(html.includes(item.acceptedAnswer.text));}
  if(file.startsWith('workshop')){
   const event=json['@graph'].find(node=>node['@type']==='EducationEvent');assert.equal(event.startDate,workshop.start);assert.equal(event.endDate,workshop.end);assert.equal(event.offers.price,0);
   assert.doesNotMatch(html,/src="\/?site.js"|data-funnel-cta|hooks.zapier.com/);
   assert.match(html,/href="#anmelden" data-webinar-open/);
  }
 }
});
test('all page assets resolve, favicon is shared and private routes remain noindex',async()=>{
 async function scan(directory){for(const item of await readdir(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory()&&item.name!=='assets')await scan(file);else if(item.isFile()&&item.name.endsWith('.html')){
  const html=await readFile(file,'utf8');assert.match(html,/href="\/favicon.png"/);
  const rel=path.relative(root,file);if(!['index.html','workshop/index.html'].includes(rel))assert.match(html,/<meta name="robots" content="noindex/);
  for(const [,url]of html.matchAll(/(?:src|href)="([^"#?]+)(?:[?#][^"]*)?"/g)){
   if(/^(?:https?:|mailto:|tel:|data:|#)/.test(url))continue;
   const target=url.startsWith('/')?path.join(root,url):path.join(path.dirname(file),url);
   await assert.doesNotReject(access(target),`${rel}: ${url}`);
  }
 }}}
 await scan(root);
 const sitemap=await readFile(root+'/sitemap.xml','utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,2);assert.ok(sitemap.includes(workshop.url));
 const robots=await readFile(root+'/robots.txt','utf8');assert.match(robots,/User-agent: \*\nAllow: \//);assert.doesNotMatch(robots,/Disallow: \/\s*$/m);
});
test('calendar export uses the correct German event time and valid CRLF folding',async()=>{
 const ics=await readFile(root+'/workshop/termin.ics','utf8');assert.match(ics,/DTSTART:20260930T170000Z/);assert.match(ics,/DTEND:20260930T183000Z/);
 assert.ok(ics.endsWith('END:VCALENDAR\r\n'));for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
});
test('follow-up pages contain three steps, separate survey, and click-to-load video embeds',async()=>{
 const thanks=await readFile(root+'/workshop/danke/index.html','utf8');assert.equal((thanks.match(/class="preparation-card/g)||[]).length,3);assert.doesNotMatch(thanks,/delivery-note|register-mailing|campaign-registration/);assert.match(thanks,/\/workshop\/umfrage\//);assert.match(thanks,/id="outlook-calendar"/);assert.doesNotMatch(thanks,/<iframe/);
 const js=await readFile(root+'/webinar-thanks.js','utf8');assert.doesNotMatch(js,/webinar\/register/);
 const survey=await readFile(root+'/workshop/umfrage/index.html','utf8');assert.equal((survey.match(/class="survey-step"/g)||[]).length,6);assert.match(survey,/name="email"/);assert.doesNotMatch(survey,/name="(?:phone|firstName|lastName)"/);
 const workshopHTML=await readFile(root+'/workshop/index.html','utf8');assert.doesNotMatch(workshopHTML,/Kundeninterview ansehen/);
});
