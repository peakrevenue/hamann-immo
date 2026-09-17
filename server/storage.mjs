import { mkdir, readFile, writeFile, rename, readdir, unlink, link } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
export function fileStore(directory) {
  const filename=key=>path.join(directory,Buffer.from(key).toString('base64url')+'.json');
  return {
    async get(key){try{return JSON.parse(await readFile(filename(key),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}},
    async set(key,value){await mkdir(directory,{recursive:true,mode:0o700});const f=filename(key),tmp=f+'.'+randomUUID();await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,f);},
    async create(key,value){await mkdir(directory,{recursive:true,mode:0o700});const tmp=filename(key)+'.'+randomUUID();await writeFile(tmp,JSON.stringify(value),{mode:0o600});try{await link(tmp,filename(key));}catch(e){if(e.code!=='EEXIST')throw e;}finally{await unlink(tmp);}},
    async delete(key){await unlink(filename(key)).catch(e=>{if(e.code!=='ENOENT')throw e;});},
    async list(prefix){const files=await readdir(directory).catch(e=>{if(e.code==='ENOENT')return [];throw e;});const keys=files.filter(f=>f.endsWith('.json')).map(f=>Buffer.from(f.slice(0,-5),'base64url').toString()).filter(k=>k.startsWith(prefix));const values=await Promise.all(keys.map(k=>this.get(k)));return values.filter(Boolean);}
  };
}
