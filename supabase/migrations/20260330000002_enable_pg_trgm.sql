-- pg_trgm-Erweiterung aktivieren und Trigram-Index auf products.name erstellen.
-- Ermöglicht effiziente Ähnlichkeitssuche (Fuzzy Matching) bei der Duplikaterkennung.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_name_trgm ON public.products USING gin (name gin_trgm_ops);
