# Release Notes (Helpcenter)

Wie am Ende eines Release-Batches (siehe `git-workflow.md` → „Release-Batch") die Nutzer:innen-Release-Notes für den Helpcenter entstehen.

## Was dafür nötig ist

1. **Versionsnummer** — aus dem Branch-Namen (`release/x.y.z`) bzw. dem `chore: Version auf x.y.z`-Commit.
2. **Umfangs-Entscheidung** — Standard: **nur nutzer:innen-sichtbare Änderungen**. Ein reiner Sentry-Aufräum-Batch besteht oft grossteils aus internen Fixes (Rauschen in der Fehlerüberwachung reduziert), die für die Nutzerin unsichtbar sind — die gehören NICHT in den Helpcenter-Eintrag. Abweichend nur, wenn explizit gewünscht.
3. **Quelle** — die Commits auf dem Release-Branch (`git log develop..HEAD` bzw. `origin/develop..HEAD`). Jeder Fix-Commit beschreibt die technische Ursache und endet mit `Fixes CHUCHIPIRAT-XX`. Diese Beschreibung wird **übersetzt**, nicht übernommen — aus „`event.tsx`'s `GENERIC_ERROR`-Reducer-Fall meldete jeden Fehler unbedingt an Sentry" wird z.B. „Beim Laden des Menüplans erschien manchmal eine unnötige Fehlermeldung."
4. **Ton** — Deutsch, Du-Form, wie die bestehenden UI-Texte (`src/constants/text/*.ts`, z.B. `ERROR_SESSION_EXPIRED`). Keine Fachbegriffe wie „Sentry", „Reducer", „RPC", „Race Condition" — stattdessen die Symptom-Perspektive der Nutzerin.

## Filter: gehört das in die Release Notes?

| Frage                                                                                            | Beispiel                                                                                            |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Hätte eine Nutzerin das je bemerkt (Absturz, falsche Anzeige, Fehlermeldung, hängender Zustand)? | ✅ Crash bei gelöschter Diät, ✅ Einkaufsliste-Refresh-Absturz                                      |
| Ändert sich etwas an dem, was sie sieht oder tun muss?                                           | ✅ neue „Sitzung abgelaufen"-Meldung mit Reload-Button, ✅ Realtime verbindet jetzt automatisch neu |
| Ist es eine spürbare Performance-Änderung?                                                       | ✅ Startseite lädt schneller                                                                        |
| Ist es nur eine interne Fehlerbehandlung/Monitoring-Änderung ohne sichtbaren Effekt?             | ❌ „JWT-expired-Fehler wird nicht mehr an Sentry gemeldet"                                          |
| Wurde das Issue analysiert, aber bewusst nicht gefixt?                                           | ❌ gehört nicht in Release Notes, sondern in `tech-debt.md`                                         |

## Format (verifiziert gegen den echten Helpcenter-Changelog)

Der Helpcenter führt **einen fortlaufenden Changelog** (mehrere Versionen in einer Datei, neueste zuerst, durch `---` getrennt). Wir liefern trotzdem nur den **Ausschnitt für die aktuelle Version** — der Nutzer fügt ihn selbst oben in seine Datei ein.

```markdown
## x.y.z — DD.MM.YYYY

<1-2 Sätze Intro: worum es in diesem Release grob geht.>

### Neue Funktion

- <Nur bei Feature-Releases. Ein bis zwei Sätze, Symptom-/Nutzen-Perspektive. Spielerischer Ton okay (Emoji vereinzelt gesehen).>

### Bugs

**<Feature-Bereich, z.B. "Einkaufsliste">**

- <Ein Satz: was ist aufgetreten, dass es jetzt behoben ist.>
- <Weiterer Fix im selben Bereich, falls vorhanden.>

### Verbesserungen

**<Feature-Bereich>**

- <Ein Satz.>
```

- **Datum:** `DD.MM.YYYY` (Schweizer Format). Ist das genaue Release-Datum noch nicht fix, `xx.MM.YYYY` als Platzhalter (Tag offen, Monat/Jahr bekannt) — wurde in der Praxis schon so verwendet.
- **Überschriften sind exakt `### Bugs` / `### Verbesserungen` / `### Neue Funktion`** — nicht „Behobene Fehler" übersetzen, „Bugs" ist der etablierte Begriff hier. Kategorie ohne Einträge einfach weglassen.
- **Gruppierung:** Bold-Subheading pro Feature-Bereich (`**Einkaufsliste**`, `**Rezepte**`, `**Anlässe**` …), darunter `-`-Bulletpoints — v.a. wenn mehrere Fixes im selben Bereich anfallen. Bei nur 3-4 Einträgen insgesamt, die sich nicht sinnvoll gruppieren lassen, ist ein einzelner Bold-Titel pro Eintrag (ohne Bereichs-Gruppierung, ohne Dash) als Fliesstext ebenfalls akzeptiert — im Zweifel nach Bereich gruppieren, das ist die häufigere Form in den bisherigen Releases.
- Keine Sentry-Issue-IDs, keine Datei-/Funktionsnamen im Endtext.

## Ausgabe

- Eigene Datei `RELEASE_NOTES_x.y.z.md` im Projekt-Root (nur der Ausschnitt für diese eine Version, nicht der ganze Changelog).
- **Nie committen** — die Datei ist nur zum Copy-Paste in die Helpcenter-Changelog-Datei gedacht.

## Beispiel

`RELEASE_NOTES_EXAMPLE.md` (Projekt-Root, falls noch lokal vorhanden) enthält den echten, vom Nutzer geprüften Changelog-Ausschnitt für 2.0.4–2.0.6 — verbindliche Referenz für Ton, Struktur und Gruppierung, vor dem Schreiben neuer Release Notes kurz gegenlesen.
