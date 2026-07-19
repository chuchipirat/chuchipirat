-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: donations_amount_in_cents_check erlaubte jeden Betrag > 0 — der
-- CHF-5.00-Mindestbetrag wurde nur im Frontend und in create-donation
-- geprüft, nie auf DB-Ebene (DO-006 ging fälschlicherweise von
-- "amount_in_cents >= 500" als bestehendem CHECK-Constraint aus).
-- Ohne DB-Constraint kann jeder direkte INSERT (Admin-Skript, zukünftiger
-- Code-Pfad, manueller Test) Spenden unterhalb des Minimums erzeugen.
--
-- Bestehende Zeilen unterhalb des neuen Minimums werden zuerst entfernt,
-- da ein ADD CONSTRAINT sonst an bereits vorhandenen Verletzungen scheitert
-- (z.B. Testzeilen aus DO-006 selbst).
-- ─────────────────────────────────────────────────────────────────────────────

DELETE FROM public.donations WHERE amount_in_cents < 500;

ALTER TABLE public.donations DROP CONSTRAINT donations_amount_in_cents_check;
ALTER TABLE public.donations ADD CONSTRAINT donations_amount_in_cents_check
  CHECK (amount_in_cents >= 500);
