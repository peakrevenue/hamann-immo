import {build} from 'esbuild';
import {renderPages} from './render-pages.mjs';
await build({entryPoints:['client/quiz.js','client/site.js','client/webinar.js','client/webinar-thanks.js','client/webinar-survey.js','client/webinar-survey-thanks.js'],bundle:true,minify:true,format:'iife',outdir:'wireframe/perspective-abstrakt'});
await renderPages();
console.log('Landingpage, Webinar, Danke-Seite, Kontaktformular und Quiz gebaut.');
