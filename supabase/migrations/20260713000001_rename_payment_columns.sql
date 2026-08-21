-- Payrexx-spezifische Spaltennamen auf provider-agnostische Namen umstellen.
-- Die donations-Tabelle ist leer (noch nicht live), daher kein Daten-Update nötig.
ALTER TABLE public.donations RENAME COLUMN payrexx_gateway_id     TO payment_gateway_id;
ALTER TABLE public.donations RENAME COLUMN payrexx_reference_id   TO payment_reference_id;
ALTER TABLE public.donations RENAME COLUMN payrexx_transaction_id TO payment_transaction_id;

ALTER INDEX idx_donations_payrexx_ref RENAME TO idx_donations_payment_ref;

-- View neu erstellen mit umbenannten Spalten
DROP VIEW IF EXISTS public.donations_view;
CREATE VIEW public.donations_view WITH (security_invoker='true') AS
 SELECT d.id,
    d.event_id,
    d.payment_gateway_id,
    d.payment_reference_id,
    d.payment_transaction_id,
    d.amount_in_cents,
    d.currency,
    d.status,
    d.payment_method,
    d.paid_at,
    d.donor_uid,
    d.donor_message,
    d.receipt_number,
    d.receipt_sent_at,
    d.created_at,
    d.updated_at,
    u.display_name AS donor_display_name,
    u.email AS donor_email,
    e.name AS event_name
   FROM ((public.donations d
     LEFT JOIN public.users u ON ((u.id = d.donor_uid)))
     LEFT JOIN public.events e ON ((e.id = d.event_id)));

GRANT SELECT ON public.donations_view TO authenticated;
