# Sentry-Bugfix-Workflow

Anleitung für eine Sitzung, in der mehrere Sentry-Issues nacheinander abgearbeitet werden (typisch: der Nutzer nennt eine Issue-ID wie `CHUCHIPIRAT-XX`, wir untersuchen, fixen, verifizieren, committen — und weiter zur nächsten). Für den Branch/PR-Rahmen einer solchen Sitzung siehe `git-workflow.md` → „Release-Batch".

## 1. Issue abrufen

- Einmal pro Sitzung: `find_organizations()` für den Org-Slug (aktuell `chuchipirat`).
- Pro Issue: `get_sentry_resource(resourceType: "issue", organizationSlug, resourceId: "CHUCHIPIRAT-XX")`.
- Bei einem Performance-/AI-detected-Issue ohne Code-Location hilft `get_sentry_resource(resourceType: "trace", ...)` mit der `trace_id` — zeigt die Span-Übersicht (welche Requests/Long-Tasks tatsächlich liefen).
- `Seer Actionability` und `Users Impacted` als erste Einschätzung nutzen: `super_low` + 0 Nutzer:innen + 1 Occurrence ist oft Rauschen oder Umgebungslärm, kein Fixbedarf.

## 2. Triage — welche Art von Issue ist das?

**a) Erwarteter, selbstheilender Fehler wird fälschlich gemeldet (häufigster Fall)**
Erkennbar an: `message` ist `"JWT expired"`, oder ein Objekt mit `code/details/hint/message`, wobei `details` eine Stacktrace-Zeile enthält (`xhe@https://.../index-*.js:...`) und `message` `"[Filtered]"` oder `"TypeError: Failed to fetch"`/`"Load failed"` zeigt — das ist `postgrest-js`s eigener Wrapper für einen fehlgeschlagenen `fetch()`-Aufruf, kein echter DB-Fehler.
→ Prüfen: nutzt die Catch-Stelle bereits `isTransientNetworkError`/`isMissingSessionError`/`toError` aus `src/utils/errorUtils.ts`? Falls nicht: Guard ergänzen (siehe Beispiele dort — bereits an >10 Stellen im Code etabliert).
→ **Wichtig:** dasselbe Muster tritt oft mehrfach im selben File auf (mehrere `useEffect`/Catch-Blöcke). Immer das ganze File nach `Sentry.captureException` durchsuchen, nicht nur die eine gemeldete Zeile fixen.
→ Manchmal gibt es einen zentralen Reducer-Fall (`GENERIC_ERROR` o.ä.), durch den alle `dispatch()`-Aufrufe eines Files laufen — dort EINMAL fixen statt an jeder Dispatch-Stelle.

**b) Rauschen von Drittanbietern (Browser-Extension, fremde Domain)**
Erkennbar an: Stacktrace komplett ausserhalb von `src/`/`node_modules` unserer eigenen Deps (z.B. `PayPal Honey.app`, `chrome-extension://`), oder ein Performance-Issue zu einer Domain, die im Code nirgends vorkommt (z.B. "Firebase API" obwohl kein Firebase-Package mehr installiert ist — vorher mit `grep` verifizieren!).
→ Kein Code-Fix. Filterung in `src/index.jsx`:

- Fehler-Events: `ignoreErrors` (Message-Pattern) oder `denyUrls` (Herkunfts-URL, robuster als Message-Matching, da jede Extension eigene Texte wirft).
- Performance-Spans: `Sentry.browserTracingIntegration({shouldCreateSpanForRequest})` — nur Spans für unsere eigenen Domains erzeugen.

**c) Echter Bug — „stale reference"-Muster**
Ein Objekt (Diät, Mahlzeit, Menü …) wurde aus seiner Sammlung gelöscht, aber eine andere Stelle hält noch eine ältere UID-Referenz darauf (z.B. eine Einkaufsliste mit `selectedMeals`-Snapshot, ein Menüplan-Eintrag mit `diet`-UID). Der Lookup (`collection.entries[uid]` oder `collection[uid]`) liefert `undefined`, der nächste Property-Zugriff crasht.
→ Fix: Lookup defensiv machen (Optional Chaining, `?.`, ggf. Fallback-Text wie "Diät gelöscht"), nicht die aufrufende Stelle. Nach Sibling-Funktionen in derselben Datei suchen — oft existiert das Guard-Muster dort schon (z.B. `Object.values(...).find(...)` statt direktem Index-Zugriff), einfach übernehmen.
→ Prüfen, ob dieselbe Helper-Funktion von mehreren Features genutzt wird (`grep -rn "functionName("`) — ein Fix an der gemeinsamen Stelle behebt oft 5-10 Call-Sites gleichzeitig.

