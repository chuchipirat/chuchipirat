# Coaching-Roadmap: Abrechnung (Issue #86)

## Context

Issue #86 fordert ein vollständiges Ausgaben-/Budget-Modul pro Anlass: Budgets definieren,
Ausgaben inkl. Beleg erfassen, ein Dashboard mit Kennzahlen, PDF-/CSV-Export und eine
automatische Beleg-Löschung nach einem Jahr. Freigeschaltet wird das Feature pro Anlass, sobald
eine bestätigte Spende für diesen Anlass existiert.

Der Umfang ist gross — realistisch 30+ Arbeitspakete à 1–2h. Der Nutzer schreibt den Code
**selbst**, um das Architektur-Niveau der letzten Migration zu verinnerlichen; ich bin Coach:
Ich plane die Pakete, der Nutzer implementiert eines nach dem anderen auf einem einzigen
Feature-Branch, meldet sich nach jedem fertigen Paket, ich lese den Diff und gebe ehrliches,
konkretes Feedback (Architektur, Konventionen, Testabdeckung, Edge Cases) — keine Schönfärberei.

Diese Datei ist eine **lebende Roadmap**: Epic 0 und Epic 1 sind bis auf Datei-/Funktionsebene
ausdetailliert, weil sie sofort starten. Ab Epic 2 sind nur Titel + Kurzbeschreibung fixiert —
die genaue Paket-Aufteilung verfeinern wir gemeinsam, sobald das jeweilige Epic ansteht (mit den
dann gemachten Erfahrungen aus den Reviews davor).

## Arbeitsvereinbarung (Working Agreement)

- **Ein Branch** für das gesamte Feature: `feature/expense-tracking` (von `develop`).
- Pro Paket: Nutzer implementiert, verifiziert selbst zuerst (`npx tsc --noEmit`,
  `npx jest <Muster> --watchAll=false`, `npm run lint`) und geht die **Pre-Commit-Checkliste**
  unten durch — **noch nicht committen**, meldet "Paket X.Y fertig, ungecommittet".
- Ich lese den Working-Tree-Diff (`git status` + `git diff` gegen den letzten committeten
  Stand), gebe Feedback in vier Kategorien: Architektur/Pattern-Treue, Namensgebung/Clean
  Code, Testabdeckung, übersehene Edge Cases. Feedback ist ehrlich — auch wenn's unbequem
  ist, das ist der Zweck der Übung.
- Nutzer wendet die Muss-Fixes an, ich prüfe die Fixes kurz (nicht das ganze Paket neu).
  **Erst danach committen.** Grund: Review vor dem Commit heisst ein Commit pro Paket statt
  "Fix Review Findings"-Nachträgen — sauberere Historie, kein Nacharbeiten an bereits
  committeten Ständen.
- Nach jedem Epic: kurzer Rückblick + Verfeinerung der Pakete des nächsten Epics.
- Ein finaler PR gegen `develop` am Ende des gesamten Features (nicht pro Paket/Epic) — kann bei
  Bedarf revidiert werden, falls der Nutzer lieber früher einen (Draft-)PR öffnen möchte.

### Pre-Commit-Checkliste (vor jedem "Paket X.Y fertig")

Allgemein, jedes Paket:

- [ ] `npx tsc --noEmit`, `npm run lint`, `npx jest <Muster> --watchAll=false` grün
- [ ] `git status` durchgesehen — nur Dateien drin, die zum Paket gehören (kein
      Formatter-Grundrauschen in unbeteiligten Dateien, kein Leftover aus einem anderen Paket)
- [ ] Neue/geänderte Dateinamen == Hauptexport (z.B. `ExpenseRepository.test.ts`, nicht
      `ExpesesRepository.test.ts`)
- [ ] JSDoc/TSDoc `@example`-Zeilen zeigen echte, existierende Methodennamen

Bei neuen Repositories/Domain-Typen (Paket-Typ "Repository-Skelett"):

- [ ] Repository in `DatabaseService.ts` registriert (Import + Feld + Konstruktor-Zeile) —
      sonst ist `database.<name>` aus der UI nicht erreichbar, fällt aber weder bei `tsc` noch
      im Repo-Test selbst auf
- [ ] Cache-Konfiguration in `sessionStorageHandler.class.ts` ergänzt, passend zur
      Event-Bindung (`excludeFromCaching: true` bei Multi-User/Event-Daten)
- [ ] Jede `date`-Spalte (Postgres-Typ `date`, nicht `timestamptz`) läuft durch
      `formatLocalDate()`/`parseLocalDate()` aus `dateUtils.ts` — nie `Date` roh durchreichen,
      nie `.toISOString().split("T")[0]` (CET/CEST-Tagesverschiebung, siehe CLAUDE.md)
- [ ] `orderBy`/`filters`/`.eq(...)`-Feldnamen sind **DB-Spaltennamen** (snake_case), nicht
      Domain-Feldnamen — Verwechslung fällt bei `tsc` nicht auf, nur zur Laufzeit
- [ ] Domain-Typen (`*.types.ts`) importieren keine Domain-**Klassen** (z.B. `Event`) nur für
      einen Feldtyp — führt zu unnötiger Kopplung/Zirkelimport-Risiko; einfache Typen
      (`string`, `string | null`) verwenden, wie `donation.types.ts` es vormacht
- [ ] Nullability der Domain-Felder stimmt mit der Tabellendefinition überein (`NOT NULL`
      in Postgres → nicht `| null` im Domain-Typ)

Bei UI-/Komponenten-Paketen (aus den Review-Funden von Epic 1 abgeleitet):

- [ ] Jeder Schreibaufruf (`await`/`.then` auf Repository-Methoden) läuft durch `try/catch` →
      zentrales `handleError` (Fehler sichtbar + Sentry, ausser Nutzerhinweise/Netzwerkfehler) —
      kein ungefangenes Promise, der Dialog darf nicht «erfolgreich» schliessen, wenn nichts
      gespeichert wurde, ohne dass ein Fehler erscheint
- [ ] Keine Hooks nach einem frühen `return` (Rules of Hooks — das ESLint-Plugin ist in diesem
      Projekt nicht aktiv, `tsc` und `lint` merken es nicht; Folge ist ein Absturz zur Laufzeit)
- [ ] Keine Importe aus `__mocks__`/Testdateien in Produktivcode; kein `console.log`, kein
      `debugger`, kein auskommentierter Code, keine ungenutzten Exporte/Konstanten
- [ ] Ein eigener Analytics-Event pro Aktion (nicht `..._CREATED` per Copy&Paste beim Löschen)
- [ ] Wird ein Domain-Feld Pflicht, sind alle Test-Fixtures/Mocks nachgezogen (`tsc` prüft Tests mit)
- [ ] `jest.mock` steht nur auf oberster Ebene der Testdatei; `...Once`-Warteschlangen werden in
      `beforeEach` per `mockReset` geleert (`clearAllMocks` leert sie nicht)
- [ ] Realtime-/Callback-Tests: Callbacks aus dem Mock auslesen und selbst aufrufen; danach
      **Mutationsprobe** (Code absichtlich kaputt machen → der Test muss rot werden)
- [ ] JSDoc auf Deutsch für exportierte Funktionen, Komponenten und Typen; «Warum»-Kommentare bei
      nicht offensichtlichem Code
- [ ] Dateigrösse: Komponenten mit eigener Logik in eigene Datei (Richtwert < 500 Zeilen)
- [ ] Dialoge sind auf Mobile (xs) nutzbar (Vollbild), Touch-Ziele nicht zu klein
- [ ] Migrationen: bestehende Dateien nie ändern, Versions-Präfix (Timestamp) eindeutig — vor
      dem Commit `ls supabase/migrations | sed 's/_.*//' | sort | uniq -d` muss leer sein

## Architektur-Entscheidungen (vorab getroffen, mit Begründung)

Diese Entscheidungen treffe ich jetzt als Coach, damit die Pakete einen klaren Rahmen haben.
Wer anderer Meinung ist, darf jederzeit widersprechen — das ist Teil des Lernprozesses.

1. **Kein neuer DB-Sicherheitsmechanismus für die Spenden-Freischaltung.** Die
   `donations`-Tabelle hat bereits `event_id` + RLS-Policy `donations_select`, die Event-Köch:innen
   bestätigte (`confirmed`/`migrated`) Spenden ihres Anlasses sehen lässt (`amount_in_cents` ist
   DB-seitig bereits auf ≥ 500 begrenzt). Die Freischaltung ist reine **UI-Gate-Logik**
   (`DonationRepository.hasVerifiedDonationForEvent(eventId)`), keine RLS-Verschärfung auf
   `event_budgets`/`event_expenses` — die bleiben wie alle anderes Event-Daten für alle
   Event-Köch:innen über `is_event_cook(event_id)` zugänglich. Grund: Die Spende ist ein
   Goodwill-Türsteher für die UI, kein Security-Boundary im eigentlichen Sinn.
2. **Ordner `src/components/Event/ExpenseTracking/`** (im Verlauf so entstanden, statt `Accounting/`) für Budget- und Ausgaben-Domain-Klassen +
   Tab-UI (analog `ShoppingList/`, `MaterialList/` — ein Ordner pro Tab-Feature). Repositories
   bleiben wie immer flach unter `src/components/Database/Repository/`.
3. **Geldbeträge als Integer-Cents in Spalte `amount_in_cents`** — exakt gleicher Name wie
   `donations.amount_in_cents`, das einzige bestehende Geld-Muster im Code (in 0.2 so
   umgesetzt; `event_expenses` und die Domain-Typen ziehen nach). Kein neuer `Money`-Typ nötig
   für den Umfang hier, aber eine gemeinsame Formatierungs-Utility
   (`formatMoney(amountInCents, currency)`) lohnt sich, da bisher an jeder Stelle einzeln
   `toFixed(2)` inline gemacht wird (siehe Tech-Debt).
4. **Neue Tabellen `event_budgets` und `event_expenses`** (Präfix `event_`, wie
   `event_shopping_lists`) statt Wiederverwendung generischer Namen — das Datenmodell soll laut
   Issue "generisch genug" für andere Budget-Zwecke sein, das erreichen wir über den
   `budget_type`/freien `name` je Budget, nicht über eine Kassa-spezifische Tabellenstruktur.
