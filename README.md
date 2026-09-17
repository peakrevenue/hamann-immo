# Hamann & Kollegen Landingpage und Mini-CRM

Landingpage mit vierstufigem Quiz, Qualifizierung, geschütztem Mini-CRM und A/B-Tests. Die bestehende Landingpage-Copy und Reihenfolge bleiben erhalten. Die großen Original-Lotties bleiben in Methodenbereich und Mockups; die kleinen Benefit-Symbole sind einheitliche SVGs.

## Lokal starten

Node.js 22 oder neuer:

```sh
npm ci
npm run build
npm run dev
```

- Landingpage: http://127.0.0.1:8766/
- Bisherige Vorschau funktioniert ebenfalls: http://127.0.0.1:8766/wireframe/perspective-abstrakt/
- Admin: http://127.0.0.1:8766/admin/
- Zugang: `.local/admin-zugang.txt` (wird beim ersten Start erzeugt).
- E-Mail: account@peak-revenue.ch. Kein Login über E-Mail-Versand; das Konto verwendet ein Passwort.
- Daten liegen ausschließlich lokal unter `.local/data/`, außerhalb des veröffentlichten Verzeichnisses. `.local/` und Zugangsdaten werden nicht in Git aufgenommen.

## Netlify aktivieren

`netlify.toml` baut das Quiz und veröffentlicht `wireframe/perspective-abstrakt`. Die API läuft als Netlify Function unter `/api/*`. Die Datenspeicherung verwendet einen privaten, deployübergreifenden Netlify-Blobs-Store `hamann-crm` mit starker Lesekonsistenz. Produktion benötigt keine externe Datenbank.

Vor dem Deployment **drei Umgebungsvariablen** für dieses Netlify-Projekt setzen:

- `HAMANN_ADMIN_EMAIL`
- `HAMANN_ADMIN_PASSWORD_HASH` (scrypt-Hash, kein Klartextpasswort)
- `HAMANN_SESSION_SECRET` (mindestens 32 Zeichen; erzeugt mit kryptografischer Zufallsquelle)

`node scripts/production-credentials.mjs` erzeugt diese in `.local/production.env` und das zugehörige Passwort in `.local/production-admin-zugang.txt`. Existierende Produktionsschlüssel werden nicht überschrieben. Diese Dateien nicht hochladen, committen oder öffentlich ablegen. Variablen in Netlify auf Functions / Produktionskontext begrenzen, soweit der Tarif das unterstützt. Danach neu deployen. Lokaler und produktiver Zugang sind getrennt.

Ohne Konfiguration wird kein Zugang mit einem Standardpasswort geöffnet. API-Anfragen erhalten eine klare Fehlermeldung. Den geheimen Sitzungsschlüssel bei Passwortwechsel mitrotieren; dadurch werden bestehende Sitzungen ungültig. Zum Ändern des Passworts einen neuen scrypt-Hash erzeugen und als Netlify-Variable setzen.

## Quiz und Qualifizierung

1. Rolle: Angestellt, selbstständig, arbeitslos, sonstiges.
2. Erfahrung: Immobilien, Interesse an erster Immobilie, ETFs/Wertpapiere, noch keine Investments.
3. Netto: unter 2.500 €, 2.500 bis unter 3.500 €, 3.500 bis unter 5.000 €, ab 5.000 €, keine Angabe.
4. Kontakt: Vorname, E-Mail, Land/Vorwahl (DE vorausgewählt), Telefon und aktive Kontaktfreigabe.

Arbeitslos und die beiden Einkommensgruppen unter 3.500 € führen auf `/interesse/`. Ohne Einkommensangabe ist eine Anfrage ausdrücklich zugelassen. Die Qualifikation wird nochmals serverseitig geprüft. Abgelehnte Antworten werden nicht als personenbezogener Lead gespeichert. Telefonnummern werden mit `libphonenumber-js/max` gegen das ausgewählte Land geprüft. Das bestätigt das Nummernformat, nicht die Erreichbarkeit oder Inhaberschaft.

