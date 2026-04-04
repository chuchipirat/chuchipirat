-- =============================================================================
-- Chuchipirat – Baseline Migration (4/7): Views
-- Generated: 2026-04-01
-- =============================================================================
-- This file is part of the baseline schema. Do NOT modify after first deploy.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. User Profiles (SECURITY DEFINER – intentionally public)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.user_profiles WITH (security_invoker='true') AS
 SELECT users.id,
    users.display_name,
    users.created_at,
    users.member_id,
    users.motto,
    users.picture_src,
    users.no_found_bugs
   FROM public.users;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Recipe Views
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.recipe_ingredients_with_names WITH (security_invoker='true') AS
 SELECT ri.id,
    ri.firebase_uid,
    ri.recipe_id,
    ri.sort_order,
    ri.pos_type,
    ri.product_id,
    ri.quantity,
    ri.unit,
    ri.detail,
    ri.scaling_factor,
    ri.section_name,
    ri.created_at,
    ri.updated_at,
    p.name AS product_name
   FROM (public.recipe_ingredients ri
     LEFT JOIN public.products p ON ((p.id = ri.product_id)));

COMMENT ON VIEW public.recipe_ingredients_with_names IS 'Rezept-Zutaten mit aufgelöstem Produktnamen (LEFT JOIN, da Abschnitte product_id = NULL haben).';

CREATE VIEW public.recipe_materials_with_names WITH (security_invoker='true') AS
 SELECT rm.id,
    rm.firebase_uid,
    rm.recipe_id,
    rm.sort_order,
    rm.material_id,
    rm.quantity,
    rm.created_at,
    rm.updated_at,
    m.name AS material_name
   FROM (public.recipe_materials rm
     LEFT JOIN public.materials m ON ((m.id = rm.material_id)));

COMMENT ON VIEW public.recipe_materials_with_names IS 'Rezept-Materialien mit aufgelöstem Materialnamen (LEFT JOIN, da material_id nullable ist).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Shopping & Material List Views
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.event_shopping_list_items_view WITH (security_invoker='on') AS
 SELECT i.id,
    i.list_id,
    i.product_id,
    i.material_id,
    i.free_text_name,
    i.quantity,
    i.unit,
    i.checked,
    i.edit_source,
    i.sort_order,
    i.created_at,
    i.updated_at,
    COALESCE(p.name, m.name, i.free_text_name) AS item_name,
    COALESCE(i.department_id, p.department_id) AS resolved_department_id,
    d.name AS department_name,
    d.pos AS department_pos,
    u.name AS unit_name
   FROM ((((public.event_shopping_list_items i
     LEFT JOIN public.products p ON ((p.id = i.product_id)))
     LEFT JOIN public.materials m ON ((m.id = i.material_id)))
     LEFT JOIN public.departments d ON ((d.id = COALESCE(i.department_id, p.department_id))))
     LEFT JOIN public.units u ON ((u.key = i.unit)));

CREATE VIEW public.event_material_list_items_view WITH (security_invoker='true') AS
 SELECT i.id,
    i.list_id,
    i.material_id,
    i.free_text_name,
    i.quantity,
    i.checked,
    i.edit_source,
    i.sort_order,
    i.assigned_cook_id,
    i.assigned_cook_name,
    i.created_at,
    i.updated_at,
    COALESCE(m.name, i.free_text_name) AS item_name,
    COALESCE(u.display_name, i.assigned_cook_name) AS resolved_cook_name,
    ec.user_id AS assigned_cook_user_id
   FROM (((public.event_material_list_items i
     LEFT JOIN public.materials m ON ((m.id = i.material_id)))
     LEFT JOIN public.event_cooks ec ON ((ec.id = i.assigned_cook_id)))
     LEFT JOIN public.user_profiles u ON ((u.id = ec.user_id)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Request Views
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.requests_view WITH (security_invoker='true') AS
 SELECT r.id,
    r.firebase_uid,
    r.number,
    r.status,
    r.request_type,
    r.author_uid,
    r.assignee_uid,
    r.request_object_uid,
    r.change_log,
    r.resolve_date,
    r.created_at,
    r.updated_at,
    ua.display_name AS author_display_name,
    ua.picture_src AS author_picture_src,
    uas.display_name AS assignee_display_name,
    uas.picture_src AS assignee_picture_src,
    rec.name AS recipe_name,
    rec.picture_src AS recipe_picture_src
   FROM (((public.requests r
     LEFT JOIN public.user_profiles ua ON ((ua.id = r.author_uid)))
     LEFT JOIN public.user_profiles uas ON ((uas.id = r.assignee_uid)))
     LEFT JOIN public.recipes rec ON ((rec.id = r.request_object_uid)));

CREATE VIEW public.request_comments_view WITH (security_invoker='true') AS
 SELECT rc.id,
    rc.request_id,
    rc.comment,
    rc.created_at,
    rc.created_by AS user_uid,
    rc.updated_at,
    u.display_name AS user_display_name,
    u.picture_src AS user_picture_src
   FROM (public.request_comments rc
     LEFT JOIN public.user_profiles u ON ((u.id = rc.created_by)));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Feed View
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.feeds_view WITH (security_invoker='true') AS
 SELECT f.id,
    f.firebase_uid,
    f.feed_type,
    f.visibility,
    f.user_uid,
    f.source_object_type,
    f.source_object_uid,
    f.source_object_data,
    f.created_at,
    f.updated_at,
    u.display_name AS user_display_name,
    u.picture_src AS user_picture_src,
    COALESCE(r.name, e.name, p.name, m.name, u2.display_name, ''::text) AS source_object_name,
    COALESCE(r.picture_src, e.picture_src, u2.picture_src, ''::text) AS source_object_picture_src
   FROM ((((((public.feeds f
     LEFT JOIN public.user_profiles u ON ((u.id = f.user_uid)))
     LEFT JOIN public.recipes r ON (((r.id = f.source_object_uid) AND (f.source_object_type = 'recipe'::text))))
     LEFT JOIN public.events e ON (((e.id = f.source_object_uid) AND (f.source_object_type = 'event'::text))))
     LEFT JOIN public.products p ON (((p.id = f.source_object_uid) AND (f.source_object_type = 'product'::text))))
     LEFT JOIN public.materials m ON (((m.id = f.source_object_uid) AND (f.source_object_type = 'material'::text))))
     LEFT JOIN public.user_profiles u2 ON ((((u2.id)::text = f.source_object_uid) AND (f.source_object_type = 'user'::text))));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Donations View
-- ─────────────────────────────────────────────────────────────────────────────

CREATE VIEW public.donations_view WITH (security_invoker='true') AS
 SELECT d.id,
    d.event_id,
    d.payrexx_gateway_id,
    d.payrexx_reference_id,
    d.payrexx_transaction_id,
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