5. **Genau ein Attachment pro Ausgabe** wird direkt als Spalten auf `event_expenses` gespeichert
   (`attachment_path`, `attachment_original_filename`) — keine separate Attachment-Tabelle nötig,
   da 1:1-Beziehung.
6. **Charts**: `@mui/x-charts` als neue Abhängigkeit (passt zu bereits vorhandenem
   `@mui/x-data-grid`/MUI-Theme). Fortschrittsbalken (Ist/Soll) brauchen keine Chart-Lib —
   normales MUI `LinearProgress`.
7. **CSV-Export** ohne neue Abhängigkeit (einfacher String-Join + `Blob`/`file-saver`, wie beim
   PDF-Blob). **ZIP-Export** der Belege braucht `jszip` als neue Abhängigkeit (keine bestehende
   Lösung im Code).
8. **PDF-Export** folgt 1:1 dem bestehenden Muster: eigene `@react-pdf/renderer`-Dokument-
   komponente + `generateAndDownloadPdf()` aus `src/components/Shared/pdfUtils.ts` (siehe
   `DonationReceiptPdf.tsx` als Vorbild).
9. **"Gesperrter Tab"-UI ist neu** — es gibt aktuell kein Entitlement-/Locked-Tab-Muster im Code
   (nur Route-Level-Redirects via `AuthorizationGuard`). Wir bauen das hier zum ersten Mal:
   einfache Weiche innerhalb des Tab-Ternaries in `event.tsx`, kein neues generisches Framework.

## Bestätigte Out-of-Scope-Punkte (aus dem Issue übernommen)

Offline-Erfassung, Soll-Ist-Vergleich mit Menüplan-Kosten, Verknüpfung mit Einkaufslisten,
Rückerstattungsstatus-Tracking, Beleg-Reminder während des Lagers, Sperren von Ausgaben nach
Abrechnungserstellung, Kursumrechnung, Freigabe-Workflow/Kassier:in-Rolle.

---

## Epic 0 — Fundament: Schema, Entitlement, Tab-Shell

Ziel: Ein leerer, aber echter "Abrechnung"-Tab, der Spenden-Status korrekt erkennt und (noch
ohne Inhalt) zwischen Upsell und "kommt gleich"-Platzhalter unterscheidet.

**Paket 0.1 — Entitlement-Check (kein Migration nötig)**

- `DonationRepository.hasVerifiedDonationForEvent(eventId: string): Promise<boolean>` — Query
  auf `donations` (`event_id = eventId`, `status in ('confirmed','migrated')`, `limit 1`),
  nutzt bestehende RLS. Analog zu bestehenden `getAllDonations()`/`getMyDonations()`-Methoden in
  derselben Datei (inkl. `isUuid`-Guard-Konvention wo zutreffend).
- Unit-Test mit gemocktem Supabase-Client (true/false-Fall).
- **Definition of Done**: `npx jest DonationRepository` grün, `tsc` clean.

**Paket 0.2 — Migration: `event_budgets`** ✅ erledigt (`20260905000001_add_event_budgets.sql`)

- Neue Migration `supabase/migrations/<timestamp>_add_event_budgets.sql`, self-contained:
  - `CREATE TYPE public.budget_type AS ENUM ('fixed_amount', 'per_person_per_day');`
  - Tabelle `event_budgets`: `id text default gen_random_uuid()::text not null`, `event_id text
not null` (FK `events(id) on delete cascade`), `name text not null`, `budget_type` (Enum,
    default `fixed_amount`), `amount_in_cents integer` (nullable — "Küche" startet ohne Betrag;
    `check (amount_in_cents > 0)` lässt NULL zu), `currency text not null default 'CHF'`,
    4 Audit-Spalten (inkl. `created_at` und FKs `created_by`/`updated_by` → `auth.users`
    `on delete set null`).
  - RLS: select/update/delete → `USING (is_event_cook(event_id) OR is_admin())`,
    insert → `WITH CHECK (…)`, update zusätzlich `WITH CHECK (…)`. `OR is_admin()` folgt der
    Mehrheit der Event-Tabellen (`20260401000006_rls_policies.sql:205-322`); die in der
    ursprünglichen Planung genannten `event_shopping_lists`-Policies sind eine der zwei
    Ausnahmen ohne `is_admin()`.
  - Trigger `updated_at`/`updated_by` (Vorbild `20260722000001_add_meal_type_cutoff_times.sql`).
  - `ALTER TABLE … REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE`
    (Pflicht für alle Event-Tabellen — nötig für die Realtime-Subscription in 1.5).
  - Grants + Index auf `event_id`.
- **Verifikation**: transaktional gegen die laufende lokale `-test`-DB angewendet (behält
  Daten); alle Objekte + RLS-Verhalten (Nicht-Koch-INSERT wird abgewiesen) geprüft. Voller
  `supabase db reset` blockiert durch veraltete Supabase-CLI (2.90 → baseline-Fehler bei
  `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin`); CLI-Upgrade offen.
- **SQL-Formatter-Wechsel**: `prettier-plugin-sql` entfernt (brach den Baseline-Stil um),
  ersatzweise `sqlfluff` + `.sqlfluff` (nur Casing: Keywords GROSS, Datentypen klein).

**Paket 0.3 — Migration: `event_expenses`** ✅ erledigt

- Neue Migration, self-contained:
  - `CREATE TYPE public.expense_payee_type AS ENUM ('existing_user', 'new_person',
'no_refund_needed');`
  - Tabelle `event_expenses`: `id`, `event_id` (FK events, cascade), `budget_id` (FK
    `event_budgets`, `on delete restrict` — eine Ausgabe braucht immer ein Budget), `date date
not null`, `amount_in_cents integer not null check (amount_in_cents > 0)`, `currency text not
null default 'CHF'`, `label text not null`, `comment text`, `payee_type` (Enum, not null),
    `payee_user_id uuid references auth.users(id) on delete set null`, `payee_name text`,
    `attachment_path text`, `attachment_original_filename text`, 4 Audit-Spalten.
  - RLS wie 0.2 (`USING`/`WITH CHECK`-Aufteilung, `OR is_admin()`), aber über `event_id` direkt
    (nicht über `budget_id`-Join — einfacher und performanter, da `event_id` redundant aber
    direkt auf der Zeile steht).
  - `REPLICA IDENTITY FULL` + `ALTER PUBLICATION supabase_realtime ADD TABLE` (wie 0.2).
  - Trigger `updated_at`/`updated_by`.
  - Grants + Indizes auf `event_id`, `budget_id`.
- **Verifikation**: wie 0.2 transaktional gegen die laufende `-test`-DB (behält Daten), plus
  Insert-Test mit allen drei `payee_type`-Varianten um die Constraint-Kombinationen zu prüfen.

**Paket 0.4 — Repository-Skelette + Domain-Typen** ✅ erledigt

- `src/components/Event/Accounting/budget.types.ts`, `expense.types.ts` — `BudgetDomain`,
  `BudgetRow`, `ExpenseDomain`, `ExpenseRow` (Vorbild: `donation.types.ts`-Struktur/TSDoc-Stil).
- `src/components/Database/Repository/BudgetRepository.ts`,
  `src/components/Database/Repository/ExpenseRepository.ts` — extends `BaseRepository`,
  vorerst nur `getForEvent(eventId)`, `create(...)`, `update(...)`, `delete(id)` + `toRow`/
  `toDomain`. Noch keine Realtime-Subscription (kommt in Epic 1/2 mit der UI, die sie braucht).
- In `DatabaseService.ts`/`DatabaseContext.tsx` registrieren (Vorbild: wie `shoppingLists`
  registriert ist).
- Unit-Tests für `toRow`/`toDomain`-Mapping beider Repositories.

**Paket 0.5 — Tab-Shell in `event.tsx`** ✅ erledigt

- `EventTabs`-Enum um `accounting` erweitern, `TAB_QUERY_PARAM_MAP`/`TAB_TO_QUERY_PARAM`
  ergänzen (`?tab=abrechnung`), neuer `<Tab label={TEXT_ACCOUNTING} {...tabProps(6)} />`,
  Analytics-Pageview-Tracking-Zeile ergänzen (siehe Zeile ~908 im bestehenden Code).
  Windowtitle-Ternary ergänzen.
- Neue Komponente `src/components/Event/Accounting/accounting.tsx`: lädt beim Mount
  `hasVerifiedDonation` via `database.donations.hasVerifiedDonationForEvent(eventId)`. Zeigt:
  - `false` → Upsell-Card (Text + CTA-Button, der zur Spenden-Seite navigiert,
    `eventId` als Query-Param mitgeben wie in `EventCompletionDonation` bereits gemacht).
  - `true` → Platzhalter "Budgets & Ausgaben folgen in Kürze" (wird in Epic 1/2 ersetzt).
- Neue Textkonstanten in `src/constants/text/` (eigene Sektion, z.B. `accounting.ts` oder
  Ergänzung in `shared.ts` — Nutzer entscheidet, worauf ich beim Review schaue).
- **Definition of Done**: Im Browser beide Zustände manuell durchklicken (Event ohne Spende /
  Event mit bestätigter Spende in DEV-DB), Desktop + Mobile-Viewport prüfen.

---

## Epic 1 — Budgets (CRUD + Live-Berechnung)

Ziel: Köch:innen können Budgets anlegen, bearbeiten, löschen; "Küche"-Default entsteht
automatisch; Pro-Person/Tag-Budgets rechnen sich live nach.

**Paket 1.1 — `budget.class.ts` (reine Domain-Logik)** ✅ erledigt

- `src/components/Event/Accounting/budget.class.ts`: statische Methoden, keine DB-Imports.
  `computePerPersonPerDayAmount(participantCount, dayCount, amountPerPersonPerDay): number`,
  `createDefaultKitchenBudget(eventId): BudgetDomain` (ohne Betrag, `budget_type =
fixed_amount`), Validierung (leerer Name etc. → `FieldValidationError`, Vorbild
  `shoppingList.class.ts`).
- Unit-Tests: Berechnung, Default-Budget-Shape, Validierungsfehler.

**Paket 1.2 — Kein automatisches Default-Budget (Ansatz zweimal revidiert)** ✅ erledigt

