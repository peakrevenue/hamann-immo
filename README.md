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

Vor dem Deployment die Umgebungsvariablen für dieses Netlify-Projekt setzen:

- `HAMANN_ZAPIER_WEBHOOK_URL` (der Zapier Catch-Hook; bleibt ausschließlich serverseitig)
- `HAMANN_ZAPIER_QUIZ_WEBHOOK_URL` (separater Hook für Quiz-Abschlüsse)
- `HAMANN_ZAPIER_WEBINAR_WEBHOOK_URL` (separater Hook für Webinar-Anmeldungen)
- `HAMANN_ZAPIER_WEBINAR_SURVEY_WEBHOOK_URL` (separater Hook für Umfrage-Antworten)
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

## Immobilien-Webinar

`/workshop/` → Anmelde-Pop-up → `/api/webinar/register` → private Speicherung und eigene Zapier-Outbox → `/workshop/danke/`.

Termin: **30. September 2026, 19:00–20:30 Uhr, Europe/Berlin**. Die zentralen Veranstaltungsdaten liegen in `content/workshop.mjs`. Bei Terminänderungen auch die sichtbaren Texte in `templates/workshop.html` und `templates/workshop-danke.html` aktualisieren und neu bauen.

Das Formular benötigt Vorname, Nachname, E-Mail und eine gültige Telefonnummer. Es ist unabhängig vom Analysegespräch und dessen Qualifizierungsquiz. Webinar-Kontakte erscheinen im CRM als „Webinar angemeldet“. Die serverseitige Konfiguration lautet lokal `webinarWebhookUrl` in `.local/config.json`, in Netlify `HAMANN_ZAPIER_WEBINAR_WEBHOOK_URL`. Der vom Auftraggeber gelieferte Anmelde-Hook ist in Netlify als geheime Variable ausschließlich für Functions im Produktionskontext hinterlegt.

Der Hook erhält `event = webinar_registered`, `event_id`, `lead_id`, `first_name`, `last_name`, `vorname`, `nachname`, vollständigen `name`, `email`, normalisierte `phone`, `country`, Veranstaltungs-ID/-Titel/-Beginn/-Ende/-Zeitzone, Zeitstempel und alle bereinigten UTM-Parameter (flach und unter `attribution`). Gleiche E-Mail-Adressen werden für dieselbe Veranstaltung demselben Kontakt zugeordnet. Ein unverändert erneut abgesendetes Formular löst nach erfolgreicher Zustellung kein zweites Ereignis aus. Zapier sollte dennoch nach `event_id` deduplizieren, da Netzwerk-Wiederholungen technisch mehrfache Zustellungen auslösen können.

Die Danke-Seite übernimmt bei einer normalen Website-Anmeldung den Vornamen aus einem signierten HttpOnly-Cookie. Klaviyo registriert Mailing-Empfänger bereits extern über Zapier und führt ebenfalls direkt auf diese Seite. Die Danke-Seite löst selbst keine Anmeldung aus. Der technische Zustellstatus erscheint nur im Admin. `?vorschau=1` zeigt eine ausdrücklich markierte Designvorschau ohne Speicherung oder Versand. Kalenderexport für Apple (`/workshop/termin.ics`), Google- und Outlook-Kalenderlinks enthalten 19:00 Uhr deutscher Zeit sowie die Dauer von 90 Minuten.

**Zugangsmail:** Der Website-Code übermittelt die Anmeldung. Versand, tatsächlicher Webinar-Zugangslink und Erinnerungen müssen im empfangenden Zap eingerichtet sein. Der hier durchgeführte Test hat den Empfänger simuliert und keine Webinar-Testkontakte an den echten Hook geschickt. Die lokale Browser-Vorschau läuft mit `HAMANN_DISABLE_WEBHOOK=1`.

## Suchmaschinen und KI-Crawler

