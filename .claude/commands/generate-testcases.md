# Generate Testcases

Eingabe: "$ARGUMENTS"

- Erstes Wort = Business Object
- Rest (optional) = Fokus-Aspekt

Wenn ein Fokus-Aspekt angegeben ist:
Analysiere nur diesen spezifischen Aspekt der Komponente tief.
Erstelle gezielte Testfälle nur für die relevanten Typen
(nicht zwingend alle 6 Typen wenn sie nicht passen –
z.B. hat drag-drop keinen sinnvollen auth-db Test).

Wenn kein Fokus-Aspekt angegeben:
Erstelle die vollständige Testsuite wie gewohnt
(mind. 1x pro typ: happy-path, edge-case, error-case, db-check, auth-ui, auth-db).

## Analyse

Analysiere das Business Object "$ARGUMENTS" vollständig:

- TypeScript Interfaces/Types
- DAL-Funktionen (Lesen, Schreiben, Löschen)
- RLS-Policies in den Migration-Files
- Validierungen und Permissions im App-Layer

## Regeln

- **Sprache**: Alle Testfall-Inhalte (Beschreibung, Schritte, Notizen) auf Deutsch.
- **Konventionen**: Siehe `docs/claude/manual-testcases.md` für Namenskonvention, Präfixe, Typen und Prioritäten.
- **Duplikate vermeiden**: Vor dem Erstellen die bestehenden Dateien im Zielverzeichnis lesen und die nächste freie Nummer verwenden.
- **Verlinkung**: In der Sektion "Verwandte Testfälle" immer Obsidian-Wikilinks verwenden: `* [[EV-001 Anlass erstellen]]`.

## Testfälle

Erstelle pro Business Object folgende Testfälle als separate Markdown-Files:

- Mind. 1x happy-path (Normalfluss)
- Mind. 1x edge-case (Grenzwerte, Pflichtfelder, leere Zustände)
- Mind. 1x error-case (Fehlerbehandlung, ungültige Eingaben)
- Mind. 1x db-check (Feldtabelle mit allen DB-Spalten aus dem Schema)
- Mind. 1x auth-ui (Berechtigungen App-Layer, alle relevanten Rollen)
- Mind. 1x auth-db (RLS-Policies, API-Calls mit/ohne JWT)

Dateiformat: Markdown mit YAML-Properties gemäss Template.
Ausgabepfad: /Users/giocettuzzi/Library/Mobile Documents/iCloud~md~obsidian/Documents/second-brain/🏴‍☠️ chuchipirat/Testing/Testfälle/[Bereich]/
Nummerierung: Nächste freie [PRÄFIX]-NNN im jeweiligen Bereich.

## Template

Verwende dieses Template exakt:

````markdown
---
tc_id: XX-000
bereich: ""
titel: ""
priorität: hoch
typ: happy-path
status: aktiv
---

## Beschreibung

## Vorbedingungen

## Testschritte

| # | Schritt | Erwartetes Ergebnis |
|---|---------|---------------------|
| 1 | | |

## Erwartetes Endergebnis

## Notizen / Risiken

Verwandte Testfälle:
* [[XX-000 Titel]]
````
