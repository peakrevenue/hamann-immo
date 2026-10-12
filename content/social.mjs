import {workshopVariants,campaignRoutes} from './workshop-campaign.mjs';
export const socialImages = {
  webinarSteuer:{path:'/assets/social/webinar-steuer-v1.png',alt:'Kostenloses Live-Webinar: Steuerlast mit Immobilien senken. 26. Oktober, 19 Uhr.'},
  webinarEk:{path:'/assets/social/webinar-ek-v1.png',alt:'Kostenloses Live-Webinar: Vermietete Immobilie ohne Eigenkapital. 26. Oktober, 19 Uhr.'},
  strategy: {
    path: '/assets/social/immobilien-v1.png',
    alt: 'Hamann & Kollegen Immobilien: Immobilien als Kapitalanlage. Kostenloses Analysegespräch.',
  },
  webinar: {
    path: '/assets/social/webinar-v1.png',
    alt: 'Hamann & Kollegen Immobilien: Deine erste vermietete Immobilie. Kostenloses Live-Webinar mit Henrik Hamann.',
  },
};

// Social previews are public and deliberately contain no participant data.
export const socialPages = {
  'index.html': ['strategy', '/', 'Immobilien als Kapitalanlage | Hamann & Kollegen', 'Deine individuelle Immobilienstrategie. Kostenloses Analysegespräch für Angestellte ab 65.000 Euro brutto.'],
  'anfrage/index.html': ['strategy', '/anfrage/', 'Dein kostenloses Analysegespräch | Hamann & Kollegen', 'Hinterlasse deine Kontaktdaten für ein persönliches und unverbindliches Analysegespräch zu Immobilien als Kapitalanlage.'],
  'quiz/index.html': ['strategy', '/quiz/', 'Deine Immobilienstrategie vorbereiten | Hamann & Kollegen', 'Ein paar Fragen zu deiner Situation helfen uns, dein persönliches Analysegespräch vorzubereiten.'],
  'termin/index.html': ['strategy', '/termin/', 'Dein Analysegespräch mit Hamann & Kollegen', 'Wähle einen Termin für dein persönliches Gespräch über Immobilien als Kapitalanlage.'],
  'danke/index.html': ['strategy', '/termin/', 'Dein Analysegespräch mit Hamann & Kollegen', 'Wähle einen Termin für dein persönliches Gespräch über Immobilien als Kapitalanlage.'],
  'interesse/index.html': ['strategy', '/interesse/', 'Immobilien als Kapitalanlage | Hamann & Kollegen', 'Erfahre, für wen das persönliche Analysegespräch von Hamann & Kollegen geeignet ist.'],
  'workshop/index.html': ['webinar', '/workshop/', 'Deine erste vermietete Immobilie | Kostenloses Live-Webinar', 'Am 30. September um 19 Uhr: Wohnungen bewerten, Finanzierung verstehen und Risiken prüfen. 90 Minuten mit Henrik Hamann.'],
  'workshop-danke.html': ['webinar', '/workshop-danke', 'Deine Vorbereitung aufs Immobilien-Webinar', 'Speichere den Termin, teile deine Fragen mit uns und erhalte vorab Einblicke in unsere Immobilienstrategien.'],
  'workshop-umfrage.html': ['webinar', '/workshop-umfrage', 'Deine Fragen fürs Immobilien-Webinar', 'Teile deine Ziele und Fragen mit uns, damit wir die Beispiele und Antworten im Webinar auf die Teilnehmer vorbereiten können.'],
  'workshop-umfrage-danke.html': ['webinar', '/workshop-umfrage-danke', 'Einblicke vor dem Immobilien-Webinar | Hamann & Kollegen', 'Entdecke die Videos mit Henrik Hamann und die Erfahrungen unserer Kunden vor dem Immobilien-Webinar.'],
};

for(const variant of workshopVariants) socialPages[variant.slug+'.html']=[variant.socialImage,'/'+variant.slug,variant.title,variant.subheadline];
for(const [key,source] of [['thanks','workshop-danke.html'],['survey','workshop-umfrage.html'],['surveyThanks','workshop-umfrage-danke.html']]) {
 const [, ,title,description]=socialPages[source];
 socialPages[campaignRoutes[key].slice(1)+'.html']=['webinarSteuer',campaignRoutes[key],title,description];
}
