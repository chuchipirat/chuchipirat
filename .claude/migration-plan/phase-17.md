## Donation Flow — Payrexx Integration

### Context

Replace the current simple donate page (static text + RaiseNow TWINT link) with a full Payrexx-integrated donation flow. The current page (`src/components/Donate/donate.tsx`) just shows a QR code and an external TWINT link via RaiseNow. The new flow adds: in-app amount selection, Payrexx payment gateway (TWINT, Apple Pay, cards), webhook-driven status tracking, feed entries, receipt PDF download (already exists as `EventReceiptPdf`), and an admin overview.

**Scope decisions:**

- **Auth-only** — no anonymous donations
- **Placement:** standalone `/donate` page + Event Create Wizard completion step
- **Include donation goal widget** (stacked progress bar) in v1
- **Delete RaiseNow/TwintButton** entirely (Payrexx handles TWINT)
- **Admin view** included
- **Goal sections:** stored in DB config table (N sections, admin-manageable), not hardcoded

**Existing code to reuse:**

| File                                                      | What to reuse                                              |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `src/components/Event/Event/eventRecipePdf.tsx`           | Existing receipt PDF — adapt for new `DonationDomain` type |
| `src/components/Event/Event/receipt.class.ts`             | Current Firebase receipt structure — read by migration job |
| `supabase/volumes/functions/_shared/emailService.ts`      | Email sending (Brevo/SMTP)                                 |
| `src/components/Admin/MigrationJobs/EventMigrationJob.ts` | Migration job pattern                                      |
| `src/components/Database/Repository/BaseRepository.ts`    | Repository base class                                      |
| `src/components/Database/Repository/FeedRepository.ts`    | Feed entry creation pattern                                |
| `src/components/Shared/feed.class.ts`                     | Feed type enum + text generation                           |
| `src/constants/pdfTokens.ts`                              | PDF design tokens                                          |
| `src/constants/stylesEventReceiptPdf.ts`                  | Existing receipt PDF styles                                |

---

### Phase 1: Database Migrations

#### 1a. Donations table + ENUM

> [!info] File
> `supabase/migrations/20260323000001_create_donations.sql`

```sql
CREATE TYPE public.donation_status AS ENUM (
  'pending', 'confirmed', 'failed', 'cancelled', 'refunded', 'migrated'
);

CREATE TABLE public.donations (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_id               TEXT REFERENCES public.events(id) ON DELETE SET NULL,

  payrexx_gateway_id     TEXT,
  payrexx_reference_id   TEXT,
  payrexx_transaction_id TEXT,

  amount_in_cents        INTEGER NOT NULL CHECK (amount_in_cents >= 500),
  currency               TEXT NOT NULL DEFAULT 'CHF',
  status                 public.donation_status NOT NULL DEFAULT 'pending',
  payment_method         TEXT,
  paid_at                TIMESTAMPTZ,

  donor_uid              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donor_message          TEXT CHECK (char_length(donor_message) <= 200),

  receipt_number         TEXT UNIQUE,
  receipt_sent_at        TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Triggers
CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_donations_updated_by BEFORE UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- Indexes
CREATE INDEX idx_donations_payrexx_ref ON public.donations(payrexx_reference_id);
CREATE INDEX idx_donations_event_id ON public.donations(event_id);
CREATE INDEX idx_donations_donor_uid ON public.donations(donor_uid);
CREATE INDEX idx_donations_status ON public.donations(status);

-- RLS
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY donations_insert_own ON public.donations
  FOR INSERT TO authenticated WITH CHECK (donor_uid = auth.uid() AND status = 'pending');
CREATE POLICY donations_select_own ON public.donations
  FOR SELECT TO authenticated USING (donor_uid = auth.uid());
CREATE POLICY donations_select_event_cooks ON public.donations
  FOR SELECT TO authenticated
  USING (event_id IS NOT NULL AND status = 'confirmed' AND is_event_cook(event_id));
CREATE POLICY donations_select_admin ON public.donations
  FOR SELECT TO authenticated USING (is_admin());

-- Receipt sequence + generator
CREATE SEQUENCE public.donation_receipt_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_donation_receipt_number()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'DON-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
         LPAD(nextval('public.donation_receipt_seq')::TEXT, 4, '0');
$$;
```

Key change vs. original plan: no `donor_email`, `donor_name`, `firebase_uid` columns. Donor info is JOINed from `users` via `donor_uid`. No Firebase UID needed.

#### 1b. Donation goal sections table

> [!info] File
> `supabase/migrations/20260323000002_create_donation_goal_sections.sql`

