import http from 'node:http';
import { readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileStore } from './storage.mjs';
import { createApi,passwordHash } from './api.mjs';
import {flushOutbox} from './webhook.mjs';
const root=path.resolve('wireframe/perspective-abstrakt');
await mkdir('.local',{recursive:true,mode:0o700});
let config;
try{config=JSON.parse(await readFile('.local/config.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;
 const password=randomBytes(24).toString('base64url');
 config={adminEmail:'admin@example.invalid',passwordHash:passwordHash(password),secret:randomBytes(48).toString('base64url'),local:true};
 await writeFile('.local/config.json',JSON.stringify(config),{mode:0o600});
 await writeFile('.local/admin-zugang.txt',`Nur lokale Entwicklung\nAdmin: http://127.0.0.1:8766/admin/\nE-Mail: ${config.adminEmail}\nPasswort: ${password}\nNicht veröffentlichen oder committen.\n`,{mode:0o600});
}
const store=fileStore(path.resolve('.local/data'));
config.webhookDisabled=process.env.HAMANN_DISABLE_WEBHOOK==='1';
const api=createApi({store,config});
const retryTimer=setInterval(()=>flushOutbox(store,config).catch(()=>console.error('Webhook retry failed')),60000);retryTimer.unref();
const types={'.ics':'text/calendar; charset=utf-8','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.avif':'image/avif','.gif':'image/gif','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.mp4':'video/mp4'};
http.createServer(async(req,res)=>{try{
 const origin=`http://${req.headers.host}`,url=new URL(req.url,origin);
 if(url.pathname.startsWith('/api/')){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>20000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const response=await api(new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET'?{body:Buffer.concat(chunks)}:{})}),{ip:req.socket.remoteAddress});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 let route=decodeURIComponent(url.pathname).replace(/^\/wireframe\/perspective-abstrakt/,'');
 if(/^\/danke\/?$/.test(route)){res.writeHead(302,{Location:'/termin/'+url.search});res.end();return;}
 if(route.endsWith('/'))route+='index.html';
 let file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return;}
 if((await stat(file)).isDirectory()){if(!url.pathname.endsWith('/')){res.writeHead(302,{Location:url.pathname+'/'});res.end();return;}file=path.join(file,'index.html');}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(file));
 }catch(e){res.writeHead(e.code==='ENOENT'?404:500);res.end('Seite nicht gefunden.');}
}).listen(Number(process.env.PORT||8766),'127.0.0.1',()=>console.log('Vorschau: http://127.0.0.1:8766/ – Admin-Zugang liegt in .local/admin-zugang.txt'));
