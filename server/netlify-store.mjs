import {getStore} from '@netlify/blobs';
export function netlifyStore(){
 const blobs=getStore({name:'hamann-crm',consistency:'strong'});
 return {get:key=>blobs.get(key,{type:'json'}),set:(key,value)=>blobs.setJSON(key,value),create:(key,value)=>blobs.setJSON(key,value,{onlyIfNew:true}),delete:key=>blobs.delete(key),async list(prefix){const result=[];for await(const page of blobs.list({prefix,paginate:true})){const values=await Promise.all(page.blobs.map(b=>blobs.get(b.key,{type:'json'})));result.push(...values.filter(Boolean));}return result;}};
}