```sql
CREATE TABLE public.donation_goal_sections (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  label       TEXT NOT NULL,                    -- e.g. "Infrastruktur", "Verein"
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  year        INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.donation_goal_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY goal_sections_select ON public.donation_goal_sections
  FOR SELECT USING (true);  -- everyone can see goals (for the widget)
CREATE POLICY goal_sections_admin_write ON public.donation_goal_sections
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON public.donation_goal_sections TO authenticated;

-- Triggers
CREATE TRIGGER trg_donation_goal_sections_updated_at BEFORE UPDATE ON public.donation_goal_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_donation_goal_sections_updated_by BEFORE UPDATE ON public.donation_goal_sections
  FOR EACH ROW EXECUTE FUNCTION update_updated_by();

-- Seed initial sections for 2026
INSERT INTO public.donation_goal_sections (label, target_cents, sort_order, year) VALUES
  ('Infrastruktur', 40000, 1, 2026),
  ('Verein', 20000, 2, 2026);
```

#### 1c. Feed type extension

> [!info] File
> `supabase/migrations/20260323000003_add_feed_type_donation.sql`

```sql
ALTER TYPE public.feed_type ADD VALUE 'donationConfirmed';
```

#### 1d. Donation goal stats RPC

> [!info] File
> `supabase/migrations/20260323000004_donation_goal_stats.sql`

RPC function `get_donation_goal_stats()` returns total confirmed cents + donor count + donation count for the current year. Also update `get_user_profile_stats` to add `noDonations`.

#### 1e. Donations view

> [!info] File
> `supabase/migrations/20260323000005_create_donations_view.sql`

```sql
CREATE VIEW public.donations_view WITH (security_invoker = true) AS
SELECT
  d.*,
  u.display_name AS donor_display_name,
  u.email AS donor_email,
  e.name AS event_name
FROM public.donations d
LEFT JOIN public.users u ON u.auth_uid = d.donor_uid
LEFT JOIN public.events e ON e.id = d.event_id;

GRANT SELECT ON public.donations_view TO authenticated;
```

---

### Phase 2: Edge Functions

#### 2a. `create-donation`

> [!info] File
> `supabase/volumes/functions/create-donation/index.ts`

**Logic:**

1. Verify JWT → extract user uid, email, displayName
2. Parse body: `{ amountInCents, eventId?, message?, returnPath? }`
3. Validate: `amountInCents >= 500`, `message?.length <= 200`, `eventId` exists if provided
4. INSERT into `donations` (`status='pending'`, `donor_uid=user.id`) via user's JWT client
5. Build redirect URLs with `returnPath`: `${APP_URL}/donate/result?status=success|failed|cancel&donationId=${id}&return=${encodeURIComponent(returnPath)}`
6. POST to Payrexx Gateway API with HMAC-SHA256 signature
7. UPDATE donation with `payrexx_gateway_id` (service_role client)
8. Return `{ paymentUrl: gateway.link }`

**Env vars:** `PAYREXX_INSTANCE`, `PAYREXX_API_SECRET`, `APP_URL`

#### 2b. `payrexx-webhook`

> [!info] File
> `supabase/volumes/functions/payrexx-webhook/index.ts`

**Logic:**

