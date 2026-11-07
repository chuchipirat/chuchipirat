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

- Ein Ordner pro Feature: `.claude/tasks/<Feature>/` (z.B. `.claude/tasks/Expense Tracking/`).
  Er ist **nicht in Git** (siehe `.gitignore`).
  - `<Feature>.md`: die Story-Datei, an der wir arbeiten (Aufbau unten).
  - `Epic NN - <Titel>.md`: das **vollständige Archiv** eines abgeschlossenen Epics.
- Pläne, Checklisten, Entscheidungen, Abweichungen und Review-Notizen stehen **nur dort**, nicht
  in `todo.md`.
- **Lebende Roadmap:** Das erste Epic wird bis auf Datei-/Funktionsebene ausgearbeitet, die
  weiteren nur mit Titel und Kurzbeschreibung. Feinplanung jeweils, wenn das Epic ansteht, mit den
  Erfahrungen aus den Reviews davor.
- Erledigtes mit `✅ (Datum: was geprüft wurde)` markieren.

### Epic abschliessen: archivieren statt löschen

Damit die Story-Datei kurz bleibt und trotzdem nichts verloren geht:

1. Den vollständigen Abschnitt des Epics (alle Pakete mit Entscheidungen, Schnittstellen, Tests,
   Abweichungen, Review-Notizen) unverändert nach `Epic NN - <Titel>.md` verschieben, oben mit
   einem Kopf: Zeitraum, Ziel, Ergebnis, PR.
2. In der Story-Datei bleibt pro Epic eine **Kurzfassung** (höchstens ca. 20 Zeilen): was gebaut
   wurde, die wichtigsten Entscheidungen mit einem Satz Begründung, Abweichungen vom Plan,
   PR-Nummer, Link auf die Archivdatei.
3. Rückblick des Epics schreiben (siehe Aufbau), neue Regeln in die Pre-Commit-Checkliste unten.

**Am Ende des Features** ist der Ordner das Logbuch: Story-Datei mit Kurzfassungen, Architektur-
Entscheidungen und Rückblicken als Übersicht, die Epic-Dateien als Detail. Der Nutzer kopiert ihn
in die Dropbox; erst danach wird er in `.claude/tasks/` gelöscht.

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

   Befunde nach **Muss** / **Kann** trennen. Jeder Befund nennt das **Prinzip dahinter** (warum
   es so besser ist, was sonst passiert), damit es beim nächsten Mal ohne Review sitzt. Das Review
   ist der wichtigste Lernteil für den Nutzer: gründlich und präzise, nicht nur «sieht gut aus».
   Danach schreibt Claude die JSDoc (Deutsch) direkt in die Dateien, ohne Nachfrage.
5. **Fixes:** Nutzer wendet die Muss-Fixes an, Claude prüft nur die Fixes.
6. **Commit erst danach:** ein Commit pro Paket (conventional commit, Deutsch), keine
   «Fix Review Findings»-Nachträge. Claude committet nur auf Aufforderung.

## Regeln

- **Ein Paket = ein Ziel.** Braucht etwas Zusatzarbeit, wird sie ein eigenes Paket davor oder
  danach, nicht nebenbei. Das gilt auch fürs Feature: Neue Ideen ausserhalb des Issues (z.B. eine
  Admin-Funktion) bekommen einen eigenen Branch und PR.
- **Ein PR pro Epic** gegen `develop`, nicht ein grosser PR am Schluss. Unfertiges bleibt hinter
  einem Flag oder einer Admin-Sperre verborgen. *Warum:* Ein Feature-Branch über Monate führte bei
  der Abrechnung zu Cherry-picks, einem doppelten PR und einem riesigen Schluss-Review.
  Abhängigkeiten von anderen Branches zuerst mergen, dann darauf aufbauen, statt zu cherry-picken.
- **Dateigrösse in jedem Review:** Jede berührte Datei über ca. 500 Zeilen ist ein Befund, und das
  Aufteilen wird als nächstes Paket eingeplant, nicht erst im Abschluss-Epic.
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
- [ ] Nach dem Speichern `git diff --stat`: nur eigene Zeilen. Kommentare/JSDoc *zwischen*
      Methoden mit «Save without Formatting» (`⌘K S`) speichern, sonst formatiert Prettier die
      ganze Klasse
- [ ] Untracked Dateien im Repo: gezielt `git add <pfade>`, nicht `git add -A`
- [ ] Dateinamen == Hauptexport; JSDoc-`@example` zeigt existierende Methodennamen

Repositories/Domain-Typen:

- [ ] Repository in `DatabaseService.ts` registriert (Import + Feld + Konstruktor)
- [ ] Cache-Konfiguration in `sessionStorageHandler.class.ts` (`excludeFromCaching: true` bei
      Multi-User/Event-Daten)
- [ ] `date`-Spalten über `formatLocalDate()`/`parseLocalDate()`, nie `.toISOString().split("T")[0]`
- [ ] `orderBy`/`filters`/`.eq(...)` mit DB-Spaltennamen (snake_case), nicht Domain-Feldnamen
- [ ] Domain-Typen importieren keine Domain-Klassen nur für einen Feldtyp
- [ ] Nullability der Domain-Felder == Tabellendefinition

