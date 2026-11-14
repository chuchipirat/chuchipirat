# Coaching-Workflow für grössere Features

Arbeitsweise, die sich bei der Abrechnung (Issue #86, Release 2.1) bewährt hat. Gilt für jedes
Feature, das über mehrere Pakete läuft. Einstieg über den Skill `/coach`.

## Rollen

- **Nutzer schreibt den Code**, um das Architektur-Niveau des Projekts zu verinnerlichen.
- **Claude ist Coach:** plant Epics und Pakete, schreibt die Tests vorab, reviewt jeden Stand vor
  dem Commit und schreibt die JSDoc der neuen/geänderten Funktionen.
- Feedback ist ehrlich und konkret, auch wenn es unbequem ist. Claude zeigt Probleme auf und
  erklärt sie, schreibt den Code des Nutzers aber nicht stillschweigend um.
- **Variante «Claude setzt um»:** Für einzelne, vorher ausdrücklich so vereinbarte Pakete
  (z.B. Aufräumen, Politur) implementiert Claude, der Nutzer prüft und testet vor dem Commit.
  Erst nach Freigabe des Plans umsetzen.

## Story-Datei

- Eine Datei pro Feature: `.claude/tasks/<Feature>.md` (z.B. `.claude/tasks/Expense Tracking.md`).
  Sie ist **nicht in Git** (siehe `.gitignore`); nach Abschluss verschiebt der Nutzer sie ins
  Vereins-Logbuch.
- Pläne, Checklisten, Entscheidungen, Abweichungen und Review-Notizen stehen **nur dort**, nicht
  in `todo.md`.
- **Lebende Roadmap:** Das erste Epic wird bis auf Datei-/Funktionsebene ausgearbeitet, die
  weiteren nur mit Titel und Kurzbeschreibung. Feinplanung jeweils, wenn das Epic ansteht, mit den
  Erfahrungen aus den Reviews davor.
- Erledigtes mit `✅ (Datum: was geprüft wurde)` markieren.

### Aufbau

1. **Context:** Ziel des Features, Umfang, Link aufs Issue.
2. **Arbeitsvereinbarung:** Verweis auf dieses Dokument plus feature-spezifische Abweichungen
   (Branch, PR-Zeitpunkt, Helpcenter-Commit).
3. **Architektur-Entscheidungen** (vorab, je mit Begründung).
4. **Out of Scope** (aus dem Issue übernommen).
5. **Epics → Pakete/Stories**, pro Paket:
   - **Worum es geht** (zwei, drei Sätze; bei UI eine ASCII-Skizze)
   - **Entscheidungen** (je mit *Warum*; offene Punkte als Frage an den Nutzer)
   - **Abweichungen vom Umriss** (nach Abgleich mit dem Code)
   - **Schnittstellen:** Dateipfade, Namen, Signaturen, Verhalten, API-Hinweise. **Kein fertiger Code.**
   - **Texte** (Konstanten mit genauem Wortlaut)
   - **Tests (vorab geschrieben, Definition of Done)**
   - **Mutationsproben:** welche absichtlichen Fehler die Tests rot machen müssen
   - **Schritte** mit ✋-Checkpoint nach jedem in sich testbaren Teil
   - **Im Browser ansehen:** Desktop, Handy, ggf. echte Geräte
   - **Typische Stolperfallen**, wo bekannt
6. **Rückblick** nach jedem Epic: was lief schief, welche Regel folgt daraus (neue Punkte in die
   Pre-Commit-Checkliste unten übernehmen).

## Ablauf pro Paket

1. **Feinplanung:** Claude gleicht den Umriss mit dem aktuellen Code ab, hält Abweichungen fest
   und klärt offene Entscheidungen mit dem Nutzer. Multi-User-Folgen vorher durchspielen
   («Was passiert, wenn zwei Köch:innen gleichzeitig …?»).
2. **Tests zuerst:** Claude schreibt die vollständigen Testdateien, prüft sie gegen eine
   Wegwerf-Umsetzung (danach löschen, nie Code in den Dateien des Nutzers lassen). `tsc` bleibt
   rot, bis der Nutzer die Module anlegt, und das wird so angesagt.
3. **Umsetzung durch den Nutzer**, bis die Tests grün sind. Er prüft selbst `tsc`, Lint, Tests
   und die Pre-Commit-Checkliste und meldet **«Paket X.Y fertig, ungecommittet»**.
4. **Review (✋):** Claude liest den Working-Tree-Diff (`git status`, `git diff`) und gibt
   Feedback in vier Kategorien:
   1. Architektur/Pattern-Treue
   2. Namensgebung/Clean Code
   3. Testabdeckung (inkl. Mutationsprobe)
   4. übersehene Edge Cases (Multi-User, Mobile, Zeitzone, Fehlerfälle)

   Befunde nach **Muss** / **Kann** trennen. Danach schreibt Claude die JSDoc (Deutsch) direkt in
   die Dateien, ohne Nachfrage.
5. **Fixes:** Nutzer wendet die Muss-Fixes an, Claude prüft nur die Fixes.
6. **Commit erst danach:** ein Commit pro Paket (conventional commit, Deutsch), keine
   «Fix Review Findings»-Nachträge. Claude committet nur auf Aufforderung.

## Regeln

- **Ein Paket = ein Ziel.** Braucht etwas Zusatzarbeit, wird sie ein eigenes Paket davor oder
  danach, nicht nebenbei.
- **Nein heisst stopp:** Lehnt der Nutzer einen Vorschlag ab, wird nichts davon gebaut, auch
  keine Tests.
- **Snippets nur auf Wunsch**, dann vollständig und kopierfertig (keine «…», keine erfundenen
  Helfer, deutsche Kommentare).
- **Keine Plan-IDs im Code:** JSDoc, Kommentare und Testnamen nennen nie Epic/Story/Paket-Nummern,
  sondern den Grund selbst.
- **Security-Review** (`security-reviewer`) am Ende jeder Story mit Migration, RLS, Auth,
  Formularen, Uploads, Repositories oder Edge Functions.
- **Abschluss-Epic:** aufräumen (grosse Dateien aufteilen, Styles/Texte ordnen), Regressionslauf
  (`ui-review`), manuelle Testfälle (`generate-testcases`), Helpcenter (`helpcenter-page`),
  Release Notes, Rebase auf `develop`, ein finaler PR.

## Pre-Commit-Checkliste

Allgemein, jedes Paket:

- [ ] `npx tsc --noEmit`, `npm run lint`, `npx jest <Muster> --watchAll=false` grün
- [ ] `git status` durchgesehen: nur Dateien des Pakets, kein Formatter-Rauschen, keine Reste
- [ ] Dateinamen == Hauptexport; JSDoc-`@example` zeigt existierende Methodennamen
- [ ] Editor formatiert beim Speichern mit Prettier (nicht dem TypeScript-Formatter); nach dem
      Speichern `tsc` laufen lassen, bevor es weitergeht
- [ ] Keine Importe aus `__mocks__`/Tests in Produktivcode; nach dem Speichern den Import-Block
      ansehen (der Editor importiert beim Tippen eines Namens gern eine gleichnamige Mock-Datei)

Domain-Logik/reine Funktionen:

- [ ] Helfer stehen vor ihren Aufrufern, die exportierte Funktion zuletzt (`const`-Funktionen
      werden nicht hochgezogen); nur die Schnittstelle exportieren
- [ ] `map`/`filter` nur, um ein neues Array zu bauen; Nebenwirkungen mit `forEach`; `Map`/`Set`
      direkt aus Paaren bauen (`new Map(list.map(…))`)
- [ ] Kein Name überdeckt eine äussere Variable (z.B. Parameter `matches` in einer Funktion, die
      selbst `matches` hat)

Repositories/Domain-Typen:

- [ ] Repository in `DatabaseService.ts` registriert (Import + Feld + Konstruktor)
- [ ] Cache-Konfiguration in `sessionStorageHandler.class.ts` (`excludeFromCaching: true` bei
      Multi-User/Event-Daten)
- [ ] `date`-Spalten über `formatLocalDate()`/`parseLocalDate()`, nie `.toISOString().split("T")[0]`
- [ ] `orderBy`/`filters`/`.eq(...)` mit DB-Spaltennamen (snake_case), nicht Domain-Feldnamen
- [ ] Domain-Typen importieren keine Domain-Klassen nur für einen Feldtyp
- [ ] Nullability der Domain-Felder == Tabellendefinition
- [ ] Row-Typ ohne Index-Signatur (`[key: string]: unknown` lässt fehlende oder vertippte Felder
      durch); ein `type` erfüllt `Record<string, unknown>` auch ohne

UI/Komponenten:

- [ ] Jeder Schreibaufruf in `try/catch` → zentrales `handleError`; Dialog schliesst nicht
      «erfolgreich», wenn nichts gespeichert wurde
- [ ] Keine Hooks nach frühem `return` (prüft ESLint `rules-of-hooks` als Fehler); `exhaustive-deps`-Warnungen nicht durch blosses Ergänzen der Abhängigkeiten «beheben», erst fragen, ob der Effekt bei jeder Änderung wirklich neu laufen soll
- [ ] Kein `console.log`, `debugger`, auskommentierter Code, ungenutzte Exporte
- [ ] Eigener Analytics-Event pro Aktion (kein kopiertes `..._CREATED`)
- [ ] Neues Pflichtfeld → alle Fixtures/Mocks nachgezogen
- [ ] `[...array].sort()`, nie in place auf State; `useMemo`-Dependencies vollständig
- [ ] `localStorage`-Zugriff in `try/catch` (kann werfen), ohne Sentry
- [ ] Komponenten mit eigener Logik in eigene Datei (Richtwert < 500 Zeilen)
- [ ] Dialoge auf dem Handy (xs) als Vollbild, Touch-Ziele gross genug
- [ ] Dialoge mit CREATE/EDIT: modusabhängige Logik dort an den Modus binden, wo sie startet
      (z.B. im Öffnen-Effekt), und den anderen Modus im Test prüfen

Tests:

- [ ] `jest.mock` nur auf oberster Ebene; `...Once`-Warteschlangen per `mockReset` in `beforeEach`
      leeren (`clearAllMocks` leert sie nicht)
- [ ] Realtime/Callbacks: Callback aus dem Mock lesen und selbst aufrufen
- [ ] Mutationsprobe gemacht: Code absichtlich kaputt → Test wird rot
- [ ] Vorab geschriebene Tests nie an den Code anpassen; scheint ein Test falsch, im Review melden
- [ ] Jeder Wert eines Entscheidungs-/Ergebnis-Enums hat mindestens einen Test
- [ ] Sortierung: Testdaten so wählen, dass jede Stufe der nächsttieferen widerspricht (sonst
      bleibt «Stufe weg» grün, weil z.B. alphabetisch zufällig dieselbe Reihenfolge ergibt)
- [ ] Algorithmen (Abstand, Index, Zwischenspeicher): zusätzlich gegen eine einfache Referenz
      über erzeugte kleine Eingaben prüfen, nicht nur Beispiele
- [ ] Erwartungen einer Fixture mit den schon vorhandenen Funktionen gegenrechnen (z.B. ist der
      Name nach der Normalisierung schon gleich?)
- [ ] Beträge mit Tausender-Apostroph/geschütztem Leerzeichen über die Formatierungsfunktion
      erwarten, nicht hart codiert

Migrationen:

- [ ] Bestehende Migrationen nie ändern; Präfix eindeutig
      (`ls supabase/migrations | sed 's/_.*//' | sort | uniq -d` ist leer)
- [ ] Transaktional gegen die laufende `supabase-db-test` angewendet; RLS mit mehreren Rollen geprüft
- [ ] INSERT-Policy auf Tabellen mit `created_by`: `WITH CHECK (created_by = (SELECT auth.uid()))`
      (der `DEFAULT auth.uid()` greift nur, wenn die Spalte fehlt)
- [ ] Nach `REVOKE ALL … FROM anon, authenticated` nur die nötigen Rechte `GRANT`en, nie `GRANT ALL`
      (sonst bleibt z.B. `TRUNCATE` offen)

UI-Pakete zusätzlich: im Browser auf Desktop und Handy angesehen (`ui-review`).
