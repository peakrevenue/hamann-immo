import {flushOutbox} from '../../server/webhook.mjs';
import {netlifyStore} from '../../server/netlify-store.mjs';
export default async()=>{await flushOutbox(netlifyStore(),{webhookUrl:process.env.HAMANN_ZAPIER_WEBHOOK_URL,quizWebhookUrl:process.env.HAMANN_ZAPIER_QUIZ_WEBHOOK_URL});return new Response(null,{status:204});};
export const config={schedule:'*/15 * * * *'};
