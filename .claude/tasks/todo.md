# Track B — Einkaufslisten-Save-Race Hotfix (fix/shopping-list-save-race → release/2.0.4)

Plan: ~/.claude/plans/linked-tinkering-pelican.md

## Tasks

- [x] B5: Migration `20260906000002_save_shopping_list_items_rpc.sql` (RPC + advisory lock)
- [x] B5: `ShoppingListRepository.saveListItems()` → RPC-Call
- [x] B1a: `persistListItems` — Save-Flag als Zähler, synchron (kein setTimeout(500))
- [x] B1a: Checkbox-Pfad ebenfalls auf Zähler + synchron
- [x] B2: `event.tsx` Realtime `onChange` — harte Early-Return bei `saveInProgress > 0`
- [x] B2: Empty-List-Heuristik entfernt (RPC ist atomar → kein transienter Leerzustand)
- [x] B3: Kontextmenü-Delete (`Action.DELETE`) persistiert jetzt
- [x] B4: `shoppingListItemsUnsubRef` + synchroner Teardown (+ Tab-Cleanup) + `break`
- [x] Tests: `ShoppingListRepository.test.ts` (RPC-Call, 4) + `useShoppingListHandlers.persist.test.tsx` (B1a/B3, 3)
- [x] Verify: tsc clean, eslint 0 errors, 832 Tests grün
- [x] Verify: Migration gegen -test-DB; Concurrency-Test (Session B blockiert 2.38s auf Advisory-Lock → 1 Zeile, kein Duplikat); RLS-Test (Nicht-Koch → RLS-Verletzung); Empty-Array → 0 Zeilen
- [ ] Commit + Push + PR gegen release/2.0.4

## Review

**Umgesetzt (Track B, minimal & wegwerf-frei):**

- **B5** ist der strukturelle Kern: `save_shopping_list_items(p_list_id, p_items jsonb)`
  RPC (Vorbild `save_menuplan`, kein SECURITY DEFINER → RLS greift automatisch),
  `pg_advisory_xact_lock(hashtext(p_list_id))` + DELETE + INSERT in einer TX.
  Gegen die laufende `-test`-DB verifiziert: parallele Aufrufe serialisieren
  (2.38s Wartezeit), Endstand genau 1 Zeile statt 2 → **Duplikate strukturell
  unmöglich**.
- **B1a/B2**: `saveInProgressRef` ist jetzt ein **Zähler** (überlappende Saves),
  synchron hoch/runter (kein `setTimeout(500)`-Hack mehr). Die Realtime-
  Subscription bricht bei `> 0` **komplett ab** (wie Material-Liste) statt nur
  das Highlighting zu unterdrücken → eigenes Echo überschreibt lokale Edits
  nicht mehr. Nach dem Save (Zähler 0) übernimmt das dann eintreffende Echo als
  regulärer Reconcile (inkl. paralleler Fremdänderungen).
- **B3**: Kontextmenü „Löschen" rief bisher keinerlei Repo-Methode auf → die
  Zeile blieb in der DB und kam per Echo zurück. Jetzt `persistListItems`.
- **B4**: Zweiter `fetchMissingData(SHOPPING_LIST)`-Aufruf im selben Tick baute
  am veralteten `state.shoppingList.unsubscribe` vorbei einen zweiten Channel
  auf. Jetzt synchroner Ref-basierter Teardown + Cleanup beim Tab-Wechsel.

**Bewusst NICHT in Track B:** Save-Coalescing (nur falls Lost-Update-Test es
zeigt), MaterialList-Härtung, Save-Fehler-UX, `state.shoppingList.unsubscribe`
als tote State (superseded durch Ref, Entfernung in Track A).

**Track A** (surgical writes mit stabilen IDs, `develop`) folgt als eigener Plan.
Muss zusätzlich in `tech-debt.md`.
