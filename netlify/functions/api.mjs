import {createApi} from '../../server/api.mjs';
import {netlifyStore} from '../../server/netlify-store.mjs';
export default async(request,context)=>createApi({store:netlifyStore(),config:{secret:process.env.HAMANN_SESSION_SECRET,adminEmail:process.env.HAMANN_ADMIN_EMAIL,passwordHash:process.env.HAMANN_ADMIN_PASSWORD_HASH,webhookUrl:process.env.HAMANN_ZAPIER_WEBHOOK_URL}})(request,{ip:context.ip});
export const config={path:'/api/*',rateLimit:{windowLimit:100,windowSize:60,aggregateBy:['ip','domain']}};