**d) Echter Bug — Concurrency-Race in einer RPC-Funktion**
Erkennbar an: `duplicate key value violates unique constraint` (23505) in einer Postgres-Funktion, die nach dem Muster „DELETE ALL + INSERT" arbeitet (Full-Replace-Save), obwohl clientseitiges Deduplizieren bereits existiert. Wenn ein Dedup-Fix bereits deployed war und der Fehler trotzdem erneut auftritt: mit hoher Wahrscheinlichkeit zwei echte, unabhängige gleichzeitige Aufrufe (mehrere Köch:innen/Tabs), kein Dateninkonsistenz-Problem.
→ Vor dem Schreiben einer neuen Lösung: `grep -rn "pg_advisory" supabase/migrations/` — falls eine Schwester-RPC-Funktion (z.B. `save_shopping_list_items`) dasselbe Muster hat, `pg_advisory_xact_lock(hashtext(p_id))` exakt übernehmen. Lock ist transaktionsgebunden (auto-release bei COMMIT/ROLLBACK), pro betroffener ID — keine Auswirkung auf andere Datensätze.
→ Siehe `database-and-supabase.md` für die Migrations-Konventionen.

**e) Reale, aber nicht behebbare Umgebungs-Bedingung**
0 Nutzer:innen betroffen, 1 Occurrence, Trace zeigt z.B. eine 1.3s-DNS-Auflösung oder ein 4.8s-Skript-Download — das ist eine langsame Nutzer-Verbindung, kein Code-Bug. Nicht fixen; beim Nutzer nachfragen, ob das Issue in Sentry ignoriert/resolved werden soll.

**f) Architektur-Problem mit unverhältnismässigem Fix-Risiko**
Z.B. „Hauptthread blockiert beim Laden der Event-Seite" — Ursache ist oft ein grösseres Strukturproblem (fehlende Memoisierung in einer 2000+-Zeilen-Datei). Wenn Risiko/Aufwand eines sofortigen Fixes nicht zum Impact passt (wenige Nutzer:innen, keine Regression): Analyse + konkrete Fix-Empfehlung in `tech-debt.md` dokumentieren, mit dem Nutzer die Entscheidung „jetzt fixen vs. zurückstellen" explizit klären (`AskUserQuestion`), nicht eigenmächtig entscheiden.

## 3. Fix-Umfang

