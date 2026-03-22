# Tech Debt

This file tracks code that violates current conventions but is not urgent enough to fix immediately. Claude Code appends new entries here automatically when encountered during work. Items are grouped by category, with priority and complexity to help with planning.

**Priority:** hoch (every release), mittel (when area is touched), tief (when time allows)
**Complexity:** klein (< 30 min, isolated change), mittel (1–3h, multiple files), gross (half day+, cross-cutting, needs thorough testing)

---

## Enums

Numeric TypeScript enums that need conversion to string enums matching PostgreSQL ENUM labels. See `database-and-supabase.md` for the target convention.

- **`MaterialType`** in `src/components/Material/material.class.ts` / `MaterialRepository.ts` — Uses numeric values (`none = 0, consumable = 1, usage = 2`). Convert to string enum, delete `MATERIAL_TYPE_TO_DB` / `MATERIAL_TYPE_FROM_DB` lookup maps, simplify `toRow()` / `toDomain()` to direct pass-through. Update `MaterialRow.type` and `MaterialDomain.type` types.
  **Priorität:** mittel · **Komplexität:** mittel

- **`Allergen` + `Diet`** in `src/components/Product/product.class.ts` / `ProductRepository.ts` — Uses numeric values. Convert to string enums, delete lookup maps, simplify `toRow()` / `toDomain()`, update `ProductRow` and `ProductDomain` types. Note: `Allergen.None` was a sentinel for "empty array" — after conversion, rely on empty array instead.
  **Priorität:** mittel · **Komplexität:** mittel

- **`EventTabs`** in `src/components/Event/Event/event.tsx` — Uses implicit numeric values (`menuplan = 0, quantityCalculation = 1, …`). Convert to string enum per project conventions. Currently used as MUI `<Tabs>` value and in multiple `useEffect` comparisons.
  **Priorität:** tief · **Komplexität:** mittel

## Missing DB Functions

- **`increment_field` RPC** — `BaseRepository.increment()` calls `rpc("increment_field", {...})` but no migration creates this function. Any code path calling `BaseRepository.increment()` will fail at runtime. Create migration with allowlist guard (see `security-guidelines.md` for pattern). Add tables to allowlist as needed.
  **Priorität:** hoch · **Komplexität:** klein

## Security / Auth

- **Admin-client bypass in profile picture uploads** — `User.uploadPicture()` and `User.deletePicture()` in `user.class.ts` use `database.admin?.storage.users ?? database.storage.users`, bypassing Storage RLS. Switch to regular client (`database.storage.users`), verify authenticated user has active Supabase session, remove `database.admin?.storage` fallback.
  **Priorität:** mittel · **Komplexität:** klein

## Performance

- **Recipe loading: 5 parallel queries** — `recipe.tsx` and `recipe.edit.tsx` load a recipe via 4–5 separate parallel Supabase queries, plus a full products list just for name resolution. Refactor to use PostgREST embedded resources (single query with joins). Add `RecipeFullRow` interface, `getRecipeFull(id)` to `RecipeRepository`, `Recipe.fromFullRow()` factory method. Remove `getAllProducts()` workaround. See `database-and-supabase.md` for PostgREST embedded resource syntax.
  **Priorität:** mittel · **Komplexität:** gross

## Naming

- **`dialogDepartment.tsx`** — Verwendet `authUser`-Prop mit Typ `AuthUser` (Firebase-Klasse). Funktioniert, ist aber irreführend, da die App jetzt Supabase-Auth nutzt. Alle Dialog-Komponenten, die `authUser` akzeptieren, sollten einen gemeinsamen Supabase-kompatiblen Typ verwenden.
  **Priorität:** tief · **Komplexität:** mittel (codebase-weit, viele Dialoge)

## Error Handling

_(Claude Code: append entries here when you encounter `console.log` / `console.error` used instead of Sentry, missing error boundaries, or swallowed errors.)_

## Comments / Documentation

_(Claude Code: append entries here when you encounter English comments that should be German, missing JSDoc, or outdated/misleading comments.)_

## Firebase Class Removal

- **`src/components/Department/department.class.ts`** — Legacy-Firebase-Klasse, Shape identisch mit `DepartmentDomain`. Wird als Typ in ~20 Dateien importiert. Nur `product.class.ts` ruft eine statische Methode (`Department.getAllDepartments()`) auf. Sobald die Products-Migration abgeschlossen ist, Klasse löschen und alle Typ-Imports durch `DepartmentDomain` ersetzen.
  **Priorität:** mittel · **Komplexität:** mittel (20+ Dateien, mechanisches Suchen-und-Ersetzen)

- **`src/components/Event/Event/event.tsx`** — Aktiver `firebase.analytics`-Aufruf für Event-Logging. Zu Supabase Analytics migrieren oder eigenständigen Firebase-Analytics-Import verwenden.
  **Priorität:** mittel · **Komplexität:** klein

