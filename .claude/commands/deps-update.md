# Abhängigkeiten aktualisieren

Eingabe: "$ARGUMENTS"

- `minor` (Standard): Patch- und Minor-Runde zu Beginn eines Release-Batches, etwa monatlich
- `major`: geplante Major-Runde, zweimal im Jahr (Februar/März und September–November), nach einem Release und nicht kurz vor der Lagersaison

Grundsätze: Node 24 und npm 11 (`.nvmrc`), nie gegen PROD, Commit nur hinter grünem Gate. Für Major-Runden gilt zusätzlich `.claude/docs/coaching-workflow.md` (Story-Datei, Epics, Pre-Commit-Checkliste, Abschnitt «Abhängigkeits-Upgrades»).

## 1. Umgebung prüfen

```bash
node -v && npm -v   # erwartet v24.x / 11.x
```

Weicht die Version ab (z.B. in einer Hintergrund-Sitzung): `export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH` (Version unter `~/.nvm/versions/node/` nachsehen). npm 10 zeigt in `npm outdated` falsche «Latest»-Werte.

## 2. Stand erheben

```bash
npm outdated
npm audit --omit=dev
```

Ergebnis als Tabelle festhalten: Paket, installiert, neueste, Art (Patch/Minor/Major).

**Beobachtungsliste** (bei jeder Runde prüfen, ob die Sperre weg ist):

| Paket                      | Wartet auf                                 | Prüfen mit                                                                         |
| -------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `typescript` 7             | `typescript-eslint` und `ts-jest` mit TS 7 | `npm view typescript-eslint peerDependencies`, `npm view ts-jest peerDependencies` |
| `eslint` / `@eslint/js` 10 | `eslint-plugin-react` mit ESLint 10        | `npm view eslint-plugin-react peerDependencies`                                    |
| `react-router` 8           | Jest mit ESM                               | Issue #259                                                                         |
| `@types/node`              | bleibt auf der Hauptversion von `.nvmrc`   | –                                                                                  |
| `jszip`                    | bewusst fest gepinnt                       | Changelog lesen, wieder fest pinnen                                                |

Ist eine Sperre weg: nicht in dieser Runde mitnehmen, sondern als eigenes Paket bzw. für die nächste Major-Runde vormerken.

## 3a. Minor-Runde

1. Branch von `develop`: `chore/deps-<monat>` (z.B. `chore/deps-2026-12`)
2. `npm update --save`
3. Bereiche in `package.json` gegen `npm ls --depth=0` abgleichen (gemeinsam genutzte Pakete werden nicht immer angehoben)
4. Gate (Exit-Code zählt, nicht die Ausgabe):
   ```bash
   npx jest --watchAll=false && npx tsc --noEmit && npm run lint && npm run build
   ```
5. Changelogs der Pakete mit Minor-Sprung überfliegen. Bei Bibliotheken, die die Tests wegmocken (Diagramme, DataGrid, PDF, Drag-and-Drop, zxcvbn), die betroffene Seite kurz im Browser ansehen
6. Ein Commit `chore(deps): Minor- und Patch-Updates <Monat Jahr>`, PR nach `develop`
7. Lint-Warnungen und Startladung gegen die letzte Runde vergleichen (Startladung: Dateien, die `build/index.html` beim Start lädt)

## 3b. Major-Runde

1. Story-Datei `.claude/tasks/Dependency Upgrade <Jahr-Monat>/…` nach `coaching-workflow.md`, Baseline erheben (Tests, Lint, Konsole, Build, Startladung, Audit)
2. Pro Major einen Probelauf im Wegwerf-Worktree: installieren, `tsc`, Tests, Build, Release Notes **und** Quellcode lesen (stille Änderungen wie geänderte Vorgaben, umbenannte CSS-Klassen, entfernte Optionen)
3. Wo die Suite die Bibliothek wegmockt: vor dem Upgrade einen Test mit der echten Bibliothek schreiben
4. Ein Branch und ein Draft-PR pro Thema, gestapelt; pro Paket ein Commit
5. Abschluss: Messung gegen die Baseline (beide Seiten mit derselben Node-Version gebaut), Regressionsrundgang Desktop/Handy, hell/dunkel, Testfälle im Testrun des nächsten Releases, Release Note «Technische Grundlagen aktualisiert»
6. Gestapelte PRs mergen: vor jedem Merge den nächsten PR auf `develop` umhängen, erst dann mit `--delete-branch` mergen; umgehängten PR schliessen/öffnen, damit CI startet; zwischen den Merges den TEST-Deploy abwarten

## 4. Sicherheitslücken zwischen den Runden

Der Workflow «Dependency Audit» prüft jeden Montag `develop` und schlägt bei «high»/«critical» in App-Abhängigkeiten fehl. Dann sofort ein `fix/`-Branch mit dem kleinsten Update, das die Lücke schliesst (`npm audit fix --omit=dev`, nie `--force` ohne Prüfung), nicht bis zur nächsten Runde warten. Lücken nur in Dev-Werkzeugen (Jest, ESLint) warten auf die nächste Runde.

## 5. Node

Node-LTS etwa alle zwei Jahre wechseln, zusammen mit einer Major-Runde: `.nvmrc`, `engines` in `package.json`, `node-version` in allen Workflows, `@types/node`. Node 24 hat Support bis April 2028, Wechsel auf die nächste LTS also Ende 2027.
