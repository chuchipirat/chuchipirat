# Track A — Einkaufs-/Materialliste: stabile Row-IDs + Diff-Persistenz

Branch: `refactor/shopping-list-surgical-writes` von `develop`
Plan: `~/.claude/plans/linked-tinkering-pelican.md`

## Commits

- [ ] 1. Migration `20260907000001_list_surgical_writes.sql` (2 Diff-RPCs) + Concurrency-Skript
- [ ] 2. Domain: `id` auf `ShoppingListItem`/`MaterialListMaterial`, Mint-Stellen, `carryOverItemIds`, `refreshList`-Wiring (+ Tests)
- [ ] 3. Adapter emittieren/tragen `id` (+ Tests)
- [ ] 4. Repos: `saveListItems(…, knownIds)` → RPC; toten `updateItem` löschen (+ Tests)
- [ ] 5. `knownIds`-Plumbing: `getPersistedItemIds`-Prop + Hook-Ref (+ Handler-Tests)
- [ ] 6. Einkaufsliste: `event.tsx`/`shoppingList.tsx` Realtime- + Render-Keys, Empty-Snapshot-Guard raus
- [ ] 7. Materialliste: item-level Realtime + `materialList.tsx` Keys
- [ ] 8. (separat) `moveItemToDepartment`-unit-Fix

## Verify (fortlaufend + am Ende)

- [ ] tsc, lint, jest grün
- [ ] Concurrency-Skript gegen `-test`-DB (Koch-B-Add überlebt, No-op-Beweis, RLS)
- [ ] Manueller Zwei-Tab-Test
- [ ] PR gegen `develop` (Merge-Hazard mit Track B dokumentieren)

## Review

_(am Ende)_
