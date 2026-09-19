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
- E-Mail: admin@example.invalid. Kein Login über E-Mail-Versand; das Konto verwendet ein Passwort.
- Daten liegen ausschließlich lokal unter `.local/data/`, außerhalb des veröffentlichten Verzeichnisses. `.local/` und Zugangsdaten werden nicht in Git aufgenommen.

## Netlify aktivieren

`netlify.toml` baut das Quiz und veröffentlicht `wireframe/perspective-abstrakt`. Die API läuft als Netlify Function unter `/api/*`. Die Datenspeicherung verwendet einen privaten, deployübergreifenden Netlify-Blobs-Store `hamann-crm` mit starker Lesekonsistenz. Produktion benötigt keine externe Datenbank.

Vor dem Deployment **vier Umgebungsvariablen** für dieses Netlify-Projekt setzen:

- `HAMANN_ZAPIER_WEBHOOK_URL` (der Zapier Catch-Hook; bleibt ausschließlich serverseitig)
- `HAMANN_ADMIN_EMAIL`
- `HAMANN_ADMIN_PASSWORD_HASH` (scrypt-Hash, kein Klartextpasswort)
- `HAMANN_SESSION_SECRET` (mindestens 32 Zeichen; erzeugt mit kryptografischer Zufallsquelle)

`node scripts/production-credentials.mjs` erzeugt diese in `.local/production.env` und das zugehörige Passwort in `.local/production-admin-zugang.txt`. Existierende Produktionsschlüssel werden nicht überschrieben. Diese Dateien nicht hochladen, committen oder öffentlich ablegen. Variablen in Netlify auf Functions / Produktionskontext begrenzen, soweit der Tarif das unterstützt. Danach neu deployen. Lokaler und produktiver Zugang sind getrennt.

Ohne Konfiguration wird kein Zugang mit einem Standardpasswort geöffnet. API-Anfragen erhalten eine klare Fehlermeldung. Den geheimen Sitzungsschlüssel bei Passwortwechsel mitrotieren; dadurch werden bestehende Sitzungen ungültig. Zum Ändern des Passworts einen neuen scrypt-Hash erzeugen und als Netlify-Variable setzen.

## Seitenablauf und frühe Kontakterfassung

- CTA auf der Landingpage → `/anfrage/`: Vorname, E-Mail, Land/Vorwahl (DE vorausgewählt), Telefonnummer und aktive Kontaktfreigabe. Kontaktdaten werden hier bereits gespeichert, bevor eine Quizfrage erscheint. Social Proof mit vorhandenen Kundenporträts, Kundenstatement und Kennzahlen begleitet Kontakt und Quiz.
- `/quiz/`: drei Fragen zu Rolle, Investment-Erfahrung und Monatsnettoeinkommen. Jede Antwort wird serverseitig am selben Lead gespeichert. Nach Neuladen wird beim nächsten offenen Schritt fortgesetzt. E-Mail und Telefon werden nicht in die URL oder den Browser-Speicher geschrieben; die Zuordnung erfolgt über ein signiertes HttpOnly-Cookie mit zwei Stunden Laufzeit.
- `/termin/`: qualifizierte Teilnehmer sehen den originalen Calendly-Kalender. `/danke/` leitet auf `/termin/` weiter.
- `/interesse/`: freundliche Absage und Empfehlungsmöglichkeit. Die Kontaktdaten bleiben im CRM mit Status „Nicht passend“ erhalten.

Arbeitslos und Einkommen unter 3.500 € netto führen zur Absage. „Will ich noch nicht sagen“ lässt eine Anmeldung zu. Die Qualifikation wird serverseitig geprüft; eine direkte Navigation auf `/termin/` umgeht sie nicht. Bis zum Quizabschluss ist der CRM-Status „Kontaktdaten erfasst“. Formatprüfung der Telefonnummer erfolgt mit `libphonenumber-js/max`; sie bestätigt nicht die Erreichbarkeit oder Inhaberschaft.

Der Kalender unter https://calendly.com/hamann-kollegen/erstgespraech erhält Name, E-Mail, Telefon und UTM-Parameter zur Vorbelegung. Es wird kein Termin automatisch gebucht. Kalenderbuchungen werden noch nicht ins CRM synchronisiert; Status „Termin vereinbart“ wird manuell gesetzt. Kein automatischer PDF- oder E-Mail-Versand.

