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

## Epic 3 — Zahlende Instanz

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
