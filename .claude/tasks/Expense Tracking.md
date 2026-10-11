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

## Epic 2 — Ausgaben: Kern-CRUD (ohne Zahlungsinstanz/Beleg) ✅ erledigt


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
4. `date` muss ein gültiges `Date` sein (`instanceof Date && !isNaN(getTime())`) →
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
- Vergleich über `date.getTime()`, absteigend. Gleiches Datum → `label` mit
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
- **Zeile** (`ExpenseRow`, rendert `<ListItemButton divider onClick={...}>`): Datum (`expense.date`, Format wie im Rest der App — `dayjs`/vorhandene Datums-Utility prüfen, nicht neu erfinden) und Betrag (`formatAmountFromCents`) als eigene `Typography` links/rechts der `<ListItemText primary={expense.label} secondary={expense.comment || undefined} />` — `ListItemText` blendet `secondary` automatisch aus, wenn `undefined` übergeben wird, kein manuelles `comment && (...)` nötig. Layout responsiv über die `sx`-Prop selbst, **nicht** über zwei Komponenten: `sx={{flexDirection: {xs: "column", md: "row"}}}` — mobil gestapelt (Datum/Betrag über/unter Bezeichnung+Kommentar), auf Desktop eine Zeile, wirkt dann tabellenartig, ohne eine Tabelle zu sein. Gleiches DOM, gleiche Tests, nur CSS unterscheidet sich je Breakpoint. `data-testid={`expense-${expense.id}`}` (Muster wie `data-testid={budget.id}` bei `BudgetCard`). Kein manuelles `role="button"` + `onKeyDown` nötig — das übernimmt `ListItemButton`.
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

### **Paket 2.5 — Ausgabe anlegen** ✅ erledigt

Ziel: `ExpenseDetailDialog` nach dem Vorbild von `BudgetDetailDialog` (Entscheidung 4 — von Anfang an mit `onCreate`/`onEdit`/`onDelete`, damit hier keine spätere Umbenennung wie `CreateBudgetDialog` → `BudgetDetailDialog` nötig wird). Dieses Paket verdrahtet nur
`onCreate` fertig; `onEdit`/`onDelete` bekommen in 2.6 echte Handler, in diesem Paket sind es Stubs nach demselben Muster wie `handleEditExpense` (2.4).

**Dateien**

| Datei | Inhalt |
|---|---|
| `expenseDetailDialog.tsx` (neu) | `ExpenseDetailDialog`, `ExpenseDetailDialogState`, `ExpenseDetailDialogProps` |
| `__tests__/expenseDetailDialog.test.tsx` (neu) | Dialog-Tests, siehe unten |
| `src/components/Shared/utils/currencyUtils.ts` | `AVAILABLE_CURRENCIES` (verschoben aus `budgetDetailDialog.tsx`, zweiter Verbraucher — gleicher Ort wie `formatAmountFromCents`/`parseAmountToCents`, die beide Dialoge schon teilen) |
| `budgetDetailDialog.tsx` | Import von `AVAILABLE_CURRENCIES` statt lokaler Konstante |
| `expenseTracking.reducer.ts` | neue Aktion `EXPENSE_CREATED` |
| `src/constants/text/expenseTracking.ts` | `NEW_EXPENSE`, `EXPENSE_LABEL`, `EXPENSE_COMMENT`, `EXPENSE_DATE`, `EXPENSE_SAVED`, `PLEASE_CREATE_BUDGET_FIRST` (Wortlaut aus Entscheidung 7) |
| `src/components/Analytics/analyticsEvents.ts` | `EXPENSE_CREATED: "expense_created"` |
| `expenseTracking.tsx` | Dialog-State, `lastUsedBudgetId`, «Neue Ausgabe»-Button, `handleCreateExpense` |

**`ExpenseDetailDialogState` und Props** — analog zu `BudgetDetailDialogState`, Betrag bleibt als Text (unvollständige Eingaben dürfen stehen bleiben), Datum als `Dayjs | null` (Muster `eventInfo.tsx`/`CopyEventDialog.tsx`: `DatePicker` mit `dayjs`), Kommentar als `""` statt `null` (kontrollierte Textarea; Umwandlung zu `null` beim Speichern, wenn leer):

```ts
type ExpenseDetailDialogState = {
  label: string;
  amount: string;
  currency: string;
  budgetId: string;
  date: Dayjs | null;
  comment: string;
};

interface ExpenseDetailDialogProps {
  open: boolean;
  expense: ExpenseDomain | null;      // null = Anlegen-Modus
  budgets: BudgetDomain[];            // für die Budget-Auswahl
  defaultBudgetId: string | null;     // Vorbelegung im Anlegen-Modus, siehe unten
  onClose: () => void;
  onCreate: (expense: ExpenseDetailDialogState) => void;
  onEdit: (expenseId: string, expense: ExpenseDetailDialogState) => void;
  onDelete: (expense: ExpenseDomain) => void;
}
```

- Felder: Datum (`DatePicker`), Betrag + Währung (Reihenfolge/Layout wie im Budget-Dialog, `classes.budgetFormAmountRow` wiederverwenden), Bezeichnung, Budget (`TextField select`, `MenuItem` je `budgets`-Eintrag, gleiches Select-Muster wie die Währung), Kommentar (`TextField multiline`, optional, kein Pflichtfeld — keine Fehleranzeige dafür).
- Feld-Beschriftungen «Betrag»/«Währung» **wiederverwenden** (`BUDGET_AMOUNT`/ `BUDGET_CURRENCY` — gleiches Feld-Konzept wie beim Budget, kein Grund für eine zweite Konstante mit demselben Text). «Budget» ebenso (`BUDGET`-Konstante).
- **Zwei-Ebenen-Validierung wie beim Budget-Dialog:** Der Dialog zeigt inline Fehler (`touched`-State, Fehlertext unter dem Feld) für Bezeichnung, Betrag und Datum. Die eigentliche, verbindliche Prüfung passiert erst auf Seitenebene mit `Expense.checkExpenseData()` auf dem transformierten Domain-Objekt (Muster `checkInputdata`/`Budget.checkBudgetData` in `expenseTracking.tsx`) — der Dialog kennt `Expense.checkExpenseData` nicht direkt, genau wie `BudgetDetailDialog` `checkBudgetData` nicht kennt.
- **Ungültiges Datum braucht keinen Sonderfall:** Ist `date` `null` **oder** ein ungültiges `Dayjs`-Objekt (halb eingetipptes Datum), liefert `.toDate() ?? new Date(NaN)` bzw. `dayjs(...).toDate()` so oder so ein `Date` mit `NaN` als `getTime()` — `checkExpenseData`s bestehende Prüfung (`isNaN(date.getTime())`) greift ohne Zusatzcode. Trotzdem einen expliziten Test dafür,  damit diese Annahme nicht stillschweigend bricht, falls sich `checkExpenseData` später ändert.

**Vorbelegung des Budgets** (Anlegen-Modus): `defaultBudgetId` wird auf **Seitenebene** berechnet, nicht im Dialog — die Seite kennt «zuletzt verwendet», der Dialog nicht:

```ts
const [lastUsedBudgetId, setLastUsedBudgetId] = React.useState<string | null>(null);
const defaultBudgetId = lastUsedBudgetId ?? state.budgets?.[0]?.id ?? null;
```

Nach erfolgreichem Anlegen: `setLastUsedBudgetId(budgetInput.budgetId)`. Reine Session-UX (kein Persistieren nötig) — Zustand geht beim Verlassen der Seite bewusst verloren.

**Toolbar «Neue Ausgabe»** (Entscheidung 7 — ohne Budget deaktiviert, Hinweis «Lege zuerst ein Budget an»), spiegelbildlich zu «Neues Budget» (2.4 hat das bereits auf `view === "overview"` beschränkt):

```tsx
{view === "overview" ? (
  <Button ...>{TEXT_NEW_BUDGET}</Button>
) : (
  <Tooltip title={hasNoBudgets ? TEXT_PLEASE_CREATE_BUDGET_FIRST : ""}>
    {/* Tooltip braucht ein Element, das Maus-Events empfängt — ein
       disabled Button feuert keine; ohne den span bleibt der Tooltip
       auf einem deaktivierten Button stumm (bekannte MUI-Falle). */}
    <span>
      <Button
        variant="contained" color="primary" startIcon={<AddOutlined />}
        onClick={handleOpenCreateExpenseDialog}
        disabled={hasNoBudgets}
      >
        {TEXT_NEW_EXPENSE}
      </Button>
    </span>
  </Tooltip>
)}
```
`hasNoBudgets = !state.budgets || state.budgets.length === 0`.

**`handleCreateExpense`** — gleicher Ablauf wie `handleCreateBudget`: transformieren → `Expense.checkExpenseData` (über  `checkInputdata`-Äquivalent) → `createExpense` → Reducer-Aktion → `trackEvent(AnalyticsEvent.EXPENSE_CREATED)` → `lastUsedBudgetId` setzen → Dialog schliessen. Platzhalter-Zahlende-Instanz (Entscheidung 3, bis Epic 3):

```ts
payeeType: ExpensePayeeType.NO_REFUND_NEEDED,
payeeUserId: null,
payeeName: null,
```

**Reducer** — `EXPENSE_CREATED` analog `BUDGET_CREATED`, aber ohne dessen etwas umständliche Null-Prüfung (`state.expenses == null` reicht als einzige Bedingung):

```ts
case ReducerActions.EXPENSE_CREATED:
  return {
    ...state,
    expenses:
      state.expenses == null
        ? [action.payload]
        : state.expenses.concat(action.payload),
    snackbar: {open: true, severity: "success", message: TEXT_EXPENSE_SAVED},
    isError: false,
    error: null,
  };
```

**Tests**

`expenseDetailDialog.test.tsx` (eigene Datei wie `budgetDetailDialog.test.tsx`): 
- Validierung: leere Bezeichnung, Betrag ≤ 0 / nicht parsebar, ungültiges Datum — jeweils eigener Fehlertext sichtbar, `onCreate` **nicht** aufgerufen.
- `onCreate`-Payload enthält exakt die eingegebenen Werte (inkl. gewähltem Budget).
- Datum und Budget sind mit `defaultBudgetId`/heute vorbelegt, wenn der Dialog öffnet.
- Kommentar ist optional: leer lassen → `onCreate` wird trotzdem aufgerufen (kein Fehler).
- Defensiv: `budgets={[]}` lässt den Dialog nicht abstürzen (auch wenn der Button das in der Praxis verhindert — z.B. falls ein Realtime-Update während offenem Dialog alle Budgets löscht).

Seitenebene (`expenseTracking.test.tsx`):
- «Neue Ausgabe» ist deaktiviert und zeigt den Hinweis, wenn `state.budgets` leer ist; aktiviert, sobald ein Budget existiert.
- Anlegen aktualisiert **beides**: die Ausgaben-Liste **und** den Fortschrittsbalken der betroffenen Budget-Karte (zurück zur Übersicht wechseln und prüfen — zeigt, dass `expenseTotals`/`budgetsWithProgress` aus 2.3 korrekt auf die neue Ausgabe reagieren).
- Fehlerfall (`createExpense` lehnt ab) zeigt die Fehlermeldung, Dialog bleibt/State bleibt konsistent.
- Platzhalter-Werte (`payee_type: 'no_refund_needed'`, `payee_user_id: null`, `payee_name: null`) werden tatsächlich an `createExpense` übergeben — Test prüft den Aufruf-Payload, nicht nur, dass kein Fehler auftritt.
- Zweites Anlegen direkt danach: Budget-Feld ist mit dem zuletzt verwendeten Budget vorbelegt, nicht mehr mit dem ersten.

**Bereits vorhanden, nicht Teil dieses Pakets:** `ExpenseRepository.createExpense()` und der Datums-Rundungstest («kurz vor Mitternacht») existieren schon (0.4 und ein bestehender Test in `ExpenseRepository.test.ts`) — hier nur verdrahten, nicht neu bauen.

**Zum Ansehen im Browser** (DEV, nie PROD): Dialog öffnen ohne Budget (deaktiviert + Tooltip), Budget anlegen, Ausgabe erfassen, prüfen dass sie in der Liste **und** im Fortschrittsbalken der Übersicht erscheint. Zweite Ausgabe: Budget-Vorbelegung korrekt.
**Mobile prüfen:** Dialog auf xs im Vollbild (wie beim Budget-Dialog), `DatePicker` gut bedienbar.

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` sauber; `AVAILABLE_CURRENCIES` existiert nur noch einmal; bestehende Budget-Dialog-Tests bleiben unverändert grün (reiner Import-Wechsel); Sichttest Desktop und
Mobile gemacht.

### **Paket 2.6 — Ausgabe bearbeiten und löschen** ✅ erledigt

Ziel: dieselben drei Bausteine wie in 1.5 (Bearbeiten, Löschen, Live-Reaktion), diesmal für Ausgaben. Der Dialog selbst (`ExpenseDetailDialog`) ist seit 2.5 schon vollständig
edit-fähig — dieses Paket verdrahtet nur noch die Seite.

("Öffnet den Bearbeiten-Dialog … noch ohne Wirkung") als **Zeilen-Klick-Opener** gedacht, analog `handleBudgetEditClick`. Aktuell hängt dieselbe leere Stub-Funktion an **zwei**
Stellen: `ExpenseList`s `handleEditClick` (Zeilen-Klick) **und** `ExpenseDetailDialog`s `onEdit` (Speichern im Bearbeiten-Modus) — das geht nur, weil beide noch nichts tun.
Dieses Paket muss die beiden Rollen **trennen**:

1. `handleEditExpense(expenseId)` bleibt der Zeilen-Klick-Opener (Name passt, Inhalt fehlt    noch) — bleibt an `ExpenseList`s `handleEditClick` hängen.
2. Eine **neue** Funktion `handleUpdateExpense(expenseId, expenseInput)` wird geschrieben    und ersetzt `handleEditExpense` als `onEdit`-Prop von `ExpenseDetailDialog`.

Ohne diese Trennung landet man entweder bei einer Funktion mit zwei unvereinbaren Signaturen oder beim Versehen, den Zeilen-Klick nie zu verdrahten, weil "onEdit ist ja schon da" täuscht.

**Dateien**

| Datei | Änderung |
|---|---|
| `expenseTracking.tsx` | `handleEditExpense` (echt), `handleUpdateExpense` (neu), `handleDeleteExpense` (echt), `<ExpenseDetailDialog onEdit={handleUpdateExpense}>` |
| `expenseTracking.reducer.ts` | neue Aktionen `EXPENSE_UPDATED`, `EXPENSE_DELETED` |
| `constants/text/expenseTracking.ts` | `EXPENSE_UPDATED`, `EXPENSE_DELETED`, `DELETE_EXPENSE_DIALOG(label, amountInCents, currency)` |
| `Analytics/analyticsEvents.ts` | `EXPENSE_UPDATED: "expense_updated"`, `EXPENSE_DELETED: "expense_deleted"` |

**`handleEditExpense` — Zeilen-Klick-Opener, analog `handleBudgetEditClick`:**

```ts
/**
 * Öffnet den Bearbeiten-Dialog für die angeklickte Ausgabe.
 *
 * @param expenseId - ID der angeklickten Ausgabe.
 */
const handleEditExpense = (expenseId: string) => {
  const expense =
    state.expenses?.find((expense) => expense.id === expenseId) ?? null;

  setExpenseDetailDialogProperties({expense, open: true});
};
```
`expenseToFormState` im Dialog übernimmt die Vorbelegung bereits vollständig seit 2.5 (Betrag `toFixed(2)`, Datum als `dayjs(expense.date)`) — hier ist nichts weiter zu tun.

**`handleUpdateExpense` — analog `handleUpdateBudget`:**

```ts
const handleUpdateExpense = async (
  expenseId: string,
  expenseInput: ExpenseDetailDialogState,
) => {
  const expense = {...transformInputToExpenseDomain(expenseInput), id: expenseId};

  if (!checkExpenseInputdata(expense)) {
    return;
  }

  try {
    const updated = await database.expenses.updateExpense(expense, authUser!);
    trackEvent(AnalyticsEvent.EXPENSE_UPDATED);
    dispatch({type: ReducerActions.EXPENSE_UPDATED, payload: updated});
  } catch (error) {
    handleError(error, "Ausgabe aktualisieren");
  }
};
```

**Budget wechseln beim Bearbeiten braucht keinen Sondercode.** `expenseTotals`, `budgetsWithProgress` und `expenseGroups` sind seit 2.3/2.4 abgeleiteter State
(`useMemo` über `state.expenses`) — sobald `state.expenses` per `EXPENSE_UPDATED` die neue `budgetId` trägt, verschiebt sich die Summe beim nächsten Render automatisch vom alten aufs
neue Budget. Das ist die Auszahlung von Entscheidung 1 (eine Datenquelle statt zweier), nicht etwas, das dieses Paket selbst bauen muss — **aber es muss getestet werden**, weil genau das
die Stelle ist, an der eine künftige Abkürzung (z.B. Summen wieder einfrieren) am ehesten unbemerkt einreisst.

**`handleDeleteExpense` — analog `handleDeleteBudget`, aber einfacher.** Ausgaben sind Blätter (Entscheidung 9: keine Fremdschlüssel-Einschränkung durch andere Tabellen) — die
Budget-spezifische Vorab-Prüfung "hat noch Ausgaben" entfällt ersatzlos, ebenso der `isForeignKeyViolationError`-Sonderfall im `catch`:

```ts
/**
 * Löscht eine Ausgabe nach Rückfrage.
 *
 * @param expense - Die zu löschende Ausgabe.
 */
const handleDeleteExpense = async (expense: ExpenseDomain) => {
  const isConfirmed = await customDialog({
    dialogType: DialogType.Confirm,
    title: TEXT_DELETE_EXPENSE_DIALOG(expense.label, expense.amountInCents, expense.currency),
    text: TEXT_DELETE_BUDGET_SIMPLE, // generischer Text, siehe unten
    buttonTextCancel: TEXT_CANCEL,
    buttonTextConfirm: TEXT_DELETE,
  });
  if (!isConfirmed) return;

  try {
    await database.expenses.deleteExpense(expense.id);
    trackEvent(AnalyticsEvent.EXPENSE_DELETED);
    dispatch({type: ReducerActions.EXPENSE_DELETED, payload: expense});
  } catch (error) {
    handleError(error, "Ausgabe löschen");
  }

  setExpenseDetailDialogProperties({expense: null, open: false});
};
```

**`TEXT_DELETE_BUDGET_SIMPLE` bewusst wiederverwendet, nicht dupliziert** — der Text ("Diese Aktion kann nicht rückgängig gemacht werden.") ist inhaltlich generisch, nicht
budget-spezifisch. Optional, nicht Teil dieses Pakets: in `DELETE_ACTION_IRREVERSIBLE` umbenennen und an beiden Stellen importieren, analog der `AMOUNT`/`CURRENCY`/`DATE`-
Konsolidierung aus 2.5 — nur wenn es sich beim Schreiben natürlich ergibt. 
**`DELETE_EXPENSE_DIALOG` zeigt Bezeichnung *und* Betrag**, anders als `DELETE_BUDGET_DIALOG` (nur der Name) — eine Ausgabe ohne Betrag im Bestätigungstext ist
schwerer wiederzuerkennen als ein Budget, das nur einen Namen hat:

```ts
export const DELETE_EXPENSE_DIALOG = (
  label: string,
  amountInCents: number,
  currency: string,
): string =>
  `Ausgabe «${label}» (${formatAmountFromCents(amountInCents, currency)}) löschen?`;
```

**Randfall «andere Sitzung hat die Ausgabe schon gelöscht» — nur beim Bearbeiten relevant, nicht beim Löschen selbst.** `BaseRepository.update()` endet auf `.select().single()`; trifft
das Update keine Zeile mehr, wirft Supabase (`PGRST116`, "no rows returned") — das reicht bereits bis zu `handleError` durch, **kein neuer Code nötig**, nur ein Test, der das beweist.
Beim Löschen ist die Lage anders: `BaseRepository.remove()` nutzt kein `.single()` — ein `delete().eq(id)` auf eine bereits gelöschte Zeile trifft null Zeilen und **wirft nicht**.
Das ist hier unproblematisch (der gewünschte Endzustand — «Ausgabe existiert nicht mehr» — ist so oder so erreicht) und braucht keine Behandlung.

**Tests** (analog 1.5, für `expenseTracking.test.tsx`)

- Klick auf eine Zeile öffnet den Dialog mit den Werten der Ausgabe (Bezeichnung, Betrag,   Währung, Budget, Datum, Kommentar).
- `updateExpense`-Payload: geänderte Felder korrekt, inkl. Budget-Wechsel. 
- **Budget-Wechsel verschiebt die Summe zwischen den Karten:** Ausgabe von Budget A nach Budget B verschieben, in der Übersicht prüfen, dass Karte A kleiner und Karte B grösser
  wird (zwei `within(card)`-Prüfungen, ein Test — das ist der eigentliche Beweis für die "kein Sondercode nötig"-Aussage oben).
- Löschen mit Bestätigung entfernt die Zeile aus der Liste **und** aus der Kartensumme; Abbruch lässt beides unverändert.
- Fehlerfälle: `updateExpense` und `deleteExpense` lehnen ab → Fehlermeldung, State bleibt wie vorher (Muster aus 2.5s Fehlerfall-Test).
- **Randfall:** `updateExpense` wirft `{code: "PGRST116", message: "..."}` (Ausgabe von anderer Sitzung bereits gelöscht) → Fehlermeldung erscheint, kein stilles Nichts.
- **Mutationsprobe** (Checkliste aus 1.5): `handleEditExpense`/`handleUpdateExpense` vertauschen oder eine der beiden auf die alte Stub-Funktion zurückfallen lassen → die Zeilen-Klick- bzw. die Speichern-Tests müssen rot werden, nicht beide gleichzeitig grün bleiben (das wäre das Zeichen, dass die Trennung von oben nicht wirklich geprüft wird).

**Zum Ansehen im Browser** (DEV, nie PROD): bestehende Ausgabe anklicken → Dialog zeigt die richtigen Werte; Budget wechseln und speichern → Summe wandert sichtbar zur anderen Karte;
Löschen mit Bestätigung und mit Abbruch. **Mobile prüfen** (Dialog auf xs, wie immer).

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` sauber; `handleEditExpense` und `handleUpdateExpense` sind zwei getrennte
Funktionen mit je einem eigenen, bestehenden Test, der bei Vertauschen rot wird; `ExpenseList`s `handleEditClick` zeigt weiterhin auf `handleEditExpense`, `ExpenseDetailDialog`s
`onEdit` auf `handleUpdateExpense`.

### **Paket 2.7 — Realtime für Ausgaben** ✅ erledigt

Ziel: Ausgaben live halten, exakt nach dem Muster, das `BudgetRepository.subscribeToBudgets` / `useExpenseTrackingData`s Budget-Effect seit 2.3b vorgeben. Kein neuer Mechanismus — eine zweite, unabhängige Subscription neben der bestehenden.

**Wichtige Vereinfachung:** `fetchData()`/`loadData()` in `useExpenseTrackingData.ts` laden schon heute **beide** Tabellen zusammen (`Promise.all([getBudgetsForEvent, getExpensesForEvent])`, Entscheidung 8). Die neue Ausgaben-Subscription braucht deshalb **keinen eigenen Reducer-Zweig**
und **keine eigene Ladefunktion** — ihr `onChange`/`onStatusChange` ruft dieselbe `loadData` auf, die die Budget-Subscription längst aufruft. Das Paket fügt nur einen zweiten `useEffect` hinzu, der einen zweiten Kanal öffnet und unter einem zweiten Status-Key anmeldet.

**Dateien**

| Datei | Änderung |
|---|---|
| `ExpenseRepository.ts` | neue Methode `subscribeToExpenses(eventId, onChange, onError, onStatusChange)` |
| `useExpenseTrackingData.ts` | zweiter `useEffect` analog dem Budget-Effect, Status-Key `"expenses"` |
| `ExpenseRepository.test.ts` | Tests für `subscribeToExpenses`, analog `BudgetRepository.test.ts` |
| `expenseTracking.test.tsx` | neue `describe`-Gruppe „Realtime der Ausgaben", `renderUnlockedPage`-Helper erweitert |

**`ExpenseRepository.subscribeToExpenses` — wörtliche Kopie von `subscribeToBudgets`, nur Tabelle/Channel getauscht:**

```ts
/**
 * Abonniert Echtzeit-Änderungen der Ausgaben eines Events.
 * `onChange` wird bei jedem Einfügen, Ändern und Löschen aufgerufen, liefert
 * aber keine Daten — der Aufrufer lädt die Ausgaben selbst neu. Beim ersten
 * Verbindungsaufbau wird `onChange` nicht aufgerufen.
 *
 * @param eventId - Die ID des Events
 * @param onChange - Callback bei einer Änderung (darf asynchron sein)
 * @param onError - Callback bei Fehler in `onChange`
 * @param onStatusChange - Optionaler Callback bei Verbindungsstatus-Wechseln
 * @returns {@link RealtimeSubscriptionHandle} mit `unsubscribe()`/`reconnect()`
 */
subscribeToExpenses(
  eventId: string,
  onChange: () => void | Promise<void>,
  onError: (error: Error) => void,
  onStatusChange?: (status: RealtimeConnectionStatus) => void,
) {
  return subscribeWithRetry({
    client: this.client,
    channelName: `expenses:${eventId}`,
    bindings: [{table: "event_expenses", filter: `event_id=eq.${eventId}`}],
    onChange,
    onError,
    onStatusChange,
  });
}
```

Publication und `REPLICA IDENTITY FULL` für `event_expenses` sind seit 0.3 vorhanden — **keine Migration nötig**.

**`useExpenseTrackingData.ts` — zweiter `useEffect`, Kopie des Budget-Effects (Zeilen 116–148):**

```ts
React.useEffect(() => {
  if (!event.uid || hasDonation !== true || !authUser) return;

  const {unsubscribe, reconnect} = database.expenses.subscribeToExpenses(
    event.uid,
    loadData,
    (error) =>
      Sentry.captureException(error, {
        extra: {context: "Realtime expenses subscription"},
      }),
    (status) => {
      realtime.setStatus("expenses", status);
      if (status === "connected") void loadData();
    },
  );

  realtime.register("expenses", reconnect);
  return () => {
    unsubscribe();
    realtime.unregister("expenses");
  };
}, [
  hasDonation,
  authUser,
  event.uid,
  database,
  loadData,
  realtime.setStatus,
  realtime.register,
  realtime.unregister,
]);
```

**Zwei Effects, ein `loadData`.** Beide Subscriptions rufen dieselbe Funktion auf — eine neue Ausgabe löst denselben Reload aus wie ein neues Budget, und beide bringen ohnehin beide Tabellen mit. Das ist kein Duplikat, sondern die Konsequenz von Entscheidung 8: der Reload ist idempotent, zwei Trigger-Quellen für denselben Reload sind güns­tiger als eine fein­granularere, aber doppelt so komplexe Lösung, die nur die geänderte Tabelle neu lädt.

**Kein neuer Status im aggregierten Banner nötig.** `useRealtimeConnectionStatus()` ist schon mehrere-Keys-fähig (`register`/`setStatus`/`unregister` je Key, `aggregateRealtimeStatus` fasst zusammen) — das Budget-Muster aus 2.3b nutzt das bereits genau für diesen Fall. `"expenses"` ist
einfach ein zweiter Key neben `"budgets"`.

**Test-Helper `renderUnlockedPage` muss erweitert werden.** Aktuell (Zeile 184–201) liest er nur die Aufrufparameter von `mockDatabase.budgets.subscribeToBudgets.mock.calls[0]` aus. Für 2.7 muss `mockDatabase.expenses` ein `subscribeToExpenses: jest.fn()` bekommen (mit eigenem `unsubscribe`/`reconnect`-Mock-Paar, nicht `mockUnsubscribe`/`mockReconnect` wiederverwenden — sonst lässt sich in einem Test nicht mehr unterscheiden, welcher der beiden Kanäle geschlossen wurde), und der Helper muss zusätzlich `expenseOnChange`/`expenseOnStatusChange` zurückgeben, analog zu `onChange`/`onStatusChange` für Budgets.

