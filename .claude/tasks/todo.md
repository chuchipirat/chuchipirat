# Rezeptliste seitenweise (Branch `feature/recipe-list-paging`)

Plan: `~/.claude/plans/i-need-a-new-refactored-cascade.md`

- [x] Migration `20260920000001_recipe_list_search.sql`: `unaccent`, Trigram-Index, RPC `list_recipe_shorts()` (Sichtbarkeit, Filter, Suche, Keyset, Gesamtzahl auf Seite 1)
- [x] Repository `listRecipeShorts()` / `getPublicRecipeNames()`, Hook `useRecipeList`, Cache, Hilfsfunktionen
- [x] Rezeptseite und Menüplan-Schublade umgebaut, `recipeList` aus dem Event-State entfernt, Duplikat-Prüfung schlank
- [x] Tests (Utils, Cache, Hook, RecipeSearch/RecipesPage, Repository), SQL 44 Fälle, Mutationschecks
- [x] Browser-Prüfung lokal (Brave, Claude-Erweiterung) mit 570 temporären Rezepten: siehe Review
- [ ] Prüfung auf TEST nach dem Merge nach `develop`, Handy mit gedrosselter Verbindung (Slow 3G)
- [ ] `Content-Encoding` der API-Antwort in PROD prüfen (DevTools), siehe Tech-Debt
- [ ] Release-Version entscheiden (2.0.6 oder eigenes Release), Release-Note-Text schreiben

## Review

- Browser (lokal, 599 sichtbare Rezepte): Seite lädt mit **einer** Anfrage (`list_recipe_shorts`), 24 Karten, «599 Rezepte» exakt; Scrollen lädt 24 → 48 → 72 → 96 nach; Suche «hornli» findet «Hörnli» («58+» sofort, «58» nach der DB-Antwort, entspricht SQL); Filter Vegan 201, ohne Gluten 493, nur meine 145 (alle wie SQL); Zurück aus einem Rezept stellt Suche, 57 Karten und Scroll 3000 wieder her, ohne neue Anfrage; Schublade lädt erst beim Öffnen, Anlass Pfila zeigt 606 (599 + 7 Varianten), Filter «Variante» 7, Suche «counter» findet die Variante über den Variantennamen; FAB öffnet den Menü-Dialog; Mobil (420 px) einspaltig, Nachladen funktioniert.
- **Testumgebung:** Der Automations-Tab war `hidden` (Browser pausiert `requestAnimationFrame` und Beobachter). Für die Scroll-Wiederherstellung wurde `requestAnimationFrame` im Test per JS ersetzt, sonst nichts.
- **Nicht im Browser geprüft:** Fehlerzustand/«Erneut versuchen» (nur Unit-Tests), Rezept in der Schublade anlegen (Reload-Zähler, nur Unit-Test), langsame Verbindung (kein Throttling-Werkzeug), Firefox/Safari.
- Gefunden: `OPTIONS`-Preflight vor jeder Anfrage (kein `Access-Control-Max-Age`), siehe Tech-Debt.
- Messung lokal (570 Rezepte): alt 2 Anfragen / 272 KB roh (23 KB gzip), neu 1 Anfrage / 13 KB für die ersten 24 Karten.

---

# Datenintegrität: Events löschbar, Events ohne Köch:innen, Admin-Guards (Branch `feature/data-integrity-events`)

Plan: `~/.claude/plans/i-need-a-new-refactored-cascade.md`

