-- =============================================================================
-- Manueller Verifikations-Test für 20260907000001_list_surgical_writes.sql
--
-- Ausführen gegen den lokalen -test-Stack:
--   docker exec -i supabase-db-test psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/scripts/test_list_surgical_writes.sql
--
-- Testet save_shopping_list_items (die Materialvariante ist strukturgleich).
-- Läuft komplett in einer Transaktion und rollt am Ende zurück — verändert
-- keine echten Daten. Event/Koch unten ggf. an die lokale -test-DB anpassen.
-- Der Advisory-Lock-Serialisierungstest (zwei Sessions) steht als Kommentar
-- am Ende.
-- =============================================================================
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('request.jwt.claims',
  '{"sub":"1ced5f20-b4a2-4031-ab57-b3a8ab3b2459","role":"authenticated"}', true);
SET LOCAL role authenticated;

INSERT INTO public.event_shopping_lists (event_id, name)
  VALUES ('3cfdb727-8256-48a2-8c56-8231a164dd3b', 'ZZ Surgical Test')
  RETURNING id AS lst \gset

\echo ''
\echo '=== 1) Erst-Save: 3 Freitext-Positionen mit stabilen client-IDs (known_ids leer) ==='
SELECT public.save_shopping_list_items(:'lst', jsonb_build_array(
  jsonb_build_object('id','it-1','free_text_name','Salz','quantity',1,'unit','kg','sort_order',0),
  jsonb_build_object('id','it-2','free_text_name','Pfeffer','quantity',2,'sort_order',1),
  jsonb_build_object('id','it-3','free_text_name','Zucker','quantity',3,'unit','kg','sort_order',2)
), ARRAY[]::text[]);
SELECT id, free_text_name, quantity FROM public.event_shopping_list_items
  WHERE list_id = :'lst' ORDER BY sort_order;

\echo ''
\echo '=== 2) No-op: identischer Payload -> 0 Zeilen geschrieben (ctid unveraendert) ==='
-- ctid statt xmin: innerhalb einer Transaktion aendert sich xmin bei einem
-- UPDATE nicht (gleiche txid), ctid schon (neue Tuple-Version).
CREATE TEMP TABLE _b AS
  SELECT id, ctid::text AS c FROM public.event_shopping_list_items WHERE list_id = :'lst';
SELECT public.save_shopping_list_items(:'lst', jsonb_build_array(
  jsonb_build_object('id','it-1','free_text_name','Salz','quantity',1,'unit','kg','sort_order',0),
  jsonb_build_object('id','it-2','free_text_name','Pfeffer','quantity',2,'sort_order',1),
  jsonb_build_object('id','it-3','free_text_name','Zucker','quantity',3,'unit','kg','sort_order',2)
), ARRAY['it-1','it-2','it-3']);
SELECT count(*) FILTER (WHERE i.ctid::text <> _b.c) AS rows_written_expect_0
  FROM public.event_shopping_list_items i JOIN _b ON _b.id = i.id;
DROP TABLE _b;

\echo ''
\echo '=== 3) Feld-Update: nur it-2 Menge geaendert -> nur it-2 geschrieben ==='
CREATE TEMP TABLE _b AS
  SELECT id, ctid::text AS c FROM public.event_shopping_list_items WHERE list_id = :'lst';
SELECT public.save_shopping_list_items(:'lst', jsonb_build_array(
  jsonb_build_object('id','it-1','free_text_name','Salz','quantity',1,'unit','kg','sort_order',0),
  jsonb_build_object('id','it-2','free_text_name','Pfeffer','quantity',99,'sort_order',1),
  jsonb_build_object('id','it-3','free_text_name','Zucker','quantity',3,'unit','kg','sort_order',2)
), ARRAY['it-1','it-2','it-3']);
SELECT i.id, (i.ctid::text <> _b.c) AS written, i.quantity
  FROM public.event_shopping_list_items i JOIN _b ON _b.id = i.id ORDER BY i.id;
DROP TABLE _b;

\echo ''
\echo '=== 4) Koch-B-Add ueberlebt: B fuegt it-4 direkt ein, A speichert ohne it-4 in known_ids ==='
INSERT INTO public.event_shopping_list_items (id, list_id, free_text_name, quantity, sort_order)
  VALUES ('it-4', :'lst', 'Oel (von Koch B)', 5, 3);
SELECT public.save_shopping_list_items(:'lst', jsonb_build_array(
  jsonb_build_object('id','it-1','free_text_name','Salz','quantity',1,'unit','kg','sort_order',0),
  jsonb_build_object('id','it-2','free_text_name','Pfeffer','quantity',99,'sort_order',1),
  jsonb_build_object('id','it-3','free_text_name','Zucker','quantity',3,'unit','kg','sort_order',2)
), ARRAY['it-1','it-2','it-3']);
SELECT string_agg(id, ',' ORDER BY id) AS ids_expect_it1_2_3_4
  FROM public.event_shopping_list_items WHERE list_id = :'lst';

\echo ''
\echo '=== 5) Diff-Delete: A kennt it-4 noch nicht, entfernt it-2 -> it-2 weg, it-4 bleibt ==='
-- known_ids weiterhin ohne it-4 (A hat den Fremd-Insert noch nicht geladen)
SELECT public.save_shopping_list_items(:'lst', jsonb_build_array(
  jsonb_build_object('id','it-1','free_text_name','Salz','quantity',1,'unit','kg','sort_order',0),
  jsonb_build_object('id','it-3','free_text_name','Zucker','quantity',3,'unit','kg','sort_order',2)
), ARRAY['it-1','it-2','it-3']);
SELECT string_agg(id, ',' ORDER BY id) AS ids_expect_it1_3_4
  FROM public.event_shopping_list_items WHERE list_id = :'lst';

\echo ''
\echo '=== 6) RLS: Aufruf als Nicht-Koch schlaegt fehl ==='
SAVEPOINT s;
SELECT set_config('request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}', true);
DO $$
BEGIN
  PERFORM public.save_shopping_list_items(
    (SELECT id FROM public.event_shopping_lists WHERE name = 'ZZ Surgical Test' LIMIT 1),
    jsonb_build_array(jsonb_build_object('id','x','free_text_name','Hack','quantity',1,'sort_order',0)),
    ARRAY[]::text[]);
  RAISE EXCEPTION 'FEHLGESCHLAGEN: Nicht-Koch durfte speichern';
EXCEPTION
  WHEN insufficient_privilege THEN RAISE NOTICE 'OK: RLS-Verletzung wie erwartet';
END $$;
ROLLBACK TO s;

ROLLBACK;

-- =============================================================================
-- Advisory-Lock-Serialisierung (zwei Sessions, manuell):
--
-- Session A:  BEGIN;
--             SELECT public.save_shopping_list_items('<list>',
--               '[{"id":"a","free_text_name":"X","quantity":1}]'::jsonb, ARRAY['a']);
--             SELECT pg_sleep(3); COMMIT;
-- Session B (~0.5s spaeter): \timing on
--             SELECT public.save_shopping_list_items('<list>',
--               '[{"id":"b","free_text_name":"Y","quantity":1}]'::jsonb, ARRAY['b']);
--             -> blockiert ~2.5s bis A committet
-- =============================================================================