- Immer prüfen, ob dieselbe Ursache **mehrfach im selben File** oder in **Schwester-Dateien mit derselben Helper-Funktion** auftritt — dann alle Stellen in einem Commit fixen, nicht nur die von Sentry gemeldete Zeile.
- Minimal-invasiv: bestehende Utility-Funktionen (`errorUtils.ts`, `SupabaseMessageHandler`) und bestehende Muster (Guard-Klauseln in Sibling-Funktionen) wiederverwenden statt neue Abstraktionen einzuführen.
- Wenn der Fix eine echte UX-Lücke aufdeckt (z.B. „Fehler wird nicht mehr gemeldet, aber der Nutzer sieht trotzdem eine unklare rohe Meldung ohne nächsten Schritt"): das offen ansprechen und fragen, ob das im gleichen Zug mitgefixt werden soll (siehe `ERROR_SESSION_EXPIRED` + `AlertMessage`-Reload-Button als Beispiel).

## 4. Verifikation pro Fix

1. `npx tsc --noEmit -p .` (kein `npm run typecheck`-Script vorhanden — direkt `tsc` nutzen)
2. `npx eslint --ext .ts,.tsx <geänderte Dateien>`
3. Bestehenden Test der betroffenen Datei/Funktion finden und um einen Regressionstest erweitern, der die **exakte Sentry-Fehlerform** reproduziert (z.B. `{code: "PGRST303", message: "JWT expired"}` statt nur `new Error(...)`) — sonst testet man nicht das, was in Produktion tatsächlich ankam.
4. Betroffene Konsumenten-Testsuiten mitlaufen lassen (z.B. bei einem Fix in einer gemeinsam genutzten Repository-Methode: alle Features, die sie aufrufen).
5. Bei einer DB-Migration: siehe `reference_local_migration_verify.md` (Memory) bzw. unten „Lokale Supabase-Verifikation".

## 5. Commit-Konvention

- **Ein Commit pro behobenem Issue.** Nicht mehrere Sentry-Issues in einen Commit bündeln, auch wenn sie im selben File liegen.
- Commit-Message erklärt die **Ursache**, nicht nur die Änderung — sonst ist der Commit in 6 Monaten nicht mehr nachvollziehbar.
- Letzte Zeile: `Fixes CHUCHIPIRAT-XX` — schliesst das Issue in Sentry automatisch, sobald der Commit gemerged ist.
- Wird ein Issue bewusst NICHT gefixt (Fall e/f oben): kein „Fixes"-Trailer, stattdessen Analyse in `tech-debt.md` und beim Nutzer nachfragen, ob das Issue in Sentry resolved/ignored werden soll (nicht eigenmächtig über die Sentry-API ändern).

## 6. Lokale Supabase-Verifikation (bei DB-Migrationen)

- `supabase db reset` ist über die CLI aktuell blockiert (siehe Memory `reference_local_migration_verify`) — Migration statt dessen direkt gegen den laufenden `supabase-db-test`-Container anwenden.
- **Wichtig:** als `supabase_admin` verbinden, nicht als `postgres` — `postgres` ist in diesem Setup kein Superuser und scheitert an Owner-geschützten Funktionen (`must be owner of function ...`).
  ```bash
  docker exec -i supabase-db-test psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f migration.sql
  ```
- Vor dem echten Anwenden: in `BEGIN; ... ROLLBACK;` testen, um Syntax/Semantik gegen das reale Schema zu prüfen, ohne den Zustand zu verändern.
- Die lokal laufenden Container heissen `*-test` (z.B. `supabase-db-test`), sind aber tatsächlich das, worauf `.env.development` (`http://localhost:8000`) zeigt — das ist die **lokale Dev-Datenbank**, keine separate Remote-TEST-Umgebung. Die echte TEST-Umgebung (`api-test.chuchipirat.ch`) läuft auf einem Server und wird ausschliesslich über den `Deploy TEST`-GitHub-Actions-Workflow (Trigger: Push auf `develop`) aktualisiert — dort gibt es keinen direkten Zugriff.
- Bei einer Lock-Serialisierung (`pg_advisory_xact_lock`): mit zwei parallelen `psql`-Sessions verifizieren, dass die zweite Session tatsächlich blockiert, bis die erste committet (siehe Beispiel-Kommandos in der Session-History bzw. bei Bedarf neu aufbauen).

## 7. Jest-Fallstricke, die in diesem Projekt aufgetreten sind

- `window.location` und `window.location.reload` sind in der aktuellen jsdom-Version **nicht konfigurierbar** — weder `Object.defineProperty` noch `jest.spyOn` können sie mocken. Für einen Klick-Test auf einen Reload-Button: nur die Anzeige-Logik testen (Button erscheint/erscheint nicht), den tatsächlichen `reload()`-Aufruf nicht testen.
- `document.visibilityState` **ist** konfigurierbar (`Object.defineProperty(document, "visibilityState", {configurable: true, value: "visible"})`) — für Tests von `visibilitychange`-Listenern nutzbar.
- `@react-pdf/renderer` ist ESM-only und bricht Jest, sobald es transitiv importiert wird (betrifft alles, was `event.tsx`, `recipe.view.tsx` oder `menuplan.tsx` importiert, da diese PDF-Export-Features einbinden). Nicht jede Zwischendatei einzeln mocken — direkt `jest.mock("@react-pdf/renderer", () => ({...Dummy-Exports}))` an der Quelle.
- `jest.clearAllMocks()` setzt **nur** die Aufruf-Historie zurück, nicht `mockImplementation`/`mockResolvedValue`. Eine `.mockImplementation()` aus einem früheren Test kann in nachfolgende Tests derselben Datei durchsickern, wenn sie nicht explizit in `beforeEach` zurückgesetzt wird.
- Manche `useDatabase`-Mocks in bestehenden Testdateien geben ein hartkodiertes `{}` zurück und ignorieren den Wert aus `DatabaseContext.Provider` komplett — vor dem Schreiben neuer Tests gegen echte Repository-Methoden prüfen, ob der Mock das tatsächlich durchreicht.

## 8. Release Notes

Nach Abschluss eines Release-Batches: siehe `release-notes.md` für Format und Umfang der Helpcenter-Notizen.