**Tests** (analog „Realtime der Budgets", für `expenseTracking.test.tsx`)

- Abonniert `event_expenses` erst, wenn eine Spende bestätigt ist.
- Abonniert die Ausgaben des Events (`subscribeToExpenses` mit den richtigen 4 Argumenten).
- Neue Ausgabe einer anderen Sitzung erscheint in der Liste **und** im Fortschritt der zugehörigen Budget-Karte (Reload liefert ja beide Tabellen — ein Test kann beides in einem Aufwasch prüfen).
- Löschung einer Ausgabe einer anderen Sitzung: Zeile verschwindet, Kartensumme sinkt.
- Lädt nach einem Verbindungsabbruch der Ausgaben-Subscription neu, aber nicht schon beim Abbruch   selbst (Muster wie beim Budget-Pendant).
- Abonniert nur einmal, auch wenn sich nur der Ausgaben-Status ändert (Effect-Dependencies stabil).
- Beendet **beide** Subscriptions beim Verlassen der Seite — zwei getrennte `unsubscribe`-Mocks,   jeweils einzeln geprüft (das ist der Punkt, an dem das separate Mock-Paar aus dem Helper-Hinweis   oben zahlt: ein gemeinsamer Mock würde nicht zeigen, wenn nur einer der beiden Kanäle sauber schliesst).
- **Nur eine Subscription pro Tabelle:** `subscribeToBudgets` und `subscribeToExpenses` je genau einmal aufgerufen, nicht mehrfach durch den zweiten Effect ausgelöst.
- **Mutationsprobe** (Checkliste aus 1.5): Ausgaben-Subscription versehentlich mit `subscribeToBudgets` statt `subscribeToExpenses` verdrahten (Copy-Paste-Fehler) → der „nur eine Subscription pro Tabelle"-Test muss rot werden. Status-Key `"expenses"` durch `"budgets"` ersetzen → der „nur einmal abonniert"/Banner-Aggregations-Test muss auffallen, weil zwei Kanäle denselben Key teilen.

**Zum Ansehen im Browser** (DEV, nie PROD): zwei Browser-Fenster mit demselben Event — in Fenster A eine Ausgabe anlegen/bearbeiten/löschen, in Fenster B ohne Neuladen live sehen, dass Liste **und** Fortschrittsbalken sich aktualisieren. Verbindung kurz kappen (DevTools offline) und wiederherstellen → Reconnect-Banner erscheint und verschwindet wieder, Daten sind danach aktuell.

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` sauber; `ExpenseRepository.subscribeToExpenses` hat eigene Tests analog `BudgetRepository.subscribeToBudgets`; beide Realtime-Effects in `useExpenseTrackingData.ts` sind unabhängig testbar (eigene `unsubscribe`-Mocks); Mutationsprobe für vertauschte Subscription/Status-Key bestanden.

### **Paket 2.8 — Hervorhebung von Fremdänderungen (optional)** ✅ erledigt

Ziel: Karten und Zeilen, die eine **andere** Sitzung geändert oder neu angelegt hat, leuchten kurz
auf (`classes.remoteChangeGlow`, bereits global in `styles.ts` definiert, keine neue Migration/kein
neuer Style nötig).

**Korrektur zum ursprünglichen Entwurf.** Der alte Stichpunkt hier sprach von einem `pendingWritesRef`-
Zähler, der nur die *Hervorhebung* unterdrückt, während der Reload normal weiterläuft — das war eine
Vermutung, kein Zitat. Tatsächlich existiert das Muster bereits zweimal im Code, und beide Male
unterdrückt es den **gesamten Reload**, nicht nur das Leuchten:

- `materialList.tsx`/`event.tsx:1508`: `saveInProgressRef` als `React.useRef(false)` (Boolean),
  `if (saveInProgressRef.current) return;` ganz am Anfang des Realtime-Callbacks.
- `useShoppingListHandlers.tsx:485-520`/`event.tsx:931,2117`: dieselbe Idee, aber als **Zähler**
  (`React.useRef(0)`, `+= 1` vor dem Save, `Math.max(0, ... - 1)` in einem `setTimeout(400)` im
  `finally`) — robuster, weil ein zweiter, sich überlappender Save den Schutz nicht vorzeitig aufhebt.
  Die eigene JSDoc dort erklärt das Warum: *„Der saveInProgressRef-Zähler wird synchron hochgezählt
  und erst mit kurzer Verzögerung nach dem Save wieder heruntergezählt: die WAL-Events des eigenen
  Saves treffen asynchron ein (typisch < 300 ms)."*

Für Ausgaben/Budgets übernehmen wir die **Zähler-Variante** (`saveInProgressRef: React.useRef(0)`),
weil sechs Schreib-Handler (3× Budget, 3× Ausgabe) denselben Ref teilen und sich theoretisch
überlappen können (z.B. Budget-Dialog schliesst, während der letzte Ausgaben-Save noch läuft).

**Wo der Ref lebt:** Anders als bei Material-/Shoppingliste, wo die Save-Handler in einem separaten
`useXxxHandlers`-Hook stecken und der Ref in `event.tsx` erzeugt und durchgereicht wird, liegen bei
Ausgaben sowohl die sechs Schreib-Handler als auch (seit 2.3b) die Realtime-Effects in zwei
verschiedenen, aber von derselben Seite (`expenseTracking.tsx`) verwendeten Stellen
(`expenseTracking.tsx` bzw. `useExpenseTrackingData.ts`). Analog zu `realtime`, das schon heute als
gemeinsame Instanz von der Seite in den Hook gereicht wird: `saveInProgressRef` wird in
`expenseTracking.tsx` erzeugt und beim Aufruf von `useExpenseTrackingData({..., saveInProgressRef})`
mitgegeben.

**Dateien**

| Datei | Änderung |
|---|---|
| `expenseTracking.tsx` | `const saveInProgressRef = React.useRef(0);`, an `useExpenseTrackingData` übergeben; alle 6 Schreib-Handler umschliessen ihren `database.*`-Aufruf mit `+= 1` / `finally`-`setTimeout(-= 1, 400)`; `highlightedBudgetIds`/`highlightedExpenseIds` an `BudgetCard`/`ExpenseList` durchreichen |
| `useExpenseTrackingData.ts` | `budgetsRef`/`expensesRef` als Vorher-Snapshot (Muster `materialListItemsRef`), `highlightedBudgetIds`/`highlightedExpenseIds`-State, Diff+Highlight in beiden Realtime-`onChange`/`onStatusChange("connected")`-Pfaden, `if (saveInProgressRef.current > 0) return;` am Anfang beider Callbacks |
| `budgetCard.tsx` | neue Prop `isHighlighted: boolean`, `sx={[classes.budgetCard, isHighlighted && classes.remoteChangeGlow]}` |
| `expenseList.tsx` | `ExpenseList` bekommt `highlightedExpenseIds: Set<string>`, reicht pro Zeile `isHighlighted={highlightedExpenseIds.has(expense.id)}` an `ExpenseRow` weiter, dort dieselbe `sx`-Array-Technik wie bei `budgetCard` |

**`saveInProgressRef` um jeden Schreib-Handler — Muster aus `useShoppingListHandlers.tsx`:**

```ts
const handleUpdateExpense = async (
  expenseId: string,
  expenseInput: ExpenseDetailDialogState,
) => {
  const expense = {...transformInputToExpenseDomain(expenseInput), id: expenseId};
  if (!checkExpenseInputdata(expense)) return;

  saveInProgressRef.current += 1;
  try {
    const updated = await database.expenses.updateExpense(expense, authUser!);
    trackEvent(AnalyticsEvent.EXPENSE_UPDATED);
    dispatch({type: ReducerActions.EXPENSE_UPDATED, payload: updated});
  } catch (error) {
    handleError(error, "Ausgabe aktualisieren");
  } finally {
    setTimeout(() => {
      saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
    }, 400);
  }
};
```

Gleiches Muster für die anderen 5 Handler (`handleCreateBudget`, `handleUpdateBudget`,
`handleDeleteBudget`, `handleCreateExpense`, `handleDeleteExpense`).

**Diff+Highlight in `useExpenseTrackingData.ts` — Muster aus `materialList.tsx:343-399`, aber für
beide Realtime-Effects gemeinsam genutzt (`loadData` lädt ohnehin immer beide Tabellen):**

```ts
const budgetsRef = React.useRef<BudgetDomain[]>([]);
const expensesRef = React.useRef<ExpenseDomain[]>([]);
const [highlightedBudgetIds, setHighlightedBudgetIds] = React.useState<Set<string>>(new Set());
const [highlightedExpenseIds, setHighlightedExpenseIds] = React.useState<Set<string>>(new Set());
const highlightTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

// Ref synchron mit dem State halten — Closure-Falle sonst wie bei materialListItemsRef.
React.useEffect(() => {
  budgetsRef.current = state.budgets ?? [];
  expensesRef.current = state.expenses ?? [];
}, [state.budgets, state.expenses]);

/**
 * Lädt neu und markiert Budgets/Ausgaben, die sich gegenüber dem letzten
 * bekannten Stand geändert haben, für 2 Sekunden zum Aufleuchten. Wird nur
 * von den Realtime-Callbacks aufgerufen, nicht vom Erstladen.
 */
const loadDataAndHighlightChanges = React.useCallback(async () => {
  if (saveInProgressRef.current > 0) return; // eigener Save, Echo ignorieren

  const oldBudgets = budgetsRef.current;
  const oldExpenses = expensesRef.current;
  await loadData();

  const changedBudgetIds = Expense.diffIds(oldBudgets, budgetsRef.current);
  const changedExpenseIds = Expense.diffIds(oldExpenses, expensesRef.current);
  if (changedBudgetIds.size === 0 && changedExpenseIds.size === 0) return;

  setHighlightedBudgetIds(changedBudgetIds);
  setHighlightedExpenseIds(changedExpenseIds);
  if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  highlightTimeoutRef.current = setTimeout(() => {
    setHighlightedBudgetIds(new Set());
    setHighlightedExpenseIds(new Set());
  }, 2000);
}, [loadData]);
```

Budget-/Ausgaben-Subscriptions rufen ab jetzt `loadDataAndHighlightChanges` statt `loadData` als
`onChange` und im `onStatusChange("connected")`-Reconnect-Zweig — das **Erstladen** (der separate
`useEffect`, der bei `hasDonation === true` einmalig lädt) bleibt bei `loadData`, unverändert: beim
ersten Laden gibt es keinen "alten Stand", gegen den zu diffen wäre, und alles wäre sonst fälschlich
"neu".

**Neue Hilfsfunktion `Expense.diffIds`** (oder als freie Funktion, falls sie budget- und
ausgabenunabhängig bleiben soll) — vergleicht zwei Arrays mit `id`-Feld und liefert die Menge der
IDs, die neu sind oder sich inhaltlich unterscheiden (Vorbild: der inline `oldMap`/`changedIds`-Block
in `materialList.tsx:365-389`, hier aber generisch statt Feld-für-Feld, weil bei Budgets/Ausgaben —
anders als bei Material-Positionen — die ganze Karte/Zeile aufleuchtet, nicht nur ein Wert):

```ts
static diffIds<T extends {id: string}>(previous: T[], current: T[]): Set<string> {
  const previousById = new Map(previous.map((item) => [item.id, item]));
  const changed = new Set<string>();
  for (const item of current) {
    const before = previousById.get(item.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
      changed.add(item.id);
    }
  }
  return changed;
}
```

`JSON.stringify`-Vergleich ist hier bewusst simpel gehalten (kein Feld-für-Feld wie bei
`materialList`, da `date` ein `Date`-Objekt ist und ein tiefer Objektvergleich sonst mehr Code
bräuchte als er hier wert ist) — **im Test verifizieren, dass ein reines `date`-Objekt mit gleichem
Wert, aber neuer Instanz (kommt nach jedem Reload vor, `parseLocalDate` erzeugt immer ein neues
`Date`) nicht fälschlich als "geändert" erkannt wird**, sonst leuchtet nach jedem Fremd-Reload die
gesamte Liste, egal ob sich wirklich etwas geändert hat. `JSON.stringify` auf ein `Date` ruft
`toISOString()` auf und ist daher wertstabil — sollte funktionieren, aber das ist genau die Annahme,
die der erste Test widerlegen oder bestätigen muss, bevor mehr darauf aufgebaut wird.

**Warum kein Context wie bei Menuplan.** `HighlightedMenueContext` existiert, weil `menuplan.menucard.tsx`
tief verschachtelt ist und Props-Drilling dort unpraktisch wäre. `BudgetCard`/`ExpenseRow` hängen
direkt an der Seite (`expenseTracking.tsx` → `BudgetCard` bzw. → `ExpenseList` → `ExpenseRow`, zwei
Ebenen) — normales Prop-Reichen reicht, kein Context nötig.

**Tests**

- `Expense.diffIds`: leeres Array → leeres Array; neues Element (ID nicht in `previous`) wird erkannt;
  geändertes Feld wird erkannt; unverändertes Element wird **nicht** erkannt; **Datum mit gleichem
  Wert, aber neuer Objekt-Instanz wird nicht fälschlich als geändert erkannt** (die Annahme von oben).
- `useExpenseTrackingData`/Seite: Fremd-Änderung einer Ausgabe → Zeile bekommt `remoteChangeGlow`
  (Klasse/Style prüfen, nicht nur den Wert), verschwindet nach 2 Sekunden (`jest.useFakeTimers()`).
- Eigener Save (z.B. `handleUpdateExpense`) löst **keine** Hervorhebung aus, obwohl danach ein
  Realtime-Echo simuliert wird (`saveInProgressRef.current` muss zum Zeitpunkt des Echos noch > 0
  sein — im Test das Echo *synchron* nach dem Save-Aufruf, aber vor Ablauf der 400 ms triggern).
- **Mutationsprobe:** `saveInProgressRef.current > 0`-Check aus einem der beiden Realtime-Callbacks
  entfernen → der "eigener Save löst keine Hervorhebung aus"-Test muss für genau diesen Callback rot
  werden (Budget- und Ausgaben-Pfad einzeln prüfen, nicht nur einen).

**Zum Ansehen im Browser** (DEV, nie PROD): zwei Fenster, in Fenster A eine Ausgabe anlegen — in
Fenster B leuchtet die neue Zeile und ggf. die betroffene Budget-Karte kurz auf; eigene Änderungen in
Fenster A selbst leuchten nicht.

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint`
sauber; `Expense.diffIds` hat eigene Tests inkl. des Datums-Randfalls; beide Realtime-Pfade
(Budgets/Ausgaben) haben je einen eigenen, bei entferntem `saveInProgressRef`-Check rot werdenden
Test. ✅ erledigt — `npx tsc --noEmit`, `npm run lint` (0 Fehler) und die volle Testsuite
(212 Suiten / 2595 Tests) sind grün.

**Zwei Abweichungen vom ursprünglichen Entwurf, beim Bauen entdeckt:**

1. **`loadDataAndHighlightChanges` ist eine einzige, geteilte Funktion** für beide Subscriptions
   (nicht zwei getrennte pro Tabelle) — Konsequenz von Entscheidung 8 (`loadData` lädt ohnehin immer
   beide Tabellen zusammen). Dadurch bricht die Mutationsprobe des `saveInProgressRef`-Checks **beide**
   "eigener Save…"-Tests gleichzeitig, nicht nur den zur jeweiligen Subscription passenden — geprüft
   und für richtig befunden, da beide Pfade trotzdem einzeln über ihren jeweiligen Realtime-Kanal
   (`onChange` bzw. `expensesOnChange`) exercised werden.
2. **Timing-Bug beim ersten Bauversuch, der die Hervorhebung komplett stumm hielt:** Die ursprüngliche
   Fassung diffte gegen `budgetsRef.current`/`expensesRef.current`, die über einen separaten `useEffect`
   auf `state.budgets`/`state.expenses` synchron gehalten wurden — dieser Effect läuft aber erst nach
   dem nächsten React-Commit, also **nicht** mehr rechtzeitig direkt nach `await loadData()`. Der Diff
   verglich dadurch den alten Stand mit sich selbst und fand nie eine Änderung. Fix: `loadData` gibt die
   frisch geladenen Werte jetzt direkt zurück (`{budgets, expenses}`), `loadDataAndHighlightChanges`
   difft gegen diesen Rückgabewert statt gegen die Refs und aktualisiert die Refs danach manuell —
   genau das Muster, das `materialList.tsx` bereits verwendet (Ref am Ende der Callback-Funktion selbst
   setzen, nicht über einen reaktiven Effect).

- **Nur umsetzen, wenn 2.1–2.7 stabil sind** — rein kosmetisch, darf Epic 2 nicht aufhalten.

**Abschluss von Epic 2:** kurzer Rückblick (analog oben) und Feinplanung von Epic 3 mit den
dann gemachten Erfahrungen; insbesondere prüfen, ob die Platzhalter-Lösung (Entscheidung 3)
im Dialog sauber ersetzbar war.

## Epic 3 — Zahlende Instanz ✅ erledigt

Ziel: Die Platzhalter-Lösung aus Epic 2 (Entscheidung 3 — jede Ausgabe wird beim Anlegen fest auf `NO_REFUND_NEEDED` gesetzt) durch echte Erfassung ersetzen. Schema, Enum und Repository-Mapping existieren bereits vollständig seit Epic 0/2 (`ExpensePayeeType`, `ExpenseDomain.payeeType/ payeeUserId/payeeName`, `ExpenseRepository.toRow/toDomain`) — Epic 3 ist reine UI- und Aggregations-Arbeit, keine neue Migration.

**Wichtiger Fund beim Verfeinern:** Die Migration `20260905000002_add_event_expenses.sql` hat ein strenges `CHECK`-Constraint, das die Datenmodellierung eindeutig vorgibt:

```sql
CONSTRAINT chk_expense_payee CHECK (
  (payee_type = 'existing_user' AND payee_user_id IS NOT NULL AND payee_name IS NULL) OR
  (payee_type = 'new_person' AND payee_name IS NOT NULL AND payee_user_id IS NULL) OR
  (payee_type = 'no_refund_needed' AND payee_user_id IS NULL AND payee_name IS NULL)
)
```

D.h. für `existing_user` wird **kein** Namens-Snapshot gespeichert — der Anzeigename kommt beim Anlegen/Bearbeiten immer live aus `event.cooks`, nie aus `payee_name`. Ein `BEFORE DELETE`-Trigger
auf `auth.users` (`detach_deleted_expense_payee`) fängt den Fall ab, dass ein referenzierter Account komplett gelöscht wird: er kopiert dann den letzten bekannten Namen nach `payee_name` und stellt den
Typ auf `new_person` um — **das ist bereits gebaut, Epic 3 muss sich darum nicht kümmern.** Nicht abgedeckt (und laut Entscheidung unten bewusst nicht in 3.1 behandelt): eine Person verlässt nur die Koch-Liste **dieses Events** (`event.cooks`), ohne dass ihr Account gelöscht wird — der Trigger greift dann nicht.

**Entscheidungen (mit dir abgestimmt):**

1. **Verwaiste `payeeUserId` beim Bearbeiten** (Person war zum Zeitpunkt der Ausgabe noch im Event-Team, ist es inzwischen nicht mehr): kein zusätzlicher Repository-Aufruf. Die Auswahl-Optionen sind `event.cooks` **plus** — falls `expense.payeeUserId` darin fehlt — ein synthetischer, deaktivierter Eintrag mit Platzhalter-Label ("Ehemalige Person"), der nur dafür sorgt, dass der `Select`-Wert einen gültigen `MenuItem` findet und nicht leer/falsch erscheint.
2. **Anzeige in der Liste:** bewusst **nicht** Teil von 3.1. `ExpenseRow` bleibt unverändert; die zahlende Instanz ist vorerst nur im Dialog sichtbar. Volle Sichtbarkeit kommt mit Epic 6 (Dashboard) über 3.2s Aggregation.

### **Story 3.1 — Auswahl-UI im Ausgaben-Dialog** ✅ erledigt


**Dateien**

| Datei | Änderung |
|---|---|
| `expenseDetailDialog.tsx` | `ExpenseDetailDialogState` + 3 neue Felder, neue Prop `cooks: Cook[]`, `RadioGroup` mit Options-Karten + je nach Typ eingebettetem `Select`/`TextField`, `isValid`-Erweiterung |
| `expenseTracking.tsx` | `transformInputToExpenseDomain` liest die drei Formularfelder statt sie zu hardcoden; `<ExpenseDetailDialog cooks={event.cooks}>` |
| `expense.class.ts` | `checkExpenseData` um Payee-Konsistenzprüfung erweitert (Server-seitiges Pendant zum `CHECK`-Constraint) |
| `constants/styles/expenseTracking.styles.ts` | neuer Style `payeeOptionCard` (Rahmen/Radius/Padding je Options-Karte, siehe unten) |
| `constants/text/expenseTracking.ts` | `PAYEE`, `PAYEE_EXISTING_USER`, `PAYEE_NEW_PERSON`, `PAYEE_NO_REFUND_NEEDED`, `PLEASE_PROVIDE_PAYEE`, `PLEASE_PROVIDE_PAYEE_NAME`, `FORMER_EVENT_COOK`; `NAME` aus `shared.ts` wiederverwenden (nicht duplizieren, analog der Text-Konsolidierung aus 2.5) |

**UI-Entscheidung (mit Mockup abgeglichen):** Jede Payee-Option ist eine eigene, umrandete Karte statt einer flachen `RadioGroup` mit separatem Feld danach (wie ursprünglich skizziert) — das verbindet das bedingte Zweitfeld visuell eindeutig mit seiner Option, statt es lose unter der ganzen Gruppe erscheinen zu lassen. Weicht bewusst vom flachen `RadioGroup`-Muster aus `budgetDetailDialog.tsx`s `BudgetType`-Auswahl ab (dort reicht ein flaches Layout, weil beide Typen dieselben Folgefelder nutzen — hier hat jeder Typ ein eigenes, unterschiedliches Zweitfeld).

**`ExpenseDetailDialogState` — drei neue Felder, analog dem bestehenden Muster (`payeeName` als leerer String im Formular wie `comment`, nicht `null`):**

```ts
export type ExpenseDetailDialogState = {
  // ...bestehende Felder unverändert...
  payeeType: ExpensePayeeType;
  payeeUserId: string | null;
  payeeName: string;
};

const INITIAL_FORM_STATE: ExpenseDetailDialogState = {
  // ...bestehende Felder unverändert...
  payeeType: ExpensePayeeType.NO_REFUND_NEEDED,
  payeeUserId: null,
  payeeName: "",
};
```

`expenseToFormState`'s Bearbeiten-Zweig übernimmt `expense.payeeType`/`payeeUserId` unverändert; `payeeName` kommt **nur** im `new_person`-Fall aus `expense.payeeName` — sonst leerer String (siehe
`CHECK`-Constraint oben, `payee_name` ist bei `existing_user` ohnehin `null`).

**Neue Prop `cooks: Cook[]`** (aus `event.cooks`, `Cook` bereits importierbar aus `event.class.ts`, Vorbild `materialList.tsx`s `cooks`-Prop). Die Auswahl-Optionen für den `existing_user`-Select kombinieren `cooks` mit einem synthetischen Fallback-Eintrag für Entscheidung 1 oben:

```ts
const payeeOptions =
  formState.payeeType === ExpensePayeeType.EXISTING_USER &&
  formState.payeeUserId &&
  !cooks.some((cook) => cook.uid === formState.payeeUserId)
    ? [...cooks, {uid: formState.payeeUserId, displayName: TEXT_FORMER_EVENT_COOK} as Cook]
    : cooks;
```

**UI — eine `RadioGroup`, deren `FormControlLabel`s je in einer eigenen `Box`-Karte stecken; das bedingte Zweitfeld ist Geschwister des `FormControlLabel`s *innerhalb derselben Karte*, nicht irgendwo unter der ganzen Gruppe. Eingefügt nach der Budget-Auswahl, vor dem Kommentarfeld:**

```tsx
<FormLabel sx={{mt: 2, display: "block"}}>{TEXT_PAYEE}</FormLabel>
<RadioGroup
  value={formState.payeeType}
  onChange={(event) => {
    const payeeType = event.target.value as ExpensePayeeType;
    // Beim Typ-Wechsel die jeweils andere Auswahl zurücksetzen — sonst bliebe
    // z.B. eine payeeUserId stehen, obwohl "Neue Person" gewählt wurde, und
    // der CHECK-Constraint der DB würde das Speichern ablehnen.
    setFormState((prev) => ({
      ...prev,
      payeeType,
      payeeUserId: payeeType === ExpensePayeeType.EXISTING_USER ? prev.payeeUserId : null,
      payeeName: payeeType === ExpensePayeeType.NEW_PERSON ? prev.payeeName : "",
    }));
  }}
>
  <Box sx={classes.payeeOptionCard}>
    <FormControlLabel
      value={ExpensePayeeType.EXISTING_USER}
      control={<Radio />}
      label={TEXT_PAYEE_EXISTING_USER}
    />
    {formState.payeeType === ExpensePayeeType.EXISTING_USER && (
      <TextField
        select
        fullWidth
        label={TEXT_NAME}
        value={formState.payeeUserId ?? ""}
        onChange={(event) => updateField("payeeUserId", event.target.value)}
        error={touched && !formState.payeeUserId}
        helperText={touched && !formState.payeeUserId ? TEXT_PLEASE_PROVIDE_PAYEE : undefined}
        margin="normal"
        sx={{mt: 1}}
      >
        {payeeOptions.map((cook) => (
          <MenuItem
            key={cook.uid}
            value={cook.uid}
            disabled={!cooks.some((c) => c.uid === cook.uid)}
          >
            {cook.displayName}
          </MenuItem>
        ))}
      </TextField>
    )}
  </Box>

  <Box sx={classes.payeeOptionCard}>
    <FormControlLabel
      value={ExpensePayeeType.NEW_PERSON}
      control={<Radio />}
      label={TEXT_PAYEE_NEW_PERSON}
    />
    {formState.payeeType === ExpensePayeeType.NEW_PERSON && (
      <TextField
        fullWidth
        label={TEXT_NAME}
        value={formState.payeeName}
        onChange={(event) => updateField("payeeName", event.target.value)}
        error={touched && formState.payeeName.trim().length === 0}
        helperText={
          touched && formState.payeeName.trim().length === 0
            ? TEXT_PLEASE_PROVIDE_PAYEE_NAME
            : undefined
        }
        margin="normal"
        sx={{mt: 1}}
      />
    )}
  </Box>

  <Box sx={classes.payeeOptionCard}>
    <FormControlLabel
      value={ExpensePayeeType.NO_REFUND_NEEDED}
      control={<Radio />}
      label={TEXT_PAYEE_NO_REFUND_NEEDED}
    />
  </Box>
</RadioGroup>
```

`RadioGroup` erwartet keine direkten `FormControlLabel`-Kinder — sie liest ihren Kontext (`RadioGroupContext`) über den React-Baum, egal wie tief die `Radio`-Elemente verschachtelt sind. Die zusätzliche `Box`-Ebene pro Option bricht die Gruppierung also nicht.

**Neuer Style `payeeOptionCard`** (`expenseTracking.styles.ts`, Vorbild `budgetCardAddNew`s gestrichelter Rahmen, hier aber durchgezogen):

```ts
payeeOptionCard: {
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: "8px",
  padding: theme.spacing(1, 1.5),
  marginTop: theme.spacing(1),
},
```

**`isValid`-Erweiterung:**

```ts
const isPayeeValid =
  formState.payeeType === ExpensePayeeType.EXISTING_USER
    ? !!formState.payeeUserId
    : formState.payeeType === ExpensePayeeType.NEW_PERSON
      ? formState.payeeName.trim().length > 0
      : true; // no_refund_needed braucht keine weitere Angabe

const isValid =
  isDateValid &&
  formState.label.trim().length > 0 &&
  amountInCents != null &&
  amountInCents > 0 &&
  formState.date &&
  formState.currency &&
  formState.budgetId &&
  isPayeeValid;
```

**`transformInputToExpenseDomain`** (in `expenseTracking.tsx`) — ersetzt die drei hartkodierten Zeilen aus Entscheidung 3:

```ts
const transformInputToExpenseDomain = (
  expenseInput: ExpenseDetailDialogState,
): ExpenseDomain => {
  return {
    // ...bestehende Felder unverändert...
    payeeType: expenseInput.payeeType,
    payeeUserId:
      expenseInput.payeeType === ExpensePayeeType.EXISTING_USER
        ? expenseInput.payeeUserId
        : null,
    payeeName:
      expenseInput.payeeType === ExpensePayeeType.NEW_PERSON
        ? expenseInput.payeeName.trim() || null
        : null,
    attachmentPath: null,
    attachmentOriginalFilename: null,
  };
};
```

Die verschachtelten Bedingungen sind bewusst redundant zum `RadioGroup`-Reset-Handler oben — beide Stellen erzwingen unabhängig voneinander die exakte Kombination, die der DB-`CHECK`-Constraint
verlangt. Ohne diese zweite Absicherung hier könnte ein Zustand, der im Formular kurzzeitig inkonsistent war (z.B. ein Test, der Felder direkt setzt statt über die UI), unbemerkt durchrutschen.

**`Expense.checkExpenseData`-Erweiterung** — Server-seitiges Pendant zum `CHECK`-Constraint, selbes Muster wie die bestehenden Feld-Prüfungen:

```ts
if (expense.payeeType === ExpensePayeeType.EXISTING_USER && !expense.payeeUserId) {
  throw new FieldValidationError(TEXT_PLEASE_PROVIDE_PAYEE);
}
if (
  expense.payeeType === ExpensePayeeType.NEW_PERSON &&
  !expense.payeeName?.trim()
) {
  throw new FieldValidationError(TEXT_PLEASE_PROVIDE_PAYEE_NAME);
}
```

**Tests**

- `expenseDetailDialog.test.tsx`: alle drei `payeeType`-Optionen wählbar; Wechsel des Typs setzt die jeweils andere Auswahl zurück (RadioGroup-Handler); Validierung greift korrekt pro Typ (leerer Name bei `new_person`, keine Auswahl bei `existing_user` → Fehler; `no_refund_needed` immer gültig); verwaiste `payeeUserId` erscheint als deaktivierter Platzhalter-Eintrag, wenn nicht in `cooks`.
- `expense.class.test.ts`: `checkExpenseData` wirft bei inkonsistenter Payee-Kombination (Muster wie die bestehenden Feld-Tests), lässt alle drei gültigen Kombinationen durch. 
- `expenseTracking.test.tsx`: `createExpense`/`updateExpense`-Payload enthält die korrekte Payee-Kombination je gewähltem Typ (Muster: `expect.objectContaining({payeeType, payeeUserId, payeeName})`, analog dem `budgetId`-Wechsel-Test aus 2.6).
- **Mutationsprobe:** Reset-Logik im `RadioGroup`-Handler entfernen (z.B. `payeeUserId` bei Typwechsel nicht mehr zurücksetzen) → ein Test muss zeigen, dass beim Speichern nach einem Typwechsel trotzdem die alte, jetzt inkonsistente `payeeUserId` mitgeschickt würde.

**Zum Ansehen im Browser** (DEV, nie PROD): alle drei Typen durchklicken, Validierung prüfen; 
Ausgabe mit `existing_user` speichern, Dialog erneut öffnen → Person weiterhin korrekt vorausgewählt;
falls im Testdatensatz möglich, einen Cook aus `event.cooks` entfernen und die zugehörige alte Ausgabe bearbeiten → Platzhalter-Eintrag erscheint, keine falsche Vorbelegung. **Mobile prüfen** (RadioGroup auf xs, wie immer).

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` sauber; alle drei Payee-Typen haben je einen eigenen Test für Auswahl **und** Validierung;
`checkExpenseData` deckt alle drei gültigen und die zwei ungültigen Payee-Kombinationen ab; Mutationsprobe für den Reset-Handler bestanden.

### **Story 3.2 — Aggregation "Offene Beträge pro Person"** ✅ erledigt

Ziel: eine reine Aggregations-Funktion, die aus allen Ausgaben eines Events die Summe pro zahlender Person errechnet, plus eine einfache Vorschau-Anzeige. Die volle Dashboard-Integration (Kennzahlen, Epic 6) baut auf derselben Funktion auf, nicht auf einer neuen.

**Wichtige Annahme, bitte gegenlesen:** Im gesamten Epic-0–10-Grobplan gibt es kein "als
zurückerstattet markieren"-Epic, und `ExpenseDomain` hat kein entsprechendes Feld. "Offen" heisst hier deshalb schlicht "insgesamt geschuldet" — die App berechnet, wer wie viel bekommen sollte, die tatsächliche Rückerstattung (Banküberweisung, bar) passiert ausserhalb der App. Es gibt also **keine** Settled/Unsettled-Filterung zu bauen. Falls doch eine Rückerstattungs-Markierung geplant ist, muss das vor dem Bauen geklärt werden — die Aggregation unten geht davon aus, dass es sie nicht
gibt.

**Gruppierung bei `new_person`:** Zwei Ausgaben mit identischem getippten Namen (z.B. beide "Hans") werden **zusammengefasst** — exakter String-Vergleich, keine Fuzzy-Matching. Ein Tippfehler ("Hans" vs. "hans") wird bewusst **nicht**  zusammengeführt; das ist eine Grenze der freien Texteingabe, keine die diese Story lösen muss.

**Dateien**

| Datei | Änderung |
|---|---|
| `expense.types.ts` | neuer Typ `PayeeBalance` |
| `expense.class.ts` | neue Methode `Expense.sumByPayee` |
| `expense.class.test.ts` | Tests für `sumByPayee` |
| `payeeBalanceAccordion.tsx` (neu) | Anzeige-Komponente, analog `budgetCard.tsx`/`expenseList.tsx` als eigene Datei |
| `expenseTracking.tsx` | `PayeeBalanceAccordion` unterhalb der Budget-Karten einbinden |
| `constants/text/expenseTracking.ts` | `OPEN_AMOUNTS_PER_PERSON` (Accordion-Titel) |
| `constants/styles/expenseTracking.styles.ts` | neuer Style `payeeBalanceSummary` (siehe unten) |

**`PayeeBalance`-Typ** (`expense.types.ts`) — bewusst ohne Anzeigenamen: `sumByPayee` bleibt reine
Domain-Logik ohne Kenntnis von `Cook`/`event.cooks`, genau wie `groupByBudget` keine
Icon-Komponente auflöst (das macht `budgetCard.tsx`). Die Auflösung des Anzeigenamens passiert erst
in der UI-Komponente. **Trägt bewusst auch die einzelnen `expenses`**, nicht nur die Summe — sonst
könnte man in der UI nicht nachsehen, welche Ausgaben einen Betrag ausmachen, bevor man jemanden
zurückerstattet. Das macht den Typ strukturell fast identisch zu `ExpenseGroup`
(`{budget, expenses, totalsByCurrency}`), nur nach zahlender Person statt Budget gruppiert:

```ts
export type PayeeBalance = {
  payeeType: ExpensePayeeType.EXISTING_USER | ExpensePayeeType.NEW_PERSON;
  payeeUserId: string | null;
  payeeName: string | null;
  expenses: ExpenseDomain[]; // neueste zuerst, wie ExpenseGroup.expenses
  totalsByCurrency: Record<string, number>;
};
```

**`Expense.sumByPayee`** — Muster wie `sumByBudgetAndCurrency`. Kein zusammengesetzter Schlüssel: der DB-`CHECK`-Constraint garantiert, dass nach dem Ausschluss von  `no_refund_needed` pro Ausgabe **genau eines** von `payeeUserId`/`payeeName` gesetzt ist, nie beide, nie keines — eine UUID und ein getippter Name landen also nie im selben Bucket, ganz ohne Namensraum-Präfix. Ein Präfix dagegen (ursprünglich hier vorgesehen) hätte nur eine praktisch nie eintretende Kollision verhindert (jemand tippt zufällig eine UUID als Namen) und wäre unnötige Komplexität für ein Szenario, das nicht eintreten kann:

```ts
/**
 * Summiert alle Ausgaben mit zahlender Instanz (ohne `no_refund_needed`) pro
 * Person und Währung. Fasst `new_person`-Einträge mit exakt gleichem Namen
 * zusammen (kein Fuzzy-Matching).
 *
 * @param expenses - Alle Ausgaben des Anlasses.
 * @returns Eine Zeile je Person, unsortiert (Sortierung nach Anzeigename
 *   obliegt der UI-Schicht, die `event.cooks` zur Auflösung braucht).
 */
