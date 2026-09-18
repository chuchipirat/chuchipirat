-- =============================================================================
-- Neue Funktionalität: Abrechnung
--
-- Ergänzt event_budgets um ein Icon zur visuellen Unterscheidung der Budgets
-- (z.B. Küche, Transport, Material) auf der Abrechnung-Übersicht.
-- =============================================================================

CREATE TYPE public.budget_icon AS ENUM (
  'kitchen',
  'groceries',
  'beverages',
  'kiosk',
  'theme',
  'material',
  'transport',
  'accommodation',
  'activities',
  'safety',
  'cleaning',
  'other'
);

ALTER TABLE public.event_budgets
  ADD COLUMN icon public.budget_icon;

-- Bereits bestehende Budgets (z.B. das automatisch angelegte "Küche"-Budget
-- aus Paket 1.2) rückwirkend mit einem Icon versehen, bevor NOT NULL erzwungen wird.
UPDATE public.event_budgets SET icon = 'kitchen' WHERE name = 'Küche' AND icon IS NULL;
UPDATE public.event_budgets SET icon = 'other' WHERE icon IS NULL;

ALTER TABLE public.event_budgets
  ALTER COLUMN icon SET NOT NULL;
