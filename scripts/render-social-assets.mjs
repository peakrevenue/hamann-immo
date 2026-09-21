import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
import {socialImages} from '../content/social.mjs';
import {workshop} from '../content/workshop.mjs';

const root = 'wireframe/perspective-abstrakt';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const font = {loadSystemFonts:false, fontFiles:[0,2,8,9].map(i=>`${root}/assets/font-${i}.ttf`), defaultFontFamily:'Figtree'};

function card(logo, {eyebrow, lines, detail, footer}) {
  // Keep all meaningful content inside the central 630px square as well.
  // This preserves the logo and headline when a messenger crops the thumbnail.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f8f6f2"/>
  <path d="M0 0h238L0 238ZM1200 630H962l238-238Z" fill="#1c3553"/>
  <path d="M0 270 270 0M1200 360 930 630" fill="none" stroke="#d0a065" stroke-width="3"/>
  <path d="M58 630V365l148-115 104 79M1142 0v265L994 380l-104-79" fill="none" stroke="#1c3553" stroke-opacity=".065" stroke-width="3"/>
  <svg x="410" y="55" width="380" height="47" viewBox="0 0 2327 285">${logo}</svg>
  <path d="M566 139h68" stroke="#d0a065" stroke-width="4"/>
  <g text-anchor="middle" fill="#1c3553">
    <text x="600" y="193" font-family="Figtree" font-weight="600" font-size="17" letter-spacing="2.8" fill="#886131">${escape(eyebrow)}</text>
    <text font-family="Outfit" font-weight="600" font-size="58" letter-spacing="-1.7">${lines.map((line,i)=>`<tspan x="600" y="${278+i*68}">${escape(line)}</tspan>`).join('')}</text>
    <rect x="340" y="395" width="520" height="62" rx="31" fill="#1c3553"/>
    <text x="600" y="435" fill="#fff" font-family="Figtree" font-size="24" font-weight="600">${escape(detail)}</text>
    <text x="600" y="502" font-family="Figtree" font-size="22" fill="#596878">${escape(footer)}</text>
    <text x="600" y="580" font-family="Figtree" font-size="16" fill="#596878">immobilien.hamann-kollegen.de</text>
  </g></svg>`;
}

function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({size,png},i)=>{
    const at = 6+i*16;
    header[at] = size; header[at+1] = size;
    header.writeUInt16LE(1, at+4); header.writeUInt16LE(32, at+6);
    header.writeUInt32LE(png.length, at+8); header.writeUInt32LE(offset, at+12);
    offset += png.length;
  });
  return Buffer.concat([header,...images.map(image=>image.png)]);
}

export async function renderSocialAssets() {
  await mkdir(`${root}/assets/social`,{recursive:true});
  const logo = (await readFile(`${root}/assets/hamann-logo.svg`,'utf8')).replace(/^[\s\S]*?<svg\b[^>]*>/,'').replace(/<\/svg>\s*$/,'');
  const date = new Intl.DateTimeFormat('de-DE',{day:'numeric',month:'long',timeZone:workshop.timeZone}).format(new Date(workshop.start));
  const hour = new Intl.DateTimeFormat('de-DE',{hour:'numeric',timeZone:workshop.timeZone}).formatToParts(new Date(workshop.start)).find(part=>part.type==='hour').value;
  const cards = {
    strategy:{eyebrow:'DEINE IMMOBILIENSTRATEGIE',lines:['Immobilien als','Kapitalanlage'],detail:'Kostenloses Analysegespräch',footer:'Persönlich. Mit Hamann & Kollegen.'},
    webinar:{eyebrow:'KOSTENLOSES LIVE-WEBINAR',lines:['Deine erste','vermietete Immobilie'],detail:`${date} · ${hour} Uhr`,footer:`${workshop.duration} mit ${workshop.host}`},
  };
  for(const [key,copy] of Object.entries(cards)) {
    const png = new Resvg(card(logo,copy),{font}).render().asPng();
    await writeFile(root+socialImages[key].path,png);
  }
  const mark = (await readFile(`${root}/assets/hamann-mark.png`)).toString('base64');
  const resize = size => new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><image width="${size}" height="${size}" href="data:image/png;base64,${mark}"/></svg>`).render().asPng();
  await writeFile(`${root}/favicon-96.png`,resize(96));
  await writeFile(`${root}/apple-touch-icon.png`,resize(180));
  await writeFile(`${root}/favicon.ico`,ico([16,32,48].map(size=>({size,png:resize(size)}))));
}
