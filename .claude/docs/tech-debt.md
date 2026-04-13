# Tech Debt

This file tracks code that violates current conventions but is not urgent enough to fix immediately. Claude Code appends new entries here automatically when encountered during work. Items are grouped by category, with priority and complexity to help with planning.

**Priority:** hoch (every release), mittel (when area is touched), tief (when time allows)
**Complexity:** klein (< 30 min, isolated change), mittel (1–3h, multiple files), gross (half day+, cross-cutting, needs thorough testing)

---

## Enums

Numeric TypeScript enums that need conversion to string enums matching PostgreSQL ENUM labels. See `database-and-supabase.md` for the target convention.

- **`MaterialType`** in `src/components/Material/material.types.ts` / `MaterialRepository.ts` — Uses numeric values (`none = 0, consumable = 1, usage = 2`). Convert to string enum, delete `MATERIAL_TYPE_TO_DB` / `MATERIAL_TYPE_FROM_DB` lookup maps, simplify `toRow()` / `toDomain()` to direct pass-through. Update `MaterialRow.type` and `MaterialDomain.type` types.
  **Priorität:** mittel · **Komplexität:** mittel

- **`Allergen` + `Diet`** in `src/components/Product/product.types.ts` / `ProductRepository.ts` — Uses numeric values. Convert to string enums, delete lookup maps, simplify `toRow()` / `toDomain()`, update `ProductRow` and `ProductDomain` types. Note: `Allergen.None` was a sentinel for "empty array" — after conversion, rely on empty array instead.
  **Priorität:** mittel · **Komplexität:** mittel

- **`EventTabs`** in `src/components/Event/Event/event.tsx` — Uses implicit numeric values (`menuplan = 0, quantityCalculation = 1, …`). Convert to string enum per project conventions. Currently used as MUI `<Tabs>` value and in multiple `useEffect` comparisons.
  **Priorität:** tief · **Komplexität:** mittel

- **`MenuType`** in `src/components/Recipe/recipe.class.ts` — Numerischer Enum, braucht String-Konvertierung für PostgreSQL ENUM. Betrifft ~15 Dateien + Repository-Mapping.
  **Priorität:** mittel · **Komplexität:** mittel

## Missing DB Functions

- **`increment_field` RPC** — `BaseRepository.increment()` calls `rpc("increment_field", {...})` but no migration creates this function. Any code path calling `BaseRepository.increment()` will fail at runtime. Create migration with allowlist guard (see `security-guidelines.md` for pattern). Add tables to allowlist as needed.
  **Priorität:** hoch · **Komplexität:** klein

## Security / Auth

- **Admin-client bypass in profile picture uploads** — `User.uploadPicture()` and `User.deletePicture()` in `user.class.ts` use `database.admin?.storage.users ?? database.storage.users`, bypassing Storage RLS. Switch to regular client (`database.storage.users`), verify authenticated user has active Supabase session, remove `database.admin?.storage` fallback.
  **Priorität:** mittel · **Komplexität:** klein

- **Admin-client bypass in `authUserContext.tsx`** — `database.admin?.users ?? database.users` (Zeile 130) umgeht RLS beim Laden des Benutzerprofils im Auth-State-Change-Listener. Ursprünglich nötig wegen Timing-Problem (RLS erlaubt eigenen User erst nach vollständigem Session-Setup). Prüfen, ob regulärer Client mittlerweile funktioniert, und Admin-Fallback entfernen.
  **Priorität:** mittel · **Komplexität:** klein

## Performance

- **Recipe loading: 5 parallel queries** — `recipe.tsx` and `recipe.edit.tsx` load a recipe via 4–5 separate parallel Supabase queries, plus a full products list just for name resolution. Refactor to use PostgREST embedded resources (single query with joins). Add `RecipeFullRow` interface, `getRecipeFull(id)` to `RecipeRepository`, `Recipe.fromFullRow()` factory method. Remove `getAllProducts()` workaround. See `database-and-supabase.md` for PostgREST embedded resource syntax.
  **Priorität:** mittel · **Komplexität:** gross

## Bundle Size

Identifiziert via Sentry Bundle Size Analysis (Build vom 13.04.2026). Die grössten Chunks bieten das meiste Optimierungspotenzial.

