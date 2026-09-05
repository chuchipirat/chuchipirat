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

- **`signIn.tsx` `setTimeout` delay** — 1× hardcoded `setTimeout(resolve, 2000)` wartet, bis der Auth-Context die Session übernommen hat. Richtiger Fix erfordert ein "ready"-Signal im Auth-Context oder `onAuthStateChange`-Subscription.
  **Priorität:** mittel · **Komplexität:** mittel

- **`authUserContext.tsx` — Cache-Validierung akzeptiert leere `uid` und kein `loading`-Flag** — `isValidCachedAuthUser` (Zeile ~49) prüft nur `typeof obj.uid === "string"`, nicht dass `uid` nicht-leer ist. Der Context hat ausserdem kein `loading`/`isLoading`-Flag — `null` bedeutet laut Kommentar sowohl "ausgeloggt" als auch "lädt noch". Konsumenten prüfen fast überall nur `if (!authUser) return`, was einen (theoretisch) korrupten Cache-Eintrag mit `uid: ""` als vollständig eingeloggt behandeln würde. Zusätzlich fehlt ein try/catch um `JSON.parse` beim Cache-Lesen (Initializer Zeile ~78 und Listener Zeile ~124). Kein aktiver Schreibpfad gefunden, der `uid: ""` erzeugt (Stand 2026-08-24) — daher nicht akut, aber als Verteidigungslinie sinnvoll: `isValidCachedAuthUser` um Non-Empty-Check ergänzen, `JSON.parse` absichern, echtes `loading`-Flag einführen.
  **Priorität:** mittel · **Komplexität:** klein

## Performance

- **Recipe loading: 5 parallel queries** — `recipe.tsx` and `recipe.edit.tsx` load a recipe via 4–5 separate parallel Supabase queries, plus a full products list just for name resolution. Refactor to use PostgREST embedded resources (single query with joins). Add `RecipeFullRow` interface, `getRecipeFull(id)` to `RecipeRepository`, `Recipe.fromFullRow()` factory method. Remove `getAllProducts()` workaround. See `database-and-supabase.md` for PostgREST embedded resource syntax.
  **Priorität:** mittel · **Komplexität:** gross

- **`BaseRepository.findMany()` — keine Pagination über PostgREST `db-max-rows` hinaus** — PostgREST begrenzt jede unpaginierte Anfrage serverseitig auf `db-max-rows` (aktuell 1000, siehe `supabase/config.toml` bzw. `PGRST_DB_MAX_ROWS` in den Docker-Compose-Dateien). `findMany()` reicht diese Begrenzung unverändert durch und schneidet Ergebnisse oberhalb der Grenze **stillschweigend** ab — kein Fehler, einfach fehlende Zeilen. Bereits behoben (eigene `fetchXPage()`-Helper mit `.range()`-Pagination statt unpaginiertem `.select()`): `ProductRepository.getAllProducts()`, `MaterialRepository.getAllMaterials()`, `FeedRepository.getAllFeeds()`, `UserRepository.findOverview()`, `EventRepository.getAllEventsShort()`, `DonationRepository.getAllDonations()` (2026-07-21, live in Feed-Übersicht aufgefallen — siehe [[FD-004]]), sowie `RecipeRepository.getAllRecipeShorts()`, `getAllPublicRecipeShorts()` und `getPrivateRecipeShortsForUser()` (2026-07-21, gemeinsamer `fetchAllRecipeShortRows()`-Helper — `getAllRecipeShorts()` war das riskanteste, da völlig ungefiltert über alle Rezepte aller User). Vollständiger Audit aller DataGrid-Seiten am 2026-07-21 durchgeführt: `overviewMailbox.tsx` (`MailLogRepository.getAll(limit)`) und `cronJobs.tsx` (`CronJobLogRepository.getAll/getByJobName(limit)`) sind sicher (expliziter `.limit()` unter 1000). `systemMessageOverview.tsx` (`SystemMessageRepository.getMessages()` via generisches `findMany()`) ist unpaginiert, aber unkritisch (Ankündigungstabelle, real nie über wenige Dutzend Zeilen). Noch nicht gefixt, da deutlich geringeres Risiko (durch Suchbegriff/Ersteller/Event bereits eingeschränkt, in der Praxis kleine Ergebnismengen): `RecipeRepository.searchByName()`, `searchByRecipeId()`, `searchByCreatorId()`, `searchByCreatorIds()`, `getVariantShortsForEvent()`. Eine generische Lösung direkt in `findMany()` wäre möglich, wurde aber bewusst vermieden, um den Blast-Radius klein zu halten (betrifft 15+ Repositories, die `findMany()` nutzen) — bei neuen Overview-/Listen-Seiten für potenziell grosse Tabellen weiterhin auf dieses Pattern prüfen.
  **Priorität:** mittel · **Komplexität:** mittel (pro betroffenem Repository klein, aber Audit über alle `findMany()`-Aufrufer nötig)

