import { getStore } from '@netlify/blobs';
import { createApi } from '../../server/api.mjs';
export default async (request, context) => {
  const blobs=getStore({name:'hamann-crm',consistency:'strong'});
  const store={
    get:key=>blobs.get(key,{type:'json'}),
    set:(key,value)=>blobs.setJSON(key,value),
    create:(key,value)=>blobs.setJSON(key,value,{onlyIfNew:true}),
    delete:key=>blobs.delete(key),
    async list(prefix){const result=[];for await(const page of blobs.list({prefix,paginate:true})){const values=await Promise.all(page.blobs.map(b=>blobs.get(b.key,{type:'json'})));result.push(...values.filter(Boolean));}return result;}
  };
  return createApi({store,config:{secret:process.env.HAMANN_SESSION_SECRET,adminEmail:process.env.HAMANN_ADMIN_EMAIL,passwordHash:process.env.HAMANN_ADMIN_PASSWORD_HASH}})(request,{ip:context.ip});
};
export const config = {path:'/api/*',rateLimit:{windowLimit:100,windowSize:60,aggregateBy:['ip','domain']}};
