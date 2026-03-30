-- QA-Spalten auf products: qa_checked (Boolean) und qa_checked_at (Timestamp).
-- Ermöglicht das Tracking, welche Produkte bereits qualitätsgeprüft wurden.

ALTER TABLE public.products
  ADD COLUMN qa_checked    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN qa_checked_at TIMESTAMPTZ;

CREATE INDEX idx_products_qa_checked ON public.products (qa_checked);