## Bundle Size

Identifiziert via Sentry Bundle Size Analysis (Build vom 13.04.2026). Die grössten Chunks bieten das meiste Optimierungspotenzial.

- **`index.js` — 2.6 MB (gzip: 1.0 MB)** — Haupt-Bundle enthält zu viele Abhängigkeiten (Supabase SDK, Material UI, Sentry, React landen alle im selben Chunk). Firebase-SDK-Anteil ist seit dem Firebase-Abbau (Issue #215) bereits weg — verbleibende Grösse ist rein Supabase/MUI/Sentry/React. `manualChunks` in Vite konfigurieren, um MUI, Supabase und Sentry in separate Vendor-Chunks auszulagern.
  **Priorität:** mittel · **Komplexität:** gross

- **`pdfUtils.js` — 2.5 MB (gzip: 758 KB)** — `@react-pdf/renderer` ist sehr gross. Wird nur für Spendenquittung und Rezept-PDF benötigt. Bereits lazy-loaded (eigener Chunk), aber die Bibliothek selbst ist schwer. Alternative: Server-side PDF-Generierung via Edge Function (z.B. mit `jsPDF` oder Puppeteer). Oder: akzeptieren, da nur bei PDF-Download geladen.
  **Priorität:** tief · **Komplexität:** gross

- **`RichTextEditor.js` — 400 KB (gzip: 129 KB)** — TipTap/ProseMirror Editor. Nur auf der Rezept-Bearbeitungsseite benötigt. Bereits lazy-loaded. Optimierung: prüfen ob alle TipTap-Extensions nötig sind, unnötige entfernen.
  **Priorität:** tief · **Komplexität:** mittel

- **`deDE.js` — 345 KB (gzip: 104 KB)** — MUI DataGrid Deutsch-Lokalisierung. Wird für Admin-Übersichtsseiten verwendet. Bereits lazy-loaded. Kaum optimierbar (MUI-intern).
  **Priorität:** tief · **Komplexität:** klein

- **`event.js` — 227 KB (gzip: 62 KB)** — Event-Seite (Menuplan, Listen, Gruppenconfig) ist die grösste Einzelseite. Könnte in Sub-Tabs aufgeteilt werden (Tab-basiertes Code-Splitting).
  **Priorität:** mittel · **Komplexität:** gross

## Error Handling

_(Claude Code: append entries here when you encounter `console.log` / `console.error` used instead of Sentry, missing error boundaries, or swallowed errors.)_

- **DAL wirft rohe Nicht-`Error`-Objekte** — `BaseRepository.findById()` / `findMany()` / `create()` etc. reichen das Supabase-`error`-Objekt (`{code, details, hint, message}`) via `if (error) throw error` unverändert weiter. Aufrufer, die es an `Sentry.captureException()` geben, erzeugen unbrauchbare Gruppen ("Object captured as exception with keys ..."). Aktuell wird das an einer Stelle (`globalSettingsContext.tsx`) über `toError()` aus `src/utils/errorUtils.ts` normalisiert. Langfristig sollte die Normalisierung zentral in `BaseRepository` passieren (einmal `throw toError(error)` statt an jeder der ~263 `captureException`-Aufrufstellen). Gleiches gilt für `isTransientNetworkError()`: vorübergehende `Failed to fetch`-Fehler aus Hintergrund-Polls (`Home.tsx:806/1033`, weitere) sollten dort ebenfalls nicht nach Sentry.
  **Priorität:** tief · **Komplexität:** mittel

- **Kein flächendeckender `isUuid()`-Guard vor `.eq("*_uid"/"user_id", …)`** — Aus veralteten localStorage-Caches kann eine Firebase-UID als `authUser.uid` durchsickern und löst dann Postgres `22P02` ("invalid input syntax for type uuid") aus. Root Cause ist per `isValidCachedAuthUser` (`authUserContext.tsx`) gefixt; als Defense-in-depth haben `EventRepository.getAllEventsForUser` und `DonationRepository.getMyDonations` einen `isUuid()`-Guard (`src/utils/uuid.ts`). Noch offen: ein Audit aller weiteren Repository-Methoden, die eine User-UID direkt in `.eq()` / `.in()` gegen eine `uuid`-Spalte reichen (z.B. `RecipeRepository.searchByCreatorId(s)`, diverse `*_uid`-Filter), und ggf. dort denselben Guard ergänzen.
  **Priorität:** tief · **Komplexität:** klein

- **`catch { Sentry.captureException(error); throw error; }`-Doppelmeldung in Repositories** — Etliche Repository-Methoden fangen den Fehler nur, um ihn zu melden, und werfen ihn dann weiter — der Aufrufer meldet ihn ein zweites (bei `insertFeed` → `getFeedById` sogar ein drittes) Mal. `FeedRepository` wurde bereinigt (meldet nicht mehr selbst; Aktivitäts-Feeds laufen über `postActivityFeed`, `src/components/Shared/feedActivity.ts`). Gleiches Muster noch in `MaterialListRepository`, `MenuplanRepository`, `RequestRepository`, `RecipeRepository` u.a. Sweep: Die Repository-Schicht meldet nicht selbst an Sentry — sie normalisiert höchstens via `toError()` und wirft; die aufrufende Schicht entscheidet über die Meldung.
  **Priorität:** tief · **Komplexität:** mittel

## Comments / Documentation

_(Claude Code: append entries here when you encounter English comments that should be German, missing JSDoc, or outdated/misleading comments.)_

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

- **`tsconfig.json` prüft keine `.tsx`-Dateien** — `include` ist `["./src/**/*.ts", "../functions/**/*.ts"]`, enthält kein `*.tsx`-Pattern. `npx tsc --noEmit` (lokal wie im CI-`typecheck`-Job, `.github/workflows/ci.yml`) hat dadurch noch nie eine einzige React-Komponente typgeprüft. Bestätigt reale, dadurch unentdeckte Fehler: `App.tsx` übergibt eine `themeLight`-Prop, die auf `OverrideFeedbackConfiguration` nicht existiert; `Recipe/dialogRecipeQuickView.tsx` ruft `Recipe.getRecipe(...)` auf, eine Methode, die auf der Klasse gar nicht existiert (Datei ist allerdings unerreichbar — keine Importer, keine Route); `Temp/temp.tsx` und `Temp/templates.tsx` haben mehrere echte Typfehler (ebenfalls unerreichbar, keine Route). Fix: `.tsx` zu `include` hinzufügen und die dadurch aufgedeckten Fehler in einer eigenen Aufräum-PR beheben — nicht nebenbei in einer fachfremden Änderung, da unklar ist, wie viele Fehler insgesamt auftauchen.
  **Priorität:** hoch · **Komplexität:** mittel

- **`src/components/Shared/localStorageHandler.class.ts`** — `values: any` im Interface `LocalStorageValue`, keine localStorage-Validierung. Migration nach Supabase-Typen erforderlich. (Der ursprünglich hier vermerkte Firebase-`ValueObject`-Import wurde im Rahmen des Firebase-Abbaus, Issue #215, bereits behoben — `ValueObject` kommt jetzt aus `global.interface.ts`.)
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

- **`BaseRepository.subscribe()` nutzt noch das naive Realtime-Muster** — Alle UI-genutzten Realtime-Subscriptions laufen inzwischen über `subscribeWithRetry` (`realtimeSubscription.ts`, Backoff-Reconnect, Breadcrumb statt Exception bei transientem `CHANNEL_ERROR`). `BaseRepository.subscribe()` (Z. ~273) meldet dagegen bei `CHANNEL_ERROR` sofort `onError` und reconnectet nicht. Aktuell kein UI-Consumer (`grep '.subscribe({'` leer), daher nicht dringend. Bei Umstellung Semantik-Unterschiede beachten: Einzelsatz-Subscription, `DELETE`-Event → `onError("Record deleted")`, `cacheUpsert` im Change-Handler.
  **Priorität:** tief · **Komplexität:** klein

- **`recipe.edit.tsx`-Reducer mutiert State in-place** — Der `recipeEditReducer` (und `onPostionMoreContextMenuClick`) kopieren `state.recipe.ingredients` / `preparationSteps` / `materials` nur flach (`{...state.recipe.ingredients}`) und mutieren dann `.entries[uid][field] = …` bzw. `.order.push()/.splice()` direkt auf den State-Referenzen (z.B. Z. ~355–381, ~433–460, ~1496–1546, Z. 392 kopiert gar nicht). Dadurch können `order` und `entries` bei rasch aufeinanderfolgenden oder unterbrochenen Aktionen desynchronisieren — ein `order`-Eintrag ohne passenden `entries`-Eintrag hat CHUCHIPIRAT-G3 (Render, `ingredient.uid` auf `undefined`) und CHUCHIPIRAT-H0 (derselbe Reducer, `ON_INGREDIENT_CHANGE`-Reduce über `order` mit `entries[uid].posType`) ausgelöst. Übergangsweise per Render-Guard (`if (!ingredient) return null`), `LastCardMoved`-Guard und `entries[uid]?.posType`-Optional-Chaining in den `ON_INGREDIENT_CHANGE`/`ON_PREPARATIONSTEP_CHANGE`-Reduces abgefangen. Sauberer Fix: Reducer vollständig immutabel machen (`order` als `[...]`, `entries` als `{...}` kopieren, Positions-Objekte vor Mutation klonen) — grösserer, eigener PR, alle 3 Blöcke betroffen.
  **Priorität:** mittel · **Komplexität:** gross

- **Menuplan-Editor mutiert State in-place** — Gleiche Klasse wie der `recipe.edit`-Reducer. `menuplanService.ts`-Funktionen (`addMealType` war betroffen, gefixt; `deleteMealType`, `onMealTypeUpdate`/`tempMealTypes` in `useMenuplanHandlers.tsx` u.a.) kopieren `{...mealTypes}` flach und mutieren dann `.order`/`.entries`. `order.push()` ohne Guard konnte eine `uid` doppelt in `mealTypes.order` legen → beim Speichern `duplicate key … event_meal_types_pkey` (23505, CHUCHIPIRAT-GE). Übergangsweise: `addMealType` immutabel + `!order.includes`-Guard, und `MenuplanRepository.saveMenuplan` dedupliziert alle Collections via `dedupeByUid` (heilt auch bereits verdoppelten Client-State). Es existiert bereits eine Render-Zeit-Telemetrie (`menuplan.tsx` Z. ~219: `captureMessage("Doppelte MealTypes im Menüplan")`). Sauberer Fix: `useMenuplanHandlers` + `menuplanService` durchgängig immutabel.
  **Priorität:** mittel · **Komplexität:** gross

## Error Handling — Where-Used / FK-Verletzung

- **`recipe.view.tsx` `onDeleteRecipe` hat keine Where-Used-Prüfung und meldet FK-Verletzungen weiterhin an Sentry** — Anders als `products.tsx`/`materials.tsx` (die vor dem Löschen `database.adminOps.whereUsed()` aufrufen und die Referenzen im Bestätigungsdialog anzeigen) löscht `onDeleteRecipe` ein Rezept direkt ohne Vorprüfung. `event_menue_recipes_recipe_id_fkey` ist ebenfalls `ON DELETE RESTRICT` — ein Rezept, das noch in einem Menüplan verwendet wird, kann also mit derselben `23503`-FK-Verletzung wie CHUCHIPIRAT-GW scheitern. Der Fehler läuft über eine `onError`-Prop (nicht direkt `Sentry.captureException` in dieser Datei) — wo genau die Meldung an Sentry geht, wurde nicht weiter verfolgt. Sollte bei Gelegenheit denselben `isForeignKeyViolationError()`-Guard (`src/utils/errorUtils.ts`) und idealerweise auch eine Where-Used-Prüfung vor dem Löschen bekommen.
  **Priorität:** tief · **Komplexität:** klein

## Other

- **Duplikate Produkte in `products`-Tabelle** — Mind. 7 Produkte existieren als zwei separate DB-Zeilen mit identischem Namen, aber unterschiedlicher `uid` (bestätigt: Äpfel, Birnen, Diverse Früchte, Frühstücksflocken, Mascarpone vegan, Rotkabis, Weisswein alkoholfrei — siehe [[RC-001 Rezept erstellen]]). Hat einen React-Key-Kollisions-Bug im Produkt-Autocomplete verursacht (behoben via `getOptionKey`), macht Produktauswahl in Zutaten-/Einkaufslisten aber weiterhin für Nutzer verwirrend (zwei identisch benannte, evtl. unterschiedlich klassifizierte Einträge zur Auswahl). Bereinigung (Duplikate zusammenführen oder eindeutig benennen) erfordert Prüfung, ob beide Zeilen bereits in Rezepten/Einkaufslisten referenziert werden.
  **Priorität:** mittel · **Komplexität:** mittel

- **`PasswordChangePage`'s `oobCode`/`resetCode`-Flow ist unerreichbar** (`src/components/PasswordChange/passwordChange.tsx`) — `AppRoutes.tsx` rendert Routen-Komponenten generisch ohne Props (`element={<Component />}`), und kein anderer Aufrufer übergibt `oobCode`. Der komplette `resetCode &&`-gated UI-Zweig (Reset-Header-Bild, "Bist du bereit?"-Titel, spezielles Reset-Flow-Verhalten) ist damit über die aktuelle Route `/passwordchange` nie erreichbar — nur der reguläre Login-Change-Flow (ohne `resetCode`) läuft. Der Firebase-spezifische Teil dieses toten Zweigs (`AuthMessages.EXPIRED_ACTION_CODE`/`INVALID_ACTION_CODE`-Check) wurde im Rahmen des Firebase-Abbaus (Issue #215) bereits entfernt; der Rest des toten `resetCode`-Zweigs bleibt bestehen, da unklar ist, ob dies beabsichtigt (Route wird noch woanders/zukünftig mit Prop verdrahtet) oder ein Überbleibsel ist — braucht Klärung, ob der Passwort-Reset-Link-Flow generell fehlt oder anders gelöst wird.
  **Priorität:** mittel · **Komplexität:** mittel

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

- **User-Klasse → Standalone-Funktionen** — `user.class.ts` verwendet statische Methoden auf einer Klasse. Moderne Konvention: eigenständige exportierte Funktionen. Betrifft 13+ Import-Stellen.
  **Priorität:** tief · **Komplexität:** gross

## Constants Folder

- **`ImageRepository.getEnvironmentRelatedPicture()` — Namensrelikt** — Methode gibt seit der Migration auf `public/`-Assets keine umgebungsabhängigen Bilder mehr zurück; Name ist irreführend. Bei Gelegenheit zu einer einfachen exportierten Konstante (`IMAGE_PATHS`) umbauen und alle ~30 Aufrufstellen anpassen.
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