- **Entscheidungsverlauf:**
  1. _Ursprünglich:_ Default-"Küche"-Budget beim Event-Erstellungs-Flow anlegen (analog zur
     Standard-Gruppenkonfiguration). Verworfen, weil Abrechnung — anders als Gruppenkonfiguration/
     Menüplan/Einkaufsliste — eine spendenbasiert freigeschaltete Zusatzfunktion ist: die meisten
     Events aktivieren sie nie, und eine `event_budgets`-Zeile würde Nutzung suggerieren, die nie
     stattgefunden hat.
  2. _Danach:_ lazy beim ersten Freischalten anlegen (`getBudgetsForEvent` leer →
     `createBudget(Budget.createDefaultKitchenBudget(eventId))`). Umgesetzt und verworfen: dieser
     Ansatz hatte einen bekannten Race (zwei Köch:innen schalten gleichzeitig frei → doppeltes
     "Küche"-Budget) und passte nicht zur Realtime-Anbindung aus 1.5, weil der Erstlade-Effekt
     danach nur noch lesen darf (ein Realtime-Reload, der bei leerer Liste ein Budget anlegt,
     würde nach dem Löschen des letzten Budgets in allen Sessions sofort ein neues erzeugen).
  3. _Final:_ **kein automatisches Budget.** Die Übersicht zeigt bei leerer Liste nur die
     "Neues Budget"-Karte (`AddBudgetCard`) — derselbe Leerzustand wie bei einer Einkaufsliste,
     die noch nie angelegt wurde. Der Lade-Effekt in `expenseTracking.tsx` ist rein lesend
     (`loadBudgets`), Erstlade + Realtime + Reload nach Verbindungsabbruch teilen sich dieselbe
     Funktion.
- **Aufgeräumt:** `Budget.createDefaultKitchenBudget` inkl. Tests entfernt. Die Migration
  `20260921000001_add_budget_icon.sql` setzt beim Backfill bestehender Zeilen mit dem Namen
  "Küche" das Icon `kitchen` — bleibt bestehen, ist für neue Daten harmlos.
- **Kein Test mehr für Auto-Anlage.** Stattdessen (siehe 1.5): leere Liste zeigt nur die
  "Neues Budget"-Karte, und der Realtime-Reload legt nie ein Budget an.

**Paket 1.3 — Budgets-Liste + Anlage-Dialog** ✅ erledigt

- UI in `expenseTracking.tsx` (ersetzt Platzhalter aus 0.5, sobald `hasVerifiedDonation === true`):
  Liste/Cards der Budgets, "+ Budget"-Dialog (Name, Typ-Auswahl, Betrag/Währung).
  Struktur/Stil an `shoppingList.tsx`'s Listenkopf anlehnen.
- **Validierung in `budget.class.ts` ergänzen** (aus 1.1 zurückgestellt, da es bis hierhin
  keinen Aufrufer mit echten Nutzereingaben gab): `Budget.validate(...)`
  (oder analog zu `recipe.class.ts`s `checkRecipeData` benannt) wirft
  `FieldValidationError` (Vorbild `shoppingList.class.ts`/`recipe.class.ts`) für:
  - leerer/nur-Whitespace-Name
  - `amountInCents` bei `budgetType: fixed_amount` negativ oder 0 (bei
    `per_person_per_day` ist `null`/`0` vor der ersten Berechnung gültig,
    siehe `createDefaultKitchenBudget`)
  - unbekannter/leerer `budgetType`
    Dialog ruft die Validierung vor dem Speichern auf und zeigt die Fehler pro Feld
    (Vorbild: wie der Rezept-Editor `FieldValidationError.formValidation` konsumiert).
- Unit-Tests für `Budget.validate(...)` (gültiger Fall + je ein Fehlerfall pro obiger Regel).

**Paket 1.4 — Live-Darstellung des Sollbetrags** ✅ erledigt

- **Entscheidung (revidiert):** Ursprünglich geplant als Hook/Effect, der bei Änderung von
  Teilnehmerzahl oder Lagerdauer alle `per_person_per_day`-Budgets neu berechnet **und
  speichert** (persistierter, abgeleiteter Totalbetrag). Verworfen — in Paket 1.3 wurde
  `amountInCents` bei `per_person_per_day`-Budgets stattdessen als **Ansatz pro Person & Tag**
  (Rate) definiert, und `Budget.getTargetAmountInCents(budget, participantCount, dayCount)`
  berechnet den Sollbetrag bereits **live bei jedem Render** aus dieser Rate — kein Speichern
  eines abgeleiteten Totals nötig, kein Risiko eines veralteten persistierten Werts bei
  gleichzeitiger Bearbeitung von Gruppenkonfiguration und Budgets durch zwei Köch:innen.
  Tradeoff, den diese Entscheidung bewusst in Kauf nimmt: jede zukünftige Stelle, die einen
  `per_person_per_day`-Betrag anzeigt oder exportiert (PDF/CSV in späteren Epics), muss
  `getTargetAmountInCents` verwenden statt `amountInCents` direkt zu lesen — sonst wird die
  Rate fälschlich als Totalbetrag dargestellt.
- **Verbleibender Umfang für 1.4:**
  - Sicherstellen, dass `BudgetCard`/die Übersicht bei Änderung von Teilnehmerzahl
    (Gruppenkonfiguration) oder Lagerdauer (Menüplan-Tage) automatisch neu rendert.
    `groupConfiguration` ist über `event.tsx`s bestehende `eventGroupConfig`-Realtime-
    Subscription bereits live — der fehlende Teil war, dass `targetAmountInCents`/
    `percentage` einmalig im Fetch-Effect berechnet und in `state.budgetsWithProgress`
    eingefroren wurden, statt live abgeleitet zu werden. Umgesetzt: Fetch-Effect speichert
    nur noch die DB-Rohdaten (`state.budgets`, `state.spentAmounts`), ein separates
    `useMemo` (abhängig von `state.budgets`, `state.spentAmounts`, `groupConfiguration`,
    `event.numberOfDays`) leitet `budgetsWithProgress` bei jedem Render neu ab — kein
    Re-Fetch, keine neue Subscription nötig.
  - **Gestrichen: Aktion "Auf Fixbetrag umstellen".** Wäre eine reine Komfort-Automatisierung
    gewesen (übernimmt den aktuell live berechneten Zielbetrag als neuen Fixbetrag), aber
    Paket 1.5s Bearbeiten-Dialog deckt denselben Anwendungsfall bereits vollständig ab: eine
    Köchin öffnet ein `per_person_per_day`-Budget zum Bearbeiten, wechselt den Typ auf
    Fixbetrag und trägt einen Betrag ein (z.B. den aktuell angezeigten Zielbetrag von der
    Karte abgelesen, oder einen beliebigen anderen) — strikt allgemeiner als die gestrichene
    Aktion, kein separater Button/Bestätigungsdialog/Update-Pfad nötig. YAGNI: kein
    identifizierter Anwendungsfall, der über den generischen Bearbeiten-Flow hinausgeht.

**Paket 1.5 — Bearbeiten/Löschen + Realtime** ✅ erledigt

- Edit-/Delete-Dialoge; `BudgetRepository.subscribeToBudgets(eventId, ...)` nach dem
  `subscribeWithRetry`-Muster inkl. `onStatusChange`, Einbindung in
  `useRealtimeConnectionStatus()` auf der Event-Seite (Key `"budgets"`), analog den 7
  bestehenden Subscriptions in `event.tsx`.

---

## Epic 2 — Ausgaben: Kern-CRUD (ohne Zahlungsinstanz/Beleg)

Ziel: Köch:innen erfassen, bearbeiten und löschen Ausgaben (Datum, Betrag+Währung, Bezeichnung,
Kommentar, Budget-Zuordnung). Die Budget-Karten aus Epic 1 zeigen den Verbrauch automatisch
korrekt an, Änderungen anderer Köch:innen erscheinen live. **Nicht** Teil von Epic 2: Zahlende
Instanz (Epic 3), Belege (Epic 4).

### Rückblick Epic 1 — Erfahrungen und daraus abgeleitete Regeln

- **Pakete blieben nicht klein.** 1.3 wuchs um Fortschrittsanzeige, Icon-Auswahl und
  Ausgaben-Aggregation, weil das Karten-Layout es «mitverlangte» — das Review wurde dadurch
  schwer. → **Ein Paket = ein Ziel.** Braucht das Layout Zusatzarbeit, wird sie als eigenes
  Paket davor oder danach geplant, nicht nebenbei mitgemacht.
- **Ansätze wurden mehrfach revidiert** (Default-Budget zweimal, «Live-Neuberechnung» ganz).
  Ursache: Mehrbenutzer-/Realtime-Folgen wurden erst beim Umsetzen sichtbar. → Vor dem Coden
  die Entscheidungen durchspielen («Was passiert, wenn zwei Köch:innen gleichzeitig …?») und
  hier festhalten — siehe «Entscheidungen» unten.
- **Wiederkehrende Review-Funde** (jetzt in der Pre-Commit-Checkliste oben): fehlendes
  Fehlerhandling bei Schreibaufrufen, Hook nach frühem `return` (Absturz), Test-Mock in
  Produktivcode importiert, kopiertes Analytics-Event, auskommentierter Code, veraltete
  Test-Fixtures nach neuem Pflichtfeld, eine bereits angewendete Migration editiert.
- **Tests:** Realtime lässt sich testen, indem man die an `subscribe…` übergebenen Callbacks
  selbst aufruft; erst die Mutationsprobe zeigt, ob ein Test wirklich schützt.
- **`expenseTracking.tsx` hat 1254 Zeilen** (Seite, Reducer, Karte, Dialog). Epic 2 würde sie
  verdoppeln → zuerst aufteilen (Paket 2.1).

### Entscheidungen (vorab, mit Begründung)