static sumByPayee(expenses: ExpenseDomain[]): PayeeBalance[] {
  const balancesByKey = new Map<string, PayeeBalance>();

  for (const expense of expenses) {
    if (expense.payeeType === ExpensePayeeType.NO_REFUND_NEEDED) continue;

    // Nach dem Ausschluss von no_refund_needed garantiert der DB-CHECK-
    // Constraint: genau eines von beiden ist gesetzt.
    const key = expense.payeeUserId ?? expense.payeeName ?? "";

    const balance = balancesByKey.get(key) ?? {
      payeeType: expense.payeeType,
      payeeUserId: expense.payeeUserId,
      payeeName: expense.payeeName,
      expenses: [],
      totalsByCurrency: {},
    };
    balance.expenses.push(expense);
    balance.totalsByCurrency[expense.currency] =
      (balance.totalsByCurrency[expense.currency] ?? 0) + expense.amountInCents;
    balancesByKey.set(key, balance);
  }

  // Analog groupByBudget: neueste Ausgabe zuerst je Person.
  return [...balancesByKey.values()].map((balance) => ({
    ...balance,
    expenses: Expense.sortByDateDescending(balance.expenses),
  }));
}
```

**`PayeeBalanceAccordion`** (neue Datei) — **eine eigene `Accordion` pro Person**, nicht eine gemeinsame Accordion um eine flache Liste.  Begründung: mit nur einer äusseren Accordion müsste man erst aufklappen, um überhaupt zu sehen, wer auf der Liste steht — Name und Summe pro Person sollen aber immer sichtbar sein (`AccordionSummary`), nur die einzelnen Ausgaben dahinter sind Detail und bleiben eingeklappt (`AccordionDetails`, Vorbild `dialogRequest.tsx`s Changelog-Accordion für das Grundmuster). Das erlaubt ausserdem, vor einer Rückerstattung nachzusehen, *welche* Ausgaben eine Summe ausmachen:

```tsx
type PayeeBalanceAccordionProps = {
  expenses: ExpenseDomain[];
  cooks: Cook[];
};

