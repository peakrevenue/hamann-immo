import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
export const roles = ['employed','self-employed','unemployed','other'];
export const experiences = ['property','interested','etf','none'];
export const incomes = ['under2500','2500to3500','3500to5000','over5000','undisclosed'];
export function qualifies(role, income) {
  return roles.includes(role) && role !== 'unemployed' && ['3500to5000','over5000','undisclosed'].includes(income);
}
export function phoneNumber(value, country) {
  if (typeof value !== 'string' || value.length > 40 || !/^[+\d\s()./-]+$/.test(value)) return null;
  try {const p = parsePhoneNumberFromString(value.replace(/^00/, '+'), country); return p?.isValid() && p.country === country ? p.number : null;} catch {return null;}
}
export function validateContact(data) {
  if (typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.trim().length > 80 || /[<>\r\n]/.test(data.name)) return {error:'Bitte gib deinen Vornamen ein.'};
  if (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(data.email)) return {error:'Bitte prüfe deine E-Mail-Adresse.'};
  const phone = phoneNumber(data.phone, data.country);
  if (!phone) return {error:'Bitte gib eine gültige Telefonnummer für das gewählte Land ein.'};
  if (data.consent !== true) return {error:'Bitte bestätige die Kontaktaufnahme.'};
  return {value:{name:data.name.trim(),email:data.email.trim().toLowerCase(),phone,country:data.country,consentVersion:'contact-first-2026-09-17'}};
}
export function validateLead(data) {
  if (!roles.includes(data.role) || !experiences.includes(data.experience) || !incomes.includes(data.income)) return {error:'Bitte beantworte alle Fragen.'};
  if (!qualifies(data.role,data.income)) return {error:'Aktuell passt unser Analysegespräch noch nicht zu deinen Angaben.',disqualified:true};
  const contact=validateContact(data);if(contact.error)return contact;
  return {value:{...contact.value,role:data.role,experience:data.experience,income:data.income}};
}