Die öffentlichen Seiten `/` und `/workshop/` liefern Inhalte einschließlich Kundenstimmen und FAQ bereits als HTML aus. `robots.txt` erlaubt Crawlern den Zugriff auf öffentliche Inhalte; private API-Pfade sind ausgeschlossen. Die Sitemap enthält die beiden öffentlichen Seiten. Anfrage-, Quiz-, Termin-, Absage-, Danke- und Admin-Seiten bleiben `noindex`. Das gesamte Projekt verwendet das originale Marken-Favicon der Hauptwebsite (32 und 256 Pixel).

Beide öffentlichen Seiten haben eigene Titel, Beschreibungen, Canonicals und Open-Graph-Daten. JSON-LD beschreibt Organisation, Gastgeber, Website, Seite und sichtbare FAQ; beim Webinar zusätzlich ein kostenloses Online-Event mit korrekten Zeiten. Es werden keine erfundenen Bewertungen oder zusätzlichen Ergebnisversprechen ausgezeichnet. Interne Links verbinden Analysegespräch und Webinar.

Die technische Grundlage orientiert sich an [Googles Hinweisen zu AI-Funktionen](https://developers.google.com/search/docs/appearance/ai-features) und der [OpenAI-Bot-Dokumentation](https://developers.openai.com/api/docs/bots). Öffentlich erreichbare, indexierbare HTML-Inhalte sind dafür entscheidend; spezielle AI-Dateien oder ein bestimmtes Ranking werden nicht vorausgesetzt oder versprochen. Hosting-/Firewall-Einstellungen und tatsächliche Indexierung sind zusätzlich auf der Live-Domain zu prüfen.

Quellen der Gestaltung und Copy: [Perspective Scaling Workshop](https://strategy.perspective.co/scaling-workshop/) für Reihenfolge und Aufbau, die bereitgestellten kommentierten Screenshots und [bisherige Webinar-Seite](https://hamann-kollegen-webinar.lovable.app/) für Inhalte, [Hamann & Kollegen](https://www.hamann-kollegen.de/) für Marke und Kundenstimmen sowie [Tobias Bräunigs Webinar-Danke-Seite](https://tobias-braeunig.de/webinar-danke/) für Bestätigung, Kalender und Teilnahmevorbereitung. Fremde Testimonials und Kennzahlen wurden nicht übernommen.

Bearbeitung: `templates/home.html`, `templates/workshop.html`, `templates/workshop-danke.html`; wiederverwendete Inhalte in `content/site.mjs` und `content/workshop.mjs`. `npm run build` erzeugt die veröffentlichten HTML-Dateien, JSON-LD, Sitemap und Kalenderdatei über `scripts/render-pages.mjs`. Öffentliches HTML nicht direkt bearbeiten, wenn dafür eine Vorlage existiert.

Prüfungen für das Webinar: Validierung, nur der vorgesehene Hook, UTM-Weitergabe, signierte Bestätigung, doppelte Anmeldung, Ausfälle und Wiederholungen, fehlende Konfiguration, Speicherausfälle, Spam-Begrenzung und abgelaufener Termin. Browserprüfung mit simuliertem Hook und Daten nur im Arbeitsspeicher: ungültige Nummer → Korrektur → erfolgreiche Anmeldung → personalisierte Danke-Seite.


## Webinar-Umfrage und Mailing-Einstieg

`/workshop/danke/` bietet drei Schritte: Kalender speichern, Umfrage ausfüllen, Videos ansehen. Desktop zeigt drei Karten nebeneinander, mobile Ansichten stapeln sie. Die direkte Danke-Seite ist für bereits über Klaviyo/Zapier angemeldete Personen vorgesehen; sie erstellt **keine** weitere Webinar-Anmeldung.

Klaviyo-Ziel: `https://immobilien.hamann-kollegen.de/workshop/danke/`. Optional `email` und `first_name` als URL-kodierte Parameter mitgeben. Beispielstruktur: `/workshop/danke/?email=URL_KODIERTE_ADRESSE&first_name=URL_KODIERTER_VORNAME&utm_source=klaviyo`. Diese Platzhalter sind keine Klaviyo-Template-Syntax. Die tatsächlich in Klaviyo verfügbaren Profilvariablen im Mailing verwenden. Kontaktdaten werden nach dem Einlesen aus der sichtbaren URL entfernt, die Seite sendet keinen Referrer und lädt keine externen Medien vor einer aktiven Wiedergabe. Die Adresse dient ausschließlich zur Vorbelegung; aus einer Adresse allein werden keine vorhandenen Kontaktdaten gelesen.

`/workshop/umfrage/` fragt Situation, berufliche Rolle, Monatsnetto, Investment-Ziele (Mehrfachauswahl) und eine freiwillige Webinar-Frage ab. Im letzten Schritt wird nur die E-Mail bestätigt. Die Adresse stammt aus der Website-Anmeldung, aus dem Mailing-Link oder wird manuell eingegeben. Ein signiertes HttpOnly-Cookie ordnet einen kurzlebigen, privaten Vorbelegungsdatensatz zu. Die Umfrage ist freiwillig und führt zu keiner zusätzlichen Webinar-Anmeldung oder Qualifizierung.

`POST /api/webinar/survey` speichert Antworten privat unter `surveys/` und legt das Ereignis `webinar_survey_completed` in die Outbox. Es enthält deutsche Antworttexte, stabile Antwortcodes, `email`, den bekannten Vornamen, `registration_id` (nur bei passender Website-Anmeldung), UTM-Parameter und eine deduplizierbare `event_id`. Wiederholungen innerhalb derselben Umfragesitzung behalten dieselbe ID; geänderte Antworten erzeugen eine neue Revision. Bei Zapier nach `event_id` deduplizieren.

Der eigene Empfänger wird als `HAMANN_ZAPIER_WEBINAR_SURVEY_WEBHOOK_URL` konfiguriert (lokal `webinarSurveyWebhookUrl`). Der vom Auftraggeber gelieferte Umfrage-Hook ist als eigene geheime Netlify-Variable für Functions im Produktionskontext hinterlegt; die private lokale Konfiguration enthält denselben Empfänger. Solange dieser Hook fehlt, bleiben Antworten und Versandaufträge gespeichert. Sie werden **nicht** ersatzweise an den Anmelde- oder Kontakt-Hook gesendet. Im Admin gibt es einen eigenen Bereich „Webinar-Umfragen“ und den Versandstatus. Nach Einrichten des Hooks können ausstehende Antworten über den Wiederholungsbutton versendet werden.

`/workshop/umfrage/danke/` bestätigt eine gespeicherte Umfrage per signiertem Cookie, zeigt dieselben Vorbereitungsvideos und vorhandene Kundenstimmen. Ohne Übermittlung erscheint keine erfundene Erfolgsbestätigung. `?vorschau=1` ist eine beschriftete Designvorschau.

Videos und Social-Links stehen in `content/webinar-videos.mjs`. Verifizierte Quellen: [offizieller YouTube-Kanal](https://www.youtube.com/@hamannkollegen/videos), [ausführliches Immobiliengespräch](https://www.youtube.com/watch?v=Z54_o3WYvUU), [Eigenkapital und Finanzierung](https://www.youtube.com/watch?v=UtI54YtnX6w), [Instagram](https://www.instagram.com/hamann_kollegen_immobilien/). Auswahl nach Themenpassung, keine Behauptung über interne Performance-Zahlen. YouTube wird erst nach Klick als `youtube-nocookie.com`-Player geladen; direkte Videolinks bleiben verfügbar.

Neue Vorlagen: `templates/workshop-umfrage.html`, `templates/workshop-umfrage-danke.html`. Gemeinsame Karten, Kalender-Icons und Videoelemente: `scripts/webinar-components.mjs`. Gestaltung: `wireframe/perspective-abstrakt/workshop/followup.css`. Alle Danke-/Umfrage-Seiten bleiben `noindex` und außerhalb der Sitemap.
