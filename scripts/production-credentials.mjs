import {mkdir,writeFile,access} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {passwordHash} from '../server/api.mjs';
await mkdir('.local',{recursive:true,mode:0o700});
try {await access('.local/production.env');console.log('Produktionszugang existiert bereits in .local/production.env. Keine Schlüssel überschrieben.');process.exit(0);}catch{}
const password=randomBytes(24).toString('base64url');
await writeFile('.local/production.env',`HAMANN_ADMIN_EMAIL=account@peak-revenue.ch\nHAMANN_ADMIN_PASSWORD_HASH=${passwordHash(password)}\nHAMANN_SESSION_SECRET=${randomBytes(48).toString('base64url')}\nHAMANN_ZAPIER_WEBHOOK_URL=${process.env.HAMANN_ZAPIER_WEBHOOK_URL||''}\n`,{mode:0o600});
await writeFile('.local/production-admin-zugang.txt',`Produktionszugang – erst nach Netlify-Konfiguration aktiv\nAdmin: https://hamann-immo.netlify.app/admin/\nE-Mail: account@peak-revenue.ch\nPasswort: ${password}\nNicht veröffentlichen oder committen.\n`,{mode:0o600});
console.log('Produktionszugang vorbereitet. Geheime Netlify-Werte: .local/production.env. Zugang: .local/production-admin-zugang.txt.');