- [x] Migration `20260919000001_data_integrity_events.sql`: Helfer `event_integrity_details()`, `check_events_without_cooks()`, `cleanup_events_without_dates/-cooks()`, Admin-Guard für alle sechs ungeschützten `check_*`
- [x] Seite: Inhalt pro Anlass, Einzellöschen (`only_empty=false`), «N leere löschen», «Nicht gelöscht»-Meldung, Fehler wird zurückgesetzt
- [x] Tests: `dataIntegrityUtils`, Seite (11 Fälle), SQL-Transaktionstest (28 Fälle) mit Rollback; Mutationscheck `isEmptyEvent`/`only_empty`
- [x] Helpcenter: `data_integrity.md` neu geschrieben (war veraltet), Release-Notes-Eintrag (uncommittet)
- [x] Migration `20260919000002_data_integrity_recipe_references.sql`: `check_recipe_ingredients_without_product()`, `check_recipe_materials_without_material()` (eine Zeile pro Rezept, nur Anzeige)
- [x] Seite: zwei neue Prüfungen, Zeilenaktion «Rezept öffnen» (kein Detail-Dialog: nur lesend, sein Löschen gehört zu «Rezepte ohne Event»)
- [x] Tech-Debt: Anlass atomar anlegen (konkrete Lösung), Löschen verwendeter Produkte, Editor speichert Zutaten ohne Produkt
- [ ] Manuelle Browser-Prüfung Desktop + Mobile (Chrome-Extension war nicht verbunden)
- [ ] Nach dem PROD-Deploy: Prüfung «Events ohne Zeitscheiben» **nur lesend** starten, Inhalt der Anlässe ansehen, dann löschen

## Review

- SQL lokal (`supabase-db-test`, als `supabase_admin` wie im Deploy-Workflow) in Rollback-Transaktion geprüft: Inhalt/`is_empty` korrekt, Bulk löscht nur leere, Einzellöschen auch mit Inhalt, Anlass mit inzwischen ergänzter Zeitscheibe wird nicht gelöscht, Kaskade vollständig, Spende bleibt mit `event_id = NULL`, alle 15 Funktionen lehnen Nicht-Admins ab, Helfer nicht direkt aufrufbar.
- Regression: alle neun Prüfungen liefern für Admins vor/nach der Migration identische Ergebnisse (Vergleich der Ausgabe).
- Beim Testen gefundener eigener Fehler: «Nicht gelöscht»-Meldung wurde vom anschliessenden `CHECK_START` überschrieben. Behoben (erst neu prüfen, dann melden), Test deckt es ab.
- Migration muss als `supabase_admin` laufen (Besitzer der `check_*`-Funktionen; `postgres` darf sie nicht ersetzen), der Deploy-Workflow tut das bereits.
- Rezept-Prüfungen: SQL in Rollback-Transaktion (13 Fälle, inkl. Ursache nachgestellt: Produkt in Rezept verwenden, löschen → Zutat erscheint), Abschnittszeilen ohne Produkt werden nicht gemeldet. Lokal: 1 Zutat, 5 Materialien in 5 Rezepten, alle vom 23.04.2026 (Datenmigration).
- Beim Prüfen gefunden: Der Editor speichert Zutaten mit Menge ohne Produkt (`deleteEmptyIngredients`), «ohne Produkt» heisst also nicht zwingend «Produkt gelöscht» (Prüfung deshalb neutral benannt). Private Rezepte kann laut `recipe.view.tsx` nur der Ersteller bearbeiten, die Zeile weist darauf hin.
- Nachgewiesen (Rollback-Transaktion): Produkt in Einkaufslisten-Position lässt sich nicht löschen (`chk_item_source`), Produkt nur in Rezept schon. Einkaufslisten-`TypeError` ist nur per Code-Lektüre belegt (`addTraceEntry`, nicht ausgeführt).
- Tech-Debt: nicht atomares Anlegen von Anlässen (Ursache der Waisen), Storage-/Feed-Waisen beim Löschen, `check_duplicate_emails` liefert `NULL`.

---

# Track A — Einkaufs-/Materialliste: stabile Row-IDs + Diff-Persistenz

Branch: `refactor/shopping-list-surgical-writes` von `develop`
Plan: `~/.claude/plans/linked-tinkering-pelican.md`

## Commits (alle erledigt)