UI/Komponenten:

- [ ] Jeder Schreibaufruf in `try/catch` → zentrales `handleError`; Dialog schliesst nicht
      «erfolgreich», wenn nichts gespeichert wurde
- [ ] Keine Hooks nach frühem `return` (prüft ESLint `rules-of-hooks` als Fehler); `exhaustive-deps`-Warnungen nicht durch blosses Ergänzen der Abhängigkeiten «beheben», erst fragen, ob der Effekt bei jeder Änderung wirklich neu laufen soll
- [ ] Keine Importe aus `__mocks__`/Tests in Produktivcode; kein `console.log`, `debugger`,
      auskommentierter Code, ungenutzte Exporte
- [ ] Eigener Analytics-Event pro Aktion (kein kopiertes `..._CREATED`)
- [ ] Neues Pflichtfeld → alle Fixtures/Mocks nachgezogen
- [ ] `[...array].sort()`, nie in place auf State; `useMemo`-Dependencies vollständig
- [ ] `localStorage`-Zugriff in `try/catch` (kann werfen), ohne Sentry
- [ ] Komponenten mit eigener Logik in eigene Datei (Richtwert < 500 Zeilen)
- [ ] Dialoge auf dem Handy (xs) als Vollbild, Touch-Ziele gross genug

Tests:

- [ ] `jest.mock` nur auf oberster Ebene; `...Once`-Warteschlangen per `mockReset` in `beforeEach`
      leeren (`clearAllMocks` leert sie nicht)
- [ ] Realtime/Callbacks: Callback aus dem Mock lesen und selbst aufrufen
- [ ] Mutationsprobe gemacht: Code absichtlich kaputt → Test wird rot
- [ ] Asynchrones Ergebnis: Entspricht der Startzustand schon dem erwarteten Ergebnis (z.B.
      Score 0 = «Schwach»), zuerst einen anderen Zustand herstellen und abwarten, dann wechseln
- [ ] Beträge mit Tausender-Apostroph/geschütztem Leerzeichen über die Formatierungsfunktion
      erwarten, nicht hart codiert

Abhängigkeits-Upgrades:

- [ ] Nutzungsstellen aus den echten Importen bestimmt (`grep` nach dem Paketnamen), Browser-Test
      daraus abgeleitet, nicht aus der Erinnerung
- [ ] Laufen die Tests die Bibliothek echt oder ist sie überall weggemockt? Wenn weggemockt: vor
      dem Upgrade einen Test mit der echten Bibliothek schreiben
- [ ] Nach `npm update --save`: Bereiche in `package.json` gegen `npm ls` abgeglichen (gemeinsam
      genutzte Pakete werden nicht immer angehoben)
- [ ] Risikobereich im Browser geprüft, auch wenn der Changelog harmlos aussieht
- [ ] Behauptetes Fehlverhalten einer Bibliothek im Quellcode (`node_modules/…`) nachgelesen, bevor
      es als Fehler gilt
- [ ] Bundle-Zahlen aus den Dateien gemessen, die `build/index.html` beim Start lädt (nicht nur
      der grösste Chunk)
- [ ] Jedes importierte Paket steht in `package.json` (nicht nur indirekt über ein anderes Paket);
      sonst springt es bei einem Update unbemerkt die Hauptversion
- [ ] Hauptversion einer UI-Bibliothek: CSS-Selektoren auf deren Klassen und Slot-/Toolbar-Props
      gezielt gesucht und im Browser geprüft (brechen still, ohne Typfehler); Selektoren über
      exportierte Klassen (`lineClasses`, `alertClasses` …) statt fester Namen
- [ ] Aus einer Bibliothek abgeleitete Typen geprüft: Mutationsprobe (falscher Wert → `tsc` rot);
      viele Bibliotheken typisieren Optionen als `any`
- [ ] SDK mit Datenschutz-Optionen (Sentry, Analytics): Vorgaben der neuen Version in den Typen
      bzw. im Quellcode gelesen (neue Version kann mehr sammeln) und im Quellcode nachgesehen,
      **wer** eine Option liest, bevor sie ausgeschaltet wird
- [ ] Vergleichsbuilds (vorher/nachher) mit derselben Node-Version, Node-Pfad explizit gesetzt
      (`.nvmrc` greift ausserhalb des Repos nicht)
- [ ] Vor jeder Messung `node -v` / `npm -v` geprüft (Hintergrund-Sitzungen erben nicht den
      nvm-Standard; npm 10 zeigt in `npm outdated` falsche «Latest»-Werte)
- [ ] Befund aus einem Regressionsrundgang erst als Regression werten, wenn er nicht älter ist
      als das Upgrade (`git log -L`, Code-Herkunft); ältere Befunde als eigenes Issue, nicht im
      Upgrade-PR beheben

Migrationen:

- [ ] Bestehende Migrationen nie ändern; Präfix eindeutig
      (`ls supabase/migrations | sed 's/_.*//' | sort | uniq -d` ist leer)
- [ ] Transaktional gegen die laufende `supabase-db-test` angewendet; RLS mit mehreren Rollen geprüft

UI-Pakete zusätzlich: im Browser auf Desktop und Handy angesehen (`ui-review`).