## Zapier und UTM-Parameter

Der Catch-Hook wird als `HAMANN_ZAPIER_WEBHOOK_URL` ausschließlich auf dem Server konfiguriert. Lokal liegt er in `.local/config.json`; die vorbereitete Produktionskonfiguration liegt in `.local/production.env`. Der Link steht nicht in öffentlichen JS-Dateien oder im Repository.

Ereignisse:

- `contact_created`: erste Kontaktübermittlung, bevor das Quiz beginnt; Qualifikation `Noch offen`.
- `quiz_completed`: vollständiges Ergebnis, einschließlich `Qualifiziert` oder `Nicht passend`. Eine arbeitslose Rolle beendet das Quiz bereits nach der Rollenfrage.
- `contact_updated`: später korrigierte Kontaktdaten.

Jedes Ereignis enthält `event_id`, `lead_id`, `name`, `email`, `phone`, `country`, Antworten, Qualifikation, Bearbeitungsstand, Zeitstempel, Kontaktfreigabe-Version und A/B-Zuordnung. `lead_id` ist der Schlüssel zum Aktualisieren desselben Kontakts in Zapier. Für qualifizierte Abschlüsse im Zap auf `event = quiz_completed` UND `qualification_code = qualified` filtern. Frühe Kontaktdaten nicht als qualifizierten Abschluss zählen.

Alle `utm_*`-Parameter werden von der Landingpage per Query-String und Session-Speicherung über `/anfrage`, `/quiz` und `/termin` erhalten. Auf dem Server werden sie zusätzlich am Besucher und anschließend am Lead gespeichert. Im Hook stehen sie sowohl als einzelne Felder als auch unter `attribution`. Standardfelder werden bei Direktzugriff mit leerem Wert geliefert; zusätzliche UTM-Felder werden ebenfalls übernommen. Kalender-Einbettung und Kalender-Fallbacklink erhalten die gespeicherten UTM-Werte.

Vor dem Versand wird jedes Ereignis in einer privaten Outbox gespeichert. Bei Fehlern bleiben Lead und Ereignis erhalten. Wiederholungen erfolgen lokal jede Minute (mit zeitlichem Backoff), in veröffentlichten Netlify-Deployments alle 15 Minuten. Im Admin gibt es einen Versandstatus und einen Wiederholungsbutton. Bei Timeouts kann Zapier ein Ereignis trotz erneuter Zustellung bereits verarbeitet haben: im Zap nach `event_id` deduplizieren (At-least-once-Zustellung). Es wird kein genau-einmaliger Versand versprochen.

`HAMANN_DISABLE_WEBHOOK=1 npm run dev` unterdrückt externen Versand für lokale Browser-Testläufe. Test-Outbox-Einträge vor dem erneuten Aktivieren entfernen. Automatisierte Tests verwenden einen simulierten Empfänger. Der echte Catch-Hook wurde mit einem separaten Ereignis `integration_test`, `test: true` und ohne Kontaktdaten geprüft.

## CRM

Geschützter Login mit achtstündiger, serverseitig widerrufbarer Sitzung (HttpOnly, SameSite, HTTPS Secure). Liste, Suche, Statusfilter, Detailansicht, interne Notizen, Archivierungsstatus und CSV-Export der aktuell gefilterten Leads. Archivierte Leads bleiben über den Filter erreichbar. Kontaktfreigabe und Zeitpunkt werden gespeichert. Keine Kontaktdaten in URLs, Fehlerlogs oder öffentlich erreichbaren JSON-Dateien.

Server prüft Origin, Feldgrenzen und Datentypen. Honeypot, IP-basierte Begrenzungen und das Netlify-Function-Limit dämpfen Spam. Keine CAPTCHA-Abhängigkeit. Wiederholte Kontaktübermittlungen derselben E-Mail innerhalb derselben Browsersitzung ergänzen denselben Lead. Unterschiedliche E-Mail-Adressen werden als getrennte Kontakte behandelt. Die Erkennung gilt bis zum Ablauf bzw. Löschen des Besucher-Cookies.

## A/B-Tests