export const PayeeBalanceAccordion = ({expenses, cooks}: PayeeBalanceAccordionProps) => {
  const classes = useCustomStyles();
  const balances = Expense.sumByPayee(expenses);
  if (balances.length === 0) return null; // Leerzustand: Abschnitt einfach ausblenden

  const rows = balances
    .map((balance) => ({
      ...balance,
      displayName:
        balance.payeeType === ExpensePayeeType.EXISTING_USER
          ? (cooks.find((cook) => cook.uid === balance.payeeUserId)?.displayName ??
             TEXT_FORMER_EVENT_COOK) // dieselbe Formulierung wie im Payee-Select aus 3.1
          : (balance.payeeName ?? ""),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));

  return (
    <Box sx={{mt: 2}}>
      <Typography variant="subtitle2" sx={{mb: 1}}>
        {TEXT_OPEN_AMOUNTS_PER_PERSON}
      </Typography>
      {rows.map((row) => (
        <Accordion
          key={`${row.payeeType}_${row.payeeUserId ?? row.payeeName}`}
          variant="outlined"
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={classes.payeeBalanceSummary}>
              <Typography>{row.displayName}</Typography>
              <Box sx={classes.expenseGroupHeaderTotals}>
                {Object.entries(row.totalsByCurrency)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([currency, amountInCents]) => (
                    <Typography key={currency} variant="body2">
                      {formatAmountFromCents(amountInCents, currency)}
                    </Typography>
                  ))}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {row.expenses.map((expense) => (
                <ListItem key={expense.id}>
                  <ListItemText
                    primary={expense.label}
                    secondary={formatAmountFromCents(
                      expense.amountInCents,
                      expense.currency,
                    )}
                  />
                </ListItem>
              ))}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};
```

**Neuer Style `payeeBalanceSummary`** (`expenseTracking.styles.ts`) — `AccordionSummary` legt seinen
Inhalt nicht automatisch mit `space-between` an, Name links und Summen rechts brauchen das aber:

```ts
payeeBalanceSummary: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "100%",
},
```

Wiederverwendet bewusst `classes.expenseGroupHeaderTotals` (Mehrwährungs-Layout, schon aus 2.4) statt
eines weiteren neuen Styles dafür — selbe visuelle Situation (mehrere Beträge nebeneinander je Zeile).
`TEXT_FORMER_EVENT_COOK` ist dieselbe Konstante wie in 3.1s Payee-Select — nicht duplizieren.

**Einbindung in `expenseTracking.tsx`** — direkt nach dem schliessenden `</Grid>` der Budget-Karten, noch innerhalb des `view === "overview"`-Zweigs (nach Zeile ~730 im aktuellen Stand):

```tsx
              </Grid>
              <PayeeBalanceAccordion expenses={state.expenses ?? []} cooks={event.cooks} />
            ) : (
```

**Tests**

- `Expense.sumByPayee`: leere Liste → `[]`; `no_refund_needed`-Einträge werden ignoriert; `existing_user`-Einträge derselben `payeeUserId` werden summiert; zwei `new_person`-Einträge mit identischem Namen werden zusammengefasst; unterschiedliche Namen bleiben getrennt; mehrere Währungen derselben Person landen in getrennten `totalsByCurrency`-Einträgen; `expenses` je Person enthält genau die richtigen Ausgaben, sortiert nach Datum absteigend (Muster wie bei `groupByBudget`s entsprechendem Test).
- `PayeeBalanceAccordion`: rendert nichts, wenn keine Ausgaben mit zahlender Instanz vorhanden sind; 
Name **und** Summe sind sichtbar, ohne dass die Accordion aufgeklappt ist (das ist der eigentliche Punkt dieser Story); 
aufgeklappt zeigt sie genau die Ausgaben dieser Person; 
zeigt aufgelösten Cook-Namen bei `existing_user`; 
zeigt `payeeName` direkt bei `new_person`; 
zeigt `TEXT_FORMER_EVENT_COOK`, wenn `payeeUserId` nicht mehr in `cooks` vorkommt; 
Sortierung der Personen nach Anzeigename; mehrere Währungen werden nebeneinander angezeigt; 
zwei Personen mit Einträgen haben zwei unabhängig auf-/zuklappbare Accordions (eine aufklappen ändert die andere nicht).
- **Mutationsprobe:** den `NO_REFUND_NEEDED`-Filter (`continue`) entfernen → ein Test muss zeigen, dass dann auch Ausgaben ohne Rückerstattungsbedarf in der Summe auftauchen.

**Zum Ansehen im Browser** (DEV, nie PROD): mehrere Ausgaben mit unterschiedlichen Personen (bestehend und neu, verschiedene Währungen) anlegen — Namen und Summen sofort sichtbar, ohne etwas aufzuklappen; eine Person aufklappen und die einzelnen Ausgaben prüfen; alle Ausgaben löschen → Abschnitt verschwindet ganz. **Mobile prüfen.**

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` sauber; `Expense.sumByPayee` hat eigene Tests inkl. der `expenses`-Zuordnung und -Sortierung; `PayeeBalanceAccordion` hat eigene Tests für Leerzustand, sichtbare Zusammenfassung ohne Aufklappen, Namensauflösung, Sortierung und unabhängiges Auf-/Zuklappen.

## Epic 4 — Belege (Attachments) ✅ erledigt

Ziel: Ausgaben können einen Beleg (PDF oder Bild) tragen. Schema ist bereits seit Epic 0/2 vorhanden (`ExpenseDomain.attachmentPath`/`attachmentOriginalFilename`, siehe `20260905000002_add_event_expenses.sql`)
— Epic 4 füllt sie erstmals mit echten Daten: erst die Storage-Policy (4.1), dann Upload/Löschen im Dialog (4.2), dann Anzeige/Download in der Liste (4.3).

### **Story 4.1 — Storage-RLS für Ausgaben-Belege** ✅ erledigt

**Nachkorrektur (2026-10-02):** Der ursprüngliche Pfad `events/<eventId>/expenses/<expenseId>/<dateiname>` (ein Ordner pro Ausgabe) war unnötig verschachtelt — jede Ausgabe hat genau einen Beleg, die `expenseId` ist bereits eindeutig, ein zusätzlicher Ordner bringt nichts. Vereinfacht auf `events/<eventId>/expenses/<expenseId>.<ext>` (flach, Dateiname = `expenseId`). Da diese Migration bereits angewendet/committet war, wurde sie **nicht verändert** — stattdessen eine neue, ablösende Migration ergänzt: `20261002000001_simplify_expense_receipt_storage_path.sql` (gleiche Methode wie unten, `[4] IS NOT NULL`-Check entfällt, weil der flache Pfad nur noch 3 statt 4 Ordner-Segmente hat). Lokal gegen `supabase-db-test` erneut verifiziert: Koch von Event A kann unter dem neuen flachen Pfad hochladen, ein anderer Nutzer nicht, bestehende Cover-Bild-Policies unverändert. Die Code-Beispiele unten zeigen noch den ursprünglichen, verschachtelten Pfad — massgeblich ist die Korrektur hier und in 4.2.

**Wichtiger Fund beim Verfeinern:** Fast nichts davon braucht eine neue Policy. Der `media`-Bucket und seine `events/`-Policies existieren bereits seit `20260401000007_grants_indexes.sql` (Cover-Bild-Feature). Von den vier Operationen (SELECT/INSERT/UPDATE/DELETE) sind **SELECT und DELETE bereits generisch genug**:

```sql
-- media_events_select (bestehend, unverändert)
bucket_id = 'media'
AND (storage.foldername(name))[1] = 'events'
AND is_event_cook((storage.foldername(name))[2])

-- media_events_delete (bestehend, unverändert)
bucket_id = 'media'
AND (storage.foldername(name))[1] = 'events'
AND (storage.foldername(name))[2] IS NOT NULL
AND is_event_cook((storage.foldername(name))[2])
```

Beide prüfen nur `[1] = 'events'` und `is_event_cook([2])` — das deckt **jeden** Pfad unter `events/<event-uid>/` ab, egal wie tief darunter noch etwas verschachtelt ist. `storage.foldername(name)` liefert alle Pfadsegmente **ausser** dem Dateinamen selbst; für
`events/<event-uid>/expenses/<expense-uid>/<dateiname>.pdf` ist `[1]`/`[2]` identisch zu `events/<event-uid>/cover.jpg` — nur `[3]`/`[4]` sind neu. `media_events_delete`s eigener Kommentar in jener Migration sagt das sogar wörtlich voraus: *"damit zukünftige Dateitypen (z.B. Quittungen) ebenfalls gelöscht werden können"* — Quittungen (Belege) waren beim Bauen der DELETE-Policy bereits
mitgedacht.

**Nur INSERT/UPDATE brauchen eine neue Policy-Variante**, weil die bestehenden zusätzlich `storage.filename(name) = 'cover.jpg'` verlangen — ein Beleg hat aber keinen festen Dateinamen (anders als das Cover-Bild: verschiedene Dateitypen/-endungen, PDF oder Bild). Deshalb eine **separate, zusätzliche** Policy statt die bestehende zu ändern (bereits angewendete Migrationen werden nie verändert) — für den spezifischen `expenses/`-Unterpfad, ohne Dateinamen-Einschränkung:

```sql
-- Neue Migration: 20261001000001_add_expense_receipt_storage_policies.sql

DROP POLICY IF EXISTS "media_expenses_insert" ON storage.objects;
CREATE POLICY "media_expenses_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND (storage.foldername(name))[4] IS NOT NULL
    AND is_event_cook((storage.foldername(name))[2])
  );

DROP POLICY IF EXISTS "media_expenses_update" ON storage.objects;
CREATE POLICY "media_expenses_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'media'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[3] = 'expenses'
    AND (storage.foldername(name))[4] IS NOT NULL
    AND is_event_cook((storage.foldername(name))[2])
  );
```

**Entscheidungen (bewusst so, nicht versehentlich vergessen):**

1. **Kein Dateinamen-Check**, anders als bei `cover.jpg`. Es gibt genau ein Attachment pro Ausgabe (`attachment_path`/`attachment_original_filename` sind einzelne Spalten, kein Array), aber je nach Dateityp unterschiedliche Endungen — ein fester Name würde das verhindern. Der tatsächliche Dateiname wird in Epic 4.2 von der App gewählt (nicht Teil dieser Story).
2. **Kein Abgleich, ob `<expense-uid>` wirklich zu `<event-uid>` gehört.** Das wäre ein zusätzlicher Lookup gegen `event_expenses` in der Policy — aber ein Event-Koch darf laut den bestehenden SELECT/DELETE-Policies ohnehin **jede** Datei unter `events/<event-uid>/` lesen/löschen, auch unabhängig vom neuen `expenses/`-Unterpfad. Eine falsche `expense-uid` im Pfad eröffnet also keine neue Berechtigung, die nicht schon existiert — die Prüfung würde nur Komplexität und einen Extra-Lookup pro Request kosten, ohne echten Sicherheitsgewinn.
3. **Keine Grössen-/Typ-Beschränkung auf Bucket-Ebene.** `media` wird auch für Cover-Bilder und Profilbilder verwendet — eine bucket-weite Beschränkung (z.B. `allowed_mime_types`) würde alle drei Verwendungszwecke gleichzeitig treffen. Grössen-/Typ-Validierung für Belege bleibt Anwendungslogik in 4.2 (serverseitig ohnehin nicht umgehbar prüfbar ohne Bucket-Config — das ist eine reine UX-Vorabprüfung, kein Sicherheitsmechanismus).

**Dateien**

| Datei | Änderung |
|---|---|
| `supabase/migrations/20261001000001_add_expense_receipt_storage_policies.sql` (neu) | zwei neue Storage-Policies (siehe oben) |

**Tests/Verifikation** — reines SQL, keine Jest-Tests möglich (der Supabase-Client ist in der Jest-Suite komplett gemockt, `jest.config.json`s `moduleNameMapper`; RLS lässt sich nur gegen eine echte Postgres-Instanz prüfen):

- Migration transaktional gegen den laufenden `supabase-db-test`-Container anwenden (`supabase db reset` ist mit der aktuellen CLI blockiert — Workaround siehe `reference_local_migration_verify`).
- Manuell mit mind. zwei Test-Usern verifizieren (CLAUDE.md-Pflicht bei RLS-Änderungen):
  - Koch von Event A kann unter `events/<A>/expenses/<beliebige-uid>/beleg.pdf` hochladen/ersetzen.
  - Koch von Event B (nicht Teammitglied von A) kann das **nicht** (INSERT/UPDATE schlägt fehl).
  - Nicht angemeldet (anon): weder Lesen noch Schreiben möglich.
  - Bestehendes Verhalten unverändert: Cover-Bild-Upload (`events/<A>/cover.jpg`) funktioniert nach wie vor genau wie vor dieser Migration.

**Zum Ansehen im Browser:** nicht sinnvoll möglich, solange 4.2 (Upload-UI) nicht existiert — diese Story ist reine Datenbank-Arbeit. Verifikation läuft über die Supabase Studio SQL-Oberfläche oder direkte `storage.upload()`-Aufrufe mit unterschiedlichen Test-Sessions.

**Definition of Done:** Migration wendet sich fehlerfrei auf der Test-DB an; alle vier Verifikations-Szenarien oben manuell bestätigt; bestehende Cover-Bild-Funktionalität nicht beeinträchtigt (keine bestehende Migration verändert, nur eine neue hinzugefügt).

### **Story 4.2 — Upload/Löschen im Ausgaben-Dialog** ✅ erledigt

**Die `folderPath`-Frage aus dem ersten Entwurf ist gelöst, keine Basisklassen-Änderung nötig.** Ich habe nachgesehen, wie `EventStorageRepository` tatsächlich aufgerufen wird (`event.tsx:1677`):

```ts
await database.storage.events.upload(event.uid + "/cover.jpg", resized, "image/jpeg");
```

`folderPath = "events/"` ist nur das **feste** Präfix — die variable `event.uid` ist bereits Teil des `filename`-Arguments, nicht des `folderPath`. (`EventStorageRepository`s eigenes `@example` im Docstring ist dabei veraltet/widersprüchlich zur Klassenbeschreibung direkt darüber — nicht Teil dieser Story, aber falls das mal auffällt: kein Bug, nur ein veraltetes Beispiel.) Dasselbe Muster funktioniert 1:1 für Belege, ganz ohne Änderung an `StorageRepository`:

```ts
export class ExpenseAttachmentStorageRepository extends StorageRepository {
  bucketName = "media";
  folderPath = "events/";
}
// Aufruf: repo.upload(`${eventId}/expenses/${expenseId}.${extension}`, file, file.type)
```

**Architektur-Entscheidung: Upload passiert nicht im Dialog, sondern in der Seite — wie überall sonst auch.** Der Dialog kennt laut seinem eigenen Docstring "weder Datenbank noch Rückfrage"; das gilt auch für Storage. Der Dialog sammelt nur die rohe `File` im Formular-State, die Seite lädt sie erst beim tatsächlichen Speichern hoch (nicht sofort bei der Dateiauswahl) — das deckt sich mit dem Rest des Formulars (nichts passiert vor "Speichern") **und** vermeidet verwaiste Storage-Objekte, wenn jemand eine Datei wählt und den Dialog dann abbricht.

**`ExpenseDetailDialogState`-Erweiterung:**

```ts
export type ExpenseDetailDialogState = {
  // ...bestehende Felder unverändert...
  attachmentFile: File | null; // neu ausgewählte, noch nicht hochgeladene Datei
  removeAttachment: boolean; // true = bestehenden Beleg beim Speichern entfernen
};
```

**Korrektur nach Mockup-Abgleich.** Zwei Punkte aus dem ersten Entwurf waren falsch:

1. **Drag-and-drop fehlte komplett** — der ursprüngliche Entwurf hatte nur einen Klick-Button. Das Mockup zeigt eine gestrichelte Dropzone ("PDF oder Bild hierher ziehen"). Es gibt dafür noch keine Vorlage im Code (keine `dataTransfer.files`-Verwendung irgendwo) — wird hier neu, mit nativen HTML5-Drag-Events gebaut, keine neue Abhängigkeit (kein `react-dropzone` o.ä., passt zu "MUI only").
2. **Nur-Bearbeiten-Einschränkung war falsch.** Das Mockup zeigt den Beleg-Bereich im **Anlegen**-Dialog ("Ausgabe erfassen"), nicht nur beim Bearbeiten. Gelöst: `handleCreateExpense` legt die Ausgabe zuerst an (um die ID zu bekommen), lädt danach — falls eine Datei gewählt wurde — den Beleg hoch und aktualisiert die Ausgabe ein zweites Mal mit dem Pfad. Weiterhin alles erst bei "Speichern", nicht beim Auswählen der Datei.

**Neue Dropzone-Styles** (`expenseTracking.styles.ts`, Vorbild `budgetCardAddNew`s gestrichelter Rahmen — selbe visuelle Sprache, neu nur die Grösse und der Hervorhebungs-Zustand beim Drag-over):

```ts
attachmentDropzone: {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(0.5),
  minHeight: "120px",
  padding: theme.spacing(2),
  borderRadius: "12px",
  border: `1px dashed ${theme.palette.divider}`,
  color: theme.palette.text.secondary,
  cursor: "pointer",
  textAlign: "center",
},
attachmentDropzoneActive: {
  borderColor: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.04),
},
```

**UI in beiden Modi**, mit Drag-and-drop **und** Klick-Fallback (der native `<input type="file">` liegt als Kind im `<label>`, beides funktioniert gleichzeitig). Zeigt die bestehende/gewählte Datei + Entfernen-Button, sobald eine da ist — egal ob frisch gewählt (`formState.attachmentFile`, auch im Anlegen-Modus) oder bereits gespeichert (`expense?.attachmentOriginalFilename`, nur beim Bearbeiten):

```tsx
const [isDraggingOver, setIsDraggingOver] = React.useState(false);

const handleFileSelected = (file: File | null) => {
  // Typ-/Grössenprüfung hier (siehe unten), bei Fehler touched-Fehlertext setzen statt speichern.
  setFormState((prev) => ({...prev, attachmentFile: file, removeAttachment: false}));
};

const currentFilename = formState.attachmentFile?.name ?? expense?.attachmentOriginalFilename;

// ...im JSX:
<Box sx={{mt: 2}}>
  <FormLabel>{TEXT_ATTACHMENT}</FormLabel>
  {currentFilename && !formState.removeAttachment ? (
    <Box sx={classes.attachmentRow}>
      <Typography>{currentFilename}</Typography>
      <Button onClick={() => updateField("removeAttachment", true)}>
        {TEXT_REMOVE_ATTACHMENT}
      </Button>
    </Box>
  ) : (
    <Box
      component="label"
      sx={[classes.attachmentDropzone, isDraggingOver && classes.attachmentDropzoneActive]}
      onDragOver={(event) => {
        event.preventDefault(); // nötig, sonst feuert onDrop nie (Browser-Standard)
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDraggingOver(false);
        handleFileSelected(event.dataTransfer.files?.[0] ?? null);
      }}
    >
      <CloudUploadOutlined />
      <Typography>{TEXT_DROP_ATTACHMENT_HINT}</Typography>
      <Typography variant="caption" color="text.secondary">
        {TEXT_ATTACHMENT_RETENTION_HINT}
      </Typography>
      <input
        type="file"
        hidden
        accept="application/pdf,image/jpeg,image/png"
        onChange={(event) => handleFileSelected(event.target.files?.[0] ?? null)}
      />
    </Box>
  )}
</Box>
```

**Validierung vor dem Hochladen** (clientseitig, UX-Vorabprüfung — kein Sicherheitsmechanismus, siehe 4.1-Entscheidung 3): Typ gegen `["application/pdf", "image/jpeg", "image/png"]`, Grösse gegen eine Obergrenze. **Vorschlag 10 MB** (üblich für Foto-Scans einer Quittung) — bei Bedarf anpassen, keine technische Notwendigkeit für genau diesen Wert. Gilt für **beide** Wege, Klick und Drop — dieselbe `handleFileSelected`-Funktion.

**`handleCreateExpense`-Erweiterung** (`expenseTracking.tsx`) — zweiter Schritt nach dem Anlegen, eigenes `try/catch` mit eigenem Fehlerkontext: schlägt nur der Beleg-Upload fehl, existiert die Ausgabe trotzdem bereits — das muss die Fehlermeldung widerspiegeln, nicht "Ausgabe erstellen" sagen:

```ts
const handleCreateExpense = async (expenseInput: ExpenseDetailDialogState) => {
  const expense = transformInputToExpenseDomain(expenseInput, event.uid);
  if (!checkExpenseInputdata(expense)) return;

  saveInProgressRef.current += 1;
  try {
    const newExpense = await database.expenses.createExpense(expense, authUser!);
    setLastUsedBudgetId(newExpense.value.budgetId);
    trackEvent(AnalyticsEvent.EXPENSE_CREATED);
    dispatch({type: ReducerActions.EXPENSE_CREATED, payload: newExpense.value});

    if (expenseInput.attachmentFile) {
      try {
        const extension = ATTACHMENT_MIME_TO_EXTENSION[expenseInput.attachmentFile.type];
        const relativePath = `${event.uid}/expenses/${newExpense.value.id}.${extension}`;
        await database.storage.expenseAttachments.upload(
          relativePath,
          expenseInput.attachmentFile,
          expenseInput.attachmentFile.type,
        );
        const updated = await database.expenses.updateExpense(
          {
            ...newExpense.value,
            attachmentPath: relativePath,
            attachmentOriginalFilename: expenseInput.attachmentFile.name,
          },
          authUser!,
        );
        dispatch({type: ReducerActions.EXPENSE_UPDATED, payload: updated});
      } catch (error) {
        // Ausgabe existiert bereits — nur der Beleg-Upload ist fehlgeschlagen.
        handleError(error, "Beleg hochladen");
      }
    }
  } catch (error) {
    handleError(error, "Ausgabe erstellen");
  } finally {
    setTimeout(() => {
      saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
    }, 400);
  }

  setExpenseDetailDialogProperties({expense: null, open: false});
};
```

**`handleUpdateExpense`-Erweiterung** (`expenseTracking.tsx`) — unverändert zum ersten Entwurf, war bereits korrekt (Ausgabe existiert hier ja bereits): Upload/Löschen passiert hier, nicht im Dialog, **vor** `database.expenses.updateExpense`, damit die Ausgabe nur mit einem gültigen, bereits hochgeladenen Pfad aktualisiert wird:

```ts
const handleUpdateExpense = async (
  expenseId: string,
  expenseInput: ExpenseDetailDialogState,
) => {
  const expense = {...transformInputToExpenseDomain(expenseInput, event.uid), id: expenseId};
  if (!checkExpenseInputdata(expense)) return;

  saveInProgressRef.current += 1;
  try {
    const previousExpense = state.expenses?.find((e) => e.id === expenseId);

    if (expenseInput.attachmentFile) {
      const extension = ATTACHMENT_MIME_TO_EXTENSION[expenseInput.attachmentFile.type];
      const relativePath = `${event.uid}/expenses/${expenseId}.${extension}`;
      // Nur löschen, wenn sich der Pfad tatsächlich ändert (andere Endung als
      // vorher) — beim Ersetzen mit derselben Endung überschreibt
      // `upsert: true` denselben Pfad automatisch, genau wie bei cover.jpg.
      if (
        previousExpense?.attachmentPath &&
        previousExpense.attachmentPath !== relativePath
      ) {
        await database.storage.expenseAttachments.remove(previousExpense.attachmentPath);
      }
      await database.storage.expenseAttachments.upload(
        relativePath,
        expenseInput.attachmentFile,
        expenseInput.attachmentFile.type,
      );
      expense.attachmentPath = relativePath;
      expense.attachmentOriginalFilename = expenseInput.attachmentFile.name;
    } else if (expenseInput.removeAttachment) {
      if (previousExpense?.attachmentPath) {
        await database.storage.expenseAttachments.remove(previousExpense.attachmentPath);
      }
      expense.attachmentPath = null;
      expense.attachmentOriginalFilename = null;
    }

    const updated = await database.expenses.updateExpense(expense, authUser!);
    trackEvent(AnalyticsEvent.EXPENSE_UPDATED);
    dispatch({type: ReducerActions.EXPENSE_UPDATED, payload: updated});
  } catch (error) {
    handleError(error, "Ausgabe aktualisieren");
  } finally {
    setTimeout(() => {
      saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
    }, 400);
  }
};
```

**Dateiname = `expenseId`, nicht der Originalname** (`attachmentOriginalFilename` bleibt der menschenlesbare Name für die Anzeige) — vermeidet jedes Problem mit Sonderzeichen/Encoding im Originalnamen, ganz ohne zusätzliche generierte ID: die `expenseId` ist bereits eindeutig, und es gibt genau einen Beleg pro Ausgabe (siehe Korrektur-Hinweis in 4.1). Die Endung wird **aus dem MIME-Type abgeleitet**, nicht aus dem Dateinamen (`event.target.files[0].name.split(".").pop()` wäre brüchig — Datei ohne Punkt im Namen, ungewöhnliche Gross-/Kleinschreibung der Endung etc.); da der Typ ohnehin validiert wird, ist eine feste Zuordnung robuster:

```ts
const ATTACHMENT_MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};
```

**Konsequenz für das Ersetzen:** nur löschen, wenn sich die Endung (und damit der Pfad) ändert — bei gleicher Endung überschreibt `upsert: true` denselben Pfad automatisch, genau wie bei `cover.jpg`. Nur ein Wechsel des Dateityps (z.B. PDF → JPG) braucht den expliziten `remove()` des alten Pfads (siehe `handleUpdateExpense` oben).

**Akzeptiertes Restrisiko, nicht Teil dieser Story:** Falls der Upload gelingt, aber der anschliessende `updateExpense`-Aufruf fehlschlägt (z.B. Netzwerkabbruch), bleibt ein verwaistes Storage-Objekt zurück, auf das keine Ausgabe verweist. Dasselbe Risiko besteht bereits heute beim Cover-Bild-Upload (`event.tsx`) und wurde dort nie gelöst — kein neuer Massstab für Belege. Episch 9s Lösch-Cron filtert über das Anlassende, erreicht echte Waisen (nie referenziert) ohnehin nicht; das wäre ein eigenes, separates Aufräum-Thema, falls es je relevant wird.

**Dateien**

| Datei | Änderung |
|---|---|
| `ExpenseAttachmentStorageRepository.ts` (neu) | wie oben, Vorbild `EventStorageRepository` |
| `DatabaseService.ts` | `storage`-Typ und Konstruktor um `expenseAttachments: ExpenseAttachmentStorageRepository` ergänzen (Zeile ~116/152, selbes Muster wie `events`) |
| `expenseDetailDialog.tsx` | `attachmentFile`/`removeAttachment` im State, Dropzone in beiden Modi sichtbar |
| `expenseTracking.tsx` | `handleCreateExpense`- **und** `handleUpdateExpense`-Erweiterung wie oben |
| `constants/text/expenseTracking.ts` | `ATTACHMENT`, `DROP_ATTACHMENT_HINT` ("PDF oder Bild hierher ziehen"), `REMOVE_ATTACHMENT`, `ATTACHMENT_RETENTION_HINT` ("wird 1 Jahr nach Lagerende automatisch gelöscht") |
| `constants/styles/expenseTracking.styles.ts` | `attachmentRow`, `attachmentDropzone`, `attachmentDropzoneActive` |
| `expense.types.ts` (oder `expenseTracking.tsx`, wo es am besten passt) | `ATTACHMENT_MIME_TO_EXTENSION`-Lookup (siehe oben) |

**Tests**

- `ExpenseAttachmentStorageRepository`: `upload`/`remove` rufen den Supabase-Client mit dem erwarteten Pfad auf (Mock-Client, Muster wie bestehende Repository-Tests).
- `expenseDetailDialog.test.tsx`: Dropzone sichtbar in **beiden** Modi (Anlegen und Bearbeiten); Datei per Klick auswählen **und** per `fireEvent.drop` setzen `attachmentFile` gleichermassen (dieselbe `handleFileSelected`-Funktion, ein Test pro Weg genügt, um das zu belegen); "Entfernen" setzt `removeAttachment`, ohne die Datei sofort zu löschen (erst beim Speichern); Typ-/Grössen-   Validierung zeigt Fehlertext, `onEdit`/`onCreate` wird nicht aufgerufen.
- `expenseTracking.test.tsx`:
  - `handleCreateExpense` ohne Beleg: unverändertes Verhalten (Regressionstest).
  - `handleCreateExpense` mit Beleg: `createExpense` wird zuerst aufgerufen, danach Upload unter `<eventId>/expenses/<neue ID>.<ext>` (Endung aus `ATTACHMENT_MIME_TO_EXTENSION`), danach ein zweiter `updateExpense`-Aufruf mit `attachmentPath`/`attachmentOriginalFilename`.
  - `handleCreateExpense`, Upload schlägt fehl: Ausgabe bleibt trotzdem angelegt (nur der Beleg-Schritt scheitert, kein Rollback) — Fehlermeldung bezieht sich auf den Beleg, nicht auf das Anlegen.
  - `handleUpdateExpense`, Ersetzen mit **gleicher** Endung (z.B. PDF → PDF): **kein** `remove()`-Aufruf, nur `upload` mit `upsert: true` auf denselben Pfad.
  - `handleUpdateExpense`, Ersetzen mit **anderer** Endung (z.B. PDF → JPG): `remove()` des alten Pfads **vor** dem Upload des neuen.
  - `handleUpdateExpense`, `removeAttachment`: löscht den Storage-Eintrag und setzt beide Felder auf `null`, ohne hochzuladen.
- **Mutationsprobe:** den Pfad-Vergleich (`previousExpense.attachmentPath !== relativePath`) durch "immer löschen" ersetzen → der Gleiche-Endung-Test muss zeigen, dass unnötig ein `remove()`-Aufruf passiert (ein Test, der `remove` bei gleicher Endung **nicht** erwartet, muss rot werden). Umgekehrt: Vergleich ganz weglassen (nie löschen) → der Andere-Endung-Test muss zeigen, dass der alte Pfad liegen bleibt (verwaistes Objekt).

**Zum Ansehen im Browser** (DEV, nie PROD, braucht 4.1 bereits angewendet): Ausgabe **neu anlegen** und dabei direkt per Drag-and-drop und per Klick je einmal einen Beleg hinzufügen (PDF und Bild testen) → nach dem Speichern im Bearbeiten-Dialog vorhanden; im Bearbeiten-Dialog ersetzen → alter Pfad im Supabase-Storage-Browser tatsächlich weg; entfernen → Feld leer. **Mobile prüfen** (Datei-Auswahl via Kamera auf dem Handy — Drag-and-drop ist dort ohnehin irrelevant, der Klick-Fallback muss aber funktionieren).

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` sauber; Repository-Tests für Upload/Remove; Dialog-Tests für Sichtbarkeit in beiden Modi, Drag-and-drop **und** Klick-Pfad, Validierung; Seiten-Tests für Anlegen-mit-Beleg (inkl. Fehlerfall ohne Rollback), Ersetzen- und Entfernen-Pfad inkl. Mutationsprobe für die Alte-Datei-Löschung.

### **Story 4.3 — Anzeige/Download in der Liste & Storage-Aufräumen beim Löschen (Ausgabe & Anlass)** ✅ erledigt

Zwei getrennte, unabhängige Fähigkeiten, keine davon ist der "Beleg entfernen"-Pfad — der ist bereits seit 4.2 über den Dialog erledigt (Icon-Button → `removeAttachment` → Speichern) und wird hier **nicht** nochmal gebaut:

1. **Anzeige/Download in der Liste** — ein Anhang-Icon in `ExpenseRow`, wenn `attachmentPath` gesetzt ist; Klick öffnet die Datei in einem neuen Tab.
2. **Storage-Objekt beim Löschen der ganzen Ausgabe entfernen** — die in Epic 2 bewusst aufgeschobene Schnittstelle (Entscheidung 9, Zeile 396f.): `handleDeleteExpense` löscht aktuell nur die DB-Zeile, das Storage-Objekt bliebe verwaist liegen.
3. **Storage-Objekte beim Löschen des ganzen Anlasses entfernen** — derselbe Verwaisungs-Fall wie 2., nur ausgelöst von `event.tsx`s `onEventDelete` statt von der Abrechnungsseite: `event_expenses.event_id` hat `ON DELETE CASCADE` (`event_expenses_event_id_fkey`), die DB-Zeilen (und damit alle `attachment_path`-Werte) verschwinden beim Löschen des Anlasses automatisch — die zugehörigen Storage-Objekte nicht. `onEventDelete` entfernt heute bereits `cover.jpg` (Zeile 1811ff.), aber keine Belege. Gelöst über eine neue generische `removeFolder()`-Methode auf `StorageRepository` (siehe Entscheidung 8) statt über die DB — braucht daher **keine** Ausgaben-Abfrage vorab.

**Architektur-Entscheidungen**

1. **`media`-Bucket ist public → kein signierter Link nötig.** `getPublicUrl()` reicht (anders als bei einem privaten Bucket). Die Methode ist zudem rein synchron — reine String-Konstruktion aus Projekt-URL + Bucket + Pfad, kein Netzwerk-Call — kann also direkt beim Rendern aufgerufen werden, ohne Async-State oder Ladezustand in der Zeile.
2. **`ExpenseList`/`ExpenseRow` bleiben "reine Darstellung".** Laut eigenem Docstring berechnet die Liste nichts und kennt keine Datenbank. Statt die ganze `database`-Instanz durchzureichen, bekommt `ExpenseList` eine schmale Callback-Prop `getAttachmentUrl: (attachmentPath: string) => string` — umgesetzt als **Pflicht**-Prop (nicht optional wie ursprünglich geplant), da die Liste jetzt auch für Ausgaben ohne Beleg ein Icon rendert; bestehende Aufrufe in `expenseList.test.tsx` übergeben `jest.fn()`.
3. **Echter `<a>`-Link statt `window.open()`.** `IconButton component="a" href={...} target="_blank" rel="noopener noreferrer"` — funktioniert mit Rechtsklick/"Link speichern als" und Cmd/Strg-Klick, kein Popup-Blocker-Risiko. "Anzeige" und "Download" sind damit ein und derselbe Klick: Browser zeigen PDF/Bild meist inline, "Speichern als" bleibt dem Nutzer im neuen Tab überlassen — kein erzwungener Download-Header nötig.
4. **`stopPropagation` auf dem Icon-Klick**, sonst öffnet sich zusätzlich der Bearbeiten-Dialog (die ganze Zeile ist bereits klickbar) — etabliertes Muster, siehe `eventCard.tsx:200`.
5. **Layout:** `expenseRowPrimary` hat `justifyContent: space-between` mit genau zwei Kindern (Bezeichnung, Betrag). Ein drittes Kind würde das umbrechen (mittleres Element würde zentriert statt rechts ausgerichtet). Deshalb Icon + Betrag in einer neuen `expenseRowAmountGroup`-Box zusammenfassen, die als zweites der zwei `space-between`-Kinder dient.
6. **Reihenfolge beim Löschen: DB-Zeile zuerst, Storage danach.** Analog zum Upload-Fehler-Muster aus 4.2 (dort: Ausgabe zuerst anlegen, Beleg danach hochladen) — die DB-Operation ist die primäre, für den Nutzer sichtbare Aktion und darf nicht an einem Storage-Fehler scheitern. Schlägt `remove()` fehl, bleibt ein verwaistes Storage-Objekt liegen; das ist unkritisch (kein Datenverlust, kein sichtbarer Fehlzustand) und wird langfristig vom geplanten Housekeeping-Cron mit aufgeräumt, nicht hier nochmal behandelt.
7. **Fehler beim Storage-Entfernen wird trotzdem gemeldet** (`handleError(error, "Beleg löschen")`, gleiches Muster wie "Beleg hochladen" in 4.2), auch wenn die Zeile zu diesem Zeitpunkt schon verschwunden ist — Konsistenz mit dem Rest des Features (jeder Storage-Fehler wird gemeldet) wiegt hier höher als die etwas unscharfe UX in diesem Rand-Fall.
8. **Beim Anlass-Löschen: ganzer Storage-Ordner statt DB-Abfrage.** Statt die Ausgaben vor dem Löschen abzufragen (um an die `attachment_path`-Werte zu kommen, bevor die CASCADE sie mitnimmt), bekommt `StorageRepository` eine neue generische Methode `removeFolder(folderPrefix)`, die direkt im Storage nachschaut, was unter diesem Pfad tatsächlich liegt, und alles löscht — unabhängig vom DB-Zustand. Das macht die Reihenfolge-Frage aus der vorherigen Fassung dieser Entscheidung hinfällig (keine Abfrage mehr nötig, die vor dem CASCADE passieren müsste) und räumt als Nebeneffekt auch Dateien auf, die aus irgendeinem anderen Grund nie einen `attachment_path`-Eintrag bekommen haben (z.B. ein Fehler zwischen Upload und dem zweiten `updateExpense`-Aufruf aus 4.2). Supabase Storage hat kein atomares "Ordner löschen" — Ordner sind rein virtuell (aus Dateipfaden abgeleitet) — `list()` liefert nur eine Ebene, Unterordner erscheinen als Einträge mit `id: null` und müssen selbst nochmal aufgelistet werden; `removeFolder()` löst das rekursiv auf und ruft am Ende **ein** `remove([...])` mit allen gefundenen Pfaden.
9. **`events/<eventId>/` ist flach genug für die generische Lösung, lohnt sich aber auch fürs Housekeeping-Cron.** Die konkrete Struktur hier ist nur eine Ebene tief (`cover.jpg` direkt, `expenses/<id>.<ext>` einen Unterordner tiefer) — eine fest verdrahtete Zwei-Ebenen-Lösung hätte auch gereicht. Die rekursive Variante ist trotzdem die bessere Wahl: dieselbe Methode liefert auch die vollständige Dateiliste, die das geplante Housekeeping-Cron fürs Reconciliation-Sweep sowieso braucht (siehe `project_housekeeping_cron`-Notiz) — keine zweite Implementierung später.
10. **Fehler bleiben stumm (`.catch(() => {})`), kein `handleError`.** Ersetzt die bisherige `cover.jpg`-Entfernung 1:1 (war schon stumm) — jetzt räumt derselbe eine, stumme Aufruf Cover **und** alle Belege zusammen auf, keine zweite Fehlerbehandlung nötig.

**Code-Skizze** (`expenseList.tsx`):

```tsx
interface ExpenseListProps {
  expenseGroups: ExpenseGroup[];
  highlightedExpenseIds: Set<string>;
  handleEditClick: (expenseId: string) => void;
  getAttachmentUrl?: (attachmentPath: string) => string;
}
// ... durchreichen an ExpenseRow ...

{expense.attachmentPath && getAttachmentUrl && (
  <IconButton
    component="a"
    href={getAttachmentUrl(expense.attachmentPath)}
    target="_blank"
    rel="noopener noreferrer"
    size="small"
    aria-label={TEXT_SHOW_EXPENSE_RECEIPT}
    onClick={(clickEvent) => clickEvent.stopPropagation()}
  >
    <AttachFileOutlined fontSize="small" />
  </IconButton>
)}
```

**Code-Skizze** (`expenseTracking.tsx`, `handleDeleteExpense`-Erweiterung):

```ts
await database.expenses.deleteExpense(expense.id);
trackEvent(AnalyticsEvent.EXPENSE_DELETED);
dispatch({type: ReducerActions.EXPENSE_DELETED, payload: expense});

if (expense.attachmentPath) {
  try {
    await database.storage.expenses.remove(expense.attachmentPath);
  } catch (error) {
    handleError(error, "Beleg löschen");
  }
}
```

**Code-Skizze** (`StorageRepository.ts`, neue generische Methode):

```ts
/**
 * Löscht alle Dateien unterhalb eines Ordners rekursiv.
 *
 * Supabase Storage kennt kein atomares "Ordner löschen" — Ordner sind rein
 * virtuell (aus Dateipfaden abgeleitet). `list()` liefert deshalb nur eine
 * Ebene; Unterordner erscheinen als Einträge mit `id: null` und werden hier
 * rekursiv selbst nochmal aufgelistet, bis nur noch echte Dateien übrig sind.
 *
 * @param folderPrefix - Ordnerpfad relativ zu `folderPath` (ohne führenden/folgenden Slash).
 * @throws Error bei Lese- oder Löschfehler.
 *
 * @example
 * await repo.removeFolder("evt-123"); // löscht alles unter events/evt-123/*, rekursiv
 */
async removeFolder(folderPrefix: string): Promise<void> {
  const filePaths = await this.listFilesRecursively(`${this.folderPath}${folderPrefix}`);
  if (filePaths.length === 0) return;

  const {error} = await this.client.storage.from(this.bucketName).remove(filePaths);
  if (error) throw error;
}

private async listFilesRecursively(prefix: string): Promise<string[]> {
  const {data, error} = await this.client.storage.from(this.bucketName).list(prefix);
  if (error) throw error;

  const paths: string[] = [];
  for (const entry of data ?? []) {
    const entryPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      paths.push(...(await this.listFilesRecursively(entryPath)));
    } else {
      paths.push(entryPath);
    }
  }
  return paths;
}
```

**Code-Skizze** (`event.tsx`, `onEventDelete`-Vereinfachung — ersetzt die bisherige `cover.jpg`-Zeile 1:1):

```ts
// ersetzt die bisherigen zwei Zeilen (cover.jpg einzeln + keine Belege) durch einen Aufruf,
// der den ganzen events/<eventId>/-Ordner aufräumt — Cover UND alle Belege, in einem Schritt:
await database.storage.events.removeFolder(state.event.uid).catch(() => {});

await database.events.deleteEvent(state.event.uid);
```

**Dateien**

| Datei | Änderung |
|---|---|
| `expenseList.tsx` | neue optionale Prop `getAttachmentUrl` auf `ExpenseList` **und** `ExpenseRow`; Anhang-Icon im `expenseRowPrimary`, wenn `attachmentPath` gesetzt |
| `expenseTracking.tsx` | übergibt `database.storage.expenses.getPublicUrl` als `getAttachmentUrl`; `handleDeleteExpense` entfernt zusätzlich das Storage-Objekt, wenn vorhanden |
| `constants/styles/expenseTracking.styles.ts` | neue `expenseRowAmountGroup` (Flex-Box, fasst Icon + Betrag zusammen) |
| `constants/text/expenseTracking.ts` | neuer Text `SHOW_EXPENSE_RECEIPT` ("Beleg ansehen", aria-label fürs Icon) |
| `StorageRepository.ts` | neue Methoden `removeFolder(folderPrefix)` (public) und `listFilesRecursively(prefix)` (private) |
| `Repository/__mocks__/storageMock.ts` | `list`-Mock auf `storageBucketMock` ergänzen (fehlt heute, nur `upload`/`remove`/`getPublicUrl`) |
| `event.tsx` (ausserhalb `ExpenseTracking/`) | `onEventDelete`: bisherige `cover.jpg`-Einzel-Entfernung durch einen `removeFolder(eventId)`-Aufruf ersetzen |

**Tests**

- `expenseList.test.tsx`: Icon erscheint nur, wenn **beides** gesetzt ist (`attachmentPath` **und** `getAttachmentUrl`); `href` entspricht dem Rückgabewert der übergebenen Funktion; Klick auf das Icon löst `handleEditClick` **nicht** aus (stopPropagation); bestehende Aufrufe ohne die neue Prop zeigen weiterhin kein Icon (Regressionstest, belegt die Rückwärtskompatibilität).
- `expenseTracking.test.tsx`:
  - Löschen einer Ausgabe **mit** Beleg ruft zusätzlich `storage.expenses.remove(attachmentPath)` auf, **nach** `deleteExpense`.
  - Löschen einer Ausgabe **ohne** Beleg ruft `remove()` nicht auf (Regressionstest für den bestehenden Lösch-Pfad aus Paket 2.6).
  - Scheitert das Entfernen des Storage-Objekts, bleibt die Ausgabe trotzdem gelöscht (die Zeile verschwindet), zusätzlich erscheint ein auf "Beleg löschen" bezogener Fehler.
- `StorageRepository.test.ts` (bestehende Datei, neue `describe("removeFolder()")`):
  - Flacher Ordner (nur Dateien, keine Unterordner): `list()` einmal aufgerufen, `remove()` mit allen gefundenen Pfaden in einem Aufruf.
  - Verschachtelter Ordner (ein Unterordner-Eintrag mit `id: null`, wie bei `events/<id>/expenses/`): `list()` wird für den Unterordner **zusätzlich** aufgerufen (rekursiv), am Ende trotzdem **ein** `remove()`-Aufruf mit allen Pfaden aus beiden Ebenen zusammen.
  - Leerer Ordner (`list()` liefert `[]`): `remove()` wird gar nicht aufgerufen (kein leerer Call mit `[]`).
  - Lesefehler bei `list()` bzw. Löschfehler bei `remove()`: beide werfen (gleiches Muster wie die bestehenden `upload`/`remove`-Fehlertests).
- **Mutationsprobe (Beleg-Entfernen in `handleDeleteExpense`):** den `if (expense.attachmentPath)`-Check vor dem `remove()`-Aufruf entfernen (immer aufrufen) → der "ohne Beleg kein remove()"-Test muss rot werden.
- **Mutationsprobe (`removeFolder`):** die Rekursion weglassen (nur eine `list()`-Ebene) → der "verschachtelter Ordner"-Test muss zeigen, dass die Dateien aus dem Unterordner (`expenses/...`) fehlen und so unentfernt liegen blieben.

**Zum Ansehen im Browser** (DEV, braucht 4.1 und 4.2 bereits angewendet): eine Ausgabe mit PDF- und eine mit Bild-Beleg anlegen → Anhang-Icon erscheint in der Liste, Klick öffnet die Datei in neuem Tab, Klick auf den Rest der Zeile öffnet weiterhin den Bearbeiten-Dialog. Ausgabe mit Beleg löschen → im Supabase-Storage-Browser verifizieren, dass das Objekt tatsächlich weg ist. Anlass mit mehreren Belegen löschen → alle zugehörigen Dateien unter `events/<eventId>/` im Storage-Browser verifizieren, dass sie weg sind (Cover **und** alle Belege, in einem `removeFolder()`-Aufruf). **Mobile prüfen** (Touch-Ziel des Icons neben dem eng gedrängten Betrag).

**Abweichungen in der Umsetzung (gegenüber der Skizze oben)**

- Ausgaben ohne Beleg zeigen ein Warn-Icon ("Beleg fehlt"), Klick öffnet den Bearbeiten-Dialog.
- Icon sitzt in der Sekundärzeile (`expenseRowSecondary`) statt neben dem Betrag — keine `expenseRowAmountGroup` nötig.
- Dialog: zusätzlicher "Beleg anzeigen"-Link; "Beleg löschen" markiert nur (durchgestrichen) und ist bis zum Speichern per "Rückgängig" rücknehmbar.
- Beleg-Uploads mit `cacheControl: "0"` (Supabase-Standard `3600` lieferte nach Ersetzen am gleichen Pfad bis zu 1 h den alten Inhalt); gleicher Effekt bei Cover-/Profilbildern als Tech-Debt erfasst.
- Tests: Sentry wird in `expenseTracking.test.tsx` per top-level `jest.mock` ersetzt (`jest.spyOn` scheitert am ESM-Export).

**Verifiziert (2026-10-09):** Mutationsproben beide rot; DEV: Beleg nach Ausgabe-Löschen und alle Objekte unter `events/<id>/` nach Anlass-Löschen im Storage weg; Desktop + Mobile geprüft.

**Definition of Done:** `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false` **und** `npx jest StorageRepository --watchAll=false` (liegt unter `Database/Repository/__tests__/`, nicht unter `ExpenseTracking/` — vom ersten Filter nicht erfasst), `npm run lint` sauber; neue Tests grün, bestehende `expenseList`- **und** `StorageRepository`-Tests unverändert grün; beide Mutationsproben bestanden; Sichttest Desktop **und** Mobile gemacht; Storage-Objekt nach Löschen einer Ausgabe **und** nach Löschen eines ganzen Anlasses im Supabase-Storage-Browser verifiziert weg (inkl. Cover, in einem Aufruf).

## Epic 5 — Profil: Zahlungsangaben ✅ erledigt

Ziel: Registrierte Personen können Adresse + IBAN für Rückerstattungen im eigenen Profil hinterlegen, ansehen, ändern und löschen. Epic 7.3 nutzt die Angaben später als Prefill für die PDF-Abrechnung. Grundlage im Issue: Abschnitt "IBAN & Adresse für Rückerstattung".

### Entscheidungen (vorab, mit Begründung)

1. **Eigene Tabelle statt Spalten auf `public.users`.** `users_select` lässt neben der Person selbst auch `is_community_leader()` und `is_admin()` lesen — Bankdaten gehören nicht in diese Sichtbarkeit. RLS wirkt pro Zeile, nicht pro Spalte; eine strengere Regel für nur zwei Spalten ginge nur über Column-Grants/Views (mehr Komplexität, leicht zu unterlaufen).
2. **Nur die Person selbst — kein Admin, keine Mitköch:innen** (mit dem Nutzer entschieden, 2026-10-09). Folge für 7.3: Prefill funktioniert nur, wenn jemand die **eigene** Abrechnung erstellt; erstellt eine Köchin die Abrechnung für eine andere Person, tippt sie deren Angaben von Hand ein (wie bei nicht-registrierten Personen). Das deckt sich mit dem Issue ("Opt-in der Person selbst") und hält die Angriffsfläche minimal. Konsequenz für Support: Admins können die Angaben nicht einsehen — gewollt.
3. **Kontoinhaber:in = Profilname** (`users.first_name`/`last_name`), keine eigene Spalte (mit dem Nutzer entschieden). Bekannte Grenze: Gehört das Konto jemand anderem (z.B. Eltern), steht auf dem PDF der falsche Name — falls das in der Praxis auftaucht, lässt sich später eine nullable `account_holder_name`-Spalte additiv ergänzen.
4. **Existenz der Zeile = Einwilligung.** Kein `consent`-Flag: Es wird nur gespeichert, wenn die Person es aktiv tut (Profil-Card in 5.3 oder Checkbox "fürs nächste Mal speichern" in 7.3); Widerruf = Zeile löschen. `created_at` dokumentiert den Zeitpunkt.
5. **Primärschlüssel = `user_id`** (1:1, wie `public.users.id`). Kein separates `id`-Feld — ermöglicht in 5.2 ein schlichtes `upsert` auf den PK, und eine zweite Zeile pro Person ist strukturell unmöglich. FK auf `auth.users ON DELETE CASCADE` (wie `donations.donor_uid`): Konto-Löschung räumt die Bankdaten automatisch mit weg.
6. **Keine `created_by`/`updated_by`-Spalten.** Sie wären per Definition immer `user_id` (Owner-only) — reine Redundanz. `created_at`/`updated_at` + `update_updated_at()`-Trigger bleiben.
7. **IBAN normalisiert speichern** (Grossbuchstaben, ohne Leerzeichen); die DB prüft nur die **Form** (`^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$`, also 15–34 Zeichen). Die **Mod-97-Prüfsumme** prüft die App in 5.2 als reine, getestete Funktion — in SQL wäre sie möglich, aber schwer lesbar und doppelt gepflegt. Die Form-Prüfung in der DB ist das Sicherheitsnetz gegen Rohdaten, die an der UI vorbei kommen.
8. **Adresse als Einzelfelder** `street` (inkl. Hausnummer), `postal_code`, `city`. Alle `NOT NULL` — gespeichert wird nur vollständig (fürs PDF braucht es alles). `postal_code` als `text` (ausländische Formate, führende Nullen). **Kein `country_code`** (bei der Umsetzung gestrichen, 2026-10-09): das Land ergibt sich aus Adresse bzw. IBAN-Präfix.
9. **Kein Realtime, kein `REPLICA IDENTITY FULL`** — nur eine Person bearbeitet die eigene Zeile; Multi-User-Gleichzeitigkeit gibt es hier nicht.
10. **Least-Privilege-Grants:** `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` statt `GRANT ALL` wie bei den Event-Tabellen — `ALL` enthält u.a. `TRUNCATE`, das RLS nicht unterliegt. Über PostgREST nicht erreichbar, aber für Bankdaten soll die Rechtevergabe auch ohne dieses Wissen korrekt sein. `anon` erhält nichts. **Fund bei der Verifikation:** Die Supabase-eigenen Default-Privileges (`pg_default_acl`) geben `anon` **und** `authenticated` auf jede neue Tabelle automatisch `ALL` — ein `GRANT` allein bewirkt nichts. Deshalb zuerst `REVOKE ALL … FROM anon, authenticated`, dann gezielt `GRANT`. Projektweites Problem, siehe Tech-Debt "Supabase-Default-Privileges".
11. **Keine Verschlüsselung auf Spaltenebene.** pgsodium/TCE ist von Supabase abgekündigt, Vault ist für Secrets (wenige, serverseitig gelesen), nicht für Nutzerdaten, die der Client liest. Schutz: RLS + Plattenverschlüsselung + Least-Privilege. Bewusst so akzeptiert.
12. **Profil: Card, kein neuer Reiter.** Das Issue spricht von einem "neuen Reiter", die Profilseite hat aber keine Tabs, sondern einen `<Stack>` mit Cards (`ProfileCard`, `PublicProfileCard`, `DonationsCard`). Neue `PaymentDetailsCard` reiht sich dort ein.

### **Story 5.1 — Migration `user_payment_details`** ✅ erledigt

**Datei:** `supabase/migrations/20261009000001_add_user_payment_details.sql` (neu, self-contained: Tabelle + Trigger + RLS + Grants).

**Code-Skizze:**

```sql
-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Zahlungsangaben (Adresse + IBAN) für Rückerstattungen. 1:1 zum Konto, nur
-- von der Person selbst les- und schreibbar (auch nicht von Admins). Eine
-- Zeile existiert nur nach aktivem Speichern durch die Person (= Einwilligung).
-- =============================================================================

CREATE TABLE public.user_payment_details (
  user_id uuid DEFAULT auth.uid() NOT NULL,
  street text NOT NULL,
  postal_code text NOT NULL,
  city text NOT NULL,
  iban text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT user_payment_details_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_payment_details_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_payment_details_street_check CHECK (char_length(btrim(street)) BETWEEN 1 AND 100),
  CONSTRAINT user_payment_details_postal_code_check CHECK (char_length(btrim(postal_code)) BETWEEN 1 AND 10),
  CONSTRAINT user_payment_details_city_check CHECK (char_length(btrim(city)) BETWEEN 1 AND 100),
  -- Nur die Form; die Mod-97-Prüfsumme prüft die App (siehe Entscheidung 7).
  CONSTRAINT user_payment_details_iban_check CHECK (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$')
);

ALTER TABLE public.user_payment_details ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_user_payment_details_updated_at BEFORE UPDATE ON public.user_payment_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Bewusst ohne is_admin(): Bankdaten sieht nur die Person selbst.
CREATE POLICY "user_payment_details_select" ON public.user_payment_details FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "user_payment_details_insert" ON public.user_payment_details FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_payment_details_update" ON public.user_payment_details FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "user_payment_details_delete" ON public.user_payment_details FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Supabase-Default-Privileges geben anon UND authenticated automatisch ALL
-- (inkl. TRUNCATE, das RLS umgeht) — erst alles entziehen, dann gezielt vergeben.
REVOKE ALL ON public.user_payment_details FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_payment_details TO authenticated;
```

Hinweise zur Skizze:

- `(SELECT auth.uid())` statt `auth.uid()` — gleiche Schreibweise wie `users_select`; Postgres wertet den Subselect einmal pro Statement statt pro Zeile aus (Supabase-Performance-Empfehlung). - `UPDATE … WITH CHECK` verhindert, dass jemand die eigene Zeile per Update auf eine fremde `user_id` "umhängt".
- Kein Index nötig — der PK auf `user_id` ist der einzige Zugriffspfad.
- Ob `update_updated_at()` das richtige Trigger-Funktionspaar ist: siehe `event_budgets`
  (`20260905000001`); `update_updated_by()` entfällt (Entscheidung 6).

**Tests/Verifikation** — reines SQL, keine Jest-Tests (Supabase-Client in Jest gemockt). Migration transaktional gegen den laufenden `supabase-db-test`-Container anwenden (`supabase db reset` blockiert, siehe `reference_local_migration_verify`), dann mit zwei Test-Usern A und B sowie einem Admin prüfen — Rolle/JWT pro Abschnitt per `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true);`:

1. A legt eigene Zeile an (ohne `user_id` → Default `auth.uid()` greift), liest, ändert, löscht sie — alles erfolgreich; `updated_at` ändert sich beim Update.
2. B sieht A's Zeile **nicht** (`SELECT` liefert 0 Zeilen), `UPDATE`/`DELETE` auf A's Zeile betreffen 0 Zeilen, `INSERT` mit `user_id = A` wird abgewiesen.
3. Admin sieht A's Zeile **nicht** (Entscheidung 2 — explizit prüfen, sonst fällt ein versehentliches `OR is_admin()` nicht auf).
4. A kann die eigene Zeile nicht per `UPDATE … SET user_id = B` umhängen.
5. `anon` (`SET LOCAL ROLE anon`) bekommt `permission denied`.
6. Zweites `INSERT` von A → PK-Konflikt (genau eine Zeile pro Person).
7. Constraints: IBAN mit Leerzeichen/Kleinbuchstaben, zu kurz (`CH12`), leere/nur-Leerzeichen `street`/`city`, zu lange `postal_code` → jeweils abgewiesen; gültige IBAN `CH9300762011623852957` akzeptiert.
8. Kaskade: Test-User in `auth.users` löschen (innerhalb der Transaktion) → seine Zeile ist weg.
9. Am Ende `ROLLBACK` für die Prüf-Daten; Migration selbst danach regulär anwenden.

**Zum Ansehen im Browser:** nichts — reine Datenbank-Story (UI folgt in 5.3).

**Definition of Done:** Migration wendet sich fehlerfrei auf der Test-DB an; alle neun Verifikationspunkte bestätigt (SQL-Ausgaben im Feedback mitschicken); `sqlfluff` auf die neue Datei (nur Casing); Timestamp-Präfix eindeutig (`ls supabase/migrations | sed 's/_.*//' | sort | uniq -d` leer); keine bestehende Migration verändert.

**Verifiziert (2026-10-09):** Prüfskript (alle 9 Punkte, transaktional mit `ROLLBACK`) grün — inkl. Admin sieht 0 Zeilen, `anon` → permission denied, `authenticated` ohne `TRUNCATE`. Auf `supabase-db-test` regulär angewendet. Abweichungen zur Skizze: kein `country_code` (Entscheidung 8), `REVOKE ALL` vor dem `GRANT` (Entscheidung 10). Für 5.2 mitnehmen: Die DB prüft `btrim(...)`, speichert aber ungetrimmt — Repository/Formular trimmt und normalisiert die IBAN vor dem Speichern.

### **Story 5.2 — Domain-Typen, Validierung, Repository (kein UI)** ✅ erledigt

Ziel: Alles, was 5.3 (Profil-Card) und später 7.3 (Abrechnung) brauchen, um Zahlungsangaben zu laden, zu prüfen und zu speichern — ohne eine einzige Zeile UI. Reine Logik, vollständig per Jest testbar.

**Architektur-Entscheidungen**

1. **Drei Ebenen, wie bei den Ausgaben:**
   - `ibanUtils.ts` (reine Funktionen, keine Domain-Kenntnis) unter `src/utils/` (neben `dateUtils.ts`; ursprünglich in `Shared/utils/` geplant, dann gemäss Tech-Debt "Hilfsfunktionen auf zwei `utils`-Ordner" direkt am Zielort angelegt) — wird in 7.3 auch für **nicht-registrierte** Personen gebraucht (dort ohne Repository, nur Formular-Prüfung).
   - `paymentDetails.class.ts` mit statischen Methoden (Vorbild `Expense.checkExpenseData`): `checkPaymentDetailsData()` wirft `FieldValidationError`, `normalize()` trimmt und normalisiert die IBAN.
   - `PaymentDetailsRepository` (extends `BaseRepository`) — reine Datenzugriffsschicht, kennt weder Validierung noch Normalisierung.
2. **Ablauf beim Speichern (Aufrufer, also 5.3/7.3):** `checkPaymentDetailsData(input)` → `normalize(input)` → `savePaymentDetails(...)`. Genau wie `Expense.checkExpenseData` vor dem `createExpense`. Grund für die Trennung: Das Repository bleibt "dumm" (wie alle anderen); die DB-Checks aus 5.1 sind das Sicherheitsnetz, falls ein Aufrufer die Normalisierung vergisst — sie lehnen dann ab, statt Datenmüll zu speichern.
3. **`primaryKeyColumn` auf `"user_id"` überschreiben** (der Hook existiert in `BaseRepository` genau dafür, Vorbild `units`/`key`). Damit funktionieren `findById`, `upsert` und `remove` unverändert — es braucht **keine** eigenen Supabase-Aufrufe im Repository.
4. **`savePaymentDetails(details, authUser)` nimmt die ID aus `authUser.uid`**, nicht aus `details.userId`. Die API kann so gar nicht erst "für jemand anderen speichern" ausdrücken (RLS würde es ohnehin abweisen — so fällt es aber schon beim Lesen des Codes auf). `upsert` = `INSERT … ON CONFLICT DO UPDATE` → braucht INSERT- **und** UPDATE-Policy, beide existieren seit 5.1.
5. **Kein Caching** (`excludeFromCaching: true`, neuer Eintrag `USER_PAYMENT_DETAILS` in `STORAGE_OBJECT_PROPERTY`): Bankdaten gehören nicht in den `sessionStorage` — der bleibt nach dem Schliessen des Tabs nicht, ist aber für jedes Script auf der Seite lesbar.
6. **IBAN-Prüfung = Form + Mod-97, länderunabhängig.** Keine Längentabelle pro Land (CH = 21, DE = 22 …): Mod-97 fängt Tippfehler und Zahlendreher praktisch vollständig, eine Tabelle müsste gepflegt werden. Die Form-Regex ist **dieselbe wie in der DB** (5.1), als exportierte Konstante, damit App und DB nicht auseinanderlaufen. Mod-97 über `BigInt` (`tsconfig`-Target ist `esnext`) — kein stückweises Rechnen nötig.
7. **Domain-Typ ohne `createdAt`/`updatedAt`.** Die UI zeigt in 5.3 keinen Zeitstempel; `PaymentDetailsRow` führt sie (Abbild der Tabelle), `toDomain` lässt sie weg. Kommt der Bedarf, ist es eine Zeile.
8. **Texte** in neuer Datei `src/constants/text/paymentDetails.ts` (+ Re-Export in `index.ts`), wie `expenseTracking.ts`.

**Code-Skizze** (`ibanUtils.ts`):

```ts
/** Form einer normalisierten IBAN — identisch zum CHECK in user_payment_details (5.1). */
export const IBAN_FORMAT = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/**
 * Bringt eine eingegebene IBAN in die gespeicherte Form: ohne Leerzeichen, Grossbuchstaben.
 *
 * @param input - IBAN, wie sie eingegeben wurde (z.B. "ch93 0076 2011 6238 5295 7").
 * @returns Normalisierte IBAN (z.B. "CH9300762011623852957").
 * @example
 * normalizeIban(" ch93 0076 2011 6238 5295 7 ") // "CH9300762011623852957"
 */
export const normalizeIban = (input: string): string =>
  input.replace(/\s+/g, "").toUpperCase();

/**
 * Prüft Form und Prüfsumme (ISO 13616, Mod-97) einer **normalisierten** IBAN.
 * ...
 */
export const isValidIban = (iban: string): boolean => {
  if (!IBAN_FORMAT.test(iban)) return false;
  // Ländercode + Prüfziffern ans Ende, Buchstaben → Zahlen (A=10 … Z=35)
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (letter) =>
    (letter.charCodeAt(0) - 55).toString(),
  );
  return BigInt(numeric) % 97n === 1n;
};

/**
 * Gruppiert eine IBAN für die Anzeige in Viererblöcken.
 * @example
 * formatIban("CH9300762011623852957") // "CH93 0076 2011 6238 5295 7"
 */
export const formatIban = (iban: string): string =>
  iban.replace(/(.{4})(?=.)/g, "$1 ");
```

**Code-Skizze** (`paymentDetails.types.ts` + Repository, gekürzt):

```ts
export type PaymentDetailsDomain = {
  userId: string;
  street: string;
  postalCode: string;
  city: string;
  iban: string;
};

export type PaymentDetailsRow = {
  user_id: string;
  street: string;
  postal_code: string;
  city: string;
  iban: string;
  created_at: string;
  updated_at: string;
};

export class PaymentDetailsRepository extends BaseRepository<PaymentDetailsDomain, PaymentDetailsRow> {
  tableName = "user_payment_details";

  /** PK ist `user_id` (1:1 zum Konto), nicht `id`. */
  protected get primaryKeyColumn(): string {
    return "user_id";
  }

  // toRow: OHNE user_id — upsert setzt den PK selbst aus `id`, insert nutzt den DB-Default auth.uid()
  // toDomain: ohne created_at/updated_at (Entscheidung 7)

  async getPaymentDetails(userId: string): Promise<PaymentDetailsDomain | null> {
    return this.findById(userId);
  }

  async savePaymentDetails(details: PaymentDetailsDomain, authUser: AuthUser): Promise<PaymentDetailsDomain> {
    return this.upsert({id: authUser.uid, value: details, authUser});
  }

  async deletePaymentDetails(userId: string): Promise<void> {
    return this.remove(userId);
  }
}
```

**Dateien**

| Datei | Änderung |
|---|---|
| `src/utils/ibanUtils.ts` (neu) | `IBAN_FORMAT`, `normalizeIban`, `isValidIban`, `formatIban` |
| `src/components/User/paymentDetails.types.ts` (neu) | `PaymentDetailsDomain`, `PaymentDetailsRow` |
| `src/components/User/paymentDetails.class.ts` (neu) | `PaymentDetails.checkPaymentDetailsData()`, `PaymentDetails.normalize()` |
| `src/components/Database/Repository/PaymentDetailsRepository.ts` (neu) | siehe Skizze |
| `src/components/Database/DatabaseService.ts` | Import + Feld `paymentDetails` + Konstruktor-Zeile + JSDoc-`@property` |
| `src/components/Shared/sessionStorageHandler.class.ts` | neuer Eintrag `USER_PAYMENT_DETAILS` (`excludeFromCaching: true`) |
| `src/constants/text/paymentDetails.ts` (neu) + `index.ts` | Fehlertexte: Strasse/PLZ/Ort fehlt, IBAN fehlt, IBAN ungültig |

**Tests**

- `src/utils/__tests__/ibanUtils.test.ts`:
  - `normalizeIban`: Leerzeichen innen/aussen, Tabs/Zeilenumbruch, Kleinbuchstaben.
  - `isValidIban` **gültig**: `CH9300762011623852957`, `LI21088100002324013AA` (Buchstaben im BBAN), `DE89370400440532013000`, `AT611904300234573201`.
  - `isValidIban` **ungültig**: letzte Ziffer verändert (`…957` → `…958`), zwei Ziffern vertauscht, nicht normalisiert (mit Leerzeichen → `false`, Normalisieren ist Aufgabe des Aufrufers), zu kurz, zu lang (35 Zeichen), leer.
  - `formatIban`: 21 Zeichen → letzter Block mit 1 Zeichen; Länge genau durch 4 teilbar → kein Leerzeichen am Ende.
- `User/__tests__/paymentDetails.class.test.ts`:
  - `checkPaymentDetailsData`: je ein Fall pro leerem Pflichtfeld (auch nur Leerzeichen), ungültige IBAN, gültiger Datensatz wirft nicht. Die IBAN wird dabei **vor** der Prüfung normalisiert betrachtet ("ch93 0076 …" ist gültige Eingabe).
  - `normalize`: trimmt alle Textfelder, normalisiert die IBAN, verändert das Eingabeobjekt nicht (neues Objekt).
- `Database/Repository/__tests__/PaymentDetailsRepository.test.ts` (Vorbild `BudgetRepository.test.ts`, `createSupabaseMock`, `SessionStorageHandler` gemockt):
  - `toRow`/`toDomain`-Mapping; `toRow` enthält **kein** `user_id`, `toDomain` keine Zeitstempel.
  - `getPaymentDetails` filtert auf `.eq("user_id", …)` und liefert `null` bei `PGRST116`.
  - `savePaymentDetails` ruft `upsert` mit `user_id = authUser.uid` — auch wenn `details.userId` etwas anderes enthält.
  - `deletePaymentDetails` löscht per `.eq("user_id", …)`.
  - `getCacheConfig().excludeFromCaching === true`.
- **Mutationsprobe (Prüfsumme):** in `isValidIban` die Mod-97-Zeile durch `return true` ersetzen → die "letzte Ziffer verändert"- und "vertauscht"-Tests müssen rot werden.
- **Mutationsprobe (PK):** den `primaryKeyColumn`-Override entfernen → die `.eq("user_id", …)`-Tests müssen rot werden (sonst würde zur Laufzeit gegen eine nicht existierende `id`-Spalte gefiltert).

**Zum Ansehen im Browser:** nichts — reine Logik-Story. Der echte Rundlauf gegen die Test-DB (speichern → neu laden → ändern → löschen) wird in 5.3 über die Profil-Card geprüft; die RLS-Seite ist bereits durch das 5.1-Prüfskript abgedeckt.

**Definition of Done:** `npx tsc --noEmit`, `npx jest ibanUtils paymentDetails PaymentDetailsRepository --watchAll=false`, `npm run lint` sauber; beide Mutationsproben bestanden; Repository in `DatabaseService.ts` registriert (Pre-Commit-Checkliste "Repository-Skelett" komplett durchgegangen); JSDoc auf Deutsch mit lauffähigen `@example`-Zeilen.

### **Story 5.3 — `UserPaymentDetailsCard` im Profil** ✅ erledigt

Ziel: Auf der Profilseite kann die Person ihre Zahlungsangaben hinterlegen, ansehen, ändern und löschen. Erste Story mit UI in Epic 5 — und der erste echte Rundlauf gegen die Test-DB (5.1 und 5.2 waren reine DB-/Logik-Stories). Das Formular wird so gebaut, dass Epic 7.3 es wiederverwenden kann.

**Architektur-Entscheidungen**

1. **Card = nur Anzeige; Hinterlegen/Ändern über einen Dialog; Löschen direkt in der Card.** Nicht Teil des globalen Bearbeiten-Modus der Profilseite (Stift im Header → ein "Speichern" für `public.users`):
   - andere Tabelle, anderes Speichern, andere Fehlerfälle — ein gemeinsamer Speichern-Knopf müsste zwei unabhängige Schreibvorgänge koordinieren;
   - Speichern ist hier gleichzeitig die **Einwilligung** (Epic-5-Entscheidung 4) — eine bewusste, eigene Handlung, kein Nebeneffekt von "Profil speichern".

   Card und Dialog sind unabhängig vom `editMode` immer bedienbar.
2. **Formular und Dialog getrennt — das Formular ist der wiederverwendbare Teil:**
   - `PaymentDetailsForm` (`src/components/User/paymentDetailsForm.tsx`) — nur die vier Felder: Werte + Fehler rein, `onChange` raus, weiss nichts vom Speichern. Bewusst **ohne** `User` im Namen: In 7.3 wird es auch für Personen **ohne Konto** verwendet (Issue: "eventspezifisch als reines Eingabefeld") — dort kommt dann ein optionales Namensfeld dazu (nicht jetzt bauen).
   - `UserPaymentDetailsDialog` (`userPaymentDetailsDialog.tsx`) — Titel + `PaymentDetailsForm` + Abbrechen/Speichern. Nur für 5.3.
   - 7.3 baut später einen eigenen Schritt aus `PaymentDetailsForm` + Checkbox "Angaben fürs nächste Mal speichern" — der Dialog aus 5.3 passt dort nicht (eigener Ablauf, Checkbox, Nicht-Konto-Personen).
3. **Eigene Dateien** (`userProfile.tsx` hat bereits 979 Zeilen, Richtwert < 500): Card, Dialog und Formular je eine Datei. `userProfile.tsx` bekommt nur eine Zeile im `<Stack>` (nach `AchievedRewardsCard`, vor `DonationsCard`) plus Callbacks für Snackbar/Fehler.
4. **Die Card besitzt ihren Zustand selbst** (`useState` für `details`, `isLoading`, `isDeleting`, Dialog offen/zu) und nutzt `useDatabase()`/`useAuthUser()` direkt — statt den grossen Profil-Reducer um weitere Actions zu erweitern. Fehler beim Laden/Löschen gibt sie über `onError` an die Seite (Muster `DonationsCard`), Erfolgsmeldungen über `onSuccess(message)` an die bestehende Snackbar.
5. **Zustände der Card:**
   - *lädt* → `Skeleton` (statt Backdrop — die übrige Seite soll nicht blockieren);
   - *leer* (`null`) → Erklärtext + Button "Zahlungsangaben hinterlegen";
   - *vorhanden* → Name (aus dem Profil, Epic-5-Entscheidung 3), Strasse, PLZ Ort, IBAN via `formatIban()`; Buttons "Bearbeiten" und "Löschen".
6. **IBAN ungekürzt anzeigen, keine Maskierung.** Eigene Daten, hinter Login und Owner-only-RLS; im Bearbeiten-Dialog stünde die volle IBAN ohnehin.
7. **Fehlender Profilname → Hinweis, kein Blocker.** `users.first_name`/`last_name` dürfen leer sein. Ist einer leer: Hinweis "Für die Abrechnung braucht es deinen Vor- und Nachnamen — bitte oben im Profil ergänzen". Speichern bleibt möglich — die Pflicht gehört zur Abrechnung (7.3).
8. **IBAN-Eingabe: frei tippen, beim Verlassen formatieren und prüfen (`onBlur`)**:
   - Beim Tippen keine Eingriffe (keine Cursor-Sprünge auf Mobile); Leerzeichen und Kleinbuchstaben erlaubt.
   - `onBlur`: Feld leer → nichts tun. Sonst Wert auf `formatIban(normalizeIban(value))` setzen (`ch9300762011623852957` → `CH93 0076 2011 6238 5295 7`) und sofort prüfen: `isValidIban(normalizeIban(value))` → Hilfetext "IBAN gültig" bzw. Fehlerzustand "IBAN ungültig — bitte prüfen" am Feld. So fällt ein Tippfehler direkt auf, nicht erst beim Speichern.
   - Beim erneuten Tippen verschwindet der Fehlerzustand wieder (sonst bleibt das Feld rot, während man korrigiert).
   - Kein neues Paket: nutzt nur die Funktionen aus 5.2. Fühlt es sich im Browser-Test nicht gut genug an, lässt sich `react-imask` später nachrüsten — betroffen wäre nur `PaymentDetailsForm`.
   - Gespeichert wird weiterhin normalisiert (ohne Leerzeichen) — das Formatieren ist reine Anzeige.
   - Feldattribute: Platzhalter `CH93 0076 2011 6238 5295 7`, `autoComplete="off"`, `spellCheck={false}`, `slotProps={{htmlInput: {autoCapitalize: "characters"}}}` (Mobile-Tastatur startet in Grossbuchstaben; MUI-7-Schreibweise — `inputProps` ist veraltet, siehe Tech-Debt "MUI Deprecated APIs").
9. **Speichern (Ablauf in der Card):** `checkPaymentDetailsData(input)` → `normalize(input)` → `savePaymentDetails(normalized, authUser)` → Card zeigt das Ergebnis aus der DB, Dialog schliesst, Snackbar "Zahlungsangaben gespeichert", `trackEvent(PAYMENT_DETAILS_SAVED)`.
   - Validierungsfehler (`FieldValidationError`) → im Dialog, Dialog bleibt offen, Eingaben bleiben erhalten, kein Sentry.
   - Technischer Fehler → im Dialog, Dialog bleibt offen, Sentry ausser bei Netzwerkfehlern.
   - Während des Speicherns ist "Speichern" deaktiviert (kein Doppel-Submit).
   - "Bearbeiten" öffnet den Dialog vorausgefüllt (IBAN formatiert); "Hinterlegen" leer.
10. **Löschen (Ablauf in der Card):**
    1. Button "Löschen" in der Card neben "Bearbeiten" — **nicht** im Dialog: Löschen ist der Widerruf der Einwilligung und soll nicht erst das Formular öffnen müssen; das wiederverwendbare Formular kennt ohnehin kein Löschen.
    2. Bestätigung über `customDialog` (`DialogType.Confirm`, wie beim Profilbild): Titel "Zahlungsangaben löschen?", Text "Deine Adresse und IBAN werden gelöscht. Bei der nächsten Abrechnung musst du sie wieder eingeben.", Knopf "Löschen".
    3. Abbrechen → nichts passiert.
    4. Bestätigt → beide Card-Buttons deaktiviert, `deletePaymentDetails(authUser.uid)`:
       - Erfolg → Card zeigt den Leerzustand, Snackbar "Zahlungsangaben gelöscht", `trackEvent(PAYMENT_DETAILS_DELETED)`;
       - Fehler → `onError` (Meldung oben auf der Seite), Card zeigt weiterhin die Angaben — die Zeile existiert ja noch.
    5. Bereits erstellte Abrechnungs-PDFs (7.x) sind davon nicht betroffen — das sind heruntergeladene Dateien, nichts auf dem Server. Gehört in den Helpcenter-Text, nicht ins UI.
11. **Mobile:** Dialog `fullScreen` unterhalb `sm` (`useMediaQuery(theme.breakpoints.down("sm"))`); Card-Aktionen als normale `Button`s, keine kleinen Icon-Buttons.
12. **Analytics:** `PAYMENT_DETAILS_SAVED` (`"payment_details_saved"`) und `PAYMENT_DETAILS_DELETED` (`"payment_details_deleted"`) in `analyticsEvents.ts` — **ohne** Daten-Payload (keine IBAN/Adresse in die Analytics). Kein Feed-Eintrag (private Daten).
13. **Hinweistext** in der Card: "Nur du siehst diese Angaben. Sie werden verwendet, um deine Abrechnung vorauszufüllen. Löschen kannst du sie jederzeit." — deckt "wer sieht es / wofür / Widerruf" ab.

**Code-Skizze** (`paymentDetailsForm.tsx`, IBAN-Feld):

```tsx
const [ibanStatus, setIbanStatus] = React.useState<"unchecked" | "valid" | "invalid">("unchecked");

const handleIbanBlur = () => {
  if (!values.iban.trim()) return;
  const normalized = normalizeIban(values.iban);
  onChange({...values, iban: formatIban(normalized)});
  setIbanStatus(isValidIban(normalized) ? "valid" : "invalid");
};

<TextField
  label={TEXT_IBAN}
  value={values.iban}
  onChange={(event) => {
    setIbanStatus("unchecked"); // beim Korrigieren nicht rot bleiben
    onChange({...values, iban: event.target.value});
  }}
  onBlur={handleIbanBlur}
  error={ibanStatus === "invalid"}
  helperText={IBAN_HELPER_TEXT[ibanStatus]}
  placeholder="CH93 0076 2011 6238 5295 7"
  autoComplete="off"
  spellCheck={false}
  slotProps={{htmlInput: {autoCapitalize: "characters"}}}
/>
```

**Code-Skizze** (`userPaymentDetailsCard.tsx`, Speichern):

```tsx
const handleSave = async (input: UserPaymentDetailsDomain) => {
  try {
    UserPaymentDetails.checkPaymentDetailsData(input);
  } catch (error) {
    setDialogError(toError(error)); // FieldValidationError → Dialog bleibt offen
    return;
  }
  setIsSaving(true);
  try {
    const saved = await database.userPaymentDetails.savePaymentDetails(
      UserPaymentDetails.normalize(input),
      authUser,
    );
    setDetails(saved);
    setDialogOpen(false);
    trackEvent(AnalyticsEvent.PAYMENT_DETAILS_SAVED);
    onSuccess(TEXT_PAYMENT_DETAILS_SAVED);
  } catch (error) {
    if (!isTransientNetworkError(error)) Sentry.captureException(error);
    setDialogError(toError(error));
  } finally {
    setIsSaving(false);
  }
};
```

**Dateien**

| Datei | Änderung |
|---|---|
| `src/components/User/paymentDetailsForm.tsx` (neu) | wiederverwendbares Formular (4 Felder, IBAN-`onBlur`-Formatierung/-Prüfung) |
| `src/components/User/userPaymentDetailsDialog.tsx` (neu) | Dialog: Titel + Formular + Abbrechen/Speichern, Fehleranzeige, fullScreen auf xs |
| `src/components/User/userPaymentDetailsCard.tsx` (neu) | Card: laden, Zustände, Speichern, Löschen mit Bestätigung, Hinweise |
| `src/components/User/userProfile.tsx` | eine Zeile im `<Stack>` + Callbacks für Snackbar/Fehler |
| `src/components/Analytics/analyticsEvents.ts` | `PAYMENT_DETAILS_SAVED`, `PAYMENT_DETAILS_DELETED` |
| `src/constants/text/userPaymentDetails.ts` | Card-/Dialog-/Formulartexte (Titel, Erklärtext, Buttons, Bestätigung, Snackbars, Namens-Hinweis, IBAN-Hilfetexte) |
| `src/components/User/__tests__/userProfile.test.tsx` | `mockDatabase` um `userPaymentDetails.getPaymentDetails` ergänzen (sonst crasht der bestehende Test) |
| Helpcenter `docs/user/profile.md` (separates Repo) | neuer Abschnitt "Zahlungsangaben" inkl. Hinweis zu bereits erstellten PDFs |

**Tests**

`src/components/User/__tests__/paymentDetailsForm.test.tsx`:
- Tippen ruft `onChange` mit dem rohen Wert (keine Formatierung beim Tippen).
- `onBlur` mit `ch9300762011623852957` → `onChange` mit `CH93 0076 2011 6238 5295 7`, Hilfetext "IBAN gültig".
- `onBlur` mit falscher Prüfsumme → Feld im Fehlerzustand mit Hinweis; danach erneut tippen → Fehlerzustand weg.
- `onBlur` mit leerem Feld → kein `onChange`, kein Fehler.

`src/components/User/__tests__/userPaymentDetailsCard.test.tsx` (`DatabaseContext`/`AuthUserContext` gemockt, Vorbild `userProfile.test.tsx`):
- **Leerzustand:** `getPaymentDetails` → `null` → Erklärtext + "Zahlungsangaben hinterlegen", keine IBAN, kein "Löschen".
- **Anzeige:** gespeicherte Angaben → Strasse, "PLZ Ort" und formatierte IBAN sichtbar.
- **Speichern, Erfolg:** Dialog öffnen, Felder mit Leerzeichen/Kleinbuchstaben ausfüllen → `savePaymentDetails` mit den **normalisierten** Werten und `authUser`; Dialog schliesst; Card zeigt die neuen Werte; `onSuccess` aufgerufen.
- **Bearbeiten:** Dialog ist mit den gespeicherten Werten vorausgefüllt.
- **Speichern, Validierungsfehler:** ungültige IBAN → Fehler im Dialog, `savePaymentDetails` **nicht** aufgerufen, Dialog offen, Eingaben erhalten, **kein** Sentry.
- **Speichern, DB-Fehler:** `savePaymentDetails` rejected → Fehler im Dialog, Dialog bleibt offen.
- **Löschen bestätigt:** `customDialog` → `true` → `deletePaymentDetails(authUser.uid)`, Card im Leerzustand, `onSuccess` aufgerufen.
- **Löschen abgebrochen:** `customDialog` → `false` → `deletePaymentDetails` **nicht** aufgerufen, Angaben sichtbar.
- **Löschen fehlgeschlagen:** `deletePaymentDetails` rejected → `onError` aufgerufen, Angaben bleiben sichtbar.
- **Namens-Hinweis:** Profil ohne Nachname → Hinweis sichtbar; mit vollständigem Namen → nicht.
- **Laden fehlgeschlagen:** `getPaymentDetails` rejected → `onError`.
- `userProfile.test.tsx` bleibt grün (nur Mock ergänzt).
- **Mutationsprobe (Normalisieren):** in `handleSave` das `normalize(...)` weglassen → "Speichern, Erfolg" muss rot werden.
- **Mutationsprobe (Fehlerzustand):** in `PaymentDetailsForm` das Zurücksetzen auf `"unchecked"` beim Tippen entfernen → der "erneut tippen → Fehlerzustand weg"-Test muss rot werden.

**Zum Ansehen im Browser** (DEV gegen `supabase-db-test`, Migration aus 5.1 angewendet): Profil öffnen → Leerzustand → Angaben mit `ch9300762011623852957` hinterlegen; beim Verlassen des Feldes wird daraus `CH93 0076 2011 6238 5295 7` mit "IBAN gültig" → speichern → Card zeigt die Angaben → Seite neu laden (Daten aus der DB, kein Cache) → bearbeiten (vorausgefüllt) → eine Ziffer ändern, Feld verlassen → Fehlerzustand → korrigieren → speichern → löschen (abbrechen, dann bestätigen). Per SQL prüfen, dass die Zeile normalisiert gespeichert und nach dem Löschen weg ist. Mit einem **zweiten** Test-User einloggen → sieht den Leerzustand. **Mobile prüfen:** Dialog Vollbild, Tastatur startet beim IBAN-Feld in Grossbuchstaben, Speichern-Knopf nicht von der Tastatur verdeckt.

**Definition of Done:** `npx tsc --noEmit`, `npx jest paymentDetailsForm userPaymentDetails userProfile --watchAll=false`, `npm run lint` sauber; beide Mutationsproben bestanden; Browser-Rundlauf Desktop **und** Mobile; Zweit-User-Prüfung gemacht; Helpcenter-Abschnitt geschrieben (dort nicht committen ohne Rückfrage, siehe CLAUDE.md).


**Security-Review (2026-10-10, `security-reviewer`):**

- **Behoben:** Rohe Supabase-Fehler gingen samt `details` (`Failing row contains (…, IBAN, …)`) an Sentry, betraf alle `Sentry.captureException(error)` der App → zentral per `beforeSend` (`redactSupabaseErrorDetails`, eigener Commit). Sentry Replay zeichnete IBAN und Adresse unmaskiert auf → `data-sentry-block` an `PaymentDetailsForm` und am Anzeigebereich der Card, Test in `userProfile.test.tsx`. Regel in `security-guidelines.md` (wichtig für Epic 7: Abrechnung zeigt IBANs anderer Personen).
- **Akzeptiert:** IBAN-Prüfsumme nur in der App, siehe Entscheidung 7 in Story 5.1.
- **Offen:** Nach dem Deploy auf TEST ein Replay mit geöffneter Card/Dialog in Sentry ansehen (graue Flächen statt IBAN), lokal nicht prüfbar (Sentry in DEV aus).

## Epic 6 — Dashboard & Kennzahlen

Ziel: Die Küche sieht während des Lagers auf einen Blick, wo sie steht: ob ein Budget voraussichtlich reicht, wie sich die Ausgaben über die Lagertage entwickeln, wie sie sich auf die Budgets verteilen, und welche Kennzahlen (Ø pro Teilnehmer:in / Mahlzeit, grösste Posten, fehlende Belege) Handlungsbedarf zeigen. Grundlage im Issue: Abschnitt "Übersicht / Dashboard" und "Kennzahlen & Diagramme".

### Ausgangslage — was aus dem Grobzuschnitt schon erledigt ist

- **Ist/Soll-Fortschrittsbalken (alter Punkt 6.2) gibt es bereits** seit Epic 1: `budgetCard.tsx` zeigt `LinearProgress`, farblich gestuft (`getProgressColor`: < 85 % `success`, ab 85 % `warning`, ab 100 % `error`), inkl. Fremdwährungszeilen. Entfällt als Story.
- **"Offene Beträge pro Person" gibt es bereits** seit 3.2 (`Expense.sumByPayee` + `PayeeBalanceAccordion` in der Übersicht, Summen pro Währung, aufklappbar mit den Einzelposten). Das deckt die Anforderung im Issue vollständig ab ("reine Übersicht ohne Status-Tracking"). Epic 6 baut daran nichts um. Auch die Zahlende Instanz in der Ausgabenliste (offen aus 3.1, Entscheidung 2) bleibt draussen: Sie ist über das Accordion sichtbar. Falls sie in der Liste trotzdem fehlt, wird das ein eigenes Politur-Paket in Epic 10.
- Der Grobzuschnitt hatte "`@mui/x-charts` + alle Aggregationsfunktionen" als 6.1 gebündelt. Das widerspricht der Lehre aus Epic 1 ("ein Paket = ein Ziel") und bringt eine Abhängigkeit ins Projekt, bevor sie jemand nutzt. → Neu: **Jede Story bringt ihre eigene reine Funktion (mit Tests) plus die Anzeige, die sie braucht**, wie 3.2 es vorgemacht hat. Die Chart-Bibliothek kommt mit dem ersten Diagramm (6.3).

### Entscheidungen (vorab, mit Begründung)

1. **Keine neue Datenquelle, kein neues Repository, keine Migration.** Alle Kennzahlen werden aus `state.expenses` + `state.budgets` (schon geladen, schon live über Realtime, Epic-2-Entscheidung 1), `groupConfiguration` und `event` abgeleitet (`useMemo`, wie `budgetsWithProgress`). Folge: Das Dashboard ist automatisch live für alle Köch:innen, ohne eigene Subscription und ohne Race-Conditions. Einzige neue Eingabe ist der Menüplan für Ø/Mahlzeit (6.5). `event.tsx` hat ihn schon in `state.menuplan` und reicht ihn als weitere Prop durch.
2. **Lagertage = `getEventDateList({event})`** aus `menuplanService.ts`: alle Tage aller Zeitscheiben, leere Platzhalter-Zeitscheiben übersprungen, lokale Mitternacht. Nicht `event.numberOfDays` und nicht `maxDate - minDate`. Grund: Ein Anlass kann aus mehreren, nicht zusammenhängenden Zeitscheiben bestehen (z.B. zwei Wochenenden). Tage zwischen den Scheiben sind keine Lagertage. Dieselbe Funktion erzeugt die Tage des Menüplans, also stimmen "Lagertag 3" im Dashboard und im Menüplan überein.
3. **"Heute" wird immer als Parameter übergeben** (`today: Date`), nie `new Date()` in den reinen Funktionen. Grund: deterministische Tests ohne Fake-Timer, und dieselbe Funktion kann später (PDF, 7.x) mit einem anderen Stichtag rechnen. Nur die Seite ruft `new Date()` auf. Bekannte Grenze: Bleibt der Tab über Mitternacht offen, springt der Tag erst beim nächsten Render um (jede Realtime-Änderung löst einen aus). Das reicht, kein Timer.
4. **Datumsvergleiche nur auf Tagesebene, lokal.** `ExpenseDomain.date` kommt aus `parseLocalDate` (lokale Mitternacht), die Lagertage aus `getEventDateList` (auch lokale Mitternacht). Verglichen wird über einen kleinen Helfer `startOfLocalDay(date)` bzw. `formatLocalDate(...)`-Strings. Nie über Millisekunden-Differenzen ÷ 86 400 000: Bei der Zeitumstellung (Ende Oktober, Herbstlager!) hat ein Tag 25 Stunden. Ein Test deckt das ab (6.1).
5. **Währungen: keine Umrechnung, nie über Währungen summieren** (Issue + Epic-2-Entscheidung 2).
   - Pro-Budget-Kennzahlen (Hochrechnung 6.1, Verlauf 6.3) rechnen nur in der **Währung des Budgets**, wie der Fortschrittsbalken.
   - Budgetübergreifende Kennzahlen (6.2, 6.4, 6.5) brauchen eine Währung. Die Auswertungs-Ansicht bekommt deshalb eine Währungsauswahl (`ToggleButtonGroup`), die **nur erscheint, wenn es Ausgaben in mehr als einer Währung gibt**. Vorauswahl: die Währung mit den meisten Ausgaben, bei Gleichstand CHF. Alle budgetübergreifenden Zahlen beziehen sich auf die gewählte Währung; der Hinweis "Ausgaben in EUR sind hier nicht enthalten" steht darunter.
   - Ausnahme: "Ausgaben ohne Beleg" ist eine Anzahl, keine Summe, und zählt währungsunabhängig.
6. **Wo es angezeigt wird:**
   - Die **Hochrechnung** gehört zum Budget und steht deshalb auf der `BudgetCard` in der bestehenden Übersicht (6.1). Dort fällt eine drohende Überschreitung auf, ohne dass man eine weitere Ansicht öffnet (Issue: "Visueller Hinweis bei drohender Budgetüberschreitung").
   - Alles Budgetübergreifende kommt in eine **dritte Ansicht "Auswertung"** im bestehenden `ToggleButtonGroup` (Übersicht | Ausgaben | Auswertung), ab 6.2. Kein eigener Tab, keine eigene Route: gleiche Daten, gleicher Freischalt-Status.
   - Auf Mobile (xs) haben drei Toggle-Buttons plus "Neues Budget"/"Neue Ausgabe" in einer Zeile keinen Platz → in 6.2 prüfen und die Toolbar notfalls umbrechen (`flexWrap`). In der Auswertung gibt es keinen "Neu"-Button.
7. **Chart-Bibliothek `@mui/x-charts` in Version 7** (`^7.29`), nicht 8 oder 9. Grund: `@mui/x-data-grid` und `@mui/x-date-pickers` sind auf 7.29, alle drei teilen sich `@mui/x-internals`. Mischt man Major-Versionen, landen zwei Kopien davon im Bundle und die Typen können auseinanderlaufen. Ein späteres Upgrade aller `@mui/x-*` gemeinsam gehört in die Tech-Debt-Liste, nicht in dieses Epic.
8. **Diagramme werden in Jest nicht gerendert, sondern gemockt.** Die Bibliothek zieht ESM-only-Pakete (`d3-*`) nach, die `ts-jest` ohne zusätzliche `transformIgnorePatterns`/Babel-Konfiguration nicht verarbeiten kann. jsdom hat ausserdem kein Layout, ein gerendertes SVG wäre wertlos zum Prüfen. → Getestet werden die **reinen Datenfunktionen** (exakte Zahlenreihen) und dass die Komponente der Chart-Komponente die richtigen `series`/`xAxis`-Props übergibt (`jest.mock("@mui/x-charts/LineChart", ...)` mit einer Fake-Komponente, die ihre Props festhält). Zusätzlich braucht `expenseTracking.test.tsx` den Mock, sobald die Seite ein Diagramm importiert → in 6.3 einplanen. Ob die Diagramme stimmen, wird im Browser geprüft.
9. **Neue reine Funktionen landen in einer eigenen Datei `expenseStatistics.class.ts`** (Klasse `ExpenseStatistics`, statische Methoden, kein Supabase, kein React), ab 6.2. Ausnahme: Die Hochrechnung (6.1) ist eine Eigenschaft *eines Budgets* und kommt zu `Budget` (`budget.class.ts`, aktuell 115 Zeilen). Grund: `expense.class.ts` hat schon fünf Aufgaben (Validierung, Summen, Sortierung, Gruppierung, Diff). Statistiken über alle Budgets sind ein eigenes Thema und würden die Datei über 500 Zeilen treiben.
10. **Leere Zustände sind normal und bekommen Text statt leerer Diagramme.** Vor der ersten Ausgabe, vor Lagerbeginn, ohne Budget im Typ "pro Person/Tag", ohne Menüplan: Jede Kennzahl erklärt in einem Satz, warum sie (noch) nichts zeigt. Nie `NaN`, nie `Infinity`, nie "CHF 0.00 pro Mahlzeit", wenn es 0 Mahlzeiten gibt. Jede Story hat dafür einen eigenen Testfall.

### Neuer Zuschnitt

| Story | Inhalt | Ort | Neue Abhängigkeit |
|---|---|---|---|
| **6.1** | Hochrechnung pro Budget (`Budget.projectSpending`) + Anzeige auf der `BudgetCard` | Übersicht | — |
| **6.2a** | Ansicht "Auswertung" + Währungsauswahl + Kennzahl-Kacheln: Gesamttotal, Ø/Teilnehmer:in, Ausgaben ohne Beleg, Top-5-Ausgaben | Auswertung | — |
| **6.2b** | Budget-Auswahl für die Auswertung (Chips, pro Gerät im `localStorage`) | Auswertung | — |
| **6.2c** | Filter "Nur ohne Beleg" in der Ausgabenliste, Sprung aus der Kachel | Ausgaben | — |
| **6.3** | Ausgabenverlauf (`LineChart`): kumuliert pro Lagertag, Soll-Referenzlinie (Budget-Auswahl aus 6.2b) | Auswertung | `@mui/x-charts@^7.29` |
| **6.4** | Verteilung nach Budget (`PieChart` als Donut) | Auswertung | — |
| **6.5** | Ø pro Mahlzeit (Menüplan als Prop von `event.tsx` durchreichen) | Auswertung | — |

Danach: Rückblick Epic 6, Helpcenter-Seite `docs/event/expensetracking.md` um "Auswertung" ergänzen (kann in 6.5 oder als eigener Schritt passieren).

---

### **Story 6.1 — Hochrechnung pro Budget** ✅ erledigt

Ziel: Jede Budget-Karte zeigt während des Lagers die voraussichtliche Endsumme. Liegt diese über dem Sollbetrag, warnt die Karte schon *bevor* das Budget überschritten ist. Reine Domain-Funktion + eine Zeile auf der bestehenden Karte, keine neue Ansicht, keine neue Abhängigkeit.

**Fachliche Entscheidungen (bitte gegenlesen, weicht bewusst vom Issue-Wortlaut ab)**

1. **Formel.** Das Issue sagt: "bisherige Ausgaben ÷ vergangene Lagertage × Gesamtdauer". Wörtlich umgesetzt würde jedes Lager am ersten Tag falsch Alarm schlagen: Der Grosseinkauf passiert *vor* dem Lager (z.B. CHF 1'200 für eine Woche). An Tag 1 von 7 hiesse das 1'200 ÷ 1 × 7 = CHF 8'400 Hochrechnung, obwohl das Budget vermutlich reicht. → Ausgaben werden in zwei Teile getrennt:
   - **laufende Ausgaben** = Ausgaben mit `ersterLagertag ≤ Datum ≤ heute`. Nur diese werden hochgerechnet.
   - **feste Ausgaben** = alle anderen Ausgaben des Budgets: vor dem Lager (Grosseinkauf, Vorbestellungen), nach heute datiert (Vorauszahlungen, Tippfehler im Datum) oder nach Lagerende. Diese zählen einmal, unverändert.

   `Hochrechnung = feste Ausgaben + laufende Ausgaben ÷ vergangene Lagertage × Lagertage gesamt`

   Für ein Lager ohne Vorab-Einkauf ist das exakt die Issue-Formel. Wer die wörtliche Variante will: Einwand vor dem Coden, nicht danach.
2. **Vergangene Lagertage** = Anzahl Lagertage (Entscheidung 2 oben) mit `Tag ≤ heute`. **Heute zählt mit:** Wer am Abend von Tag 3 die Einkäufe von Tag 3 erfasst hat, hat 3 Tage hinter sich. Ein Tag zwischen zwei Zeitscheiben ist kein Lagertag und zählt nicht. Eine Ausgabe an so einem Tag ist aber eine laufende Ausgabe (sie liegt zwischen erstem Lagertag und heute).
3. **Wann es eine Hochrechnung gibt:** nur wenn `1 ≤ vergangene Lagertage < Lagertage gesamt`, also ab dem ersten Lagertag bis zum vorletzten. Sonst `null`:
   - vor dem Lager: keine Daten zum Tempo;
   - am letzten Lagertag und danach: Hochrechnung = Ist, die Zeile wäre nur Rauschen;
   - Anlass ohne Daten (`getEventDateList` leer): nichts zu rechnen.
4. **Nur in der Budgetwährung**, wie der Fortschrittsbalken. Ausgaben in anderen Währungen gehen weder in die festen noch in die laufenden Ausgaben ein.
5. **Rundung:** Ergebnis auf ganze Rappen runden (`Math.round`). Rappen sind Integer (Architektur-Entscheidung 3), eine Hochrechnung mit Nachkommastellen in Rappen gibt es nicht. "Keine Rundungslogik" im Issue betrifft eingegebene Beträge, nicht berechnete Werte.
6. **Warnung:** `projectedAmountInCents > targetAmountInCents` **und** `targetAmountInCents > 0` → Zeile in `warning.main` mit Icon `TrendingUpOutlined`. Ein Budget ohne Sollbetrag (0) kann nicht drohend überschritten werden; dort steht die Hochrechnung neutral. Keine zusätzliche `error`-Stufe: Ist das Budget schon überschritten, zeigt das der rote Balken bereits.
7. **Kein Speichern, kein Realtime-Sonderfall.** Wird live im bestehenden `budgetsWithProgress`-`useMemo` berechnet (wie der Sollbetrag in 1.4). Erfasst eine andere Köchin eine Ausgabe, ändert sich die Hochrechnung bei allen mit dem nächsten Reload.

**Schnittstelle**

`budget.types.ts`:

```ts
/**
 * Lineare Hochrechnung der Ausgaben eines Budgets bis Lagerende.
 */
export type BudgetProjection = {
  /** Voraussichtliche Endsumme in Rappen (Budgetwährung). */
  projectedAmountInCents: number;
  /** Bereits vergangene Lagertage inkl. heute (≥ 1). */
  elapsedCampDays: number;
  /** Anzahl Lagertage gesamt (> elapsedCampDays). */
  totalCampDays: number;
};

export type BudgetWithProgress = {
  // … bestehende Felder …
  /** `null`, wenn keine Hochrechnung möglich ist (vor dem Lager, ab dem letzten Lagertag). */
  projection: BudgetProjection | null;
};
```

`budget.class.ts`:

```ts
static projectSpending({
  budget,
  expenses,   // alle Ausgaben des Anlasses — Filter auf Budget + Währung passiert hier
  campDays,   // getEventDateList({event}), aufsteigend sortiert
  today,
}: {
  budget: BudgetDomain;
  expenses: ExpenseDomain[];
  campDays: Date[];
  today: Date;
}): BudgetProjection | null
```

Absichtlich *alle* Ausgaben rein und der Filter innen. Gleiches Muster wie `groupByBudget`, und die Seite muss nicht pro Budget vorfiltern.

**Code-Skizze** (`budget.class.ts`, nicht abschreiben, selbst bauen):

```ts
const todayKey = formatLocalDate(today);
const campDayKeys = campDays.map((day) => formatLocalDate(day));
const elapsedCampDays = campDayKeys.filter((dayKey) => dayKey <= todayKey).length;
if (elapsedCampDays < 1 || elapsedCampDays >= campDayKeys.length) return null;

const firstCampDayKey = campDayKeys[0];
let fixedAmountInCents = 0;
let runningAmountInCents = 0;
for (const expense of expenses) {
  if (expense.budgetId !== budget.id || expense.currency !== budget.currency) continue;
  const expenseDayKey = formatLocalDate(expense.date);
  // Vorab-Einkäufe und vorausdatierte Ausgaben nicht hochrechnen (siehe Entscheidung 1)
  if (expenseDayKey >= firstCampDayKey && expenseDayKey <= todayKey) {
    runningAmountInCents += expense.amountInCents;
  } else {
    fixedAmountInCents += expense.amountInCents;
  }
}
```

Der Vergleich über `YYYY-MM-DD`-Strings ist lexikografisch korrekt und unabhängig von Uhrzeit und Zeitumstellung (Entscheidung 4). `formatLocalDate` gibt es schon in `src/utils/dateUtils.ts`. Funktion bleibt unter 20 Zeilen, wenn das Aufteilen in fest/laufend als private Hilfsmethode ausgelagert wird (`splitFixedAndRunning`).

**Anbindung in `expenseTracking.tsx`**

- `const campDays = React.useMemo(() => getEventDateList({event}), [event.dates]);`
- Im bestehenden `budgetsWithProgress`-`useMemo`: `projection: Budget.projectSpending({budget, expenses: state.expenses ?? [], campDays, today: new Date()})`. Dependencies um `state.expenses` und `campDays` ergänzen. Fehlt eine, rechnet die Karte mit veralteten Ausgaben: Mutationsprobe unten.
- **Prüfen, ob `event.dates` eine stabile Referenz ist** (kommt aus `state.event`). Sonst `useMemo` auf `event.dates` wirkungslos → harmlos (die Funktion ist billig), aber im Review erwähnen.

**Anzeige in `budgetCard.tsx`**

- Neue Zeile unterhalb der Betragszeile, nur wenn `projection !== null`:
  `Hochrechnung bis Lagerende: CHF 1'480.00` + darunter klein (`caption`, `text.secondary`) `Stand Lagertag 3 von 7`.
- Warnfall (Entscheidung 6): Text + Icon in `warning.main`. Dazu ein `aria-label`/sichtbarer Text, nicht nur Farbe ("voraussichtlich über Budget"). Farbe allein ist nicht barrierefrei.
- Betrag über `formatAmountFromCents(…, budget.currency)` (`currencyUtils.ts`).
- Styles in `constants/styles/expenseTracking.styles.ts`, nicht inline.

**Dateien**

| Datei | Änderung |
|---|---|
| `src/components/Event/ExpenseTracking/budget.types.ts` | `BudgetProjection`, Feld `projection` in `BudgetWithProgress` |
| `src/components/Event/ExpenseTracking/budget.class.ts` | `projectSpending` (+ private `splitFixedAndRunning`) |
| `src/components/Event/ExpenseTracking/expenseTracking.tsx` | `campDays`-Memo, `projection` im `budgetsWithProgress`-Memo, Dependencies |
| `src/components/Event/ExpenseTracking/budgetCard.tsx` | Hochrechnungszeile inkl. Warnfall |
| `src/constants/text/expenseTracking.ts` | `PROJECTION_UNTIL_CAMP_END`, `PROJECTION_CAMP_DAY_OF` (Funktion mit `(elapsed, total)`, Muster bestehender Text-Funktionen prüfen), `PROJECTION_ABOVE_BUDGET` |
| `src/constants/styles/expenseTracking.styles.ts` | Style für die Hochrechnungszeile |
| `src/components/Event/ExpenseTracking/__tests__/budget.class.test.ts` | Tests `projectSpending` |
| `src/components/Event/ExpenseTracking/__tests__/budgetCard.test.tsx` (neu) | Anzeige-Tests der Karte |
| Fixtures, die `BudgetWithProgress` bauen (`expenseTracking.test.tsx`, Mocks) | `projection: null` nachziehen (neues Pflichtfeld, Pre-Commit-Checkliste) |

**Tests**

`budget.class.test.ts`, `describe("projectSpending")`. Testlager: 7 Tage, 5.–11. Juli 2026, Budget CHF, Soll beliebig. Alle Daten über `parseLocalDate`, nie `new Date("YYYY-MM-DD")`.

- **Vor dem Lager** (heute = 4.7.) → `null`.
- **Erster Lagertag** (heute = 5.7.), laufend CHF 100 → `projectedAmountInCents` 70000, `elapsedCampDays` 1, `totalCampDays` 7.
- **Mitte** (heute = 7.7.), laufend CHF 300 → 70000; `elapsedCampDays` 3.
- **Vorab-Einkauf wird nicht hochgerechnet:** 3.7. CHF 1'200 + laufend CHF 300, heute 7.7. → 120000 + 70000 = 190000.
- **Vorausdatierte Ausgabe zählt fest:** heute 7.7., Ausgabe am 9.7. CHF 50 → +5000, nicht hochgerechnet.
- **Letzter Lagertag** (11.7.) → `null`; **nach dem Lager** (12.7.) → `null`.
- **Fremdwährung ignoriert:** EUR-Ausgabe im CHF-Budget ändert das Ergebnis nicht.
- **Anderes Budget ignoriert.**
- **Keine Ausgaben, im Lager** → Hochrechnung 0 (nicht `null`: Die Zeile zeigt CHF 0.00, das ist eine gültige Aussage).
- **Leere Lagertage** (`campDays = []`) → `null`.
- **Mehrere Zeitscheiben:** 6.–8.7. und 10.–12.7. (6 Lagertage), heute 10.7. → `elapsedCampDays` 4. Eine Ausgabe am 9.7. (Lücke) zählt als laufend.
- **Uhrzeit egal:** `today` = 7.7. 23:59 und 7.7. 00:00 ergeben dasselbe.
- **Zeitumstellung:** Lager 23.10.–1.11.2026 (Umstellung in der Nacht auf 25.10.), heute 27.10. → `elapsedCampDays` 5. (Läuft nur aussagekräftig mit `TZ=Europe/Zurich`. Prüfen, ob `jestSetup.ts` die TZ setzt; sonst im Test-Kommentar vermerken und `elapsedCampDays` trotzdem prüfen.)
- **Rundung:** laufend 1 Rappen, Tag 3 von 7 → `Math.round(7/3)` = 2.

`budgetCard.test.tsx` (neu, reine Anzeige-Komponente, keine Contexts nötig, Props direkt):

- `projection: null` → keine Hochrechnungszeile.
- Projektion unter Soll → Betrag + "Lagertag 3 von 7" sichtbar, kein Warnhinweis.
- Projektion über Soll → Warnhinweis ("voraussichtlich über Budget") sichtbar.
- Soll 0, Projektion > 0 → kein Warnhinweis.

**Mutationsproben**

1. In `projectSpending` die Trennung fest/laufend entfernen (alles hochrechnen) → der Test "Vorab-Einkauf" muss rot werden.
2. Vergleich `dayKey <= todayKey` auf `<` ändern → "Erster Lagertag" muss rot werden.
3. `state.expenses` aus den `useMemo`-Dependencies entfernen und im Browser eine Ausgabe erfassen → die Hochrechnung darf sich dann *nicht* aktualisieren (zeigt, dass die Dependency nötig ist; danach zurücksetzen). Kein Jest-Test dafür, das Seitenrendering ist in `expenseTracking.test.tsx` schon teuer genug.

**Zum Ansehen im Browser** (DEV gegen `supabase-db-test`): Test-Anlass so legen, dass heute ein mittlerer Lagertag ist (Anlass bearbeiten → Zeitscheibe z.B. gestern bis in 4 Tagen).
1. Budget "Küche" CHF 500 fix. Eine Ausgabe CHF 300 vor dem Lager, eine CHF 50 gestern → Karte zeigt eine Hochrechnung, die den Vorab-Einkauf nicht vervielfacht.
2. Eine weitere grosse Ausgabe heute → Hochrechnung über Soll → Warnzeile.
3. Zweites Browserfenster mit anderer Köchin: Ausgabe erfassen → Hochrechnung aktualisiert sich live im ersten Fenster.
4. Anlass auf die Zukunft legen → Zeile verschwindet. Auf die Vergangenheit → Zeile verschwindet.
5. Budget "pro Person/Tag": Gruppenkonfiguration ändern → Soll ändert sich, die Warnung reagiert mit.
6. **Mobile (xs):** Karte nicht überladen, Zeile bricht sauber um, Warnung lesbar.

**Definition of Done:** `npx tsc --noEmit`, `npx jest budget.class budgetCard expenseTracking --watchAll=false`, `npm run lint` grün; Mutationsproben 1 + 2 rot/grün bestätigt; Browser-Rundlauf Desktop **und** Mobile inkl. Zweit-Köchin; Tests decken mehrere Zeitscheiben und die Zeitumstellung ab. Helpcenter-Absatz zur Hochrechnung (Formel in einem Satz, Hinweis auf Vorab-Einkäufe) wird gesammelt am Ende von Epic 6 geschrieben, nicht pro Story.

---

**Abschluss-Review (2026-10-10):**

- `tsc` sauber; `eslint` auf allen geänderten Dateien ohne Befund; `npx jest budget.class budgetCard expenseTracking` 165/165 grün.
- Tests: 14 Fälle für `projectSpending` (inkl. mehrerer Zeitscheiben, Zeitumstellung mit `TZ=Europe/Zurich` im Test gesetzt, Rundung), 7 für `budgetCard.test.tsx` (neu).
- Mutationsproben: Warnbedingung in der Karte (`targetAmountInCents > 0` entfernt bzw. `>` → `>=`) machen je einen Test rot. Die Proben 1 + 2 in `projectSpending` und der Browser-Rundlauf (Desktop + Mobile, Zweit-Köchin) wurden laut Nutzer gemacht.
- Bewusst nicht in Jest: die Anbindung im `budgetsWithProgress`-Memo (Mutationsprobe 3, nur im Browser geprüft).
- Lehre: `toHaveTextContent` mit `formatAmountFromCents` braucht normale statt geschützter Leerzeichen (Helfer `expectedAmount` in `budgetCard.test.tsx`). Gilt für alle Betrags-Tests in 6.2 ff.
- Helpcenter-Absatz zur Hochrechnung: gesammelt am Ende von Epic 6.

---

### **Story 6.2 — Ansicht "Auswertung" mit Kennzahl-Kacheln** (aufgeteilt in 6.2a, 6.2b, 6.2c)

> **Lesehilfe.** Diese Story ist ausführlicher als 6.1: Zu jedem Schritt steht *was* zu tun ist, *wo* im bestehenden Code das Vorbild liegt und *warum* es so gemacht wird. Abschnitte, die mit **Offen** markiert sind, bitte vor dem Coden beantworten (kurz im Chat reicht). Alles andere ist entschieden; Widerspruch ist trotzdem willkommen.

#### Worum es geht (in zwei Sätzen)

Die Abrechnungsseite bekommt neben "Übersicht" und "Ausgaben" eine dritte Ansicht "Auswertung". Dort stehen vier Kacheln mit Kennzahlen über **die ausgewählten Budgets** (Gesamttotal, Ø pro Teilnehmer:in, Anzahl Ausgaben ohne Beleg, Top-5-Ausgaben). Die Köchin wählt, welche Budgets zählen (z.B. ohne "Material", das nichts mit der Küche zu tun hat). Ein Klick auf "ohne Beleg" springt in die Ausgabenliste und zeigt dort nur noch die Ausgaben ohne Beleg.

#### Warum drei Pakete

| Paket | Inhalt | Warum getrennt |
|---|---|---|
| **6.2a** | `ExpenseStatistics` (reine Funktionen + Tests), neue Komponente `ExpenseEvaluation`, dritter Toggle, Währungsauswahl, vier Kacheln | Neue Datei, neue Ansicht, keine Änderung an bestehendem Verhalten. Lässt sich für sich reviewen und committen. |
| **6.2b** | Budget-Auswahl (Chips), gespeichert pro Gerät im `localStorage` | Eigenes Thema mit eigenem Risiko: Speicher, der fehlen, kaputt sein oder werfen kann. 6.2a rechnet zuerst über alle Budgets; 6.2b schiebt nur einen Filter davor. |
| **6.2c** | Filter "Nur ohne Beleg" in der Ausgabenliste + Sprung aus der Kachel | Ändert **bestehende** Komponenten (`ExpenseList`, Seite). Anderes Risiko (Regression in der Liste), andere Tests. Lehre aus Epic 1: ein Paket = ein Ziel. |

In 6.2a zählen noch alle Budgets, die Auswahl kommt mit 6.2b. Die Kachel "Ohne Beleg" ist bis 6.2c **nicht klickbar**.

#### Was am Ende auf dem Bildschirm steht

Desktop (md und grösser), Auswertung gewählt, Ausgaben in CHF und EUR vorhanden:

```
[ Übersicht | Ausgaben | Auswertung ]                      (kein "Neu"-Button)

Budgets: [✓ Küche] [✓ Grosseinkauf] [ Material ]   ← ab 6.2b, nur bei ≥ 2 Budgets
2 von 3 Budgets berücksichtigt
Währung: [ CHF | EUR ]
Ausgaben in EUR sind hier nicht enthalten.        ← nur, wenn es andere Währungen gibt

┌ Gesamtausgaben ─┐ ┌ Ø pro Teilnehmer:in ┐ ┌ Ohne Beleg ─────┐
│ CHF 2'340.50    │ │ CHF 97.52           │ │ 3 Ausgaben  ⚠   │
│ 14 Ausgaben     │ │ bisher CHF 13.93    │ │ alle Budgets    │
│                 │ │ pro Person & Tag    │ │ und Währungen   │
│                 │ │ 24 TN · 7 Lagertage │ │                 │
└─────────────────┘ └─────────────────────┘ └─────────────────┘
┌ Grösste Ausgaben ─────────────────────────────────────────────┐
│ 🛒 Grosseinkauf Migros     03.07.2026          CHF 1'200.00   │
│ 🍳 Gas-Flasche             05.07.2026            CHF 89.00    │
│ …                                                (max. 5)     │
└───────────────────────────────────────────────────────────────┘
```

Mobile (xs): Jede Kachel volle Breite, untereinander. Toggle-Leiste bricht um, falls sie nicht in eine Zeile passt.

Die drei Zahl-Kacheln stehen in einer Zeile (`Grid size={{xs: 12, sm: 4}}`), die Top-5-Liste darunter über die volle Breite (`size={{xs: 12}}`). Abweichung vom Umriss ("md 3"): Eine Liste mit fünf Zeilen passt nicht in ein Viertel der Breite.

#### Wie die Daten fliessen (nichts Neues laden)

```
useExpenseTrackingData ──► state.expenses ──┐   (schon geladen, schon live über Realtime)
                          state.budgets ────┤
event.tsx ──► groupConfiguration ───────────┤
                                            ▼
                expenseTracking.tsx  (Seite, rechnet NICHTS Neues aus)
                                            │ Props
                                            ▼
                ExpenseEvaluation  (neue Komponente, eigene Datei)
                   │  useMemo
                   ▼
                ExpenseStatistics.*  (reine Funktionen, kein React, kein Supabase)
```

Warum die Berechnung in `ExpenseEvaluation` und nicht in der Seite: `expenseTracking.tsx` hat schon 927 Zeilen. Die Seite reicht nur Rohdaten durch; alles, was nur die Auswertung braucht, lebt in der Auswertung. Gleiches Muster wie `PayeeBalanceAccordion`, das `Expense.sumByPayee` selbst aufruft (`payeeBalanceAccordion.tsx:50`).

Weil alles aus `state.expenses` abgeleitet wird, ist die Auswertung **automatisch live**: Erfasst eine andere Köchin eine Ausgabe, lädt der bestehende Realtime-Hook neu, `state.expenses` bekommt eine neue Referenz, `useMemo` rechnet neu. Kein eigener Realtime-Code.

#### Bestehende Bausteine, die du brauchst

| Baustein | Wo | Wofür in 6.2 |
|---|---|---|
| `ExpenseTrackingView` | `expenseTracking.tsx:98` | Typ um `"evaluation"` erweitern |
| `handleViewChange` | `expenseTracking.tsx:305` | Bleibt für 6.2a unverändert; in 6.2c setzt er den Filter zurück |
| Toolbar mit `ToggleButtonGroup` und "Neu"-Button | `expenseTracking.tsx:806–847` | dritter `ToggleButton`; der Button-Ternary wird zu "Übersicht → Budget, Ausgaben → Ausgabe, Auswertung → nichts" |
| Ansicht-Ternary | `expenseTracking.tsx:848–883` | wird zu drei Fällen (siehe Schritt 4) |
| `expenseGroups`-Memo | `expenseTracking.tsx:279` | 6.2c: hier wird gefiltert |
| `handleEditExpense(expenseId)` | `expenseTracking.tsx:353` | Klick auf eine Top-5-Zeile öffnet denselben Bearbeiten-Dialog wie in der Liste |
| `groupConfiguration.totalPortions` | `groupConfiguration.class.ts` | Teilnehmerzahl. Summe der Portionen aller Diäten = eine Portion pro Person. Dieselbe Zahl, mit der `Budget.getTargetAmountInCents` den Sollbetrag rechnet, also konsistent mit den Budget-Karten. |
| `formatAmountFromCents(cents, currency)` | `src/components/Shared/utils/currencyUtils.ts` | jede Betragsanzeige |
| `AVAILABLE_CURRENCIES` | gleiche Datei | **nicht** für die Währungsauswahl verwenden, siehe Entscheidung W2 |
| `BUDGET_ICON_MAP` | `budgetIcons.ts` | Icon des Budgets in der Top-5-Zeile (wie `ExpenseGroupHeader` in `expenseList.tsx`) |
| `Expense.sortByDateDescending` | `expense.class.ts` | Vorbild für einen stabilen Sortiervergleich mit `localeCompare(…, "de")` |
| `classes.expenseRowPrimary`, `expenseRowAmount` | `expenseTracking.styles.ts` | Top-5-Zeile sieht aus wie eine Zeile der Ausgabenliste (Bezeichnung links, Betrag rechts) |
| `expectedAmount`-Helfer | `__tests__/budgetCard.test.tsx` | Betrags-Asserts mit `toHaveTextContent` (geschütztes Leerzeichen, Lehre aus 6.1) |

---

### **Paket 6.2a — Statistik-Funktionen + Ansicht "Auswertung"**

#### Fachliche Entscheidungen

**W1 — Welche Währungen gibt es?** Nur die Währungen, in denen es **Ausgaben** gibt. Budgets ohne Ausgaben spielen keine Rolle, weil alle Kennzahlen aus Ausgaben bestehen.

**W2 — Vorauswahl.** Die Währung mit den **meisten Ausgaben (Anzahl, nicht Betrag)**. Gleichstand: CHF, falls beteiligt, sonst alphabetisch. Keine Ausgaben: CHF.
*Warum Anzahl statt Betrag:* Ein Lager in Frankreich mit einem CHF-Grosseinkauf von 1'500 vorab und 30 kleinen EUR-Einkäufen vor Ort lebt in EUR. Die Anzahl zeigt, in welcher Währung die Küche tatsächlich arbeitet.
*Warum nicht `AVAILABLE_CURRENCIES`:* Das ist die Liste der *wählbaren* Währungen im Dialog. Ein Toggle "EUR" ohne EUR-Ausgaben zeigt nur Nullen.

**W3 — Wann der Währungs-Toggle erscheint.** Nur bei **mehr als einer** Währung in den Ausgaben. Bei genau einer Währung steht weder Toggle noch Hinweis; das ist der Normalfall (fast alle Lager nur CHF).

**W4 — Gewählte Währung verschwindet.** Die Köchin wählt EUR, eine andere Köchin löscht die letzte EUR-Ausgabe. Dann fällt die Auswahl auf die Vorauswahl (W2) zurück. Umsetzung **ohne `useEffect`**:

```ts
// null = «keine bewusste Wahl», dann gilt die Vorauswahl
const [chosenCurrency, setChosenCurrency] = React.useState<string | null>(null);
const selectedCurrency =
  chosenCurrency && currencies.includes(chosenCurrency)
    ? chosenCurrency
    : defaultCurrency;
```

*Warum kein `useEffect`, der den State zurücksetzt:* Ein Effekt läuft erst *nach* dem Rendern. Es gäbe einen Frame mit einer Währung, die nicht mehr existiert, plus einen zweiten Render. Den Wert beim Rendern abzuleiten ist kürzer und hat diesen Zwischenzustand nicht. Kommt die EUR-Ausgabe zurück (Undo, Realtime), ist EUR automatisch wieder gewählt, weil `chosenCurrency` noch "EUR" ist. Das ist gewollt.

**W5 — Zustand der Währungsauswahl.** Lokaler State in `ExpenseEvaluation`. Wechselt man in "Übersicht" und zurück, wird die Komponente neu gemountet und die Auswahl steht wieder auf der Vorauswahl. Akzeptiert: Die Vorauswahl ist in > 95 % der Fälle das, was man will. Nicht in `localStorage`, nicht in die URL.

**K1 — Gesamtausgaben.** Summe aller Ausgaben in der gewählten Währung, **über alle Budgets**. Darunter klein: Anzahl dieser Ausgaben ("14 Ausgaben"; Einzahl "1 Ausgabe").

**K2 — Ø pro Teilnehmer:in.** `Math.round(Gesamtausgaben ÷ totalPortions)`, in Rappen. Darunter die Zeile "pro Person & Tag" (siehe unten) und klein, womit gerechnet wurde: "24 TN · 7 Lagertage".
- `totalPortions` 0 (Gruppenkonfiguration nicht ausgefüllt) → `null` → Kachel zeigt statt der Zahl: "Erfasse die Teilnehmenden in der Gruppenkonfiguration." Nie `Infinity`, nie `NaN` (Epic-Entscheidung 10).
- In 6.2a über alle Budgets. Ab 6.2b nur über die ausgewählten (z.B. ohne "Material").
- **Zweite Zeile "pro Person & Tag"** (O1, entschieden 2026-10-10: ja). `Math.round(Gesamtausgaben ÷ totalPortions ÷ event.numberOfDays)`. Geteilt wird durch **alle** Lagertage, nicht durch die bisher vergangenen. *Warum:* Durch die vergangenen Tage geteilt, wird der Grosseinkauf vor dem Lager an Tag 2 auf zwei Tage verteilt, und der Wert sieht dreimal zu hoch aus. Durch alle Tage geteilt, heisst der Wert "so viel haben wir pro Person und Tag *bisher verbraucht*, gemessen am ganzen Lager". An Tag 3 von 7 steht dort z.B. CHF 4.20 bei einem Ansatz von CHF 8.50, und das ist richtig gelesen wie der Fortschrittsbalken: noch Luft. Darum steht "bisher" im Text, damit niemand es als Tagesdurchschnitt liest. `event.numberOfDays` statt `getEventDateList(...).length`, weil `Budget.getTargetAmountInCents` den Sollbetrag damit rechnet: So sind Ansatz und Ist direkt vergleichbar.
  - `numberOfDays` 0 (Anlass ohne Daten) → nur diese Zeile entfällt, die Zeile "pro Person" bleibt.
  - Kein Vergleich mit dem Ansatz eines "pro Person & Tag"-Budgets in der Kachel: Es kann mehrere solche Budgets mit verschiedenen Ansätzen geben. Den Vergleich pro Budget zeigt die Budget-Karte.

**K3 — Ausgaben ohne Beleg.** Anzahl Ausgaben mit `attachmentPath === null`, **alle Währungen** (Epic-Entscheidung 5, Ausnahme). Darum steht unter der Zahl klein "alle Budgets und Währungen" (Budgets ab 6.2b, siehe B4), sonst wirkt es wie ein Fehler, wenn die Zahl beim Wechsel gleich bleibt.
- Anzahl > 0 → Zahl + Icon `ReportProblemOutlined` in `warning.main`. Gleiches Icon wie das "Beleg fehlt"-Icon in der Liste (`expenseList.tsx`), damit man die Verbindung sieht.
- Anzahl 0 → "Alle Ausgaben haben einen Beleg." in `success.main` mit `CheckCircleOutlined`. Positive Rückmeldung, kein leerer Zustand.
- Text nicht nur über Farbe: "3 Ausgaben ohne Beleg" ist auch ohne Farbe verständlich.

**K4 — Top-5-Ausgaben.** Die 5 grössten Einzelposten in der gewählten Währung, budgetübergreifend.
- Sortierung: Betrag absteigend; bei gleichem Betrag neueres Datum zuerst; dann Bezeichnung (`localeCompare(…, "de")`). *Warum so genau:* Ohne festen Tie-Breaker hängt die Reihenfolge gleicher Beträge von der Ladereihenfolge ab und kann nach jedem Realtime-Reload springen.
- Weniger als 5 Ausgaben → so viele, wie es gibt. Keine Ausgabe in der Währung → Kachel erscheint nicht (siehe K5).
- Zeile: Budget-Icon, Bezeichnung, Datum, Betrag. Klick öffnet den Bearbeiten-Dialog (`handleEditExpense`, schon vorhanden; O2, entschieden 2026-10-10: ja). *Warum klickbar:* Der häufigste Grund, die grössten Posten anzusehen, ist "stimmt der Betrag?" (Tippfehler 1200 statt 12.00). Kein neuer Code nötig, nur ein Callback durchreichen.
- "Gefiltert" aus dem Issue (pro Budget) → kommt mit der Budget-Auswahl in 6.2b.

**K5 — Leere Zustände** (O3, entschieden 2026-10-10: ein Satz statt Kacheln mit Nullen).
- **Keine einzige Ausgabe:** Die ganze Ansicht zeigt nur einen Satz: "Sobald ihr Ausgaben erfasst, siehst du hier die Auswertung." Keine Kacheln mit CHF 0.00. *Warum nicht vier leere Kacheln:* Vier Nullen sagen nichts, ein Satz erklärt den Zustand.
- Gibt es Ausgaben, gibt es auch in der gewählten Währung mindestens eine (W1/W2). Die Kacheln sind dann also nie leer. Der Test deckt es trotzdem ab.

**K6 — Rundung.** Nur der Durchschnitt wird gerundet (`Math.round` auf ganze Rappen), wie die Hochrechnung in 6.1. Summen von Integer-Rappen sind exakt.

#### Schnittstelle `expenseStatistics.class.ts` (neue Datei)

```ts
/**
 * Kennzahlen über alle Ausgaben eines Anlasses (Auswertung, Epic 6).
 * Reine Funktionen: kein React, kein Supabase. Summiert nie über Währungen.
 */
export class ExpenseStatistics {
  /** Währungen mit Ausgaben, häufigste zuerst, plus Vorauswahl (W1, W2). */
  static getCurrenciesInUse(expenses: ExpenseDomain[]): CurrenciesInUse;

  /** Nur die Ausgaben einer Währung. Basis für alle anderen Kennzahlen. */
  static filterByCurrency(expenses: ExpenseDomain[], currency: string): ExpenseDomain[];

  /** Summe in Rappen. Erwartet bereits nach Währung gefilterte Ausgaben. */
  static sumAmountInCents(expenses: ExpenseDomain[]): number;

  /** Ø pro Teilnehmer:in in Rappen, `null` bei 0 Teilnehmenden (K2). */
  static averagePerParticipant(totalAmountInCents: number, participantCount: number): number | null;

  /** Bisher verbraucht pro Person und Tag, über alle Lagertage (K2). `null` bei 0 Teilnehmenden oder 0 Tagen. */
  static averagePerParticipantAndDay(totalAmountInCents: number, participantCount: number, campDayCount: number): number | null;

  /** Anzahl Ausgaben ohne Beleg, alle Währungen (K3). */
  static countWithoutAttachment(expenses: ExpenseDomain[]): number;

  /** Die `limit` grössten Ausgaben, stabil sortiert (K4). Gibt eine neue Liste zurück. */
  static topExpenses(expenses: ExpenseDomain[], limit = 5): ExpenseDomain[];
}
```

Abweichung vom Umriss: `sumForCurrency(expenses, currency)` wird zu `filterByCurrency` + `sumAmountInCents`. *Warum:* Gesamttotal, Anzahl, Top-5 (und später 6.3–6.5) brauchen alle zuerst "nur CHF". Einmal filtern und das Ergebnis weitergeben ist klarer, als jede Funktion intern selbst filtern zu lassen. `averagePerParticipant` bekommt deshalb auch schon die Summe statt der Ausgaben: Die Komponente hat sie ohnehin, und die Funktion wird trivial testbar (zwei Zahlen rein, eine raus).

Neuer Typ in `expense.types.ts` (bei den View-Modellen):

```ts
/** Ergebnis von `ExpenseStatistics.getCurrenciesInUse`. */
export type CurrenciesInUse = {
  /** Währungscodes mit mindestens einer Ausgabe, häufigste zuerst. */
  currencies: string[];
  /** Vorausgewählte Währung (W2). «CHF», wenn es keine Ausgaben gibt. */
  defaultCurrency: string;
};
```

Code-Skizze für die einzige nicht triviale Funktion (nicht abschreiben, selbst bauen):

```ts
static getCurrenciesInUse(expenses: ExpenseDomain[]): CurrenciesInUse {
  const countByCurrency = new Map<string, number>();
  for (const expense of expenses) {
    countByCurrency.set(expense.currency, (countByCurrency.get(expense.currency) ?? 0) + 1);
  }
  const currencies = [...countByCurrency.keys()].sort((currencyA, currencyB) =>
    ExpenseStatistics.compareCurrencyUsage(currencyA, currencyB, countByCurrency),
  );
  return {currencies, defaultCurrency: currencies[0] ?? DEFAULT_CURRENCY};
}
```

`compareCurrencyUsage` (privat): erst Anzahl absteigend, dann CHF vor allen anderen, dann alphabetisch. So ist `currencies[0]` automatisch die Vorauswahl und die Toggle-Reihenfolge ist dieselbe Logik, nicht eine zweite. `DEFAULT_CURRENCY = "CHF"` gibt es noch nicht (geprüft: "CHF" steht hart in `budgetDetailDialog.tsx:70` und `DonationResult.tsx:98`) → neben `AVAILABLE_CURRENCIES` in `currencyUtils.ts` anlegen. Die zwei bestehenden Stellen nicht anfassen (Minimal Impact), sondern in `tech-debt.md` notieren.

#### Komponente `expenseEvaluation.tsx` (neue Datei)

```ts
type ExpenseEvaluationProps = {
  /** Alle Ausgaben des Anlasses (ungefiltert, alle Währungen). */
  expenses: ExpenseDomain[];
  /** Alle Budgets, für Icon und Name in der Top-5-Liste. */
  budgets: BudgetDomain[];
  /** `groupConfiguration.totalPortions`. Nur die Zahl, nicht die ganze Konfiguration. */
  participantCount: number;
  /** `event.numberOfDays`, gleiche Grundlage wie der Sollbetrag der Budgets. */
  campDayCount: number;
  /** Öffnet den Bearbeiten-Dialog (Klick auf eine Top-5-Zeile). */
  handleEditClick: (expenseId: string) => void;
};
```

*Warum `participantCount: number` statt `groupConfiguration`:* Die Komponente braucht eine Zahl. Mit der ganzen Klasse wird jeder Test gezwungen, eine `EventGroupConfiguration` zu bauen, und die Komponente hängt an einer Struktur, die sie nicht nutzt.

Aufbau (Richtwert < 250 Zeilen):

- `ExpenseEvaluation` (exportiert): Leerer Zustand (K5), Währungsauswahl (W3/W4), `useMemo` für die Kennzahlen, Grid mit den Kacheln.
- `StatisticTile` (nicht exportiert): gemeinsamer Rahmen einer Zahl-Kachel: Titel, grosse Zahl oder Hinweistext, kleine Zeile darunter. Die drei Zahl-Kacheln unterscheiden sich nur im Inhalt; ohne gemeinsamen Rahmen entsteht dreimal dasselbe JSX.
- `TopExpensesTile` (nicht exportiert): die Liste.

Ein `useMemo` für alles, was von der Währung abhängt:

```ts
const statistics = React.useMemo(() => {
  const expensesInCurrency = ExpenseStatistics.filterByCurrency(expenses, selectedCurrency);
  const totalAmountInCents = ExpenseStatistics.sumAmountInCents(expensesInCurrency);
  return {
    expenseCount: expensesInCurrency.length,
    totalAmountInCents,
    averagePerParticipantInCents: ExpenseStatistics.averagePerParticipant(totalAmountInCents, participantCount),
    averagePerParticipantAndDayInCents: ExpenseStatistics.averagePerParticipantAndDay(totalAmountInCents, participantCount, campDayCount),
    topExpenses: ExpenseStatistics.topExpenses(expensesInCurrency),
  };
}, [expenses, selectedCurrency, participantCount, campDayCount]);
```

`countWithoutAttachment` hängt nicht von der Währung ab → eigenes `useMemo` nur auf `[expenses]`. (Beides ist billig, `useMemo` hier vor allem als Lesehilfe: "das wird abgeleitet, nicht gespeichert".)

Kachel-Rahmen: `Card variant="outlined"` mit dem Radius der Budget-Karten. Style `evaluationTile` in `expenseTracking.styles.ts` an `budgetCard` anlehnen (12px Radius, `divider`-Rahmen, `height: "100%"`, damit die drei Kacheln einer Zeile gleich hoch sind).

Ansage für Screenreader: Die grosse Zahl ist ein `Typography variant="h5"` mit `component="p"`, der Titel `variant="subtitle2"`. Keine Überschriften-Hierarchie (`h1`–`h6` als Element) für Kacheln, sonst springt die Dokumentgliederung.

#### Anbindung in `expenseTracking.tsx`

1. `type ExpenseTrackingView = "overview" | "expenses" | "evaluation";` und JSDoc darüber nachziehen (dort steht noch "(folgt) Ausgabenliste").
2. Dritter `ToggleButton value="evaluation"` mit `TEXT_EXPENSE_TRACKING_EVALUATION`.
3. Button-Weiche: Heute `view === "overview" ? Budget-Button : Ausgabe-Button`. Mit drei Ansichten wird der `else`-Zweig falsch (Auswertung würde "Neue Ausgabe" zeigen). → Zwei explizite Bedingungen: `{view === "overview" && …}` und `{view === "expenses" && …}`.
4. Ansicht-Weiche: verschachtelter Ternary mit drei Fällen ist schwer lesbar. → Drei `{view === … && (…)}`-Blöcke untereinander. (Wer möchte: kleine `renderView()`-Funktion mit `switch`. Beides okay; keinen verschachtelten Ternary.)
5. `<ExpenseEvaluation expenses={state.expenses ?? []} budgets={state.budgets ?? []} participantCount={groupConfiguration.totalPortions} campDayCount={event.numberOfDays} handleEditClick={handleEditExpense} />`

Toolbar auf Mobile: `budgetToolbar` bekommt `flexWrap: "wrap"` und `gap: theme.spacing(1)`. Auf 360 px Breite prüfen. Passen die drei Toggles allein nicht in eine Zeile ("Übersicht", "Ausgaben", "Auswertung" ≈ 300 px bei `size="small"`), stattdessen `ToggleButtonGroup` mit `fullWidth` auf xs. Das im Browser entscheiden, nicht vorab.

#### Texte (`src/constants/text/expenseTracking.ts`)

| Konstante | Text |
|---|---|
| `EXPENSE_TRACKING_EVALUATION` | "Auswertung" |
| `EVALUATION_NO_EXPENSES` | "Sobald ihr Ausgaben erfasst, siehst du hier die Auswertung." |
| `EVALUATION_CURRENCY` | "Währung" (Beschriftung + `aria-label` der Toggle-Gruppe) |
| `EVALUATION_OTHER_CURRENCIES_EXCLUDED(currencies: string[])` | "Ausgaben in EUR sind hier nicht enthalten." / bei mehreren: "Ausgaben in EUR und USD …" |
| `EVALUATION_TOTAL` | "Gesamtausgaben" |
| `EVALUATION_EXPENSE_COUNT(count: number)` | "1 Ausgabe" / "14 Ausgaben" |
| `EVALUATION_AVERAGE_PER_PARTICIPANT` | "Ø pro Teilnehmer:in" |
| `EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR(amountInCents: number, currency: string)` | "bisher CHF 13.93 pro Person & Tag" |
| `EVALUATION_CALCULATION_BASIS(participants: number, days: number)` | "24 TN · 7 Lagertage" (Einzahl: "1 Lagertag") |
| `EVALUATION_PARTICIPANTS_MISSING` | "Erfasse die Teilnehmenden in der Gruppenkonfiguration." |
| `EVALUATION_WITHOUT_RECEIPT` | "Ohne Beleg" |
| `EVALUATION_WITHOUT_RECEIPT_COUNT(count: number)` | "1 Ausgabe ohne Beleg" / "3 Ausgaben ohne Beleg" |
| `EVALUATION_ALL_RECEIPTS_PRESENT` | "Alle Ausgaben haben einen Beleg." |
| `EVALUATION_ALL_CURRENCIES` | "alle Währungen" |
| `EVALUATION_TOP_EXPENSES` | "Grösste Ausgaben" |

Funktions-Texte nach dem Muster von `DAY_X_OF_Y_IN_EVENT` (Pfeilfunktion mit Rückgabetyp `string`). Einzahl/Mehrzahl in der Text-Funktion lösen, nicht in der Komponente.

#### Dateien 6.2a

| Datei | Änderung |
|---|---|
| `src/components/Event/ExpenseTracking/expenseStatistics.class.ts` (neu) | Klasse `ExpenseStatistics` |
| `src/components/Event/ExpenseTracking/expense.types.ts` | Typ `CurrenciesInUse` |
| `src/components/Event/ExpenseTracking/expenseEvaluation.tsx` (neu) | `ExpenseEvaluation`, `StatisticTile`, `TopExpensesTile` |
| `src/components/Event/ExpenseTracking/expenseTracking.tsx` | View-Typ, dritter Toggle, Button-/Ansicht-Weiche |
| `src/constants/text/expenseTracking.ts` | Texte oben |
| `src/constants/styles/expenseTracking.styles.ts` | `evaluationTile`, `budgetToolbar` mit `flexWrap`/`gap` |
| `src/components/Shared/utils/currencyUtils.ts` | `DEFAULT_CURRENCY` |
| `__tests__/expenseStatistics.class.test.ts` (neu) | reine Funktionen |
| `__tests__/expenseEvaluation.test.tsx` (neu) | Anzeige |
| `__tests__/expenseTracking.test.tsx` | Toggle "Auswertung", kein "Neu"-Button |

#### Tests 6.2a

**`expenseStatistics.class.test.ts`** — Ausgaben aus `__mocks__/expense.mock.ts` mit `{...expense, id, currency, amountInCents, date: parseLocalDate("2026-07-05")}` bauen. Eine kleine Fabrik-Funktion `createExpense(overrides)` oben in der Testdatei spart viel Wiederholung.

`getCurrenciesInUse`
- keine Ausgaben → `{currencies: [], defaultCurrency: "CHF"}`
- nur CHF → `["CHF"]`, `"CHF"`
- 2 × EUR, 1 × CHF → `["EUR", "CHF"]`, `"EUR"` (Anzahl entscheidet)
- 1 × EUR à 1'000, 2 × CHF à 1 → `"CHF"` (Anzahl, **nicht** Betrag)
- Gleichstand 1 × EUR, 1 × CHF → `"CHF"` (in beiden Eingabe-Reihenfolgen testen, sonst ist der Test zufällig grün)
- Gleichstand 1 × USD, 1 × EUR → `"EUR"` (alphabetisch)

`filterByCurrency` / `sumAmountInCents`
- gemischte Währungen → nur die gewählte
- leere Liste → `[]` bzw. `0`

`averagePerParticipant`
- 240000 ÷ 24 → 10000
- 1000 ÷ 3 → 333 (gerundet); 2000 ÷ 3 → 667 (aufgerundet)
- Teilnehmende 0 → `null`
- Summe 0, Teilnehmende 10 → 0 (nicht `null`: gültige Aussage)

`averagePerParticipantAndDay`
- 168000 ÷ 24 ÷ 7 → 1000
- 1000 ÷ 3 ÷ 1 → 333 (gerundet, erst am Schluss runden, nicht nach jeder Division: 100000 ÷ 3 ÷ 3 → 11111, nicht `Math.round(Math.round(100000/3)/3)`)
- Teilnehmende 0 → `null`; Lagertage 0 → `null`

`countWithoutAttachment`
- gemischt (2 ohne, 1 mit) → 2
- verschiedene Währungen zählen alle

`topExpenses`
- 7 Ausgaben → genau 5, absteigend nach Betrag
- 3 Ausgaben → 3
- gleicher Betrag, verschiedenes Datum → neueres zuerst
- gleicher Betrag und Datum → alphabetisch nach Bezeichnung
- Eingabe-Array bleibt unverändert (`expect(input).toEqual(kopieVorher)`): `sort` sortiert in place, darum `[...expenses].sort(…)`. Klassischer Fehler, der sonst die Reihenfolge der Ausgabenliste mitverändert.

**`expenseEvaluation.test.tsx`** — reine Anzeige, Props direkt, keine Contexts (wie `budgetCard.test.tsx`). `expectedAmount`-Helfer von dort übernehmen (kopieren ist hier okay; wird er ein drittes Mal gebraucht, in eine Test-Utility verschieben).
- keine Ausgaben → Hinweistext, keine Kachel
- nur CHF → kein Währungs-Toggle, kein "nicht enthalten"-Hinweis
- CHF + EUR → Toggle sichtbar, Vorauswahl gemäss W2, Hinweis nennt die andere Währung
- Klick auf EUR → Gesamttotal wechselt auf EUR-Summe, "Ohne Beleg" bleibt gleich
- `participantCount` 0 → Hinweis "Gruppenkonfiguration", kein Betrag, auch keine "pro Person & Tag"-Zeile
- `campDayCount` 0 → "pro Person"-Betrag da, "pro Person & Tag"-Zeile fehlt
- alle mit Beleg → "Alle Ausgaben haben einen Beleg."
- Top-5: Reihenfolge der Zeilen (`within(list).getAllByRole("button")` o.ä.) und Klick ruft `handleEditClick` mit der richtigen ID
- **W4:** mit CHF + EUR rendern, EUR wählen, dann mit `rerender` nur noch CHF-Ausgaben übergeben → zeigt CHF, kein Absturz, kein Toggle

**`expenseTracking.test.tsx`**
- Toggle "Auswertung" zeigt die Auswertung (`data-testid="expense-tracking-evaluation"`)
- In der Auswertung gibt es weder "Neues Budget" noch "Neue Ausgabe"
- Bestehender Test "Toggle Button wechselt die Ansicht" (Zeile ~341) bleibt grün

#### Mutationsproben 6.2a

1. In `compareCurrencyUsage` die CHF-Regel entfernen → Test "Gleichstand EUR/CHF" muss in einer der beiden Reihenfolgen rot werden.
2. In `topExpenses` `[...expenses].sort` durch `expenses.sort` ersetzen → Test "Eingabe bleibt unverändert" muss rot werden.
3. In `ExpenseEvaluation` die Ableitung `currencies.includes(chosenCurrency)` entfernen → W4-Test muss rot werden.

#### Im Browser ansehen (DEV gegen `supabase-db-test`)

1. Anlass ohne Ausgaben → Auswertung zeigt nur den Hinweissatz.
2. Drei CHF-Ausgaben, eine davon mit Beleg → Gesamttotal, Ø, "2 Ausgaben ohne Beleg", Top-5 mit drei Zeilen. Kein Währungs-Toggle.
3. Eine EUR-Ausgabe dazu → Toggle erscheint, CHF vorausgewählt, Hinweis "Ausgaben in EUR …". EUR wählen → Zahlen wechseln, "ohne Beleg" bleibt.
4. EUR gewählt lassen; im zweiten Fenster (andere Köchin) die EUR-Ausgabe löschen → erstes Fenster springt auf CHF, Toggle verschwindet.
5. Gruppenkonfiguration auf 0 Teilnehmende → Hinweis statt Ø. Zurück auf 24 → Ø erscheint live. Anlass um einen Tag verlängern → "pro Person & Tag" und "7 Lagertage" ändern sich.
6. Klick auf eine Top-5-Zeile → Bearbeiten-Dialog, Betrag ändern, speichern → Top-5 sortiert sich neu.
7. **Mobile (xs, 360 px):** Toolbar bricht sauber um, Kacheln untereinander, lange Bezeichnung in der Top-5-Zeile wird abgeschnitten (`noWrap`), Betrag bleibt sichtbar.

**Definition of Done 6.2a:** `npx tsc --noEmit`, `npx jest expenseStatistics expenseEvaluation expenseTracking --watchAll=false`, `npm run lint` grün; Mutationsproben 1–3 bestätigt; Browser-Rundlauf Desktop **und** Mobile inkl. Zweit-Köchin (Punkt 4).

---

### **Paket 6.2b — Budget-Auswahl für die Auswertung**

#### Worum es geht

Nicht jede Ausgabe gehört zur Küche. Die Küche kauft oft Dinge für das ganze Lager ein (z.B. Material für die Lagerleitung, Spielmaterial), meist in einem eigenen Budget ohne Sollbetrag. Diese Ausgaben müssen erfasst werden, weil sie in die Abrechnung gehören. In der Auswertung verfälschen sie aber die Kennzahlen: Ø pro Teilnehmer:in ist dann nicht mehr "was kostet uns das Essen". → Die Köchin wählt, **welche Budgets in die Auswertung einfliessen**.

```
Budgets:  [✓ 🍳 Küche] [✓ 🛒 Grosseinkauf] [ 🎨 Material ] [ 🏕 Lagerleitung ]
2 von 4 Budgets berücksichtigt
Währung:  [ CHF | EUR ]
… Kacheln wie in 6.2a, aber nur mit Ausgaben aus «Küche» und «Grosseinkauf» …
```

Ein `Chip` pro Budget (Icon + Name). Ausgewählt = `variant="filled" color="primary"`, abgewählt = `variant="outlined"`. Klick schaltet um.

#### Fachliche Entscheidungen

**B1 — Vorauswahl: alle Budgets** (entschieden 2026-10-10). Nichts wird still ausgeblendet. Wer "Material" nicht drin haben will, wählt es einmal ab.

**B2 — Gespeichert pro Gerät im `localStorage`** (entschieden 2026-10-10). Kein Teilen zwischen Köch:innen, keine Migration. Folge, bewusst akzeptiert: Zwei Köch:innen können für dasselbe Lager unterschiedliche Durchschnitte sehen. Reicht das in der Praxis nicht, wäre eine Spalte `event_budgets.include_in_statistics` der saubere nächste Schritt (gleiche Überlegung wie bei den Mahlzeitentypen in 6.5).

**B3 — Gespeichert werden die *abgewählten* Budget-IDs, nicht die ausgewählten.** Das ist die wichtigste Entscheidung dieses Pakets, weil eine einzige Regel drei Fälle ohne Sonderlogik löst:

| Fall | Gespeichert: ausgewählte IDs | Gespeichert: abgewählte IDs |
|---|---|---|
| Nichts gespeichert (erster Besuch, privates Fenster) | Sonderfall "leer heisst alle" nötig | leer = nichts abgewählt = alle ✓ |
| Neues Budget angelegt (auch von anderer Köchin) | fehlt in der Liste → wäre **abgewählt**, widerspricht B1 | nicht in der Liste → ausgewählt ✓ |
| Abgewähltes Budget gelöscht | — | ID bleibt liegen, passt auf nichts, harmlos ✓ |

**B4 — Was der Auswahl folgt und was nicht.**
- **Folgt:** Gesamtausgaben, Ø pro Teilnehmer:in (beide Zeilen), Top-5 **und die Währungsliste** (W1/W2). Die Währungen werden aus den Ausgaben der *ausgewählten* Budgets bestimmt. Sonst steht ein EUR-Toggle da, obwohl alle EUR-Ausgaben in einem abgewählten Budget liegen, und EUR zeigt nur Nullen.
- **Folgt nicht:** "Ohne Beleg". Das ist eine Aufgabe (jede Ausgabe braucht für die Abrechnung einen Beleg), keine Statistik. Auch eine Material-Quittung muss da sein. Untertitel der Kachel darum "alle Budgets und Währungen" statt nur "alle Währungen". Der Sprung in die gefilterte Liste (6.2c) zeigt entsprechend auch alle Budgets.
- **Später:** 6.3–6.5 nutzen dieselbe Auswahl (siehe Umriss unten). Es gibt keine zweite Budget-Auswahl.

**B5 — Reihenfolge der Verarbeitung.** Erst nach Budget filtern, dann Währungen bestimmen, dann nach Währung filtern, dann rechnen:

```ts
const expensesOfSelectedBudgets = React.useMemo(
  () => ExpenseStatistics.excludeBudgets(expenses, excludedBudgetIds),
  [expenses, excludedBudgetIds],
);
const {currencies, defaultCurrency} = React.useMemo(
  () => ExpenseStatistics.getCurrenciesInUse(expensesOfSelectedBudgets),
  [expensesOfSelectedBudgets],
);
// … W4-Ableitung von selectedCurrency, dann das statistics-Memo aus 6.2a,
// das jetzt expensesOfSelectedBudgets statt expenses bekommt
```

Der Rest von 6.2a bleibt unverändert. Er bekommt nur eine kleinere Liste.

**B6 — Leere Zustände** (zusätzlich zu K5 aus 6.2a):
- **Kein Budget ausgewählt** → anstelle der Kacheln: "Wähle mindestens ein Budget aus." Die Chips bleiben sichtbar, damit man es beheben kann.
- **Ausgewählte Budgets haben keine Ausgaben** (andere schon) → anstelle der Kacheln: "In den gewählten Budgets gibt es noch keine Ausgaben." Nicht CHF 0.00 in drei Kacheln.
- **Gar keine Ausgaben** → weiterhin nur der Satz aus K5, ohne Chips (nichts zu wählen).

**B7 — Chips nur ab zwei Budgets.** Bei einem Budget gibt es nichts zu wählen. Die Zeile "2 von 4 Budgets berücksichtigt" erscheint nur, wenn nicht alle ausgewählt sind. Chips in derselben Reihenfolge wie die Budget-Karten in der Übersicht (`state.budgets`).

**B8 — Lesen und Schreiben im `localStorage`.**
- Schlüssel: `${LocalStorageKey.EXPENSE_EVALUATION_EXCLUDED_BUDGETS}_${eventId}` mit neuem Enum-Wert `EXPENSE_EVALUATION_EXCLUDED_BUDGETS = "expenseEvaluationExcludedBudgets"` in `src/constants/localStorage.ts`. Pro Anlass, weil Budget-IDs pro Anlass sind.
- Wert: JSON-Array von Strings.
- **Jeder Zugriff in `try/catch`.** `localStorage` wirft im privaten Modus mancher Browser, bei vollem Speicher oder wenn Cookies blockiert sind. Kaputter Inhalt (`JSON.parse` wirft, oder es ist kein Array von Strings) zählt als "nichts gespeichert". Ein Fehler hier darf nie die Auswertung blockieren, und nach Sentry gehört er auch nicht: Das ist kein Bug, sondern eine Browser-Einstellung.
- **Nicht `LocalStorageHandler`** (`src/components/Shared/localStorageHandler.class.ts`) verwenden: Er fängt keine Fehler, erlaubt nur Objekte (kein Array) und arbeitet mit `any`. → In `tech-debt.md` notieren, nicht hier umbauen.
- **Lesen** einmal beim Mounten über einen Lazy-Initializer `useState(() => readExcludedIds(key))`. *Warum Lazy:* Ohne Funktion würde `localStorage` bei jedem Render gelesen und das Ergebnis weggeworfen.
- **Schreiben** im Klick-Handler, nicht in einem `useEffect` auf den State. *Warum:* Gespeichert wird nur, was die Köchin bewusst geändert hat. Ein Effekt würde schon beim ersten Render die leere Vorauswahl zurückschreiben.

**B9 — Ein kleiner, wiederverwendbarer Hook.** `useStoredIdSet(storageKey: string)` → `{ids: Set<string>, toggleId: (id: string) => void}` in `src/components/Shared/useStoredIdSet.ts`. Er weiss nichts von Budgets, nur "eine Menge von IDs unter diesem Schlüssel". *Warum generisch:* 6.5 braucht dasselbe für die Mahlzeitentypen (dort ebenfalls "abgewählte" speichern, B3 gilt genauso). Gebaut wird trotzdem nur, was 6.2b braucht, keine Extra-Optionen auf Vorrat.

Bekannte Grenze: Ändert sich `storageKey` bei montierter Komponente, liest der Hook nicht neu. Kommt nicht vor, weil ein anderer Anlass die ganze Seite neu montiert. In der JSDoc vermerken.

#### Schnittstellen

`expenseStatistics.class.ts`, neue Methode:

```ts
/** Ausgaben ohne die abgewählten Budgets (B3). Gibt eine neue Liste zurück. */
static excludeBudgets(expenses: ExpenseDomain[], excludedBudgetIds: Set<string>): ExpenseDomain[];
```

`ExpenseEvaluation` bekommt zusätzlich `eventId: string` (für den Speicherschlüssel). Die Budgets hat sie seit 6.2a schon.

#### Texte

| Konstante | Text |
|---|---|
| `EVALUATION_BUDGETS` | "Budgets" (Beschriftung + `aria-label` der Chip-Gruppe) |
| `EVALUATION_BUDGETS_SELECTED(selected: number, total: number)` | "2 von 4 Budgets berücksichtigt" |
| `EVALUATION_NO_BUDGET_SELECTED` | "Wähle mindestens ein Budget aus." |
| `EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS` | "In den gewählten Budgets gibt es noch keine Ausgaben." |
| `EVALUATION_ALL_CURRENCIES` (aus 6.2a) | wird zu "alle Budgets und Währungen" |

Barrierefreiheit: Jeder Chip bekommt `aria-pressed={isSelected}`. So hört ein Screenreader "ausgewählt / nicht ausgewählt", die Farbe allein reicht nicht.

#### Dateien 6.2b

| Datei | Änderung |
|---|---|
| `src/components/Shared/useStoredIdSet.ts` (neu) | Hook inkl. `try/catch` und Validierung |
| `src/constants/localStorage.ts` | `EXPENSE_EVALUATION_EXCLUDED_BUDGETS` |
| `expenseStatistics.class.ts` | `excludeBudgets` |
| `expenseEvaluation.tsx` | Chips, Prop `eventId`, Reihenfolge B5, leere Zustände B6 |
| `expenseTracking.tsx` | `eventId={event.uid}` durchreichen |
| `src/constants/text/expenseTracking.ts` | Texte oben |
| `.claude/docs/tech-debt.md` | `LocalStorageHandler` ohne Fehlerbehandlung, nur Objekte, `any` |
| `src/components/Shared/__tests__/useStoredIdSet.test.ts` (neu) | Hook |
| `__tests__/expenseStatistics.class.test.ts`, `__tests__/expenseEvaluation.test.tsx` | erweitern |

#### Tests 6.2b

`useStoredIdSet.test.ts` (mit `renderHook` aus `@testing-library/react`; in `beforeEach` `localStorage.clear()`):
- nichts gespeichert → leere Menge
- gespeichertes `["a","b"]` → Menge mit a und b
- kaputtes JSON (`"{nicht json"`) → leere Menge, kein Fehler
- gültiges JSON, aber kein String-Array (`{"a":1}`, `[1,2]`) → leere Menge
- `getItem` wirft (`jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); })`) → leere Menge; danach `mockRestore()`
- `setItem` wirft → `toggleId` ändert den State trotzdem (Auswahl gilt für diese Sitzung), kein Fehler
- `toggleId("a")` zweimal → zuerst drin und gespeichert, dann weg und gespeichert
- unterschiedliche Schlüssel beeinflussen sich nicht (Anlass A vs. B)

`expenseStatistics.class.test.ts`, `excludeBudgets`:
- leere Menge → alle Ausgaben
- ein Budget ausgeschlossen → dessen Ausgaben fehlen, Rest unverändert
- unbekannte ID in der Menge (gelöschtes Budget) → keine Wirkung

`expenseEvaluation.test.tsx` (zwei Budgets: Küche CHF, Material CHF + EUR):
- ein Budget → keine Chips
- Material abwählen → Gesamttotal nur noch Küche, Top-5 ohne Material-Zeilen
- Material abwählen → EUR-Toggle verschwindet (B4, Währungen aus der Auswahl)
- Material abwählen → "Ohne Beleg" unverändert
- beide abwählen → "Wähle mindestens ein Budget aus.", Chips noch da
- nur ein Budget ohne Ausgaben gewählt → "In den gewählten Budgets …"
- im `localStorage` vorab Material als abgewählt eingetragen → beim Rendern bereits abgewählt
- neues Budget in den Props (Rerender), das nicht im Speicher steht → ausgewählt (B3)

#### Mutationsproben 6.2b

1. Im Hook *ausgewählte* statt abgewählte IDs behandeln (Logik in `excludeBudgets` umdrehen) → Test "neues Budget ist ausgewählt" muss rot werden.
2. `try/catch` um `getItem` entfernen → Test "`getItem` wirft" muss rot werden.
3. In `ExpenseEvaluation` `getCurrenciesInUse(expenses)` statt `(expensesOfSelectedBudgets)` → Test "EUR-Toggle verschwindet" muss rot werden.

#### Im Browser ansehen

1. Vier Budgets, Ausgaben in allen. "Material" abwählen → Zahlen ändern sich, darunter "3 von 4 Budgets berücksichtigt".
2. Seite neu laden → Material bleibt abgewählt.
3. Zweites Fenster (andere Köchin, anderes Gerät/Profil) → dort ist alles ausgewählt (B2, gewollt).
4. Im zweiten Fenster ein neues Budget mit Ausgabe anlegen → im ersten Fenster erscheint es **ausgewählt**.
5. Abgewähltes Budget leeren und löschen → kein Fehler, Chip verschwindet.
6. Privates Fenster → funktioniert, Auswahl gilt bis zum Schliessen bzw. bis zum Neuladen.
7. DevTools → Application → Local Storage: Schlüssel enthält die `eventId`, Wert ist ein Array der abgewählten IDs.
8. **Mobile (xs):** Chips brechen um, keine horizontale Scrollleiste, Tippziele gross genug.

**Definition of Done 6.2b:** `npx tsc --noEmit`, `npx jest useStoredIdSet expenseStatistics expenseEvaluation --watchAll=false`, `npm run lint` grün; Mutationsproben 1–3 bestätigt; Browser-Rundlauf Desktop **und** Mobile, Punkte 2–4 ausdrücklich.

---

### **Paket 6.2c — Filter "Nur ohne Beleg"**

#### Was passiert

Klick auf die Kachel "Ohne Beleg" (nur wenn Anzahl > 0) → Ansicht wechselt auf "Ausgaben", über der Liste steht ein `Chip` "Nur ohne Beleg ✕", die Liste zeigt nur Ausgaben ohne Beleg. Klick auf ✕ oder Wechsel in eine andere Ansicht → Filter weg.

#### Fachliche Entscheidungen

**F1 — Wo der Filter-Zustand lebt.** `const [showOnlyMissingReceipts, setShowOnlyMissingReceipts] = React.useState(false)` in der **Seite**. *Warum dort:* Zwei Geschwister-Komponenten brauchen ihn: `ExpenseEvaluation` setzt ihn (Klick auf die Kachel), `ExpenseList` zeigt das Ergebnis. Der gemeinsame Elternteil ist die Seite ("lifting state up"). Nicht in der URL: Der Filter ist ein kurzer Arbeitsschritt, kein Link, den man teilt.

**F2 — Wo gefiltert wird.** **Vor** dem Gruppieren, im bestehenden `expenseGroups`-Memo (`expenseTracking.tsx:279`):

```ts
const expenseGroups = React.useMemo<ExpenseGroup[]>(() => {
  const visibleExpenses = showOnlyMissingReceipts
    ? (state.expenses ?? []).filter((expense) => expense.attachmentPath === null)
    : (state.expenses ?? []);
  return Expense.groupByBudget(visibleExpenses, state.budgets ?? []);
}, [state.expenses, state.budgets, showOnlyMissingReceipts]);
```

*Warum vor dem Gruppieren und nicht in `ExpenseList`:* `groupByBudget` rechnet die Summen im Gruppenkopf. Filtert man danach, stünde im Kopf "Küche CHF 1'500" über zwei Zeilen à CHF 20. Filtert man davor, passen Kopf und Zeilen zusammen. Budget-Gruppen ohne passende Ausgaben verschwinden von selbst, weil `ExpenseList` leere Gruppen schon heute ausblendet (`expenseList.tsx`, `groupsWithExpenses`).

*Warum `ExpenseList` den Filter nicht kennt:* Sie bleibt reine Darstellung ("berechnet selbst nichts", steht in ihrer JSDoc). Sie bekommt nur einen anderen Leertext (F4).

**F3 — Zurücksetzen.** In `handleViewChange`: `setShowOnlyMissingReceipts(false)` bei jedem Ansichtswechsel. Die Kachel ruft eine neue Funktion `handleShowMissingReceipts` auf, die **zuerst** die Ansicht wechselt und **dann** den Filter setzt, beide im selben Event-Handler (React fasst beide `setState` zu einem Render zusammen, kein Flackern).

**F4 — Gefiltert, aber leer.** Die letzte fehlende Quittung wird hochgeladen, während der Filter aktiv ist → Liste leer. Text dann nicht "Noch keine Ausgaben." (falsch), sondern "Alle Ausgaben haben einen Beleg." `ExpenseList` bekommt dafür eine optionale Prop `emptyText?: string` mit dem bisherigen Text als Standard. Der Filter bleibt aktiv, bis man ihn entfernt; so sieht man, dass die Arbeit erledigt ist.

**F5 — "Neue Ausgabe" bei aktivem Filter.** Bleibt möglich. Eine neue Ausgabe ohne Beleg erscheint in der gefilterten Liste, eine mit Beleg nicht. Richtig so, kein Sonderfall.

**F6 — Kachel klickbar machen.** `CardActionArea` um den Inhalt der Kachel, nur wenn Anzahl > 0. Bei 0 gibt es nichts zu filtern; eine klickbare Kachel, die zu einer leeren Liste führt, wäre verwirrend. `ExpenseEvaluation` bekommt dafür die Prop `handleShowMissingReceipts: () => void`.

#### Dateien 6.2c

| Datei | Änderung |
|---|---|
| `expenseTracking.tsx` | State, `expenseGroups`-Memo, `handleViewChange`, `handleShowMissingReceipts`, `Chip` über der Liste |
| `expenseEvaluation.tsx` | Prop `handleShowMissingReceipts`, `CardActionArea` |
| `expenseList.tsx` | optionale Prop `emptyText` |
| `src/constants/text/expenseTracking.ts` | `FILTER_ONLY_MISSING_RECEIPTS` ("Nur ohne Beleg"); für den Leertext `EVALUATION_ALL_RECEIPTS_PRESENT` wiederverwenden |
| Tests | siehe unten |

#### Tests 6.2c

`expenseTracking.test.tsx` (neues `describe("Filter: nur ohne Beleg")`; Ausgaben mit und ohne `attachmentPath` in **zwei** Budgets):
- Klick auf Kachel → Ansicht "Ausgaben", Chip sichtbar, nur Zeilen ohne Beleg
- Gruppenkopf zeigt die Summe **nur der sichtbaren** Ausgaben
- Budget, dessen Ausgaben alle einen Beleg haben → Gruppenkopf nicht sichtbar
- ✕ am Chip → alle Ausgaben wieder sichtbar
- Wechsel auf "Übersicht" und zurück auf "Ausgaben" → Filter weg
- gefiltert und keine Treffer → "Alle Ausgaben haben einen Beleg."

`expenseEvaluation.test.tsx`:
- Anzahl > 0: Klick ruft `handleShowMissingReceipts`
- Anzahl 0: kein klickbares Element (`queryByRole("button", {name: …})` ist `null`)

`expenseList.test.tsx`:
- ohne `emptyText` → bisheriger Text (Regressionsschutz); mit → der übergebene

#### Mutationsproben 6.2c

1. Filter in `expenseGroups` **nach** `groupByBudget` statt davor anwenden (Gruppen-Expenses filtern) → Test "Gruppenkopf zeigt Summe der sichtbaren Ausgaben" muss rot werden.
2. `setShowOnlyMissingReceipts(false)` aus `handleViewChange` entfernen → Test "Wechsel setzt Filter zurück" muss rot werden.
3. `showOnlyMissingReceipts` aus den `useMemo`-Dependencies entfernen → Test "Klick auf Kachel filtert" muss rot werden. (Hier lässt sich die Dependency per Jest prüfen, anders als in 6.1, weil der Filter über einen Klick in derselben Seite gesetzt wird.)

#### Im Browser ansehen

1. Auswertung → Kachel "3 Ausgaben ohne Beleg" anklicken → Ausgabenliste mit Chip, drei Zeilen, Gruppenköpfe stimmen.
2. Eine davon öffnen, Beleg hochladen, speichern → Zeile verschwindet aus der gefilterten Liste.
3. Die letzten zwei ebenso → "Alle Ausgaben haben einen Beleg."
4. Zweites Fenster: neue Ausgabe ohne Beleg erfassen → erscheint im ersten Fenster in der gefilterten Liste.
5. Chip ✕ → volle Liste. Erneut filtern, auf "Übersicht" wechseln, zurück auf "Ausgaben" → ungefiltert.
6. **Mobile (xs):** Chip und Toolbar überlagern sich nicht, Chip-✕ gross genug zum Tippen.

**Definition of Done 6.2c:** `npx tsc --noEmit`, `npx jest expenseEvaluation expenseList expenseTracking --watchAll=false`, `npm run lint` grün; Mutationsproben 1–3 bestätigt; Browser-Rundlauf Desktop **und** Mobile inkl. Zweit-Köchin.

---

#### Typische Stolperfallen (aus Epic 1–6.1 gesammelt)

- **`Array.prototype.sort` sortiert in place.** `state.expenses` direkt zu sortieren verändert den Reducer-State und damit die Reihenfolge in der Liste. Immer `[...array].sort(…)`.
- **Geschütztes Leerzeichen in Beträgen.** `formatAmountFromCents` liefert "CHF 1’200.00" mit ` `; im Test `expectedAmount` verwenden (Lehre 6.1).
- **`useMemo`-Dependencies.** Jeder Wert, der in der Funktion gelesen wird, gehört in die Liste. `participantCount` vergessen → Ø bleibt nach Änderung der Gruppenkonfiguration stehen.
- **Rules of Hooks.** Der leere Zustand (K5) ist ein früher `return`. Alle `useState`/`useMemo` müssen **davor** stehen. ESLint merkt es in diesem Projekt nicht, es stürzt erst zur Laufzeit ab, sobald die erste Ausgabe erfasst wird (Pre-Commit-Checkliste).
- **Währung im Test.** Mock-Ausgaben sind CHF. Für Mehrwährungs-Tests `currency` explizit setzen, sonst testet man aus Versehen nur den Ein-Währungs-Fall.
- **`localStorage` kann werfen** (6.2b). Nicht nur kaputtes JSON, auch der Zugriff selbst. Immer `try/catch`, nie Sentry.
- **Kein Analytics-Event für Ansichtswechsel.** Die bestehenden Toggles tracken auch nichts. Falls gewünscht: eigenes Thema, nicht in dieser Story.

#### Helpcenter

Wie bei 6.1: Absatz "Auswertung" (welche Kennzahlen, Budget-Auswahl pro Gerät, Währungsauswahl, Filter ohne Beleg) wird gesammelt am Ende von Epic 6 geschrieben.

#### Entschieden (2026-10-10)

- **O1** — "Ø pro Person & Tag": **ja**, geteilt durch alle Lagertage, beschriftet mit "bisher" (K2).
- **O2** — Top-5-Zeilen öffnen den Bearbeiten-Dialog: **ja** (K4).
- **O3** — Ohne Ausgaben ein Satz statt Kacheln mit Nullen: **ja** (K5).
- **Budget-Auswahl** (Nutzer-Ergänzung): neues Paket 6.2b. Alle Budgets vorausgewählt, Auswahl pro Gerät im `localStorage`.

---

### Story 6.3 – 6.5 (Umriss, wird vor Start ausdetailliert)

- **6.3 — Ausgabenverlauf.** `npm install @mui/x-charts@^7.29` (Entscheidung 7). `ExpenseStatistics.cumulativeByCampDay({expenses, budget | null, currency, campDays})` → eine Zahl pro Lagertag. Ausgaben vor dem Lager fliessen in Tag 1, Ausgaben in Zeitscheiben-Lücken in den nächsten Lagertag, Ausgaben nach Lagerende in den letzten Tag (sonst fehlen sie in der kumulierten Summe). Soll-Linie: `Soll × Tag / Lagertage`, siehe Budget-Auswahl unten. Ist-Linie nur bis heute (danach `null`, damit die Linie nicht flach in die Zukunft läuft). Keine eigene Budget-Auswahl mehr: Das Diagramm nutzt die Auswahl aus 6.2b; die Soll-Linie ist die Summe der Sollbeträge der *ausgewählten* Budgets in der gewählten Währung. Jest-Mock für das Diagramm, auch in `expenseTracking.test.tsx` (Entscheidung 8).
- **6.4 — Verteilung nach Budget.** `ExpenseStatistics.shareByBudget(expenses, budgets, currency)` → `{budgetId, name, amountInCents}[]`, Budgets ohne Ausgaben weggelassen, absteigend. `PieChart` mit `innerRadius` (Donut), Legende unter dem Diagramm auf Mobile. Farben aus dem MUI-Theme, nicht hart codiert.
- **6.5 — Ø pro Mahlzeit.** `event.tsx` reicht `state.menuplan` als Prop durch. Entschieden (2026-10-10):
  - **Problem:** Hauptmahlzeiten (Zmorge, Zmittag, Znacht) und kleine Mahlzeiten (Zvieri, Dessert …) kosten sehr unterschiedlich viel. Ein Durchschnitt über alle wäre verzerrt. Mahlzeitentyp-Namen sind freier Text pro Anlass.
  - **Lösung: Die Köchin wählt, welche Mahlzeitentypen zählen.** Die Kachel zeigt alle Mahlzeitentypen des Menüplans (`menuplan.mealTypes`, in Menüplan-Reihenfolge) als auswählbare `Chip`s. Vorauswahl: **alle ausgewählt**.
  - **Bewusst nicht** über `meal_type_cutoff_times` vorausgewählt: Die Tabelle dient dem Home-Widget (Relevanz nach Uhrzeit), enthält auch kleine Mahlzeiten (`Dessert`) und trifft häufige Namen nicht (lokal heisst "Zmorgen" in 20 von 25 Anlässen so, die Tabelle kennt nur "Zmorge"/"Frühstück"). Eine Admin-Änderung dort würde sonst still die Kennzahl ändern.
  - **Mahlzeit** = eine `Meal` (Datum × Mahlzeitentyp) eines ausgewählten Typs mit mindestens einem eingeplanten Rezept. Leere Slots zählen nicht.
  - **Zwei Zahlen:** "Ø pro Mahlzeit" (Total ÷ Anzahl Mahlzeiten) und "Ø pro Person und Mahlzeit" (Total ÷ (Mahlzeiten × `groupConfiguration.totalPortions`)). Die zweite ist zwischen Lagern vergleichbar.
  - **Auswahl merken:** pro Anlass im `localStorage` (Key mit `eventId`). Reine Ansichtseinstellung pro Gerät, wird nicht zwischen Köch:innen geteilt, keine Migration. Zugriffe in `try/catch`; ohne Speicher gilt die Vorauswahl. Gemerkte Typ-UIDs, die es im Menüplan nicht mehr gibt, werden ignoriert. Neue Typen sind standardmässig ausgewählt. Reicht das in der Praxis nicht, wäre ein Flag "Hauptmahlzeit" auf `event_meal_types` der saubere nächste Schritt (Migration + Menüplan-UI).
  - **Reine Funktion:** `ExpenseStatistics.countPlannedMeals(menuplan, selectedMealTypeUids)` mit Tests (leere Slots, nicht ausgewählte Typen, keine Typen ausgewählt → 0).
  - Ohne geplante Mahlzeiten, ohne ausgewählten Typ oder ohne Teilnehmende → Hinweis statt Zahl (Entscheidung 10).
  - **Für welches Budget?** Erledigt durch 6.2b: Gerechnet wird über die ausgewählten Budgets. Wer nur das Essen sehen will, wählt die übrigen ab. Für die gemerkten Mahlzeitentypen `useStoredIdSet` aus 6.2b wiederverwenden (auch dort die *abgewählten* speichern).

## Zwischenschritt vor Epic 7 — Ordner `ExpenseTracking/` nach Unterthema aufteilen

**Erst nach Abschluss von Epic 6, vor dem ersten Paket von Epic 7** (entschieden 2026-10-10). Grund: Epic 7 bringt mehrere Dateien auf einmal (Datenaufbereitung, PDF-Dokument, Dialog), danach wird der flache Ordner unübersichtlich.

- **Nach Unterthema, nicht nach Dateityp** (kein `types/`, `classes/`, `ui/`): Was zusammen geändert wird, liegt zusammen; die Endung (`.class.ts`, `.types.ts`, `.tsx`) zeigt den Typ schon.
- Zielstruktur:
  ```
  ExpenseTracking/
    expenseTracking.tsx, useExpenseTrackingData.ts, expenseTracking.reducer.ts
    Budget/      budget.class.ts, budget.types.ts, budgetCard.tsx, budgetDetailDialog.tsx, budgetIcons.ts
    Expense/     expense.class.ts, expense.types.ts, expenseList.tsx, expenseDetailDialog.tsx, payeeBalanceAccordion.tsx
    Evaluation/  expenseStatistics.class.ts, expenseEvaluation.tsx
    Report/      (Epic 7, PDF)
    Export/      (Epic 8, CSV/ZIP)
  ```
  `__tests__/` und `__mocks__/` wandern jeweils mit in den Unterordner.
- **Reines Verschieben** wie Paket 2.1: `git mv`, Importe nachziehen, keine Verhaltensänderung, ein Commit (`refactor(abrechnung): …`). Danach `npx tsc --noEmit`, `npx jest ExpenseTracking --watchAll=false`, `npm run lint` grün; Importe von ausserhalb prüfen (`grep -rn "ExpenseTracking/" src`).
- `architecture.md` um den Hinweis ergänzen, dass grosse Feature-Ordner nach Unterthema aufgeteilt werden.
- **Styles und Texte werden hier *nicht* geordnet**, sondern einmal am Ende in Epic 10 (entschieden 2026-10-11, siehe dort). Bis dahin neue Einträge in beiden Dateien als Block pro Epic mit Kopfkommentar anhängen (z.B. `// PDF-Abrechnung (Epic 7)`), damit das spätere Ordnen einfach bleibt.

## Epic 7 — PDF-Abrechnung

_Wird vor Start verfeinert. Grober Zuschnitt:_

- **Vorab (vor Verfeinerung):** Zwischenschritt «Ordner aufteilen» oben erledigt? Sonst zuerst das.
- **Idee aus 2026-10-10, beim Verfeinern entscheiden:** PDF-Erstellung als Aktion statt als vierte Ansicht. Button bzw. Menü "Exportieren" (PDF, später CSV/ZIP aus Epic 8) in der Toolbar, öffnet einen Dialog (Modus → Kommentare ja/nein → Adresse/IBAN falls fehlend → generieren). Zusätzlich Abkürzung pro Person im `PayeeBalanceAccordion` ("Abrechnung für … erstellen"). Eine eigene Ansicht nur, falls eine "Bereit für die Abrechnung?"-Übersicht (pro Person: Summe, fehlende Belege, IBAN vorhanden) gewünscht wird.

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
- **10.x Styles und Texte ordnen** (entschieden 2026-10-11): einmal am Ende, wenn alle Einträge aus Epic 7–9 bekannt sind; vorher wäre es doppelte Arbeit. Je Datei ein eigener Commit (`refactor(abrechnung): …`), **reines Umsortieren, Umbenennen und Löschen von Unbenutztem, keine Werte ändern**. `tsc` findet jede vergessene Umbenennung.
  - **Gemeinsame Abschnitte** für beide Dateien, in der Reihenfolge der Bildschirme (und passend zu den Unterordnern): Seite/Toolbar · Budget-Karte inkl. Hochrechnung · Budget-Dialog · Ausgabenliste · Ausgaben-Dialog (Formular, zahlende Instanz, Beleg) · Zahlende Instanz/Übersicht · Auswertung · PDF-Abrechnung · Export. Kopfkommentar im bestehenden Format (`/* ---- // Titel // ---- */` wie in `src/constants/styles.ts` bzw. `/* ==== */` wie oben in der Textdatei).
  - **Styles** (`src/constants/styles/expenseTracking.styles.ts`): Präfix vereinheitlichen `statistics*` → `evaluation*` (heute zwei Präfixe für dieselbe Ansicht); `budgetProjection*` zur Budget-Karte (liegt heute am Dateiende); innerhalb eines Abschnitts Container vor Kindern, Varianten (`…Selected`, `…Over`) direkt nach dem Grundstil. Prüfen: Anzahl Einträge vorher = nachher (`grep -cE "^  [a-zA-Z]+:" …`), Sichtprüfung aller Ansichten im Browser.
  - **Texte** (`src/constants/text/expenseTracking.ts`): Präfixe pro Bereich vereinheitlichen, z.B. `NO_EXPENSES_FOR_STATS` → `EVALUATION_NO_EXPENSES`, `DAY_X_OF_Y_IN_EVENT` → `PROJECTION_DAY_X_OF_Y`. Unbenutzte Konstanten löschen (Stand 2026-10-11: `BELEG`, `DELETE_BELEG` — zugleich deutsche Bezeichner und Duplikate von `EXPENSE_RECEIPT`/`REMOVE_EXPENSE_RECEIPT` — sowie `BUDGET_TYPE_PER_PERSON_PER_DAY_AMOUNT`). Prüfskript für Unbenutztes: jede exportierte Konstante per `grep -rnw` ausserhalb der Datei suchen. Texte, die auch in `src/constants/text/` anderer Bereiche vorkommen (`CANCEL`, `SAVE` …), bleiben dort.
  - **Grösse prüfen:** Ist eine der beiden Dateien danach über ca. 500 Zeilen, entlang der Abschnitte aufteilen (z.B. `expenseTrackingBudget.styles.ts`, `…Evaluation…`). Darunter bleibt es je eine Datei.
- 10.2 Finaler PR gegen `develop` + Release-Notes-Text.

---

## Nach dem Deploy auf TEST: Rebase auf `develop`

Hintergrund: Der Commit «feat(dialog): destruktive Bestätigungen rot und mit Fokus auf Abbrechen» liegt doppelt vor: als PR #243 (`feature/destructive-confirm-dialog` → `develop`) und per Cherry-pick auf diesem Branch (`8ab3191`), weil Zahlungsangaben, Budget und Ausgabe das Flag `destructive` schon brauchen.

- [ ] Voraussetzung: PR #243 ist in `develop` gemergt und auf TEST deployt.
- [ ] Auf TEST prüfen: Löschdialog öffnen → «Abbrechen» hat den Fokus, Enter schliesst ohne zu löschen. (Im lokalen Dev-Build landet der Fokus wegen React StrictMode auf dem Dialog-Container, siehe PR #243.)
- [ ] `git fetch origin && git rebase origin/develop` auf `feature/expense-tracking`. Git erkennt den inhaltsgleichen Dialog-Commit und lässt die Cherry-pick-Kopie automatisch weg (Meldung «skipped previously applied commit»). Gilt auch bei Squash-Merge von #243, da der PR nur diesen einen Commit enthält.
- [ ] Danach `npx tsc --noEmit`, `npm run lint`, `npx jest --watchAll=false`; Branch war schon gepusht → `git push --force-with-lease`.
- [ ] Worktree aufräumen: `git worktree remove ../chuchipirat-destructive-dialog` und `git branch -d feature/destructive-confirm-dialog`.

**Wichtig:** Der Rebase muss **vor** dem finalen PR (10.2) passieren (CLAUDE.md: vor jedem PR auf `develop` rebasen). Ist #243 bis dahin noch nicht gemergt, bleibt der Commit einfach im finalen PR mit drin. Das ist unschädlich, nur nicht ganz sauber.

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