1. **Datenbasis: `state.expenses` statt `state.spentAmounts`.** Die Seite hält Budgets **und**
   Ausgaben im State; Summen je Budget/Währung werden daraus abgeleitet (`useMemo`, wie
   `budgetsWithProgress` in 1.4). `ExpenseRepository.getSpentAmountsByBudget` entfällt. Grund:
   eine Quelle für Liste, Fortschrittsbalken und später Dashboard/«Offene Beträge» (Epic 3/6),
   ein Reload statt zwei Abfragen, keine Inkonsistenz zwischen Liste und Summe. Kosten: alle
   Ausgaben des Events werden geladen (ein Lager hat Hunderte, nicht Tausende Zeilen —
   unkritisch; Paginierung ist bewusst nicht vorgesehen).
2. **Währungen: keine Umrechnung** (Out-of-Scope). Der Fortschritt einer Budget-Karte zählt nur
   Ausgaben in der **Währung des Budgets**; Ausgaben in anderen Währungen erscheinen als
   Zusatzzeile je Fremdwährung (Style `budgetSecondaryCurrencyRow` ist schon vorhanden). Die
   Währung einer Ausgabe ist vorbelegt mit der Währung des gewählten Budgets, aber änderbar.
   **Nebenfund:** `getSpentAmountsByBudget` summiert Rappen heute über Währungen hinweg — 100 EUR
   und 100 CHF würden als 200 «CHF» gezählt. Latent, sobald es Ausgaben gibt → wird in 2.3 behoben.
3. **Zahlende Instanz als Platzhalter.** `payee_type` ist `NOT NULL` ohne Default und
   `chk_expense_payee` verlangt eine gültige Kombination. Bis Epic 3 schreibt der Dialog fest
   `payee_type = 'no_refund_needed'`, `payee_user_id = null`, `payee_name = null`. Kein UI dafür,
   aber Kommentar im Code und ein Test, der genau diese Werte prüft. Epic 3 ersetzt den
   Platzhalter durch eine Auswahl; bestehende Ausgaben bleiben gültig.
4. **Ein Dialog für Anlegen und Bearbeiten von Anfang an** (`ExpenseDetailDialog` — Lehre aus
   1.3→1.5, wo `CreateBudgetDialog` später umbenannt werden musste). Formular wird beim Öffnen
   per Effekt neu befüllt; die Seite besitzt Datenbankaufrufe und Rückfragen, der Dialog kennt
   nur Callbacks.
5. **Datum:** `expense_date` ist eine `date`-Spalte → `parseLocalDate`/`formatLocalDate`
   (im Repository schon umgesetzt), `DatePicker` wie in `eventInfo.tsx`/`CopyEventDialog.tsx`.
   Vorbelegung: heute. **Keine Einschränkung auf die Lagerdauer** — Einkäufe vor und nach dem
   Lager sind normal.
6. **Mobile zuerst.** Ausgaben werden im Lager am Handy erfasst: Liste als gestapelte
   Einträge (kein DataGrid), Dialog auf xs im Vollbild, grosse Touch-Ziele. Sortierung: neueste
   Ausgabe zuerst (beim Erfassen sieht man die letzte gleich oben).
7. **Ohne Budget keine Ausgabe.** `budget_id` ist `NOT NULL`. Existiert noch kein Budget, ist
   «Neue Ausgabe» deaktiviert mit Hinweis «Lege zuerst ein Budget an».
8. **Realtime: zwei Subscriptions, ein gemeinsamer Reload.** Wie bisher pro Repository eine
   Subscription (`event_budgets`, neu `event_expenses`), beide rufen dieselbe `loadData()`-
   Funktion, beide melden ihren Status unter eigenem Key an das Verbindungsbanner. Ein
   doppelter Reload, wenn beide Tabellen gleichzeitig ändern, ist harmlos (idempotent).
9. **Löschen von Ausgaben** hat keine Fremdschlüssel-Einschränkung (Ausgaben sind Blätter).
   Schnittstelle zu Epic 4: Sobald es Belege gibt, muss das Löschen einer Ausgabe auch das
   Storage-Objekt entfernen — wird dann in 4.3 ergänzt, nicht vorweggenommen.

### **Paket 2.1 — `expenseTracking.tsx` aufteilen (reines Verschieben, keine Verhaltensänderung)** ✅ erledigt

Ausgangslage: `expenseTracking.tsx` hat 1254 Zeilen und enthält fünf Dinge, die nichts
miteinander zu tun haben. Aufteilung nach **Abhängigkeitsrichtung**: Seite → Karte/Dialog/Reducer →
Icons/Typen/Domain. Nichts darf zurück in die Seitendatei importieren (Zirkelbezug).

| Neue Datei (`src/components/Event/ExpenseTracking/`) | Inhalt (heutige Zeilen)                                                                                                             | Ca. Zeilen neu |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `budgetIcons.ts`                                     | `BUDGET_ICON_MAP` + die 12 MUI-Icon-Imports (138–157)                                                                               | ~30            |
| `expenseTracking.reducer.ts`                         | `ReducerActions`, `State`, `DispatchAction`, `initialState`, `expenseTrackingReducer` (159–301)                                     | ~170           |
| `budgetCard.tsx`                                     | `BudgetCard` inkl. `BudgetCardProps` (827–940) und `AddBudgetCard` (942–981)                                                        | ~175           |
| `budgetDetailDialog.tsx`                             | `BudgetDetailDialog`, `BudgetDetailDialogProps`, `BudgetDetailDialogState`, `INITIAL_FORM_STATE`, `AVAILABLE_CURRENCIES` (983–1254) | ~300           |
| `expenseTracking.tsx` (bleibt)                       | `EventExpenseTrackingPage`, Props, `ExpenseTrackingView`, Effekte, Handler, Layout (303–825)                                        | ~580           |

**Warum diese Schnitte**

- `budgetIcons.ts` ist eigenständig, weil **Karte und Dialog** die Map beide brauchen (Icon-Anzeige /
  Icon-Auswahl). Bliebe sie in der Seite, müssten beide aus der Seite importieren → Zirkelbezug.
- Der Reducer ist reine Logik ohne JSX und lässt sich danach einzeln testen (Tests dafür gehören
  nicht in dieses Paket, aber ab 2.3 wird er wichtiger).
- `AddBudgetCard` liegt bei `BudgetCard`: beide sind Karten im selben Raster der Übersicht.
- `AVAILABLE_CURRENCIES` bleibt im Dialog. Das Hochziehen in eine gemeinsame Konstante folgt in
  2.5, wenn der zweite Verbraucher (Ausgaben-Dialog) existiert — nicht spekulativ vorziehen.

**Erlaubte Änderungen** (alles andere ist tabu, siehe unten)

- `import`-/`export`-Zeilen. Vorher nicht exportierte Teile werden exportiert (`BudgetCard`,
  `BudgetDetailDialogState`, Reducer, `ReducerActions`, State-/Action-Typen).
- Die exportierten Reducer-Typen bekommen sprechende Namen: `State` → `ExpenseTrackingState`,
  `DispatchAction` → `ExpenseTrackingAction` (generische Namen sollen nicht aus einem Modul
  exportiert werden). Das ist die **einzige** erlaubte Umbenennung.
- Die Dialog-Tests (vier Tests, die `BudgetDetailDialog` direkt rendern) ziehen in
  `__tests__/budgetDetailDialog.test.tsx` um; der Import in der Seiten-Testdatei ändert sich
  entsprechend. `event.tsx` bleibt unverändert (importiert nur `EventExpenseTrackingPage`).

**Vorgehen in Schritten** — nach jedem Schritt `npx tsc --noEmit` und
`npx jest ExpenseTracking --watchAll=false`, erst dann weiter:

1. `budgetIcons.ts` (kleinster Schnitt, keine Abhängigkeiten) — Seite und Dialog importieren von dort.
2. `expenseTracking.reducer.ts`.
3. `budgetCard.tsx` (`BudgetCard` + `AddBudgetCard`).
4. `budgetDetailDialog.tsx`, danach die Dialog-Tests verschieben.
5. Import-Block der Seite aufräumen: `npm run lint` meldet ungenutzte Imports als **Fehler** und zeigt
   damit genau, was in der Seitendatei übrig ist. Danach Zeilenzahl prüfen.

Tipp fürs Prüfen: `git diff --color-moved=dimmed-zebra` — verschobene Blöcke erscheinen gedimmt, nur
die eigentlichen Änderungen (Import/Export-Zeilen) fallen auf.

**Tabu in diesem Paket** — fällt beim Verschieben etwas auf, wird es in `tech-debt.md` notiert und
**nicht** geändert: Logik, Texte, Styles, Prop-Namen, `data-testid`s, Reihenfolge der Hooks,
Dependency-Arrays, Kommentare umschreiben. Ein Verschiebe-Paket ist nur dann sicher, wenn der Diff
nichts anderes enthält.

**Definition of Done**

- `expenseTracking.tsx` < ~600 Zeilen, jede neue Datei < ~300 Zeilen.
- Alle bestehenden Tests laufen **ohne geänderte Assertions** grün (nur Import-Pfade der
  Dialog-Tests ändern sich); `tsc` und `lint` sauber (0 Fehler).
- `git diff --color-moved` zeigt fast nur Verschiebungen.
- Kurzer Sichttest im Browser (Übersicht öffnen, Karte bearbeiten, Dialog öffnen/schliessen,
  Löschen-Rückfrage): Verhalten identisch zu vorher. Kein Mobile-Test nötig, da kein UI geändert wird.
- Nicht Teil von 2.1: die Datenlade-/Realtime-Logik aus der Seite in einen Hook auslagern — das
  passiert in 2.3b, nach der Datenbasis-Umstellung in 2.3 (Verschieben und Verhaltensänderung
  gehören in getrennte Commits).

### **Paket 2.2 — `expense.class.ts` (reine Domain-Logik, kein UI)** ✅ erledigt

Ziel: alles, was der Ausgaben-Dialog (2.5) und die Liste (2.4) rechnen oder prüfen müssen, als
getestete, reine Funktionen — ohne React, ohne Supabase. Vorbild `budget.class.ts`. Danach
brauchen 2.3–2.5 keine eigene Logik mehr zu erfinden.

**Dateien**