- **`index.js` — 3.3 MB (gzip: 1.2 MB)** — Haupt-Bundle enthält zu viele Abhängigkeiten. Firebase SDK, Supabase SDK, Material UI, Sentry und React landen alle im selben Chunk. Nach Firebase-Removal reduziert sich das deutlich. Danach: `manualChunks` in Vite konfigurieren, um MUI, Supabase und Sentry in separate Vendor-Chunks auszulagern.
  **Priorität:** mittel · **Komplexität:** gross

- **`pdfUtils.js` — 2.5 MB (gzip: 758 KB)** — `@react-pdf/renderer` ist sehr gross. Wird nur für Spendenquittung und Rezept-PDF benötigt. Bereits lazy-loaded (eigener Chunk), aber die Bibliothek selbst ist schwer. Alternative: Server-side PDF-Generierung via Edge Function (z.B. mit `jsPDF` oder Puppeteer). Oder: akzeptieren, da nur bei PDF-Download geladen.
  **Priorität:** tief · **Komplexität:** gross

- **`RichTextEditor.js` — 400 KB (gzip: 129 KB)** — TipTap/ProseMirror Editor. Nur auf der Rezept-Bearbeitungsseite benötigt. Bereits lazy-loaded. Optimierung: prüfen ob alle TipTap-Extensions nötig sind, unnötige entfernen.
  **Priorität:** tief · **Komplexität:** mittel

- **`deDE.js` — 345 KB (gzip: 104 KB)** — MUI DataGrid Deutsch-Lokalisierung. Wird für Admin-Übersichtsseiten verwendet. Bereits lazy-loaded. Kaum optimierbar (MUI-intern).
  **Priorität:** tief · **Komplexität:** klein

- **`event.js` — 227 KB (gzip: 62 KB)** — Event-Seite (Menuplan, Listen, Gruppenconfig) ist die grösste Einzelseite. Könnte in Sub-Tabs aufgeteilt werden (Tab-basiertes Code-Splitting).
  **Priorität:** mittel · **Komplexität:** gross

## Naming

- **`src/components/Shared/enviroment.class.ts`** — Firebase-abhängig, Dateiname-Tippfehler (enviroment → environment), `console.error`. Vollständige Migration nach Supabase erforderlich.
  **Priorität:** mittel · **Komplexität:** klein

- **`dialogDepartment.tsx`** — Verwendet `authUser`-Prop mit Typ `AuthUser` (Firebase-Klasse). Funktioniert, ist aber irreführend, da die App jetzt Supabase-Auth nutzt. Alle Dialog-Komponenten, die `authUser` akzeptieren, sollten einen gemeinsamen Supabase-kompatiblen Typ verwenden.
  **Priorität:** tief · **Komplexität:** mittel (codebase-weit, viele Dialoge)

- **`AuthUser`-Klasse aus `Firebase/`-Ordner verschieben** — `AuthUser` ist vollständig Supabase-basiert (befüllt aus `UserRepository` + Supabase Auth Session), liegt aber unter `src/components/Firebase/Authentication/authUser.class.ts`. Der Importpfad suggeriert fälschlicherweise eine Firebase-Abhängigkeit. Verschieben nach `src/components/Session/` oder `src/components/Auth/` und 50+ Importer aktualisieren. Gleichzeitig Konvertierung von Klasse zu Type/Interface erwägen.
  **Priorität:** hoch · **Komplexität:** mittel (mechanisches Suchen-und-Ersetzen, aber 50+ Dateien)

## Error Handling

- **`src/components/Shared/stats.class.ts`** — Firebase-abhängig, 4× `console.error` statt Sentry. Vollständige Migration nach Supabase erforderlich.
  **Priorität:** mittel · **Komplexität:** mittel

_(Claude Code: append entries here when you encounter `console.log` / `console.error` used instead of Sentry, missing error boundaries, or swallowed errors.)_

## Comments / Documentation

_(Claude Code: append entries here when you encounter English comments that should be German, missing JSDoc, or outdated/misleading comments.)_

## Firebase Class Removal

