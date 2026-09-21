import { createHash } from 'node:crypto';
import { phoneNumber } from './validation.mjs';
import { workshop } from '../content/workshop.mjs';

export function validateWebinar(data) {
  for (const key of ['firstName', 'lastName']) {
    if (typeof data[key] !== 'string' || data[key].trim().length < 2 || data[key].trim().length > 80 || /[<>\r\n]/.test(data[key])) {
      return { error: key === 'firstName' ? 'Bitte gib deinen Vornamen ein.' : 'Bitte gib deinen Nachnamen ein.' };
    }
  }
  if (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) return { error: 'Bitte prüfe deine E-Mail-Adresse.' };
  const phone = phoneNumber(data.phone, data.country);
  if (!phone) return { error: 'Bitte gib eine gültige Telefonnummer für das gewählte Land ein.' };
  return { value: { firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim().toLowerCase(), phone, country: data.country } };
}

export function webinarPayload(lead, utms) {
  const revision = createHash('sha256').update(JSON.stringify([lead.firstName, lead.lastName, lead.email, lead.phone, utms])).digest('hex').slice(0, 16);
  return {
    event: 'webinar_registered', event_id: `${lead.id}:webinar_registered:${revision}`, lead_id: lead.id,
    webinar_id: workshop.id, webinar_title: workshop.name, webinar_start: workshop.start,
    webinar_end: workshop.end, webinar_timezone: workshop.timeZone, page_url: workshop.url,
    first_name: lead.firstName, last_name: lead.lastName, vorname: lead.firstName, nachname: lead.lastName,
    name: lead.name, email: lead.email, phone: lead.phone, country: lead.country,
    stage: 'Zum Webinar angemeldet', created_at: lead.createdAt, updated_at: lead.updatedAt,
    consented_at: lead.consentedAt, consent_version: lead.consentVersion,
    attribution: utms, ...utms,
  };
}