| Datei (`src/components/Event/ExpenseTracking/`) | Inhalt                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `expense.class.ts` (neu)                        | Klasse `Expense` mit vier statischen Methoden (unten)                                           |
| `expense.types.ts` (ergänzen)                   | neuer Typ `ExpenseGroup` (Rückgabe von `groupByBudget`), `ExpenseTotalsByBudget`                |
| `__mocks__/expense.mock.ts` (neu)               | Beispiel-`ExpenseDomain` wie `budget.mock.ts` (gültige Ausgabe, `structuredClone` in den Tests) |
| `__tests__/expense.class.test.ts` (neu)         | Tests, siehe unten                                                                              |
| `constants/text/expenseTracking.ts` (ergänzen)  | Validierungsmeldungen, siehe unten                                                              |

**Signaturen**

```ts
export type ExpenseTotalsByBudget = Record<string, Record<string, number>>; // budgetId → Währung → Rappen
export type ExpenseGroup = {
  budget: BudgetDomain;
  expenses: ExpenseDomain[];                 // neueste zuerst
  totalsByCurrency: Record<string, number>;  // Rappen je Währung
};

Expense.checkExpenseData(expense: ExpenseDomain): void
Expense.sumByBudgetAndCurrency(expenses: ExpenseDomain[]): ExpenseTotalsByBudget
Expense.sortByDateDescending(expenses: ExpenseDomain[]): ExpenseDomain[]
Expense.groupByBudget(expenses: ExpenseDomain[], budgets: BudgetDomain[]): ExpenseGroup[]
```

**`checkExpenseData` — Regeln (Reihenfolge = Reihenfolge der Felder im Dialog)**

1. `label.trim()` leer → `PLEASE_PROVIDE_EXPENSE_LABEL` («Bitte eine Bezeichnung angeben.»).
2. `amountInCents` muss `Number.isInteger` und `> 0` sein → `PLEASE_PROVIDE_AMOUNT` (**bestehende**
   Konstante wiederverwenden, gleiche Aussage wie beim Budget). Deckt 0, negativ, `NaN`,
   `Infinity` und Kommazahlen ab. **Zusätzlich Obergrenze `2_147_483_647`:** die Spalte ist
   `integer`; ein grösserer Wert käme sonst als Postgres-Fehler `22003` beim Speichern zurück
   statt als Hinweis am Feld → eigene Meldung `EXPENSE_AMOUNT_TOO_LARGE`.
3. `budgetId` leer → `PLEASE_SELECT_BUDGET` («Bitte ein Budget wählen.»).
4. `expenseDate` muss ein gültiges `Date` sein (`instanceof Date && !isNaN(getTime())`) →
   `PLEASE_PROVIDE_EXPENSE_DATE`. Der `DatePicker` liefert bei halb getipptem Datum `Invalid Date`.
5. `currency` muss `/^[A-Z]{3}$/` treffen → `PLEASE_PROVIDE_CURRENCY`. Nicht nur «nicht leer»:
   `formatAmountFromCents` benutzt `Intl.NumberFormat`, das bei einem ungültigen Code eine
   `RangeError` wirft und damit die **ganze Liste beim Rendern** zum Absturz bringt.

- Zahlende-Instanz **nicht** prüfen (Epic 3, Platzhalter `no_refund_needed`).
- Wirft `FieldValidationError` (= Nutzerhinweis, kein Sentry), **immer nur den ersten Fehler**, wie
  `checkBudgetData`.

**`sumByBudgetAndCurrency`**

- Leere Liste → `{}`. Nur Budgets/Währungen, für die es Ausgaben gibt, erscheinen als Schlüssel
  (fehlender Schlüssel = 0; der Aufrufer in 2.3 liest mit `?? 0`).
- Rappen sind ganze Zahlen → einfache Addition, keine Rundungsprobleme.
- Verändert die Eingabe nicht.

**`sortByDateDescending`**

- Gibt eine **neue** Liste zurück (`[...expenses].sort(...)`) — `Array.sort` mutiert sonst den
  State des Reducers.
- Vergleich über `expenseDate.getTime()`, absteigend. Gleiches Datum → `label` mit
  `localeCompare("de")`, danach bleibt die Reihenfolge stabil (`sort` ist seit ES2019 stabil).
  Gleiches Datum **und** Bezeichnung → Reihenfolge der Eingabe bleibt.

**`groupByBudget`**

- Ergebnis hat **genau einen Eintrag pro übergebenem Budget, in der Reihenfolge von `budgets`**
  (die Seite sortiert die Budgets bereits; die Liste soll dieselbe Reihenfolge wie die Übersicht
  haben). Budgets ohne Ausgaben ergeben `expenses: []` und `totalsByCurrency: {}`.
- Ausgaben innerhalb der Gruppe: `sortByDateDescending`. Summen: `sumByBudgetAndCurrency`.
- **Ausgabe mit unbekannter `budgetId`** (Budget gerade in einer anderen Sitzung gelöscht,
  Realtime-Reload noch nicht durch — wegen `ON DELETE RESTRICT` sonst nicht möglich): wird
  **ausgelassen**, nicht geworfen und nicht in eine Sammelgruppe gepackt. Bewusst dokumentiert im
  JSDoc und im Test, damit es später niemand als Bug meldet.

**Aufräumen im Vorbeigehen (klein, gehört thematisch hierher):** Der Kommentar-Block über
`class Budget` in `budget.class.ts` beschreibt eine Funktion, die es nicht mehr gibt
(`computeBudgetPerPersonPerDayAmount`) und steht doppelt vor der Klasse — beim Anlegen von
`expense.class.ts` nicht kopieren. Aufräumen nur, wenn es den Commit nicht aufbläht.

**Texte** (`constants/text/expenseTracking.ts`, gleicher Stil wie oben in der Datei)

`PLEASE_PROVIDE_EXPENSE_LABEL`, `EXPENSE_AMOUNT_TOO_LARGE`, `PLEASE_SELECT_BUDGET`,
`PLEASE_PROVIDE_EXPENSE_DATE`, `PLEASE_PROVIDE_CURRENCY`. (Feldbeschriftungen für den Dialog
kommen erst in 2.5.)

**Tests** (`expense.class.test.ts`, Mutationsprobe wie in 1.5: Regel im Code kaputtmachen → Test
muss rot werden)

- `checkExpenseData`: gültige Ausgabe wirft nicht; je Feld ein Test (Bezeichnung leer und nur
  Leerzeichen; Betrag `0`, `-1`, `12.5`, `NaN`, `2_147_483_648`, Grenzfall `2_147_483_647` ist
  **gültig**; `budgetId` leer; `Invalid Date`; Währung `""`, `"chf"`, `"CH"`); wirft ein
  `FieldValidationError` (nicht nur irgendeinen `Error`); bei zwei Fehlern gewinnt der erste.
- `sumByBudgetAndCurrency`: leere Liste; zwei Budgets; **CHF und EUR im selben Budget getrennt**;
  Eingabe bleibt unverändert.
- `sortByDateDescending`: neueste zuerst; Gleichstand nach Bezeichnung; Originalliste
  unverändert (Referenz **und** Reihenfolge).