- **`src/components/Event/Event/receipt.class.ts` + `eventInfo.tsx`** — Aktive Firestore-Lese-/Schreiboperationen für Quittungen. Erfordert ReceiptRepository-Migration nach Supabase.
  **Priorität:** mittel · **Komplexität:** mittel

## Navigation Guards

- **In-App-Navigationsblockierung** — `react-router useBlocker` für Seiten mit ungespeicherten Änderungen fehlt. Derzeit deckt nur `beforeunload` das Schliessen/Aktualisieren des Browsers ab. Betroffene Seiten: `departments.tsx`, `units.tsx` und weitere Seiten mit Bearbeitungsmodus.
  **Priorität:** tief · **Komplexität:** mittel

## MUI Deprecated APIs

- **`InputProps` → `slotProps.input`** — Multiple components use the deprecated `InputProps` prop on MUI `<TextField>`. MUI 7 renamed this to `slotProps: { input: { ... } }`. Known locations: `src/components/AuthServiceHandler/resetPassword.tsx` (line ~166). Likely present in many more form-heavy files (SignIn, SignUp, UserProfile, Recipe, Event, etc.). Codebase-wide search + replace needed.
  **Priorität:** mittel · **Komplexität:** mittel

- **`departmentAutocomplete.tsx` Zeile 89** — Unsicherer Cast `event as unknown as React.ChangeEvent<HTMLInputElement>`. Fix erfordert Änderung des `onChange`-Prop-Typs zu `React.SyntheticEvent` und Aktualisierung von 2 Konsumenten (`dialogProduct.tsx`, `convertItem.tsx`).
  **Priorität:** tief · **Komplexität:** klein

## Large Files / Component Splitting

Dateien mit >1'000 LOC, die in kleinere Einheiten aufgeteilt werden sollten. Änderungen am Logikfluss erforderlich — nur bei gezieltem Refactoring angehen.

- **`src/components/Event/Event/event.tsx`** (2'365 LOC) — Zentrale Event-Seite mit Tab-Navigation, allen Sub-Komponenten-Importen und komplexem State-Management. Aufteilen in separate Tab-Komponenten.
  **Priorität:** tief · **Komplexität:** gross

- **`src/components/Event/ShoppingList/useShoppingListHandlers.tsx`** (1'786 LOC) — Handler-Hook mit 13+ Operationen. Aufteilen in domänenspezifische Hooks (CRUD, PDF, Department-Logik).
  **Priorität:** tief · **Komplexität:** gross

- **`src/components/Event/Menuplan/useMenuplanHandlers.tsx`** (1'535 LOC) — Handler-Hook mit Menü-, Mahlzeit- und Rezept-Operationen. Aufteilen in spezialisierte Hooks.
  **Priorität:** tief · **Komplexität:** gross

- **`src/components/Event/ShoppingList/shoppingList.tsx`** (1'329 LOC) — Seiten-Komponente mit eingebetteten Dialogen und PDF-Generierung. Dialoge extrahieren.
  **Priorität:** tief · **Komplexität:** gross

- **`src/components/Event/Menuplan/dialogPlanPortions.tsx`** (1'301 LOC) — Einzelner Dialog mit komplexer Portionsmatrix. Unterkomponenten extrahieren.
  **Priorität:** tief · **Komplexität:** gross

- **`src/components/Event/GroupConfiguration/groupConfiguration.tsx`** (1'017 LOC) — Gruppenkonfigurationsseite mit eingebetteten Dialogen.
  **Priorität:** tief · **Komplexität:** gross

- **`src/components/Event/MaterialList/materialList.tsx`** (1'006 LOC) — Materiallisten-Seite mit eingebetteten Dialogen.
  **Priorität:** tief · **Komplexität:** gross

## Type Safety

- **`any`-Typ in Testdateien** — Folgende Testdateien verwenden `any` statt typisierter Mocks: `eventUsedRecipes.test.tsx`, `usedRecipesPdf.test.tsx`, `menuplan.menucard.test.ts`, `menuplanPdf.test.tsx`, `eventInfo.test.tsx`. Mit `unknown` und Type-Narrowing oder korrekt typisierten Mocks ersetzen.
  **Priorität:** tief · **Komplexität:** klein

## UX/UI Improvements

- **Drag-and-Drop Tastatur-Zugänglichkeit** — `src/components/Event/Menuplan/useMenuplanDragDrop.ts` implementiert Maus-DnD, aber Tastatur-Zugänglichkeit fehlt. Keyboard-Drag-Support für Accessibility-Compliance hinzufügen.
  **Priorität:** mittel · **Komplexität:** mittel

- **ShoppingList Offline-Modus** — Während des Lagers (mobile Nutzung) kann das Netzwerk unzuverlässig sein. Die Einkaufsliste könnte von optimistischen Updates oder Local-First-Patterns profitieren.
  **Priorität:** tief · **Komplexität:** gross

## Other

_(Claude Code: append entries here for anything that doesn't fit the categories above. If a pattern repeats, create a new category.)_