1. Parse webhook payload (Payrexx transaction event)
2. Extract `referenceId` (= donation id) → look up donation
3. Verify transaction via `GET /v1.0/Transaction/{id}/` (don't trust webhook alone)
4. **If confirmed:**
   - UPDATE donation: `status`, `paid_at`, `payment_method`, `payrexx_transaction_id`, `receipt_number` (via `generate_donation_receipt_number()`)
   - INSERT feed entry: `feed_type='donationConfirmed'`, `source_object_type='donation'`, `source_object_uid=donation.id`, `source_object_data={amount: amountInCents}`
   - Send confirmation email via `emailService.ts` — personal thank-you with link to event page for receipt download
   - UPDATE `receipt_sent_at`
5. **If failed/cancelled:** UPDATE donation status only
6. **Idempotency:** `WHERE status = 'pending'` prevents double-processing
7. Return 200 OK

#### 2c. Email template

Create inline HTML email template (like existing `send-welcome-email`):

- Subject: "Danke für deine Spende — chuchipirat"
- Personal greeting with donor name
- Amount, date, payment method
- Event name (if event-bound)
- Receipt number
- Link to event page / donation overview to download receipt PDF
- Thank-you message + association details

---

### Phase 3: Repository & Domain Types

#### 3a. Types

> [!info] File
> `src/components/Donate/donation.types.ts`

- `DonationStatus` enum (string values matching Postgres ENUM)
- `DonationDomain` type (camelCase) — no `donorEmail`/`donorName` (JOINed from view)
- `DonationRow` type (snake_case)
- `DonationGoalSection` type
- `DonationGoalStats` type

#### 3b. `DonationRepository`

> [!info] File
> `src/components/Database/Repository/DonationRepository.ts`

Extends `BaseRepository<DonationDomain, DonationRow>`. Reads from `donations_view` (for JOINed donor info), writes to `donations`.

**Methods:**

| Method                       | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `toRow()` / `toDomain()`     | Row ↔ Domain mapping                               |
| `getMyDonations(authUser)`   | Own donations ordered by `created_at DESC`         |
| `getEventDonations(eventId)` | Confirmed for event                                |
| `getAllDonations()`          | Admin view                                         |
| `getDonationGoalStats()`     | Calls RPC `get_donation_goal_stats()`              |
| `getGoalSections(year)`      | Reads from `donation_goal_sections` for given year |

#### 3c. Register in `DatabaseService`

Add `donations: DonationRepository` instance.

---

### Phase 4: Feed Integration

| File                                                   | Change                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `src/components/Shared/feed.class.ts`                  | Add `donationConfirmed` to `FeedType` enum + cases in `getFeedTitle()` / `getFeedText()`               |
| `src/constants/text/`                                  | Add feed title/text strings for donation                                                               |
| `src/components/Database/Repository/FeedRepository.ts` | Add `donationConfirmed` case in `buildTextElements()` — format amount from `source_object_data.amount` |

---

### Phase 5: Frontend Components

#### 5a. `DonationForm.tsx` (new)

> [!info] File
> `src/components/Donate/DonationForm.tsx`

Props: `{ eventId?: string; returnPath?: string }`

- Amount selector: MUI `ToggleButtonGroup` with CHF 5/10/20/50 presets + custom `TextField` (min 5, step 1)
- Optional message `TextField` (maxLength 200, character counter)
- "Jetzt spenden" Button
- Pre-fills donor info from `useAuthUser()` — shown as read-only `Typography` (not editable)
- Calls `supabase.functions.invoke("create-donation", { body: {...} })`
- On success: `window.location.href = paymentUrl`
- Loading state with `Backdrop` + `CircularProgress`

#### 5b. `DonationResult.tsx` (new)

> [!info] File
> `src/components/Donate/DonationResult.tsx`

Reads URL params: `status`, `donationId`, `return`

- **Success:** `CheckCircle` + "Vielen Dank für deine Spende!" + hint that processing may take a moment
- **Failed:** `ErrorOutline` + "Zahlung konnte nicht verarbeitet werden"
- **Cancel:** `Warning` + "Zahlung abgebrochen"
- "Weiter" button navigates to `returnPath` or home

#### 5c. `DonationGoalWidget.tsx` (new)

> [!info] File
> `src/components/Donate/DonationGoalWidget.tsx`

- Fetches goal sections from `donation_goal_sections` table + current year stats from RPC
- Renders N stacked MUI `LinearProgress` segments (one per section), each with its own color
- Shows label + "CHF X von CHF Y" per section
- Total: "CHF X von CHF Z — Jahresziel {year}"
- Goal-reached celebration state
- Fully dynamic: admin can add/remove/reorder sections via DB without code changes

#### 5d. Adapt `EventReceiptPdf`

> [!info] File
> `src/components/Event/Event/eventRecipePdf.tsx`

The existing `EventReceiptPdf` already renders receipts with event name, date, donor name/email, amount. Adapt it to:

- Accept data from the new `DonationDomain` type (instead of the Firebase `Receipt` class)
- Add receipt number to the PDF
- Keep the same visual layout (A5 landscape)

`receipt.class.ts` — will be replaced/removed once migration is complete. For now, keep it for the migration job to read from Firebase.

#### 5e. `DonatePage.tsx` (rewrite)

> [!info] File
> `src/components/Donate/DonatePage.tsx` (replaces `donate.tsx`)

Composition:

```
PageTitle("Spenden", "Merci 1000")
Container(maxWidth="sm")
  DonationGoalWidget
  Card
    CardContent
      Typography (transparency text: why donate, costs breakdown)
      DonationForm(returnPath="/donate")
```

Named export (fix export default convention violation).

#### 5f. Update Event Create Wizard

> [!info] File
> `src/components/Event/Event/createNewEvent.tsx`

In the completion step (~line 649–696): replace `TwintButton` + QR code + `PLEASE_DONATE`/`WHY_DONATE` text with:

```tsx
<DonationForm
  eventId={createdEvent.id}
  returnPath={`/event/${createdEvent.id}`}
/>
```

Remove imports: `TwintButton`, `ImageRepository` `TWINT_QR_CODE` usage.

---

### Phase 6: Routes

| File                                | Change                                                                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/constants/routes.ts`           | Add `DONATE_RESULT = "/donate/result"`, `SYSTEM_OVERVIEW_DONATIONS = "/system/overview/donations"`                               |
| `src/components/App/routeConfig.ts` | Update Donate lazy import → `DonatePage`; add `DonateResult` route (auth-guarded); add `OverviewDonations` route (admin-guarded) |

Navigation menu entry already exists for `/donate` — no changes needed.

---

### Phase 7: Admin Overview

> [!info] File
> `src/components/Admin/Overview/overviewDonations.tsx` (new)

- `EnhancedTable` (existing pattern) with columns: Datum, Betrag, Status, Zahlungsmethode, Spender, Event, Quittung-Nr
- Status/event filter dropdowns
- Summary stats card: total this year, goal progress %, avg donation, unique donors
- Row action: "Quittung erneut senden"

Add card/link to "Spendenübersicht" in `src/components/Admin/system.tsx`.

---

### Phase 8: Migration Job

> [!info] File
> `src/components/Admin/MigrationJobs/DonationMigrationJob.ts` (new)

Following `EventMigrationJob.ts` pattern:

- **`fetchSourceRecords()`:** reads receipt data from Firestore event documents (using existing `Receipt.getReceipt()` / Firebase subcollection)
- **`migrateRecord()`:** for each receipt:
  - Look up `event_id` by Firebase event UID (using `events` table `firebase_uid` or similar mapping)
  - Look up `donor_uid` by Firebase user UID (using `users` table mapping)
  - INSERT into `donations` with `status='migrated'`, `amount_in_cents`, `paid_at`, `payment_method='twint'`
  - Generate receipt number via `generate_donation_receipt_number()` (unified sequence, no old/new distinction)
- **Verify:** count Firestore receipts vs. Postgres donations with `status='migrated'`

Register the new migration job in `src/components/Admin/migration.tsx`.

---

### Phase 9: Cleanup (RaiseNow removal)

#### Delete

- `src/components/Shared/TwintButton.tsx`
- `src/components/Donate/donate.tsx` (replaced by `DonatePage.tsx`)

#### Modify

| File                                                           | Change                                              |
| -------------------------------------------------------------- | --------------------------------------------------- |
| `src/constants/defaultValues.ts`                               | Remove `TWINT_PAYLINK`                              |
| `src/constants/imageRepository.ts`                             | Remove `TWINT_QR_CODE` from all environment configs |
| `src/constants/styles.ts`                                      | Remove `cardMediaQrCode`, `twintButton*` styles     |
| `src/constants/text/events.ts`                                 | Update `WHY_DONATE`, `NEED_A_RECEIPT` text          |
| `src/constants/__tests__/imageRepository.test.ts`              | Remove `TWINT_QR_CODE` assertions                   |
| `src/components/Event/Event/__tests__/createNewEvent.test.tsx` | Update for `DonationForm`                           |

---

### Implementation Order

1. **Phase 1** — Database migrations (`supabase db reset` to verify)
2. **Phase 2** — Edge Functions (test with curl/Postman against Payrexx test mode)
3. **Phase 3** — Repository + types
4. **Phase 4** — Feed integration
5. **Phase 5** — Frontend components (depends on 2+3)
6. **Phase 6** — Routes
7. **Phase 7** — Admin view
8. **Phase 8** — Migration job (can run anytime after Phase 1)
9. **Phase 9** — Cleanup (last, after everything works)

---

### Verification

1. `supabase db reset` — migration chain passes
2. `npm run build` — no compile errors
3. Edge functions: test with curl against Payrexx test mode
4. Full flow: form → Payrexx → redirect → webhook → DB updated → feed → email
5. Goal widget: shows correct aggregate, sections from DB, admin can modify
6. Receipt PDF: downloads from EventInfo with data from new donations table
7. Admin view: all donations visible, filters work, receipt resend works
8. Event wizard: `DonationForm` appears at completion with correct `eventId`
9. Migration job: run against dev Firestore, verify counts match
10. Grep: no TWINT/RaiseNow references remain (except migration plan docs)
11. `npm run test` — all tests pass
12. Responsive check: desktop + mobile viewports