- `groupByBudget`: Reihenfolge der Budgets bleibt; leeres Budget → leere Gruppe; Summen je
  Währung; Ausgabe mit unbekannter `budgetId` taucht nirgends auf; leere Ausgabenliste.

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`,
`npm run lint` sauber; `expense.class.ts` importiert weder React, MUI noch Supabase; keine
bestehende Datei ausser `expense.types.ts` und `constants/text/expenseTracking.ts` geändert.

### **Paket 2.3 — Datenbasis umstellen (Refactor, noch kein neues UI ausser Fremdwährungszeile)** ✅ erledigt

Ziel: Die Seite hält `state.expenses` statt `state.spentAmounts`. Der Fortschritt einer Karte
wird daraus abgeleitet und zählt **nur die Budget-Währung** (Entscheidung 2); Beträge in anderen
Währungen erscheinen als Zusatzzeile. Danach gibt es eine Datenquelle für Karten, Liste (2.4)
und später Dashboard/«Offene Beträge» (Epic 3/6).

**Wichtigste Entscheidung: die Ableitung wird eine reine Funktion, nicht `useMemo`-Code in der
Seite.** Wie in 2.2 gilt: Logik, die man ohne React testen kann, gehört in `budget.class.ts`.
Sonst braucht jeder Randfall (Fremdwährung, Währungswechsel) einen schweren Seitentest.

**Neue/geänderte Bausteine**

| Datei                                | Änderung                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `budget.class.ts`                    | neue statische Methode `Budget.getSpentAmounts(budget, totalsByCurrency)` (unten)                                                                      |
| `budget.types.ts`                    | `BudgetWithProgress` bekommt `otherCurrencySpent: {currency: string; amountInCents: number}[]` (JSDoc ergänzen)                                        |
| `expenseTracking.reducer.ts`         | `State.spentAmounts` → `State.expenses: ExpenseDomain[] \| null`; Payload `{budgets, expenses}`; Action `BUDGETS_FETCH_SUCCESS` → `DATA_FETCH_SUCCESS` |
| `expenseTracking.tsx`                | `fetchBudgets`/`loadBudgets` → `fetchData`/`loadData`; lädt **parallel** (`Promise.all`); `useMemo` für die Summen; Löschen-Vorprüfung                 |
| `budgetCard.tsx`                     | eine Zusatzzeile je Fremdwährung                                                                                                                       |
| `constants/text/expenseTracking.ts`  | Text für die Zusatzzeile (Funktion mit Betrag + Währung, wie `SPENT_AMOUNT`)                                                                           |
| `ExpenseRepository.ts`               | `getSpentAmountsByBudget` entfernen; `getExpensesForEvent` bekommt einen Test                                                                          |
| `__tests__/expenseTracking.test.tsx` | Mock `getExpensesForEvent` statt `getSpentAmountsByBudget`, Helfer nimmt `ExpenseDomain[]`                                                             |

**`Budget.getSpentAmounts(budget, totalsByCurrency)`**

- `totalsByCurrency` ist `totals[budget.id]` aus `Expense.sumByBudgetAndCurrency` (oder `undefined`,
  wenn das Budget keine Ausgaben hat — dann `{}` behandeln).
- Rückgabe `{spentInCents: number; otherCurrencies: {currency; amountInCents}[]}`:
  `spentInCents` = Summe in **`budget.currency`** (0, wenn keine); `otherCurrencies` = alle
  anderen Währungen, **alphabetisch nach Code sortiert** (stabile Anzeige, kein Springen bei
  einem Reload).
- Reine Funktion, kein React. Prozent, Ampelfarben und Sollbetrag bleiben unverändert in der
  Seite bzw. Karte.

**Seite (`expenseTracking.tsx`)**

1. `fetchData`: `const [budgets, expenses] = await Promise.all([database.budgets.getBudgetsForEvent(event.uid), database.expenses.getExpensesForEvent(event.uid)])`.
   Bisher liefen die zwei Abfragen nacheinander. Schlägt eine fehl, wirft `Promise.all` einmal
   und `handleError` meldet einmal. Kontext-Text für Sentry: «Budgets und Ausgaben laden».
2. Zwei `useMemo`, damit nicht bei jedem Budget-Edit alle Ausgaben neu summiert werden:
   `expenseTotals = useMemo(() => Expense.sumByBudgetAndCurrency(state.expenses ?? []), [state.expenses])`
   und darauf aufbauend `budgetsWithProgress` (Dependencies: `state.budgets`, `expenseTotals`,
   `groupConfiguration`, `event.numberOfDays`).
3. Löschen-Vorprüfung: `state.expenses?.some((expense) => expense.budgetId === budget.id)`.
   **Unabhängig von der Währung** — sonst gäbe eine reine Fremdwährungs-Ausgabe das Löschen
   frei, und die Datenbank antwortet mit dem FK-Fehler. Ist `state.expenses` noch `null`
   (nicht geladen), wird wie bisher nicht vorab gesperrt; der FK-Fallback bleibt.
4. Der Reducer setzt bei `DATA_FETCH_SUCCESS` beide Felder auf einmal (kein Zwischenzustand mit
   Budgets, aber ohne Ausgaben → sonst kurz alle Balken auf 0).
5. `BUDGET_CREATED/UPDATED/DELETED` bleiben unverändert (fassen `expenses` nicht an).

**Randfälle, die es zu bedenken gilt**

- **Budget-Währung nachträglich ändern** (Bearbeiten-Dialog, CHF → EUR) bei vorhandenen
  Ausgaben: Die bisherigen CHF-Ausgaben zählen dann nicht mehr zum Fortschritt, sondern stehen als
  Fremdwährung darunter. Das ist durch die Ableitung konsistent und **gewollt** — keine Sperre.
  Es gehört aber als Test in `budget.class.test.ts`.
- **`findMany` liest höchstens 1000 Zeilen** (PostgREST `db-max-rows`, siehe Tech-Debt-Eintrag):
  Mehr Ausgaben würden **stillschweigend** abgeschnitten, Summen wären zu klein. Vorher hatte
  `getSpentAmountsByBudget` dieselbe Grenze — es entsteht keine Verschlechterung. Bewusst nicht
  paginieren (Entscheidung 1: ein Lager hat Hunderte Ausgaben), aber **in `tech-debt.md`
  eintragen** («Ausgaben-Liste bei > 1000 Zeilen abgeschnitten», Priorität tief).
- **Sortierung:** `getExpensesForEvent` sortiert nach `expense_date`; die Anzeige sortiert selbst
  (`Expense.sortByDateDescending`) — die Repository-Sortierung ist für die App bedeutungslos,
  ändert aber nichts. Nicht anfassen.
- **Realtime:** In diesem Paket gibt es **noch keine** Subscription auf `event_expenses` (kommt in
  2.7). Der bestehende Budget-Reload lädt aber jetzt auch die Ausgaben mit (gemeinsames
  `loadData`) — das ist so gewollt.

**Reihenfolge (nach jedem Schritt `npx tsc --noEmit` und `npx jest ExpenseTracking --watchAll=false`)**

1. `Budget.getSpentAmounts` + Typ `otherCurrencySpent` + Unit-Tests in `budget.class.test.ts`
   (noch **nicht** verdrahtet — alles bleibt grün).
2. Test für `ExpenseRepository.getExpensesForEvent` (Filter `event_id`, Mapping) in
   `ExpenseRepository.test.ts`.
3. Reducer und Seite umstellen (Schritt 1 aus «Seite» bis 4), Test-Helfer anpassen. Die
   bestehenden Assertions bleiben — nur die Mock-Daten ändern sich
   (`renderUnlockedPage(initialBudgets, expenses)`). Grün heisst: Verhalten unverändert.
4. Löschen-Vorprüfung auf `state.expenses.some(...)` und der Test dazu.
5. `BudgetCard`: Zusatzzeilen (Style `budgetSecondaryCurrencyRow` ist vorhanden) + Text + Test.
6. `getSpentAmountsByBudget` löschen (kein Test vorhanden, `grep` muss danach leer sein),
   Tech-Debt-Eintrag.

**Tests**

- `budget.class.test.ts` (`getSpentAmounts`): keine Ausgaben (`undefined` und `{}`) → 0 und leere
  Liste; nur Budget-Währung; **Budget-Währung + Fremdwährung getrennt**; nur Fremdwährung
  (`spentInCents` = 0, Zeile vorhanden); zwei Fremdwährungen **alphabetisch**; Währungswechsel
  des Budgets ordnet um; Eingabe unverändert.
- Seite: bestehende Tests grün; Fremdwährung zählt nicht zum Fortschritt (Balken/Prozent);
  Zusatzzeile sichtbar mit Betrag und Währung; **Löschen-Sperre auch bei reiner
  Fremdwährungs-Ausgabe**; Realtime-Reload lädt Ausgaben mit (`getExpensesForEvent` zweimal
  aufgerufen).
- **Mutationsproben:** `budget.currency`-Vergleich in `getSpentAmounts` entfernen → Fremdwährungs-
  Test rot; `some(...)` durch Summen-Prüfung in der Budget-Währung ersetzen → Fremdwährungs-
  Löschen-Test rot; Sortierung der Fremdwährungen weglassen → Reihenfolge-Test rot.

**Sichttest im Browser (DEV, nie PROD).** Ohne Erfassungsdialog per SQL in die **DEV**-DB
(`supabase-db-*`, nicht PROD) einfügen; Werte in `<…>` ersetzen:

```sql
INSERT INTO public.event_expenses
  (event_id, budget_id, expense_date, amount_in_cents, currency, label, payee_type)
VALUES
  ('<event-uuid>', '<budget-uuid>', CURRENT_DATE, 4200, 'CHF', 'TEST Migros', 'no_refund_needed'),
  ('<event-uuid>', '<budget-uuid>', CURRENT_DATE, 1000, 'EUR', 'TEST Aldi',   'no_refund_needed');