Nach erfolgreicher Speicherung führt `/danke/` zum Originalkalender https://calendly.com/hamann-kollegen/erstgespraech. Der Kalender wird nur nach einer gespeicherten Anfrage geladen und erhält Name, E-Mail und Telefon zur Vorbelegung. Es wird kein Termin automatisch gebucht. Die eingebettete Buchung selbst liegt weiterhin bei Calendly. Kalenderbuchungen werden noch nicht per Webhook ins CRM synchronisiert; Status „Termin vereinbart“ wird manuell gesetzt. Es gibt keinen automatischen E-Mail- oder PDF-Versand.

## CRM

Geschützter Login mit achtstündiger, serverseitig widerrufbarer Sitzung (HttpOnly, SameSite, HTTPS Secure). Liste, Suche, Statusfilter, Detailansicht, interne Notizen, Archivierungsstatus und CSV-Export der aktuell gefilterten Leads. Archivierte Leads bleiben über den Filter erreichbar. Kontaktfreigabe und Zeitpunkt werden gespeichert. Keine Kontaktdaten in URLs, Fehlerlogs oder öffentlich erreichbaren JSON-Dateien.

Server prüft Origin, Feldgrenzen und Datentypen. Honeypot, IP-basierte Begrenzungen und das Netlify-Function-Limit dämpfen Spam. Keine CAPTCHA-Abhängigkeit. Eine erneute Übermittlung derselben Browsersitzung erzeugt keinen zweiten Lead. Diese Erkennung gilt bis zum Ablauf bzw. Löschen des Besucher-Cookies; keine E-Mail-basierte Zusammenführung unterschiedlicher Personen.

## A/B-Tests

- Variante A: vorhandene Landingpage. Variante B: alternative Hero-Headline und/oder CTA-Texte.
- Entwürfe verändern die Seite nicht. Aktivierung erfolgt explizit; maximal ein Test aktiv.
- Beide Varianten können nach Admin-Login vorab geöffnet werden. Vorschau zählt keine Besuche und speichert keine Anfragen.
- Zuordnung deterministisch 50/50 pro signierter Browser-ID und Experiment. Cookie maximal 30 Tage, keine externen Analytics.
- Pro Browser und Experiment ein Besuch. Gespeicherte Leads werden dem zum Seitenaufruf zugeordneten Test zugerechnet, auch wenn dieser vor der Anfrage pausiert wurde.
- Anfragen / Besuche = Abschlussrate. Terminbuchungen und Umsatz werden nicht automatisch gemessen. Die Zahlen sind deskriptiv, ohne Signifikanzbehauptung. Cookiesperren, Browserwechsel, Bots und gelöschte Cookies können die Messung beeinflussen.
- Änderungen einer Hypothese als neuen Test anlegen, damit Ergebnisse getrennt bleiben. Pausieren zeigt bei neuen Seitenaufrufen wieder die Originalseite.

## Prüfungen

`npm test`: Qualifikationsgrenzen, Länder-/Telefonprüfung, Einwilligung, serverseitige Abweisung, Speicherung, Wiederholungsversuche, Buchungszugang, Authentifizierung, Origin-Schutz, Abmeldung, stabile Testzuordnung und Attribution nach Testpause, Lead-Status/Notizen, Fehler bei Speicherausfall.

Browserprüfung: Mobile Kontaktformularansicht, negative Telefonnummernprüfung, vollständige Testanfrage, Kalender-Iframe, Admin-Login, Lead-Bearbeitung, Testentwurf und -aktivierung. Lokale Testdaten werden vor Übergabe entfernt.

## Wichtige Dateien

- `client/quiz.js`: bearbeitbarer Formularcode; erzeugt `quiz.js` im Publish-Verzeichnis.
- `server/api.mjs`, `server/validation.mjs`: API, Authentifizierung und gemeinsame Validierung.
- `netlify/functions/api.mjs`: Netlify-Anbindung.
- `wireframe/perspective-abstrakt/app.css`: ergänzende Landingpage- und Quizgestaltung.
- `wireframe/perspective-abstrakt/admin/`: Admin-Oberfläche.

Der Datenschutzhinweis verlinkt die offizielle Hamann-Erklärung. Neue Datenverarbeitung (Quiz/CRM, 30-Tage-Zuordnung und Calendly-Vorbelegung) muss in den eingesetzten Datenschutz- und Cookie-Informationen abgebildet werden. Die bestehende Copy enthält weiterhin die vom Auftraggeber vorgegebenen 30 Minuten an einer Stelle und 20 Minuten an anderen Stellen.
