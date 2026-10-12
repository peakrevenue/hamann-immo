import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {workshop,workshopVariants,campaignRoutes} from '../content/workshop-campaign.mjs';
import {setupCalendars} from '../client/webinar-followup.js';

const root='wireframe/perspective-abstrakt';
const normalize=html=>html.slice(html.indexOf('<body'))
 .replace(/<h1 class="hero-headline">[\s\S]*?<\/h1>/,'<h1>HERO</h1>')
 .replace(/<p class="lead">[\s\S]*?<\/p>/,'<p>SUBHEADLINE</p>')
 .replaceAll('30. September','26. Oktober').replaceAll('30. SEPTEMBER','26. OKTOBER')
 .replaceAll('Mittwoch','Montag').replaceAll('MITTWOCH','MONTAG')
 .replaceAll('/workshop-steuer','/workshop/').replaceAll('/workshop-ek','/workshop/');

test('October variants preserve the original layout and content outside headline, subheadline and date',async()=>{
 const original=normalize(await readFile(root+'/workshop/index.html','utf8'));
 for(const variant of workshopVariants){
  const html=await readFile(root+'/'+variant.slug+'.html','utf8');
  assert.equal(normalize(html),original);
  assert.ok(html.includes(variant.headline));
  assert.doesNotMatch(html,/30\. September|30\. SEPTEMBER|Mittwoch|MITTWOCH|2026-09-30/);
  const graph=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.equal(graph.find(node=>node['@type']==='EducationEvent').url,'https://immobilien.hamann-kollegen.de/'+variant.slug);
 }
 for(const key of ['thanks','survey','surveyThanks']){
  const html=await readFile(root+campaignRoutes[key]+'.html','utf8');
  assert.doesNotMatch(html,/30\. September|30\. SEPTEMBER|href="\/workshop-(?:danke|umfrage)(?:"|-)/);
 }
});

test('October calendar links use 19:00 German winter time consistently in Apple, Google and Outlook',async()=>{
 assert.equal(new Date(workshop.start).toISOString(),'2026-10-26T18:00:00.000Z');
 const ics=await readFile(root+campaignRoutes.calendar,'utf8');
 assert.match(ics,/DTSTART:20261026T180000Z/);
 assert.match(ics,/DTEND:20261026T193000Z/);
 assert.match(ics,/UID:immobilien-workshop-2026-10-26@/);
 assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 const before=globalThis.document;
 const links={'google-calendar':{},'outlook-calendar':{}};
 globalThis.document={getElementById:id=>links[id]};
 try{setupCalendars();}finally{globalThis.document=before;}
 const google=new URL(links['google-calendar'].href),outlook=new URL(links['outlook-calendar'].href);
 assert.equal(google.searchParams.get('dates'),'20261026T180000Z/20261026T193000Z');
 assert.equal(google.searchParams.get('ctz'),'Europe/Berlin');
 assert.equal(outlook.searchParams.get('startdt'),'2026-10-26T18:00:00.000Z');
 assert.equal(outlook.searchParams.get('enddt'),'2026-10-26T19:30:00.000Z');
});
