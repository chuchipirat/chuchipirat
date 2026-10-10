---
name: helpcenter-page
description: Create or update a user-facing Helpcenter page (help.chuchipirat.ch) for a chuchipirat feature, including the in-app route mapping and test. Use when a feature or admin page needs documentation or an existing help page is outdated.
---

# Helpcenter-Seite anlegen oder aktualisieren

Das Helpcenter liegt in einem **eigenen Repo**: `~/Developer/chuchipirat-helpcenter` (Jekyll + Just the Docs, Push auf `main` = live).

## Regeln

- Im Helpcenter-Repo können uncommittete Arbeiten des Users liegen: nur Dateien anfassen, die du selbst änderst. **Nie committen oder pushen ohne Auftrag.**
- Vor dem Schreiben `~/Developer/chuchipirat-helpcenter/CLAUDE.md` lesen (Sprache, «du», Seitenaufbau, Callouts, Bildpfade, Links).

## Schritte

1. **Feature verstehen**: betroffene Komponenten und UI-Texte (`src/constants/text/*`) lesen, damit Begriffe und Buttonbeschriftungen auf der Seite exakt der App entsprechen.
2. **Bestehende Seite suchen**: `docs/<subdir>/` im Helpcenter-Repo; ähnliche Seite als Vorlage für Front matter und Aufbau nehmen.
3. **Seite schreiben**: `docs/<subdir>/<page>.md`, Aufbau gemäss Helpcenter-`CLAUDE.md` (Front matter, H1 + `{: .no_toc }`, Inhaltsverzeichnis, Einleitung, Schritte unter H2, Callouts, verwandte Seiten). Bilder nur als Platzhalter-Hinweis, falls keine Screenshots vorliegen.
4. **Mapping in der App**: in `src/components/Navigation/helpCenter.ts` (`getMatchingHelpPage`) die Route auf `subdirectory`/`page` abbilden. `page` muss exakt dem Dateinamen ohne `.md` entsprechen. Test in `src/components/Navigation/__tests__/helpCenter.test.ts` ergänzen.
5. **Admin-Seiten**: zusätzlich in `docs/admin/system.md` aufnehmen (Rechtetabelle + Link).
6. **Release Notes** (nur wenn verlangt): nach `.claude/docs/release-notes.md` in `docs/others/release_notes.md`.

## Prüfen

- App: `npx jest helpCenter --watchAll=false`
- Helpcenter: `cd ~/Developer/chuchipirat-helpcenter && bundle exec jekyll build --destination /tmp/chuchipirat-helpcenter-site` (nie ohne `--destination`, sonst landet der Build im iCloud-Ordner)
- Links mit `{% link ... %}` brechen den Build, wenn das Ziel fehlt: der Build ist deshalb die Link-Prüfung.

## Ergebnis

Geänderte Dateien in beiden Repos auflisten, getrennt nach Repo, mit dem Hinweis, dass im Helpcenter nichts committet wurde.
