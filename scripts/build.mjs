import { build } from 'esbuild';
await build({entryPoints:['client/quiz.js'],bundle:true,minify:true,format:'iife',outfile:'wireframe/perspective-abstrakt/quiz.js'});
console.log('Quiz und Telefonnummernprüfung gebaut.');
