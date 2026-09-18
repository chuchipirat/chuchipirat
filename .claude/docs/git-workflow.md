# Git & GitHub Workflow

## Branch-Strategie

| Branch      | Deploy-Ziel    | Direkter Commit?                                |
| ----------- | -------------- | ----------------------------------------------- |
| `main`      | **Production** | ❌ Nie                                          |
| `develop`   | **Test**       | ✅ Nur triviale Änderungen                      |
| `feature/*` | –              | ✅                                              |
| `fix/*`     | –              | ✅                                              |
| `release/*` | –              | ✅ Sammel-Branch für mehrere Fixes, siehe unten |
| `hotfix/*`  | –              | ✅                                              |
| `chore/*`   | –              | ✅                                              |
| `docs/*`    | –              | ✅                                              |

**Regel:** `main` ist heilig. Kein direkter Commit – ausnahmslos. Triviale Änderungen (Tippfehler, Config, Dependencies) dürfen direkt auf `develop`.

---

## Branch-Naming

```
<typ>/<kurze-beschreibung-mit-bindestrichen>
```

Beispiele: `feature/payrexx-donation-widget`, `fix/shopping-list-null-pointer`, `hotfix/payrexx-webhook-crash`, `chore/upgrade-supabase-sdk`

---

## Workflows

### Feature / Fix (Normalfall)

```
develop → feature/* oder fix/* → Commits → PR → develop
```

1. `git checkout -b feature/mein-feature` (von `develop`)
2. Entwickeln & committen
3. Pull Request auf `develop` öffnen
4. Merge → Branch löschen

### Release-Batch (mehrere Fixes gesammelt, z.B. Sentry-Aufräumsession)

Für ein Bündel mehrerer kleiner, unabhängiger Fixes, die gemeinsam versioniert, auf TEST validiert und erst danach nach PROD befördert werden sollen (z.B. eine Sitzung, in der 15-20 Sentry-Issues nacheinander behoben werden — siehe `sentry-bugfix-workflow.md`):

```
main → release/x.y.z (mehrere Fixes + Version-Bump) → PR → develop (TEST-Validierung) → [später] Release-Batch (PROD-Promotion) unten
```

1. `git checkout -b release/x.y.z` (von **`main`**, NICHT `develop`) — damit unfertige Feature-Arbeit auf `develop` den Release nicht verzögert oder verschmutzt
2. Jeden Fix einzeln committen (ein Commit pro behobenem Bug/Issue, mit Begründung im Body — nicht alles in einen Riesencommit)
3. Versions-Bump als letzten Commit: `npm version x.y.z --no-git-tag-version`, dann `package.json` + `package-lock.json` committen (`chore: Version auf x.y.z`)
4. `git push -u origin release/x.y.z`
5. PR von `release/x.y.z` nach `develop` öffnen (Titel: `Release/x.y.z`) → automatischer TEST-Deploy validiert den gesamten Batch auf einmal
6. Release Notes für den Helpcenter erstellen (siehe `release-notes.md`) — eigene, **nicht committete** Datei zum Copy-Paste
7. Nach erfolgreicher Validierung auf TEST: Release-Batch (PROD-Promotion) unten, um `develop` nach `main` zu befördern

Bei nur **einem** kleinen, ungeplanten Fix lohnt sich der Release-Branch nicht — dann normal `fix/*` direkt auf `develop` (siehe oben).

### Release-Batch (PROD-Promotion)

```
develop → PR → main → GitHub Release Tag → Deploy PROD
```

1. PR von `develop` nach `main` (Titel: `Release v1.x.0`)
2. Changelog im PR-Body
3. Nach Merge: GitHub Release mit Tag `v1.x.0` erstellen
4. Webhook triggert automatisch PROD-Deploy

### Hotfix (kritischer Bug in Production)

```
main → hotfix/* → Fix → PR → main → Sync → develop
```

1. `git checkout -b hotfix/beschreibung` (von **`main`**, nicht `develop`)
2. Fix committen & PR auf `main`
3. Nach Merge: `main` in `develop` mergen oder cherry-pick

---

## Versionierung (SemVer)

| Typ     | Wann                     | Beispiel |
| ------- | ------------------------ | -------- |
| `PATCH` | Bugfix, kleine Korrektur | `1.3.1`  |
| `MINOR` | Neues Feature            | `1.4.0`  |
| `MAJOR` | Breaking Change          | `2.0.0`  |

> Die Supabase-Migration (Firebase → Supabase) ist `v2.0.0`.

---

## Commit- & PR-Konventionen

Format: `<typ>: <kurze Beschreibung im Imperativ>`

| Präfix      | Wann                               |
| ----------- | ---------------------------------- |
| `feat:`     | Neues Feature                      |
| `fix:`      | Bugfix                             |
| `hotfix:`   | Kritischer Production-Fix          |
| `chore:`    | Wartung, kein funktionaler Impact  |
| `docs:`     | Dokumentation                      |
| `refactor:` | Code-Umbau ohne Verhaltensänderung |
| `test:`     | Tests hinzugefügt/angepasst        |

Beispiele:

```
feat: Payrexx Webhook Integration
fix: Shopping List Null Pointer bei leerem Event
chore: Supabase SDK auf v2.x aktualisiert
Release v1.4.0
```

PR-Beschreibung enthält mindestens: kurze Zusammenfassung + `Closes #<Issue-Nummer>`.

---

## GitHub Issues & Labels

**Typ:** `type: feature` · `type: bug` · `type: chore` · `type: docs` · `type: security` · `type: migration`

**Priorität:** `prio: critical` · `prio: high` · `prio: low`

**Milestones = Releases** — jeder geplante Release erhält einen Milestone (z.B. `v1.4.0`), Issues werden zugewiesen.

---

## Entscheidungsbaum

```
Was muss ich tun?
│
├── Triviale Änderung (Tippfehler, Config, Dependency)?
│   └── Direkt auf develop committen
│
├── Neues Feature oder ein einzelner geplanter Bugfix?
│   └── Branch feature/* oder fix/* von develop
│       └── PR auf develop
│           └── Release: PR develop → main + GitHub Release Tag
│
├── Mehrere unabhängige Fixes gesammelt (z.B. Sentry-Aufräumsession)?
│   └── Branch release/x.y.z von main (!)
│       └── Ein Commit pro Fix + Versions-Bump
│           └── PR auf develop (TEST-Validierung des ganzen Batches)
│               └── Release Notes erstellen (release-notes.md)
│                   └── Später: PR develop → main + GitHub Release Tag
│
└── Kritischer Bug in Production?
    └── Branch hotfix/* von main (!)
        └── PR auf main + Tag + Release
            └── Sync in develop
```