- **`src/components/Department/department.class.ts`** — Legacy-Firebase-Klasse, Shape identisch mit `DepartmentDomain`. Wird als Typ in ~20 Dateien importiert. Nur `product.class.ts` ruft eine statische Methode (`Department.getAllDepartments()`) auf. Sobald die Products-Migration abgeschlossen ist, Klasse löschen und alle Typ-Imports durch `DepartmentDomain` ersetzen.
  **Priorität:** mittel · **Komplexität:** mittel (20+ Dateien, mechanisches Suchen-und-Ersetzen)

- **`src/components/Recipe/recipeShort.class.ts`** — 7 statische Firebase-Methoden haben null Aufrufer (getShortRecipes*, delete*, deleteOverview). Datei kann gelöscht werden, nachdem Typen extrahiert sind (erledigt in recipe.types.ts) und Firebase-DB-Dateien entfernt werden.
  **Priorität:** mittel · **Komplexität:** klein

- **`src/components/Recipe/recipe.comment.class.ts`** — `getComments()` und `save()` haben null Aufrufer. `RecipeCommentRepository` übernimmt alle Persistenz. Datei kann nach Typ-Extraktion gelöscht werden.
  **Priorität:** mittel · **Komplexität:** klein

- **`src/components/Recipe/recipe.rating.class.ts`** — `getUserRating()` und `updateUserRating()` haben null Aufrufer. `RecipeRatingRepository` übernimmt alle Persistenz. Datei kann nach Typ-Extraktion gelöscht werden.
  **Priorität:** mittel · **Komplexität:** klein

- **Firebase-Auth-Listener in `authUserContext.tsx`** — Der sekundäre Firebase `onAuthUserListener` (Zeilen 202–213) ist eine Migrationsbrücke für noch nicht zu Supabase migrierte User. Sobald alle User migriert sind, Listener und `useFirebase()`-Import entfernen. Damit entfällt die `firebaseContext`-Abhängigkeit im Session-Ordner vollständig.
  **Priorität:** mittel · **Komplexität:** klein (ca. 15 Zeilen + Import entfernen, aber zuerst sicherstellen, dass alle User migriert sind)

- **`signIn.tsx` `setTimeout` delay** — 1× hardcoded `setTimeout(resolve, 2000)` wartet, bis der Auth-Context die Session übernommen hat. Richtiger Fix erfordert ein "ready"-Signal im Auth-Context oder `onAuthStateChange`-Subscription.
  **Priorität:** mittel · **Komplexität:** mittel

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

- **Autocomplete `onChange` Double-Cast** — `productAutocomplete.tsx`, `materialAutocomplete.tsx`, `itemAutocomplete.tsx` verwenden alle den gleichen unsicheren doppelten Cast `event as unknown as React.ChangeEvent<HTMLInputElement>` im `onChange`-Handler. Fix erfordert Änderung des `onChange`-Prop-Typs zu `React.SyntheticEvent` in allen Autocomplete-Komponenten und ihren 10+ Konsumenten.
  **Priorität:** tief · **Komplexität:** mittel

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

