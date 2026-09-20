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
