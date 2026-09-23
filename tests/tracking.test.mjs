import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {takeMailingContext} from '../client/webinar-followup.js';

const root='wireframe/perspective-abstrakt';
async function* pages(directory) {
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  const file=path.join(directory,entry.name);
  if(entry.isDirectory()&&entry.name!=='assets')yield*pages(file);
  else if(entry.isFile()&&entry.name.endsWith('.html'))yield file;
 }
}

test('all published pages include the exact tracker once in head and cookie script once in body',async()=>{
 for await(const file of pages(root)) {
  const html=await readFile(file,'utf8');
  for(const [script,section] of [['tracker','head'],['cookie','body']]) {
   const src=`https://vt.hamann-kollegen.de/${script}.js?site-id=VT-C5735E4A-66884`;
   const tags=[...html.matchAll(/<script\b[^>]*>/g)].map(match=>match[0]).filter(tag=>tag.includes(`/${script}.js?`));
   assert.equal(tags.length,1,file+' '+script);
   assert.ok(tags[0].includes(`src="${src}"`));
   assert.match(tags[0],/\basync\b/);
   const start=html.indexOf('<'+section),end=html.indexOf('</'+section+'>');
   assert.ok(html.slice(start,end).includes(tags[0]),file+' '+section);
  }
  if(/^workshop-(?:danke|umfrage|umfrage-danke)\.html$/.test(path.basename(file))) {
   const bootstrap='<script src="/webinar-mailing-context.js"></script>';
   assert.ok(html.includes(bootstrap));
   assert.ok(html.indexOf(bootstrap)<html.indexOf('https://vt.hamann-kollegen.de/tracker.js'));
  }
 }
});

function browser(url) {
 const scope={URL,location:{href:url}};
 scope.history={replaceState(_state,_title,next){scope.location.href=new URL(next,scope.location.href).href;}};
 return scope;
}

test('head bootstrap cleans contact parameters before tracking while retaining prefill and attribution',async()=>{
 const code=await readFile(root+'/webinar-mailing-context.js','utf8');
 for(const query of [
  'email=preview%2Btest%40example.invalid&first_name=Alex',
  'email_address=preview%2Btest%40example.invalid&firstname=Alex',
  'email=preview%2Btest%40example.invalid&vorname=Alex',
 ]) {
  const scope=browser('https://immobilien.hamann-kollegen.de/workshop-danke?'+query+'&utm_source=klaviyo&vorschau=1#vorbereitung');
  runInNewContext(code,scope);
  const cleaned=new URL(scope.location.href);
  assert.equal(cleaned.pathname,'/workshop-danke');
  assert.equal(cleaned.search,'?utm_source=klaviyo&vorschau=1');
  assert.equal(cleaned.hash,'#vorbereitung');
  const contact=takeMailingContext(scope);
  assert.equal(contact.email,'preview+test@example.invalid');
  assert.equal(contact.firstName,'Alex');
  assert.equal(scope.__hkWebinarMailing,undefined);
  assert.deepEqual(takeMailingContext(scope),{email:'',firstName:''});
 }
});

test('direct visits and the fallback without bootstrap retain the existing mailing behavior',()=>{
 const direct=browser('https://immobilien.hamann-kollegen.de/workshop-umfrage?utm_source=website');
 assert.deepEqual(takeMailingContext(direct),{email:'',firstName:''});
 assert.equal(new URL(direct.location.href).search,'?utm_source=website');
 const fallback=browser('https://immobilien.hamann-kollegen.de/workshop-umfrage?email=preview%40example.invalid&first_name=Alex');
 assert.deepEqual(takeMailingContext(fallback),{email:'preview@example.invalid',firstName:'Alex'});
 assert.equal(new URL(fallback.location.href).search,'');
});