- **`src/components/Recipe/recipe.edit.tsx`** (3'602 LOC) — RecipeIngredients, RecipePreparationSteps, RecipeMaterials in separate Dateien extrahieren.
  **Priorität:** tief · **Komplexität:** gross

- **`src/components/Recipe/recipe.view.tsx`** (2'648 LOC) — Kommentare, Bewertungen, Skalierungsbereiche in separate Dateien extrahieren.
  **Priorität:** tief · **Komplexität:** gross

## Type Safety

- **`src/components/Shared/localStorageHandler.class.ts`** — Firebase `ValueObject`-Import, `values: any` im Interface `LocalStorageValue`, keine localStorage-Validierung. Migration nach Supabase-Typen erforderlich.
  **Priorität:** tief · **Komplexität:** klein

- **`display: "table" as any` in PDF-Style-Dateien** — `pdfTokens.ts`, `stylesRecipePdf.ts` und alle PDF-Style-Dateien verwenden `as any` für `display: "table"`, weil `@react-pdf/renderer` den Wert `"table"` nicht in seinem `Display`-Typ definiert. Wird behoben, sobald die Bibliothek den Typ erweitert.
  **Priorität:** tief · **Komplexität:** klein

- **`ProductDomain` ↔ `Product` Typ-Vereinheitlichung** — `ProductRepository` verwendet `ProductDomain` mit `nameSingular`-Feld, die App verwendet `Product` (aus `product.types.ts`) ohne dieses Feld. Verursacht unsicheren Cast in `products.tsx` (`{...product, nameSingular: product.name}`). Vereinheitlichung erfordert Repository-Änderungen + alle Konsumenten.
  **Priorität:** mittel · **Komplexität:** mittel

- **`any`-Typ in Testdateien** — Folgende Testdateien verwenden `any` statt typisierter Mocks: `eventUsedRecipes.test.tsx`, `usedRecipesPdf.test.tsx`, `menuplan.menucard.test.ts`, `menuplanPdf.test.tsx`, `eventInfo.test.tsx`. Mit `unknown` und Type-Narrowing oder korrekt typisierten Mocks ersetzen.
  **Priorität:** tief · **Komplexität:** klein

## UX/UI Improvements

- **Drag-and-Drop Tastatur-Zugänglichkeit** — `src/components/Event/Menuplan/useMenuplanDragDrop.ts` implementiert Maus-DnD, aber Tastatur-Zugänglichkeit fehlt. Keyboard-Drag-Support für Accessibility-Compliance hinzufügen.
  **Priorität:** mittel · **Komplexität:** mittel

- **ShoppingList Offline-Modus** — Während des Lagers (mobile Nutzung) kann das Netzwerk unzuverlässig sein. Die Einkaufsliste könnte von optimistischen Updates oder Local-First-Patterns profitieren.
  **Priorität:** tief · **Komplexität:** gross

## Migration Debts

- **Menuplan-Bridge (Domain ↔ UI Transformation)** — `src/components/Database/Repository/MenuplanRepository.ts` (Methoden `menuplanDomainToUi` / `menuplanUiToDomain`). Die Menüplan-Daten werden bidirektional zwischen der flachen DB-Struktur (8 Tabellen mit `sort_order`) und der verschachtelten UI-Struktur (`MenuplanData` mit Maps + Order-Arrays) transformiert. Diese verschachtelte Struktur stammt aus der Firebase-Ära. Refactoring-Optionen: (A) UI auf flache Arrays umstellen oder (B) Transformation schrittweise eliminieren. Tests vorhanden: `menuplanBridge.test.ts`.
  **Priorität:** mittel · **Komplexität:** gross

## Convention

- **`recipe.class.ts` default → named export** — 62 Dateien importieren diese Klasse. Konvertierung sollte ein eigenständiger Commit/PR sein wegen massivem Blast-Radius.
  **Priorität:** mittel · **Komplexität:** mittel (mechanisch, aber hoher Blast-Radius)

- **`Request` Klasse → Standalone-Funktionen** — `src/components/Request/request.class.ts` ist eine statische Utility-Klasse ohne Instanz-State. Könnte in einfache exportierte Funktionen konvertiert werden, um dem modernen Pattern zu entsprechen. Funktioniert korrekt, daher niedrige Dringlichkeit.
  **Priorität:** tief · **Komplexität:** klein

- **`dialogReauthenticate.tsx` `User.registerSignIn` statische Methode** — Wird als statische Klassenmethode aufgerufen statt über das Repository-Pattern. Sollte direkt `UserRepository.registerSignIn()` verwenden.
  **Priorität:** tief · **Komplexität:** klein

- **`Admin/migration.tsx` default export** — Verwendet `export default MigrationPage`. Sollte als Teil eines breiteren Admin-Folder-Refactorings zu Named Export konvertiert werden.
  **Priorität:** tief · **Komplexität:** klein

## Architecture

- **`src/components/Shared/customDialogContext.tsx`** — Modul-Level `resolveCallback` Variable ist fragil bei gleichzeitigen Dialogen. Funktioniert in der Praxis (App zeigt nur einen Dialog gleichzeitig), aber ein `useRef`-basiertes Rewrite wäre robuster. Würde 26 Konsumenten betreffen.
  **Priorität:** tief · **Komplexität:** gross

## Other

## Unit Folder

- **`unit.class.ts` — Klasse statt Type** — `Unit` ist eine Klasse mit Constructor, sollte aber gemäss Konvention ein `type` + standalone `getDimensionOfUnit`-Funktion sein. Betrifft 28 Import-Stellen + 3 `new Unit()`-Aufrufe ausserhalb des Unit-Ordners. Eigener kleiner PR.
  **Priorität:** mittel · **Komplexität:** mittel

- **`unitConversion.class.ts` — Klasse statt Funktionen** — Statische Methoden sollten als standalone exported Functions extrahiert werden. Betrifft 9+ Import-Stellen inkl. `recipe.class.ts`. Zusammen mit `unit.class.ts` refactoren.
  **Priorität:** mittel · **Komplexität:** mittel

- **`unitConversion.tsx` — DOM-ID-Encoding-Pattern** — `event.target.id.split("_")` ist fragil (bricht bei UIDs mit `_`). Besser: `data-*` Attribute verwenden.
  **Priorität:** tief · **Komplexität:** mittel

- **`Unit/__mocks__/` — Mock-Dateien** — Verwenden Default-Exports und `interface` statt `type`. Nach dem Hauptrefactoring aktualisieren.
  **Priorität:** tief · **Komplexität:** klein

## User Folder

- **Firebase `getAllUsers()` Migration** (`src/components/User/user.class.ts:230`) — Ruft noch `firebase.user.readCollection()` auf. Erfordert Datenmigration nach Supabase (kein reines Refactoring).
  **Priorität:** hoch · **Komplexität:** mittel

- **Firebase DB Mirror-Dateien** — `firebase.db.user.public.class.ts`, `firebase.db.user.public.searchFields.class.ts` referenzieren die gelöschten Domain-Klassen (`user.public.class.ts`, `user.public.searchFields.class.ts`). Aufräumen, wenn Firebase vollständig entfernt wird.
  **Priorität:** tief · **Komplexität:** klein

- **User-Klasse → Standalone-Funktionen** — `user.class.ts` verwendet statische Methoden auf einer Klasse. Moderne Konvention: eigenständige exportierte Funktionen. Betrifft 13+ Import-Stellen.
  **Priorität:** tief · **Komplexität:** gross

- **Admin-Client-Bypass in User-Methoden** — `user.class.ts`-Methoden verwenden `database.admin?.users ?? database.users` um RLS während der Migrationsphase zu umgehen. Nach vollständiger Migration auf regulären Client umstellen.
  **Priorität:** mittel · **Komplexität:** klein

## Constants Folder

- **`imageRepository.ts` — Firebase-Storage-URLs** — Alle Umgebungsbilder verwenden Firebase-Storage-URLs. Bei Migration zu Supabase Storage müssen diese URLs aktualisiert werden.
  **Priorität:** mittel · **Komplexität:** klein

- **`firebaseEvent.ts` — Firebase-Analytics-Abhängigkeit** — Enum wird für Firebase-Analytics-Logging verwendet. Wenn Firebase vollständig entfernt wird, muss diese Datei gelöscht oder durch Supabase/PostHog-Analytics ersetzt werden.
  **Priorität:** tief · **Komplexität:** mittel

- **`styles.ts` — 662 LOC in einer Datei** — Könnte in domänenspezifische Style-Module aufgeteilt werden (eventStyles, recipeStyles etc.). Aktuell 82 Konsumenten, daher riskant ohne grösseres Refactoring.
  **Priorität:** tief · **Komplexität:** gross

- **`text.ts` — kein i18n-Framework** — Alle UI-Strings sind hardcodierte deutsche Konstanten. Bei Bedarf an Internationalisierung zu `react-intl` oder `i18next` migrieren.
  **Priorität:** tief · **Komplexität:** gross

- **`defaultValues.ts` — hardcodierte Support-User-UIDs** — UIDs sind pro Umgebung hardcodiert. Sollten in Umgebungsvariablen oder eine DB-Konfigurationstabelle verschoben werden.
  **Priorität:** tief · **Komplexität:** klein

- **`enumMappings.ts` — numerische Enum-Brücke** — Diese Mappings existieren, weil `Allergen` und `Diet` Enums numerisch sind. Kann nach Migration zu String-Enums vollständig gelöscht werden.
  **Priorität:** mittel · **Komplexität:** klein (nach Enum-Migration löschen)

_(Claude Code: append entries here for anything that doesn't fit the categories above. If a pattern repeats, create a new category.)_
