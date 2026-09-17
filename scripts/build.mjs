import {build} from 'esbuild';
await build({entryPoints:['client/quiz.js','client/site.js'],bundle:true,minify:true,format:'iife',outdir:'wireframe/perspective-abstrakt'});
console.log('Landingpage, Kontaktformular und Quiz gebaut.');
