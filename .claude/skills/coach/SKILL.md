---
name: coach
description: Coaching mode for a multi-package feature in chuchipirat — the user writes the code, Claude plans, writes the tests first, reviews before each commit and writes the JSDoc. Use with "plan <issue/feature>" to start a feature, "next" to detail the next package, or "review" when the user reports "Paket X.Y fertig".
---

# Coaching-Modus

Vor allem anderen `.claude/docs/coaching-workflow.md` lesen. Es enthält Rollen, Aufbau der
Story-Datei, Ablauf pro Paket, Regeln und die Pre-Commit-Checkliste. Dieser Skill sagt nur, was
pro Einstieg zu tun ist.

Die Story-Datei liegt in `.claude/tasks/<Feature>/<Feature>.md` und ist nicht in Git. Gibt es
mehrere Features, fragen, welches gemeint ist.

## `plan <issue oder Feature>`: Feature starten

1. Issue lesen (`gh issue view <nr>`), betroffenen Code und `.claude/docs/architecture.md` ansehen.
2. Story-Datei nach dem Aufbau im Workflow-Dokument anlegen: Context, Arbeitsvereinbarung,
   Architektur-Entscheidungen mit Begründung, Out of Scope, Epics.
3. Erstes Epic bis auf Pakete ausarbeiten, die übrigen nur als Titel + Kurzbeschreibung.
4. Offene Entscheidungen als Fragen an den Nutzer. Nichts umsetzen, bevor der Plan freigegeben ist.
5. Branch-Name vorschlagen (`feature/kurz-beschreibung`, ohne Issue-Nummer), nicht selbst anlegen.

## `next`: nächstes Paket ausarbeiten

1. Story-Datei lesen, nächstes offenes Paket finden. Ist ein Epic abgeschlossen, zuerst:
   - Rückblick schreiben, neue Regeln in die Pre-Commit-Checkliste von `coaching-workflow.md`
   - Epic archivieren (vollständig nach `Epic NN - <Titel>.md`, Kurzfassung in der Story-Datei)
   - PR des Epics gegen `develop` vorschlagen
2. Umriss mit dem aktuellen Code abgleichen, Abweichungen festhalten.
3. Paket ausarbeiten: Worum es geht, Entscheidungen mit *Warum*, Schnittstellen (Namen,
   Signaturen, Pfade, kein fertiger Code), Texte, Tests, Mutationsproben, Schritte mit ✋,
   Im Browser ansehen.
4. Entscheidungen klären lassen. Erst nach Freigabe: Testdateien schreiben, gegen eine
   Wegwerf-Umsetzung prüfen, Wegwerf-Code löschen, sagen, dass `tsc` rot bleibt, bis die Module
   existieren.

## `review`: «Paket X.Y fertig, ungecommittet»

1. `git status` und `git diff` (Working Tree gegen HEAD), neue Dateien vollständig lesen.
2. Selbst prüfen: `npx tsc --noEmit`, `npx jest <Muster> --watchAll=false`, `npm run lint`.
3. Feedback in den vier Kategorien aus dem Workflow-Dokument, getrennt nach **Muss** und **Kann**,
   mit Datei:Zeile und dem Prinzip dahinter. Pre-Commit-Checkliste durchgehen, Dateigrösse der
   berührten Dateien prüfen (`wc -l`, über ca. 500 Zeilen = Befund). Den Code des Nutzers nicht
   umschreiben.
4. Mindestens eine Mutationsprobe vorschlagen oder selbst machen (danach zurücksetzen).
5. JSDoc (Deutsch, ohne Plan-IDs) für neue/geänderte Funktionen direkt in die Dateien schreiben.
6. Bei UI-Änderungen auf `ui-review` hinweisen, bei Migration/RLS/Auth/Uploads auf
   `security-reviewer`.
7. Nach den Fixes nur die Fixes prüfen, dann in der Story-Datei `✅ (Datum: was geprüft wurde)`
   setzen und eine Commit-Nachricht vorschlagen. Committen nur auf Aufforderung.