- [x] 1. Migration `20260907000001_list_surgical_writes.sql` (2 Diff-RPCs) + Concurrency-Skript
- [x] 2-3. Domain: `id` auf ShoppingListItem/MaterialListMaterial, Mint-Stellen, `carryOverItemIds`, `refreshList`-Wiring + Adapter emittieren/tragen `id` (+ Tests)
- [x] 4-5. Repos: `saveListItems(…, knownIds)` → RPC; toter Shopping-`updateItem` weg; `getPersistedItemIds`-Plumbing (event.tsx-Refs → Prop → Hook-Ref)
- [x] 6. Einkaufsliste: `shoppingListItemKey`→id, Empty-Snapshot-Guard raus, `shoppingList.tsx` Keys→id
- [x] 7. Materialliste: `subscribeToItemsForLists` (alle Listen, ein Kanal), `materialList.tsx` Subscription + Keys→id
- [x] 8. `moveItemToDepartment` über `item.id` filtern

## Verifikation

- [x] tsc clean, lint 0 Fehler, **2163 Tests grün** (188 Suites)
- [x] Migration + beide RPCs gegen `-test`-DB angewendet
- [x] Concurrency-Skript: No-op-Guard (0 Writes bei identischem Payload),
      Feld-Update schreibt nur die geänderte Zeile, Koch-B-Add überlebt
      Koch-A-Save, Diff-Delete, RLS-Verletzung. Material-RPC analog geprüft.
- [ ] Manueller Zwei-Tab-Test (in PR-Beschreibung, vom User)
- [ ] PR gegen `develop` — Merge-Hazard mit Track B (`20260906000002`) dokumentieren

## Review

Alle 8 Schritte umgesetzt. Kernpunkte:

- **Stabile client-`id`** (`crypto.randomUUID()`) auf jedem Item ab Geburt.
  `carryOverItemIds` verhindert, dass eine Neuberechnung alle Zeilen austauscht.
- **Diff-RPCs** `save_shopping_list_items` / `save_material_list_items`
  `(p_list_id, p_items, p_known_ids)`: Advisory Lock + Transaktion, löscht nur
  `known_ids`, die jetzt fehlen (Fremd-Adds überleben), `ON CONFLICT DO UPDATE
  … WHERE row-is-distinct` → unveränderte Zeilen = kein Write, kein Echo.
- **`knownIds`** aus `shoppingListRef` / neuem `materialListRef` (nur DB-Stand)
  via `getPersistedItemIds`-Prop; im Hook synchron nachgeführt.
- **Realtime** difft/keyt über `item.id`; Freitext-`item.item.uid` ist dadurch
  ebenfalls stabil → laufende Mengeneingaben überleben Fremd-Echos.
- **Materialliste**: item-level Realtime jetzt über alle angezeigten Listen.
- `moveItemToDepartment`-unit-Bug mitgefixt.

**Nicht angefasst** (Track-B-Cleanup, `createList`→RPC, Debounce) — siehe Plan
„Out of scope".

## Nachtrag — DEV-Test-Regressionen (Commit 3f0feab)

- **Fokusverlust** Mengenfeld Vorlagen-Zeile + Tab: neues Item übernahm eine
  frische UUID statt der Vorlagen-ID → ListItem-`key` änderte sich → Remount.
  Fix: `onChangeItem` übernimmt `field[2]`; `shoppingList.tsx` /
  `materialList.tsx` vergeben die Vorlagen-ID deterministisch und rotieren sie
  bei Kollision (globale ID-Prüfung).
- **Abteilungs-Duplikat** (Artikel landet in Quell- *und* Ziel-Abteilung):
  `itemAutocomplete`-`inputValue`-Reset hing an der pro Render neuen
  `item`-Objektreferenz → Doppel-Verarbeitungs-Schutz in `onBlur` wirkungslos.
  Fix: Reset hängt am reinen Namen. Zusätzlich Cross-Abteilungs-Dedup in
  `shoppingListToInsertRows` als Sicherheitsnetz + Single-Flight in
  `persistListItems`.