- Variante A: vorhandene Landingpage. Variante B: alternative Hero-Headline und/oder CTA-Texte.
- Entwürfe verändern die Seite nicht. Aktivierung erfolgt explizit; maximal ein Test aktiv.
- Beide Varianten können nach Admin-Login vorab geöffnet werden. Vorschau zählt keine Besuche und speichert keine Anfragen.
- Zuordnung deterministisch 50/50 pro signierter Browser-ID und Experiment. Cookie maximal 30 Tage, keine externen Analytics.
- Pro Browser und Experiment ein Besuch. Qualifiziert abgeschlossene Quiz-Anfragen werden dem zum Seitenaufruf zugeordneten Test zugerechnet, auch wenn dieser vor der Anfrage pausiert wurde.
- Qualifiziert abgeschlossene Quiz-Anfragen / Besuche = Abschlussrate. Terminbuchungen und Umsatz werden nicht automatisch gemessen. Die Zahlen sind deskriptiv, ohne Signifikanzbehauptung. Cookiesperren, Browserwechsel, Bots und gelöschte Cookies können die Messung beeinflussen.
- Änderungen einer Hypothese als neuen Test anlegen, damit Ergebnisse getrennt bleiben. Pausieren zeigt bei neuen Seitenaufrufen wieder die Originalseite.

## Prüfungen

`npm test`: Qualifikationsgrenzen, Länder-/Telefonprüfung, Einwilligung, serverseitige Abweisung, Speicherung, Wiederholungsversuche, Buchungszugang, Authentifizierung, Origin-Schutz, Abmeldung, stabile Testzuordnung und Attribution nach Testpause, Lead-Status/Notizen, Fehler bei Speicherausfall.

Browserprüfung: Mobile Kontaktformularansicht, negative Telefonnummernprüfung, vollständige Testanfrage, Kalender-Iframe, Admin-Login, Lead-Bearbeitung, Testentwurf und -aktivierung. Lokale Testdaten werden vor Übergabe entfernt.

## Wichtige Dateien

- `client/quiz.js`, `client/site.js`, `client/attribution.js`: Formular, Landingpage-CTA/A/B-Zuordnung und UTM-Weitergabe; erzeugen `quiz.js` und `site.js` im Publish-Verzeichnis.
- `server/api.mjs`, `server/validation.mjs`: API, Authentifizierung und gemeinsame Validierung.
- `netlify/functions/api.mjs`: Netlify-Anbindung.
- `wireframe/perspective-abstrakt/app.css`: ergänzende Landingpage- und Quizgestaltung.
- `wireframe/perspective-abstrakt/admin/`: Admin-Oberfläche.

Der Datenschutzhinweis verlinkt die offizielle Hamann-Erklärung. Neue Datenverarbeitung (Quiz/CRM, 30-Tage-Zuordnung und Calendly-Vorbelegung) muss in den eingesetzten Datenschutz- und Cookie-Informationen abgebildet werden. Die bestehende Copy enthält weiterhin die vom Auftraggeber vorgegebenen 30 Minuten an einer Stelle und 20 Minuten an anderen Stellen.

Die Kontakt-Ereignisse gehen an `HAMANN_ZAPIER_WEBHOOK_URL`, Quiz-Abschlüsse ausschließlich an `HAMANN_ZAPIER_QUIZ_WEBHOOK_URL` (lokal `quizWebhookUrl`). Ohne zweiten Hook bleiben Abschlüsse in der Outbox gespeichert. Kein erneuter Versand durch das Laden der Terminseite.

`role`, `experience`, `income`, `qualification` und `stage` enthalten deutsche Werte. Die ausgewählten Antworten entsprechen exakt den Optionen im Formular. `antworten` enthält alle Fragen, ausgewählte Antworten und mögliche Antworten. Für stabile Filter stehen zusätzlich `role_code`, `experience_code`, `income_code`, `qualification_code` bereit. Bestehende Zapier-Filter auf englische Antwortwerte auf diese Code-Felder umstellen.

Das Kontaktformular verwendet einen Datenschutzhinweis unter dem Button ohne Checkbox. `consented_at` dokumentiert den aktiven Versand nach diesem Hinweis, nicht eine separate Checkbox; Version `contact-submit-2026-09-17`.