-- Aufräumen:
DELETE FROM public.event_expenses WHERE label LIKE 'TEST %';
```

Prüfen: Balken zählt nur die CHF-Ausgabe, EUR erscheint als Zusatzzeile; Löschen des Budgets
zeigt die Sperr-Meldung; **Mobile-Ansicht** (Karte wird höher, darf nichts abschneiden);
Budget-Währung im Bearbeiten-Dialog ändern → Zeilen tauschen die Rollen.

**Definition of Done:** `getSpentAmountsByBudget` und `state.spentAmounts` kommen im Code nicht
mehr vor (`grep`); `tsc`, `lint`, `jest ExpenseTracking` sauber; `budget.class.ts` importiert
weder React noch Supabase; Tech-Debt-Eintrag zur 1000-Zeilen-Grenze vorhanden.

### **Paket 2.3b — Datenlade-/Realtime-Logik in einen Hook auslagern (reines Verschieben)** ✅ erledigt

Empfehlung: **eigenes Paket und eigener Commit nach 2.3** — nicht in 2.3 hineinmischen. Ein
Commit, der die Datenbasis ändert **und** Code verschiebt, ist nicht mehr prüfbar (in 2.1 war
genau das Prinzip: Verschieben ohne Verhaltensänderung). Es muss aber **vor 2.5** passieren,
weil 2.5 (Handler für Anlegen) und 2.7 (zweite Subscription) die Seite sonst weit über 700
Zeilen treiben.

- Neue Datei `useExpenseTrackingData.ts`: `useReducer`, `handleError`, `fetchData`/`loadData`,
  Erstlade-Effekt, Realtime-Effekt (Budgets), Rückgabe `{state, dispatch, loadData}`. Die Seite
  behält Handler, `useMemo`-Ableitungen und Layout.
- Dependencies der Effekte **unverändert** übernehmen (Tabu wie in 2.1: nichts «nebenbei»
  verbessern). Bestehende Seitentests laufen ohne geänderte Assertions grün; die Callbacks der
  Realtime-Tests werden weiter aus dem Mock gelesen.
- Zeilen: Seite danach < ~500.

### **Paket 2.4 — Ausgaben-Ansicht (Liste, nur lesen)** ✅ erledigt

Ziel: Toggle «Ausgaben» zeigt eine gruppierte, sortierte Liste aller Ausgaben — reine Darstellung von Daten, die bereits in `state.expenses` liegen (2.3) und bereits von `Expense.groupByBudget()` (2.2) richtig gruppiert/sortiert/summiert werden. Dieses Paket schreibt keine neue Berechnungslogik, nur eine neue Komponente plus die Verdrahtung.

**Wichtiger Fund beim Durchsehen der Seite:** Das Grid mit den Budget-Karten hängt aktuell **nicht** von `view` ab — es wird immer gerendert, sobald `hasDonation === true`, unabhängig vom Toggle-Zustand. Der Toggle selbst schaltet nur seinen eigenen `value` um, sonst passiert nichts. Dieses Paket muss also zusätzlich zum reinen Aktivieren des Buttons:

1. Das bestehende `<Grid container>` (Budget-Karten + `AddBudgetCard`) in `{view === "overview" && (...)}` einpacken.
2. Einen neuen Zweig `{view === "expenses" && (...)}` ergänzen, der `ExpenseList` rendert.

Ohne diese zwei Änderungen zeigt das Aktivieren des Toggles nichts Neues an.

**Dateien**

| Datei | Inhalt |
|---|---|
| `expenseList.tsx` (neu) | `ExpenseList` (exportiert) + private Unterkomponenten `ExpenseGroupHeader`, `ExpenseRow` (nicht exportiert, wie `AddBudgetCard` neben `BudgetCard`) |
| `__tests__/expenseList.test.tsx` (neu) | Tests für `ExpenseList`, siehe unten |
| `expenseTracking.tsx` | neuer `useMemo` `expenseGroups`; Grid + neuer Zweig hinter `view` verzweigt; Toggle-Button nicht mehr `disabled`; `handleExpenseClick`-Stub |
| `constants/text/expenseTracking.ts` | `NO_EXPENSES`-Text |

**Entscheidung: `List`/`ListSubheader`/`ListItemButton` statt DataGrid oder Card-pro-Zeile.** Diskutiert und bewusst verworfen:

- **DataGrid** (wie in den Admin-Seiten und in `products.tsx`/`materials.tsx`): Das Projekt nutzt die Community-Edition (`@mui/x-data-grid`, kein `-pro`/`-premium`) — Zeilengruppierung mit Zwischensummen (genau das, was ein Budget-Kopf mit Währungssummen braucht) ist dort eine **Pro-Funktion**, in diesem Projekt nirgends verwendet. Ohne Pro müsste man Gruppenköpfe als synthetische Zeilen ins flache Datenmodell einschleusen und Sortierung/Klick um sie herum sonderbehandeln. Ausserdem gäbe es zwei komplette Implementierungen (Tabelle + Karten) für dieselben Daten — doppelte Tests, doppelte Pflege bei jedem neuen Feld (Epic 3 Zahlende Instanz, Epic 4 Beleg-Icon). Kein bestehendes Cook-facing Feature der App macht das; DataGrid kommt bisher nur bei Verwaltungsaufgaben vor (Admin-Seiten, Produkte/Materialien — dort ohne jede Mobile-Anpassung, also kein Beleg dafür, dass es auf dem Handy gut funktioniert).
- **`Card` pro Zeile** (wie `BudgetCard`): passt für wenige, eigenständige Objekte in einem Grid, aber für eine Transaktionsliste mit potenziell Dutzenden Zeilen wirkt ein Rahmen + Radius + Padding pro Zeile visuell schwer und weniger "listenhaft" als Zeilen mit Trennlinien.
- **Gewählt: `List`** — hat in der App bereits Präzedenz (`Menuplan/menuplan.menucard.list.tsx` nutzt `List`/`ListItem`/`ListItemButton`/`ListItemText` für eine vergleichbare Zeilenliste). `ListItemButton` ist ein spezialisiertes `ButtonBase` mit eingebautem `divider` (Trennlinie statt manuellem `borderBottom`) und Tastatur-/Fokus-Verhalten geschenkt. `ListSubheader` ist genau für «beschrifteter Abschnitt innerhalb einer Liste» gebaut — inkl. optionalem `sticky`, damit der Budget-Name beim Scrollen durch viele Ausgaben sichtbar bleibt.

**`ExpenseList` — Props und Verhalten**

```ts
type ExpenseListProps = {
  expenseGroups: ExpenseGroup[];
  onEditClick: (expenseId: string) => void;
};
```

- Gruppen **ohne** Ausgaben werden **nicht** angezeigt (kein leerer Gruppenkopf «Küche: —» für jedes frisch angelegte Budget — das wäre bei wenigen erfassten Ausgaben nur Rauschen). Reihenfolge der angezeigten Gruppen folgt `expenseGroups` (= Reihenfolge der Budgets, wie in der Übersicht). Pro Gruppe: eine `<ListSubheader>` gefolgt von einer eigenen `<List>` mit den Zeilen dieser Gruppe (nicht eine grosse `<List>` über alle Gruppen — Subheader gehören semantisch zu ihrer eigenen Liste).
- **Leerzustand der ganzen Liste** («Noch keine Ausgaben»): wenn **keine** Gruppe Ausgaben hat (`expenseGroups.every((group) => group.expenses.length === 0)`), nicht erst wenn `expenseGroups` leer ist — Budgets existieren ja bereits, bevor die erste Ausgabe erfasst wird.
- **Gruppenkopf** (`ExpenseGroupHeader`, rendert `<ListSubheader>`): Icon (`BUDGET_ICON_MAP[group.budget.icon]`, wie `BudgetCard`), Name des Budgets, Summen aus `group.totalsByCurrency` — bei mehreren Währungen alle nebeneinander, Reihenfolge alphabetisch nach Code (gleiches Muster wie die Fremdwährungs-Sortierung in `Budget.getSpentAmounts`, Konsistenz zur Übersicht).
- **Zeile** (`ExpenseRow`, rendert `<ListItemButton divider onClick={...}>`): Datum (`expense.expenseDate`, Format wie im Rest der App — `dayjs`/vorhandene Datums-Utility prüfen, nicht neu erfinden) und Betrag (`formatAmountFromCents`) als eigene `Typography` links/rechts der `<ListItemText primary={expense.label} secondary={expense.comment || undefined} />` — `ListItemText` blendet `secondary` automatisch aus, wenn `undefined` übergeben wird, kein manuelles `comment && (...)` nötig. Layout responsiv über die `sx`-Prop selbst, **nicht** über zwei Komponenten: `sx={{flexDirection: {xs: "column", md: "row"}}}` — mobil gestapelt (Datum/Betrag über/unter Bezeichnung+Kommentar), auf Desktop eine Zeile, wirkt dann tabellenartig, ohne eine Tabelle zu sein. Gleiches DOM, gleiche Tests, nur CSS unterscheidet sich je Breakpoint. `data-testid={`expense-${expense.id}`}` (Muster wie `data-testid={budget.id}` bei `BudgetCard`). Kein manuelles `role="button"` + `onKeyDown` nötig — das übernimmt `ListItemButton`.
- Innerhalb einer Gruppe ist die Sortierung (neueste zuerst) bereits durch `Expense.sortByDateDescending()` in `groupByBudget()` erledigt — `ExpenseList` sortiert nichts selbst, rendert nur in der gelieferten Reihenfolge.

**Seite (`expenseTracking.tsx`)**

```ts
const expenseGroups = React.useMemo(
  () => Expense.groupByBudget(state.expenses ?? [], state.budgets ?? []),
  [state.expenses, state.budgets],
);
```

Eigener `useMemo`, unabhängig von `expenseTotals`/`budgetsWithProgress` aus 2.3 — berechnet die Summen zwar noch einmal (leichte Redundanz), bleibt aber unabhängig und einfach; bei hunderten, nicht tausenden Ausgaben (Entscheidung 1) ist das keine Performance-Frage. Nicht vorzeitig zusammenlegen.

`handleExpenseClick` ist in diesem Paket ein Stub, der noch nichts tut — die Anbindung an einen Bearbeiten-Dialog kommt mit 2.6:

```ts
/** Öffnet den Bearbeiten-Dialog für eine Ausgabe. Wird in Paket 2.6 angebunden. */
const handleExpenseClick = (_expenseId: string) => {};
```

**Toolbar-Entscheidung:** Der «Neues Budget»-Button wird nur bei `view === "overview"` gezeigt. Im Ausgaben-Tab gibt es in diesem Paket bewusst noch keinen Erfassungs-Button (siehe unten) — ihn trotzdem stehen zu lassen wäre irreführend (Klick würde einen Budget-Dialog öffnen, während die sichtbare Liste Ausgaben zeigt). Paket 2.5 ergänzt einen spiegelbildlichen «Neue. Ausgabe»-Button, der nur bei `view === "expenses"` erscheint.

**Kein «Neue Ausgabe»-Button in diesem Paket.** Der Dialog dafür kommt erst mit 2.5; ein Button ohne funktionierenden Dialog dahinter wäre nur eine Attrappe.

**Texte** (`constants/text/expenseTracking.ts`)
`NO_EXPENSES = "Noch keine Ausgaben."` (gleicher Stil/Interpunktion wie die übrigen
Meldungen in der Datei).

**Zum Ansehen im Browser** (DEV, nie PROD): gleiches SQL-Snippet wie in Paket 2.3 (zwei
Test-Ausgaben einfügen, danach `DELETE ... WHERE label LIKE 'TEST %'`). Prüfen: Gruppen in Budget-Reihenfolge, neueste Ausgabe pro Gruppe zuerst, Kommentarzeile nur wenn vorhanden, Leerzustand bei einem frisch angelegten Event ohne Ausgaben, Umschalten zwischen «Übersicht» und «Ausgaben» zeigt/versteckt die richtigen Bereiche. **Mobile-Ansicht zwingend prüfen**
(Entscheidung 6: Ausgaben werden im Lager am Handy erfasst) — gestapelte Zeilen, keine
horizontale Scrollbar, Touch-Ziele der Zeilen gross genug.

**Tests** (`expenseList.test.tsx`, eigene Datei wie `budgetCard`/`budgetDetailDialog` — keine Seite, kein Realtime, kein Rerender-Gefrickel nötig)

- Gruppierung: Ausgaben erscheinen unter dem richtigen Budget-Kopf, Reihenfolge der Gruppen folgt `expenseGroups`.
- Sortierung **innerhalb** einer Gruppe wird tatsächlich gerendert (nicht nur von `groupByBudget()` geliefert) — Testdaten bewusst nicht schon sortiert übergeben.
- Summen je Währung im Gruppenkopf, inkl. **mehrere Währungen in einer Gruppe**.
- Betragsformat: **`getDefaultNormalizer()` verwenden** beim Textvergleich mit `formatAmountFromCents(...)` — sonst dieselbe Falle mit dem geschützten Leerzeichen
 (`\u00A0`) wie beim Fremdwährungs-Test in 2.3.
- Kommentarzeile erscheint nur, wenn `comment` gesetzt ist; fehlt bei `comment: null`.
- Leerzustand: keine Gruppe hat Ausgaben → «Noch keine Ausgaben», keine Gruppenköpfe sichtbar.
- Gruppe ohne Ausgaben (aber andere Gruppen mit welchen) wird **nicht** angezeigt.
- Klick auf eine Zeile ruft `onEditClick` mit der richtigen Ausgaben-ID auf.

Auf Seitenebene (`expenseTracking.test.tsx`) reicht ein kleiner Integrationstest: Umschalten auf «Ausgaben» zeigt `ExpenseList` und versteckt das Budget-Grid, und umgekehrt — die Detailprüfungen (Gruppierung, Summen, Klick) gehören in `expenseList.test.tsx`, nicht dupliziert auf Seitenebene.

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` sauber; `expenseList.tsx` enthält keine Berechnungslogik (nur `groupByBudget()` aufrufen und rendern); Toggle nicht mehr `disabled`; bestehende Tests unverändert grün bis auf die neue Sichtbarkeits-Logik; Sichttest Desktop **und** Mobile gemacht.

