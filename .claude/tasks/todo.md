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
