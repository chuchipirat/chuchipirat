# chuchipirat

<p align="center">
  <img src="public/images/logo/logo_gray.svg" alt="chuchipirat Logo" width="200">
</p>

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE.MD)

Der chuchipirat ist eine kostenlose Open-Source-Web-Applikation, die Freiwillige in Schweizer Jugendverbänden (Pfadi, Jungwacht Blauring etc.) in der Planung, Durchführung und Nachbearbeitung von Lagerküchen unterstützt. Das Kochen in grossen Mengen in einem Lager oder Kurs ist gerade in der Vorbereitung aufwendig und erfordert spezifische Kenntnisse, damit nicht nur schmackhaftes, sondern auch Essen in passender Menge serviert werden kann. Genau hier unterstützt dich der chuchipirat.

Lege einen Anlass an, wähle aus den bestehenden Rezepten (oder lege ein neues an) und plane dieses ein. Definiere für wie viele Portionen du zubereiten möchtest und überlasse die Skalierung dem chuchipirat. Kurz vor dem Anlass kannst du automatisiert die Einkaufsliste generieren oder die verwendeten Rezepte (in der richtigen Skalierung) ausdrucken. Wie du mit dem chuchipirat arbeiten kannst, ist im [Helpcenter](https://help.chuchipirat.ch/) beschrieben.

Willst du als Entwickler\*in am chuchipirat mitarbeiten? Hier findest du alle nötigen Informationen, um das Projekt bei dir zum Laufen zu bringen.

## Features

- Rezepte suchen und neue erstellen
- Skalieren von Rezepten auf die gewünschte Gruppengrösse
- Menüplan erstellen und Rezepte zuordnen
- Erstellen von Gruppen und deren Ernährungsform
- Automatisches Erstellen einer Einkaufsliste anhand der geplanten Rezepte
- Automatisches Erstellen einer Materialliste anhand der geplanten Rezepte
- Automatische Neuberechnung der Portionen bei einer Anpassung der hinterlegten Gruppe
- Export des Menüplans, der Rezepte und der Listen als PDF (offline-Fall)

## Technologie-Stack

| Bereich                 | Technologie                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Frontend**            | [React](https://react.dev/) 18, [TypeScript](https://www.typescriptlang.org/), [Material UI](https://mui.com/) 7   |
| **Backend / Datenbank** | [Supabase](https://supabase.com/) (PostgreSQL, Auth\*, Edge Functions, Storage)                                    |
| **Build-Tool**          | [Vite](https://vite.dev/)                                                                                          |
| **Tests**               | [Jest](https://jestjs.io/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) |
| **PDF-Export**          | [@react-pdf/renderer](https://react-pdf.org/)                                                                      |
| **Fehler-Tracking**     | [Sentry](https://sentry.io)                                                                                        |
| **Analytics**           | [Umami](https://umami.is/)                                                                                         |

> \* Authentifizierung läuft aktuell noch über Firebase Auth und wird schrittweise auf Supabase Auth migriert.

## Voraussetzungen

Stelle sicher, dass folgende Software auf deinem Rechner installiert ist:

- **Node.js** 20 (siehe `.nvmrc`) — empfohlen via [nvm](https://github.com/nvm-sh/nvm)
- **npm** (wird mit Node.js mitgeliefert)
- **Docker** — wird für die lokale Supabase-Instanz benötigt
- **Supabase CLI** — [Installationsanleitung](https://supabase.com/docs/guides/cli/getting-started)
- **Firebase-Projekt** — wird für die Authentifizierung benötigt (während der Migration)

## Installation

1. **Repository forken und klonen**

   ```bash
   git clone https://github.com/<dein-username>/chuchipirat.git
   cd chuchipirat
   ```

2. **Node-Version setzen** (falls nvm installiert)

   ```bash
   nvm use
   ```

3. **Abhängigkeiten installieren**

   ```bash
   npm install
   ```

4. **Umgebungsvariablen einrichten**

   ```bash
   cp .env.example .env.development
   ```

   Öffne `.env.development` und trage die Werte ein. Die Variablen sind in folgende Kategorien unterteilt:

   | Kategorie | Prefix / Variablen | Beschreibung                                    |
   | --------- | ------------------ | ----------------------------------------------- |
   | Umgebung  | `VITE_ENVIRONMENT` | `DEV`, `TST` oder `PRD`                         |
   | Firebase  | `VITE_FIREBASE_*`  | API-Key, Auth-Domain etc. für Authentifizierung |
   | Supabase  | `VITE_SUPABASE_*`  | URL, Anon-Key und Service-Role-Key              |
   | Sentry    | `VITE_SENTRY_DSN`  | DSN für Fehler-Tracking                         |
   | Umami     | `VITE_UMAMI_*`     | Host und Website-ID für Analytics               |

5. **Supabase lokal starten**

   ```bash
   supabase start
   ```

   Dies startet eine lokale Supabase-Instanz via Docker (Postgres, Auth, Storage, etc.). Die Verbindungsdaten werden in der Konsole ausgegeben — trage diese in `.env.development` ein.

6. **Entwicklungsserver starten**

   ```bash
   npm start
   ```

   Die App ist dann unter [http://localhost:5173](http://localhost:5173) erreichbar.

## Projektstruktur

```
chuchipirat/
├── public/                     # Statische Dateien (favicon, Bilder)
├── src/
│   ├── components/             # React-Komponenten nach Feature-Ordner
│   │   ├── Admin/              #   Admin-Bereich
│   │   ├── Event/              #   Anlass (Lager/Kurs)
│   │   ├── Recipe/             #   Rezepte
│   │   ├── Product/            #   Produkte (Stammdaten)
│   │   ├── Material/           #   Material (Stammdaten)
│   │   ├── Unit/               #   Einheiten (Stammdaten)
│   │   ├── Shared/             #   Geteilte UI-Komponenten
│   │   ├── Navigation/         #   Navigation und Routing
│   │   ├── App/                #   App-Root und Providers
│   │   └── ...                 #   Weitere Feature-Ordner
│   ├── constants/              # Konstanten, Routen, Styles, Enums
│   ├── hooks/                  # Custom React Hooks
│   └── __mocks__/              # Jest-Mocks
├── supabase/
│   ├── migrations/             # SQL-Migrationsdateien (Postgres)
│   ├── volumes/functions/      # Supabase Edge Functions
│   ├── config.toml             # Supabase-Konfiguration
│   └── docker-compose.yml      # Docker-Setup für lokale Instanz
├── functions/                  # Firebase Cloud Functions (Legacy)
├── .env.example                # Vorlage für Umgebungsvariablen
├── vite.config.ts              # Vite-Konfiguration
├── tsconfig.json               # TypeScript-Konfiguration
├── jest.config.json            # Jest-Konfiguration
└── package.json                # Abhängigkeiten und Scripts
```

## Verfügbare Scripts

| Befehl                  | Beschreibung                                  |
| ----------------------- | --------------------------------------------- |
| `npm start`             | Startet den Vite-Entwicklungsserver           |
| `npm run build`         | Erstellt einen Production-Build               |
| `npm run build:dev`     | Build für die DEV-Umgebung                    |
| `npm run build:test`    | Build für die TEST-Umgebung                   |
| `npm run build:prod`    | Build für die PROD-Umgebung                   |
| `npm run preview`       | Vorschau des Production-Builds                |
| `npm run test`          | Startet Jest im Watch-Modus mit Coverage      |
| `npm run test:coverage` | Einmaliger Test-Durchlauf mit Coverage-Report |
| `npm run lint`          | ESLint über alle TypeScript-Dateien           |
| `npm run analyze`       | Bundle-Analyse mit source-map-explorer        |

## Mitwirken

Wir freuen uns über jede Art von Mitwirkung! So gehst du vor:

1. **Forke** das Repository
2. **Erstelle einen Branch** mit passendem Prefix:
   - `feature/` — neue Funktionalität
   - `fix/` — Bugfix
   - `refactor/` — Code-Verbesserung ohne Verhaltensänderung
3. **Commite** mit [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: Neue Filterfunktion für Rezepte
   fix: Portionenberechnung bei leeren Gruppen
   refactor: Repository-Pattern für Produkte
   ```
4. **Schreibe oder aktualisiere Tests** für deine Änderungen
5. **Stelle sicher**, dass Lint und Tests durchlaufen:
   ```bash
   npm run lint && npm run test
   ```
6. **Pushe** deinen Branch und erstelle einen **Pull-Request**

### Code-Style

- **TypeScript strict mode** — kein `any`, stattdessen `unknown` und Type-Narrowing
- **Material UI** als einziges UI-Framework
- **JSDoc/TSDoc** auf allen öffentlichen Funktionen — auf Deutsch
- **Beschreibende Variablennamen** — keine Einzelbuchstaben (auch nicht in Lambdas)
- **Named Exports** — keine Default-Exports

## Tests

Tests befinden sich jeweils in einem `__tests__/`-Ordner innerhalb des zugehörigen Feature-Ordners:

```
src/components/Recipe/__tests__/Recipe.test.ts
src/constants/__tests__/actions.test.ts
```

Tests ausführen:

```bash
npm run test                         # Watch-Modus
npm run test -- --filter "RecipeName" # Einzelner Test
```

## Genutzte Pakete

Vielen Dank für die grossartige Software:

- [Material UI](https://mui.com/) — UI-Komponenten
- [Supabase](https://supabase.com/) — Backend und Datenbank
- [React PDF](https://react-pdf.org/) — PDF-Export
- [Fuse.js](https://www.fusejs.io/) — Fuzzy-Search
- [date-fns](https://date-fns.org/) — Datums-Utilities
- [lodash](https://lodash.com/) — Utility-Funktionen
- [pragmatic-drag-and-drop](https://atlassian.design/components/pragmatic-drag-and-drop/) — Drag & Drop
- [React Quill](https://github.com/zenoamaro/react-quill) — Rich-Text-Editor
- [Sentry](https://sentry.io) — Fehler-Tracking
- [zxcvbn](https://github.com/dropbox/zxcvbn) — Passwort-Stärke-Analyse

## Lizenz

Dieses Projekt ist lizenziert unter der GNU Affero General Public License v3.0.
Du findest den vollständigen Lizenztext in der Datei [LICENSE](./LICENSE.MD).