- [ ] Manuelle DEV-Verifikation durch User ausstehend.

---

# Mail-Konsole: Abmelde-Footer wählbar, Titel optional (Branch `feature/mailconsole-optional-footer`)

Plan: `~/.claude/plans/i-need-a-new-refactored-cascade.md`

- [x] Edge Function `send-mail`: `includeUnsubscribe`, leerer Titel → keine H1, Opt-out-Filter nur mit Footer aktiv (`_shared/mailConsoleOptions.ts`)
- [x] Schutzregel: ohne Footer nur für `email`/`uid`, Rolle → 400 (Server) und Checkbox gesperrt (UI)
- [x] Frontend: Checkbox, Warnhinweis, Vorschau, Entwurf (alte Entwürfe → Footer an), Titel nicht mehr Pflicht
- [x] Tests: `_shared`-Modul, `mailConsoleUtils`, `mailConsole` (Komponente); Mutationscheck der Rollen-Regel
- [x] Helpcenter: `mailconsole.md` + Release-Notes-Eintrag (nicht committet)
- [ ] Manuelle Browser-Prüfung Desktop + Mobile (Chrome-Extension war nicht verbunden)

## Review

- E2E lokal (`-test`-Stack, MailPit, lokal signierter Admin-JWT): Standard mit Footer + H1; ohne Footer + leerer Titel ohne beides;
  abgemeldeter Nutzer wird mit Footer gefiltert (400), ohne Footer erreicht (uid und email); Rolle ohne Footer → 400;
  `mail_log.details` enthält `includeUnsubscribe`/`optOutFilterSkipped`. Testdaten und Opt-out-Flag wurden zurückgesetzt.
- Ausgelassen: Der Client-Pfad (`supabase.functions.invoke` aus dem Browser) ist nur per Komponententest mit Mock geprüft.
- Helpcenter: `docs/admin/mailconsole.md` hatte kaputten Front matter (`:**` statt `---`, TOC fehlte) — mit repariert.
- Tech-Debt: doppelte `mail_log`-Zeilen pro Versand (Client + Edge Function).

---

# Deploy-Check-Seite (Branch `feature/deploy-readiness-page`)

Plan: `~/.claude/plans/i-need-a-new-refactored-cascade.md`

- [x] Migration `20260918000002_admin_deploy_readiness.sql` (`admin_get_running_events`, `admin_get_recent_activity`)
- [x] `AdminOperationsRepository`: `getRunningEvents()`, `getRecentActivity()` + Domain-Typen
- [x] Seite `Admin/DeployReadiness/deployReadiness.tsx` + `deployReadinessUtils.ts`
- [x] Route `SYSTEM_DEPLOY_READINESS`, `routeConfig` (Guard `isAdmin`), Kachel in `system.tsx`, Texte
- [x] Tests: Utils, Seite, Repository, System-Kachel (Admin sichtbar, CommunityLeader nicht)
- [ ] Manuelle Browser-Prüfung Desktop + Mobile (Chrome-Extension war nicht verbunden)

## Review

- SQL in Rollback-Transaktion gegen `supabase-db-test` geprüft: Admin sieht Daten,
  Nicht-Admin bekommt leere Ergebnisse; Zeitzonen-Grenze (Ende = heute → läuft,
  Ende = gestern → läuft nicht) korrekt. Migration danach real angewendet.
- Helpcenter-Mapping `admin/deploy_readiness` in `helpCenter.ts` + Test ergänzt.
  Die Hilfeseite selbst muss im Helpcenter-Projekt (help.chuchipirat.ch) noch
  angelegt werden — Quelle liegt nicht in diesem Repo.
- `npm run typecheck` existiert nicht (CLAUDE.md nennt es); stattdessen `npx tsc --noEmit`.
- Grenzen: Löschungen und reine Lesezugriffe sind nicht sichtbar.
