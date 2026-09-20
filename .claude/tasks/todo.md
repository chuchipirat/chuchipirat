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
