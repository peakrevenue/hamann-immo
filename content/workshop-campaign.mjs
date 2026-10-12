import {workshop as previousWorkshop} from './workshop.mjs';

// The September pages retain their Zoom redirects; October has its own public URLs.
export const workshop = {
  ...previousWorkshop,
  id: 'immobilien-workshop-2026-10-26',
  start: '2026-10-26T19:00:00+01:00',
  end: '2026-10-26T20:30:00+01:00',
  url: 'https://immobilien.hamann-kollegen.de/workshop-steuer',
};
export const campaignRoutes = {
  thanks: '/workshop-oktober-danke',
  survey: '/workshop-oktober-umfrage',
  surveyThanks: '/workshop-oktober-umfrage-danke',
  calendar: '/workshop-oktober.ics',
};
export const workshopVariants = [
  {
    slug: 'workshop-steuer',
    headline: 'Wie du als Angestellter deine Steuerlast mit Immobilien unter 10 Prozent bringst.',
    subheadline: 'Im kostenlosen Live-Webinar zeigt dir Henrik Hamann, wie eine vermietete Immobilie deine Steuerlast senken kann, welche Rolle das passende Gutachten spielt und welche Voraussetzungen für eine Steuerlast unter 10 Prozent erfüllt sein müssen.',
    title: 'Steuerlast mit Immobilien senken | Kostenloses Live-Webinar',
    socialImage: 'webinarSteuer',
  },
  {
    slug: 'workshop-ek',
    headline: 'Wie du ohne Eigenkapital und mit weniger als 10 Stunden Zeitaufwand zu deiner ersten vermieteten Immobilie kommst.',
    subheadline: 'Erfahre, wie du mit deinem Gehalt statt mit Ersparnissen finanzieren kannst – und wie unser Team Objektauswahl, Finanzierung und Vermietung begleitet, damit dein eigener Zeitaufwand gering bleibt.',
    title: 'Vermietete Immobilie ohne Eigenkapital | Kostenloses Live-Webinar',
    socialImage: 'webinarEk',
  },
];
