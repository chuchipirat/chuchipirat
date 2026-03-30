-- QA-Spalten für Materialien (gleiche Struktur wie bei Produkten)
ALTER TABLE public.materials
  ADD COLUMN qa_checked    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN qa_checked_at TIMESTAMPTZ;

CREATE INDEX idx_materials_qa_checked ON public.materials (qa_checked);