### **Paket 2.5 — Ausgabe anlegen**

- `ExpenseDetailDialog` (Anlegen **und** Bearbeiten-Struktur, Entscheidung 4): Datum
  (`DatePicker`, Vorbelegung heute), Betrag + Währung (Vorbelegung = Währung des Budgets),
  Bezeichnung, Kommentar (mehrzeilig, optional), Budget (Auswahl; vorbelegt mit dem zuletzt
  verwendeten, sonst dem ersten). Auf xs im Vollbild.
- `AVAILABLE_CURRENCIES` aus dem Budget-Dialog in eine gemeinsame Konstante heben (jetzt gibt es
  den zweiten Verbraucher) — Betragsparsing (`parseAmountToCents`) wird bereits geteilt.
- Toolbar-Button «Neue Ausgabe» (in der Ausgaben-Ansicht); ohne Budget deaktiviert mit Hinweis
  (Entscheidung 7). Speichern: `Expense.checkExpenseData` → `createExpense` mit Platzhalter
  `payee_type = 'no_refund_needed'` (Entscheidung 3) → Reducer-Aktion → Snackbar; Fehler über
  `handleError`. Analytics-Event `EXPENSE_CREATED`.
- **Tests:** Dialog-Validierung (leer, Betrag ≤ 0, kein Budget), `onCreate`-Payload,
  Seite: Anlegen aktualisiert Liste **und** Fortschrittsbalken der Karte, Fehlerfall,
  Platzhalter-Werte werden geschrieben, ein Datum kurz vor Mitternacht landet als richtiger
  Kalendertag (Repository-Test mit `formatLocalDate`).

### **Paket 2.6 — Ausgabe bearbeiten und löschen**

- Klick auf eine Zeile öffnet den Dialog vorbefüllt (Betrag `toFixed(2)`, Datum lokal). Budget
  wechseln ist erlaubt; die Summen ziehen live nach (abgeleitet, Entscheidung 1).
- Löschen mit Bestätigung (`DialogType.Confirm`), Text mit Bezeichnung und Betrag der Ausgabe.
  Analytics-Events `EXPENSE_UPDATED`/`EXPENSE_DELETED`, Fehler über `handleError`.
- **Tests analog 1.5:** Vorbefüllung, `updateExpense`-Payload, Löschen mit Bestätigung/Abbruch,
  Fehlerfälle (Speichern und Löschen), Budget-Wechsel verschiebt die Summe zwischen den Karten.
- **Randfall:** Eine andere Sitzung hat die Ausgabe schon gelöscht → Fehlermeldung statt
  stillem Nichts (`update` findet keine Zeile).

### **Paket 2.7 — Realtime für Ausgaben**

- `ExpenseRepository.subscribeToExpenses(eventId, onChange, onError, onStatusChange)` (Channel
  `expenses:${eventId}`, Binding `event_expenses`, Muster `BudgetRepository.subscribeToBudgets`).
  Die Seite meldet den zweiten Status unter dem Key `"expenses"` an; beide Subscriptions rufen
  `loadData()` (Entscheidung 8), Reload auch nach Wiederverbindung. Publication und
  `REPLICA IDENTITY FULL` sind seit 0.3 vorhanden — keine Migration.
- Als `useEffect` mit stabilen Funktionen aus `useRealtimeConnectionStatus()` als Dependencies
  (das zurückgegebene Objekt selbst ist pro Render neu — siehe Tech-Debt-Eintrag).
- **Tests:** Callback aus dem Mock auslesen → neue Ausgabe erscheint in der Liste **und** im
  Fortschritt der Karte; Löschung verschwindet; nur eine Subscription pro Tabelle; `unsubscribe`
  beim Verlassen. Danach **Mutationsprobe** (Regel aus der Checkliste).

### **Paket 2.8 — Hervorhebung von Fremdänderungen (optional)**

- Karten und Zeilen, die eine **andere** Sitzung geändert oder angelegt hat, leuchten 2 Sekunden
  auf (`classes.remoteChangeGlow`, Vorbild `materialList.tsx`). Diff nach ID und Feldern zwischen
  altem und neuem State, nur bei Realtime-Reloads, nicht beim Erstladen.
- Eigene Änderungen leuchten nicht: ein Zähler `pendingWritesRef` (vor dem Schreibaufruf +1, im
  `finally` −1) unterdrückt die Hervorhebung, solange ein eigener Save läuft (das Echo kann vor
  der HTTP-Antwort eintreffen).
- **Nur umsetzen, wenn 2.1–2.7 stabil sind** — rein kosmetisch, darf Epic 2 nicht aufhalten.

**Abschluss von Epic 2:** kurzer Rückblick (analog oben) und Feinplanung von Epic 3 mit den
dann gemachten Erfahrungen; insbesondere prüfen, ob die Platzhalter-Lösung (Entscheidung 3)
im Dialog sauber ersetzbar war.

## Epic 3 — Zahlende Instanz

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 3.1 Auswahl-UI im Ausgaben-Dialog: bestehende Person (aus `event_cooks`), neue Person
  (Freitext), "keine Rückerstattung nötig".
- 3.2 Aggregation "Offene Beträge pro Person" (reine Funktion, UI-Vorschau — volle
  Dashboard-Integration folgt in Epic 6).

## Epic 4 — Belege (Attachments)

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 4.1 Storage-RLS-Migration: neue Policy-Variante für `media`-Bucket unter
  `events/<eventId>/expenses/<expenseId>/<filename>` (beliebiger Dateiname, anders als das
  hartkodierte `cover.jpg`-Muster), Insert/Select/Delete über `is_event_cook`.
- 4.2 `ExpenseAttachmentStorageRepository` + Upload/Löschen im Ausgaben-Dialog (PDF/Bild,
  Grössen-/Typ-Validierung, Hinweistext "wird nach 1 Jahr gelöscht").
- 4.3 Anzeige/Download/Löschen des Belegs in der Ausgaben-Liste.

## Epic 5 — Profil: Zahlungsangaben

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 5.1 Migration `user_payment_details` (1:1 zu `auth.users`, Adresse + IBAN, Owner-only RLS).
- 5.2 `PaymentDetailsRepository` + neue `PaymentDetailsCard`-Komponente in `userProfile.tsx`s
  bestehendem `<Stack>` (kein neuer Tab — die Profilseite hat keine Tabs, sondern eine
  Card-Liste, siehe bestehende `DonationsCard`).

## Epic 6 — Dashboard & Kennzahlen

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 6.1 `@mui/x-charts` als Dependency, reine Aggregationsfunktionen mit Tests (keine UI).
- 6.2 Ist/Soll-Fortschrittsbalken pro Budget (`LinearProgress`, farblich gestuft).
- 6.3 Hochrechnung (linear).
- 6.4 Ausgabenverlauf-Liniendiagramm (`LineChart`, inkl. Soll-Referenzlinie).
- 6.5 Verteilung-Donut (`PieChart`) nach Budget.
- 6.6 Restliche Kennzahlen: Ø/Teilnehmer:in, Ø/Mahlzeit (aus Menüplan), Top-5-Ausgaben, Ausgaben
  ohne Beleg, volle "Offene Beträge pro Person" (baut auf 3.2 auf).

## Epic 7 — PDF-Abrechnung

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 7.1 Reine Datenaufbereitung für Modus A (pro Person) und Modus B (pro Person + Budget), mit
  Tests.
- 7.2 `abrechnungPdf.tsx`-Dokumentkomponente + Modus-Auswahl-Dialog +
  `generateAndDownloadPdf()`-Anbindung (Vorbild `DonationReceiptPdf.tsx`).
- 7.3 Adress-/IBAN-Eingabeschritt vor Generierung (Prefill aus Profil bei Opt-in, sonst leeres
  Formular + Speicher-Checkbox), nummerierte Belege als Anhang.

## Epic 8 — Export (CSV/ZIP)

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 8.1 CSV-Export (String-Join + Blob, keine neue Dependency).
- 8.2 `jszip`-Dependency, ZIP-Export nummerierter Belege passend zu CSV/PDF-Referenz.

## Epic 9 — Beleg-Löschkonzept (Cron + Mail)

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 9.1 Cron-Erweiterung: Belege löschen (Storage-Objekt + Spalten null setzen), wenn
  Anlassende > 1 Jahr zurückliegt (Vorbild `cleanupTable`/`cron-housekeeping`, aber Filter über
  Event-Enddatum statt `created_at`).
- 9.2 Neues E-Mail-Template (`templateRenderer.ts`) + Cron-Job "30 Tage vorher" (Vorbild
  `cron-event-review-email`), Empfänger je nach Zahlungsinstanz-Zusammensetzung (siehe Issue).
- 9.3 Hinweistext beim Event-Löschen ergänzen ("löscht auch alle Belege").

## Epic 10 — Politur & Abschluss

_Wird vor Start verfeinert. Grober Zuschnitt:_

- 10.1 Voller Regressionslauf (`tsc`, `lint`, `test`), Mobile/Tablet-Check aller neuen Screens.
- 10.2 Finaler PR gegen `develop` + Release-Notes-Text.

---

## Verifikation pro Paket (generische Checkliste)

1. `npx tsc --noEmit -p tsconfig.json` — clean.
2. Betroffene Tests gezielt: `npx jest <Muster> --watchAll=false` (`npm run test` startet den
   Watch-Modus und kennt kein `--filter`).
3. `npm run lint` — 0 Fehler.
4. Bei UI-Paketen: manuell im Browser prüfen, inkl. Mobile-Viewport (CLAUDE.md-Pflicht).
5. Bei Migrationen: transaktional gegen die laufende `-test`-DB anwenden (`supabase db reset`
   ist mit der CLI blockiert), bei RLS-Änderungen mit unterschiedlichen Rollen/Usern testen.
6. Review **vor** dem Commit (siehe Arbeitsvereinbarung), dann Commit auf `feature/expense-tracking`.
