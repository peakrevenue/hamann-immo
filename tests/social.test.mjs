import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {socialImages, socialPages} from '../content/social.mjs';

const root = 'wireframe/perspective-abstrakt';
const origin = 'https://immobilien.hamann-kollegen.de';
const decode = value => value.replace(/&(amp|quot|lt|gt|#39);/g, (_,entity) => ({amp:'&',quot:'"',lt:'<',gt:'>', '#39':"'"}[entity]));
function metadata(html) {
 const result = new Map();
 for(const [tag] of html.matchAll(/<meta\b[^>]*>/g)) {
  const key = tag.match(/(?:property|name)="((?:og|twitter):[^"]+)"/)?.[1];
  if(!key)continue;
  assert.ok(!result.has(key), `Duplicate metadata: ${key}`);
  result.set(key,decode(tag.match(/content="([^"]*)"/)[1]));
 }
 return result;
}
function pngDimensions(buffer) {
 assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.equal(buffer.subarray(12,16).toString(),'IHDR');
 return [buffer.readUInt32BE(16),buffer.readUInt32BE(20)];
}

test('every shareable funnel page serves complete, canonical social metadata in its HTML',async()=>{
 for(const [file,[key,route,title,description]] of Object.entries(socialPages)) {
  const html = await readFile(`${root}/${file}`,'utf8');
  const meta = metadata(html.split('</head>')[0]);
  assert.equal(meta.size,17,file);
  assert.equal(meta.get('og:type'),'website');
  assert.equal(meta.get('og:locale'),'de_DE');
  assert.equal(meta.get('og:site_name'),'Hamann & Kollegen Immobilien');
  assert.equal(meta.get('og:title'),title);
  assert.equal(meta.get('og:description'),description);
  assert.equal(meta.get('og:url'),origin+route);
  assert.equal(meta.get('og:url'),html.match(/<link rel="canonical" href="([^"]+)"/)[1]);
  assert.equal(new URL(meta.get('og:url')).search,'');
  const image = origin+socialImages[key].path;
  assert.equal(meta.get('og:image'),image);
  assert.equal(meta.get('og:image:secure_url'),image);
  assert.equal(meta.get('og:image:type'),'image/png');
  assert.equal(meta.get('og:image:width'),'1200');
  assert.equal(meta.get('og:image:height'),'630');
  assert.equal(meta.get('og:image:alt'),socialImages[key].alt);
  assert.equal(meta.get('twitter:card'),'summary_large_image');
  assert.equal(meta.get('twitter:image'),image);
  assert.equal(meta.get('twitter:image:alt'),socialImages[key].alt);
  assert.equal(meta.get('twitter:title'),title);
  assert.equal(meta.get('twitter:description'),description);
 }
});

test('social cards are small, valid PNGs matching their advertised dimensions',async()=>{
 for(const image of Object.values(socialImages)) {
  const buffer = await readFile(root+image.path);
  assert.deepEqual(pngDimensions(buffer),[1200,630]);
  assert.ok(buffer.length<300_000, `${image.path} should load quickly in a messenger preview`);
 }
 const html = await readFile(`${root}/workshop/index.html`,'utf8');
 const json = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(json['@graph'].find(node=>node['@type']==='EducationEvent').image,[origin+socialImages.webinar.path]);
});

test('favicons include accurate PNG sizes and a valid multiresolution ICO',async()=>{
 for(const [file,size] of [['favicon.png',32],['favicon-96.png',96],['apple-touch-icon.png',180]]) {
  assert.deepEqual(pngDimensions(await readFile(`${root}/${file}`)),[size,size]);
 }
 const ico = await readFile(`${root}/favicon.ico`);
 assert.equal(ico.readUInt16LE(0),0);
 assert.equal(ico.readUInt16LE(2),1);
 assert.equal(ico.readUInt16LE(4),3);
 for(const [i,size] of [16,32,48].entries()) {
  const at = 6+i*16;
  assert.equal(ico[at],size);
  assert.equal(ico[at+1],size);
  const length = ico.readUInt32LE(at+8), offset = ico.readUInt32LE(at+12);
  assert.ok(offset+length<=ico.length);
  assert.deepEqual(pngDimensions(ico.subarray(offset,offset+length)),[size,size]);
 }
});
