# Supabase Environment Setup Runbook

Dieses Dokument beschreibt alle manuellen Schritte, die beim Aufsetzen einer neuen Umgebung (dev/test/prod) durchgeführt werden müssen — zusätzlich zu den automatischen SQL-Migrationen.

---

## 1. SQL-Migrationen ausführen

Die Migrationen unter `supabase/migrations/` müssen in Reihenfolge ausgeführt werden:

| Migration                                                    | Beschreibung                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260225000001_create_users.sql`                            | Users-Tabelle, user_profiles View                                                                                                                                                                                                                                                                                                                                     |
| `20260226000001_add_auth_uid.sql`                            | Auth UID, RLS Policies, Hilfsfunktionen                                                                                                                                                                                                                                                                                                                               |
| `20260226000002_drop_member_since_last_login.sql`            | Alte Spalten entfernen                                                                                                                                                                                                                                                                                                                                                |
| `20260306000002_add_no_found_bugs_to_users.sql`              | Anzahl gefunden Bugs Spalte hinzufügen                                                                                                                                                                                                                                                                                                                                |
| `20260227000001_collapse_picture_columns.sql`                | Bild-Spalten zusammenführen                                                                                                                                                                                                                                                                                                                                           |
| `20260227000002_create_media_bucket.sql`                     | Storage Bucket + Policies                                                                                                                                                                                                                                                                                                                                             |
| `20260228000001_add_auth_uid_foreign_key.sql`                | FK auf auth.users                                                                                                                                                                                                                                                                                                                                                     |
| `20260228000002_add_increment_logins_function.sql`           | Atomare Login-Zähler-Funktion                                                                                                                                                                                                                                                                                                                                         |
| `20260228000003_sync_auth_email_trigger.sql`                 | Trigger: E-Mail-Sync auth.users → public.users                                                                                                                                                                                                                                                                                                                        |
| `20260301000001_create_global_settings.sql`                  | Singleton-Tabelle für globale Einstellungen (allowSignUp, maintenanceMode)                                                                                                                                                                                                                                                                                            |
| `20260301000002_create_system_messages.sql`                  | Singleton-Tabelle für Systemmeldungen (Alert-Banner auf Startseite)                                                                                                                                                                                                                                                                                                   |
| `20260301000003_audit_columns_uuid_fk.sql`                   | Audit-Spalten umbenennen (created_by, updated_at, updated_by), TEXT→UUID, FK auf auth.users(id)                                                                                                                                                                                                                                                                       |
| `20260302000001_system_messages_multi_row.sql`               | system_messages von Singleton auf Multi-Row umstellen (Constraint entfernen, INSERT/DELETE-Policies)                                                                                                                                                                                                                                                                  |
| `20260302000002_create_revoke_sessions_function.sql`         | SQL-Funktion `revoke_user_sessions()` zum Löschen von Auth-Sessions (für sign-out-all-users Edge Function)                                                                                                                                                                                                                                                            |
| `20260303000001_create_departments.sql`                      | Stammdaten-Tabelle für Abteilungen (z.B. Gemüse, Milchprodukte)                                                                                                                                                                                                                                                                                                       |
| `20260303000002_create_units.sql`                            | Stammdaten-Tabelle für Einheiten (z.B. kg, Stück, dl)                                                                                                                                                                                                                                                                                                                 |
| `20260303000003_create_materials.sql`                        | Stammdaten-Tabelle für Material (z.B. Küchenutensilien)                                                                                                                                                                                                                                                                                                               |
| `20260303000004_create_products.sql`                         | Stammdaten-Tabelle für Produkte (Zutaten mit Abteilung/Einheit)                                                                                                                                                                                                                                                                                                       |
| `20260303000005_create_unit_conversion_basic.sql`            | Basis-Umrechnungen zwischen Einheiten                                                                                                                                                                                                                                                                                                                                 |
| `20260303000006_create_unit_conversion_products.sql`         | Produktspezifische Umrechnungen zwischen Einheiten                                                                                                                                                                                                                                                                                                                    |
| `20260303000007_tighten_media_users_policies.sql`            | RLS-Policies für media bucket und users-Tabelle verschärft                                                                                                                                                                                                                                                                                                            |
| `20260304000001_create_recipes.sql`                          | Rezept-Tabellen: recipes, recipe_ingredients, recipe_preparation_steps, recipe_materials, recipe_ratings, recipe_comments (inkl. Trigger für Bewertungs-Aggregat)                                                                                                                                                                                                     |
| `20260306000001_fix_recipes_rls.sql`                         | RLS-Policies für alle Rezept-Tabellen angepasst: SELECT für alle authentifizierten Benutzer geöffnet; UPDATE/DELETE auf `is_community_leader()` erweitert (statt nur `is_admin()`)                                                                                                                                                                                    |
| `20260307000001_add_no_comments_to_recipes.sql`              | `no_comments`-Spalte auf `recipes` + SECURITY DEFINER Trigger `update_recipe_no_comments()` (hält Zähler bei INSERT/DELETE auf `recipe_comments` aktuell)                                                                                                                                                                                                             |
| `20260307000002_get_comment_author_profiles.sql`             | SECURITY DEFINER Funktion `get_comment_author_profiles(uids UUID[])`: gibt `auth_uid`, `display_name`, `picture_src` für eine Liste von Auth-UUIDs zurück, umgeht RLS auf `public.users` und exponiert nur öffentliche Profilfelder                                                                                                                                   |
| `20260307000003_fix_users_link_auth_policy.sql`              | Sicherheits-Fix: `users_link_auth`-Policy um `roles`-Vergleich in `WITH CHECK` erweitert — verhindert Privilege Escalation über die Auth-Linking-Policy während `auth_uid IS NULL`                                                                                                                                                                                    |
| `20260308000001_create_events.sql`                           | Events-Schema: 2 ENUMs (`plan_scope_type`, `plan_mode_type`), 14 Tabellen (`events`, `event_cooks`, `event_dates`, `event_groupconfiguration_diets/intolerances/portions`, `event_meal_types`, `event_meals`, `event_menues`, `event_menue_recipes/products/materials`, `event_notes`, `event_menuplan_item_plans`), SECURITY DEFINER Hilfsfunktion `is_event_cook()` |
| `20260308000002_fix_user_profiles_security_invoker.sql`      | Security-Fix: `user_profiles`-View auf `WITH (security_invoker = true)` umgestellt — verhindert RLS-Bypass durch SECURITY DEFINER-Standard von Postgres-Views                                                                                                                                                                                                         |
| `20260308000003_fix_function_search_paths.sql`               | Security-Fix: `SET search_path = public` für alle 10 Funktionen ohne expliziten search_path ergänzt (`update_updated_at`, `update_updated_by`, `is_admin`, `is_community_leader`, `increment_logins`, `sync_auth_email`, `increment_found_bugs`, `update_recipe_no_comments`, `update_recipe_rating_aggregate`, `is_event_cook`)                                      |
| `20260308000004_fix_rls_insert_policies.sql`                 | Security-Fix: INSERT-Policies auf `events`, `materials`, `products`, `recipes` von `WITH CHECK (true)` auf `WITH CHECK ((SELECT auth.uid()) IS NOT NULL)` umgestellt — behebt „RLS Policy Always True"-Hinweis im Security Advisor                                                                                                                                    |
| `20260308000005_fix_rls_auth_init_plan.sql`                  | Performance-Fix: `auth.uid()` → `(SELECT auth.uid())` in 25 RLS-Policies auf `users`, `storage.objects`, `recipes`, `recipe_ingredients`, `recipe_preparation_steps`, `recipe_materials`, `recipe_ratings`, `recipe_comments`, `event_cooks` — behebt „Auth RLS Initialization Plan"-Hinweis im Performance Advisor                                                   |
| `20260308000007_fix_portions_numeric.sql`                    | Schema-Fix: `event_menuplan_item_plans.servings` und `event_menue_recipes.total_portions` von `INTEGER` auf `NUMERIC(10,2)` umgestellt — Portionen können Dezimalwerte sein (z.B. 0.5)                                                                                                                                                                                |
| `20260308000006_fix_multiple_permissive_policies.sql`        | Performance-Fix: Mehrere permissive RLS-Policies pro Aktion zusammengeführt — `users` (SELECT/INSERT/UPDATE je auf eine Policy konsolidiert, `TO authenticated` ergänzt), `system_messages` (alle Policies gedroppt und mit `TO authenticated` neu erstellt) — behebt „Multiple Permissive Policies"-Hinweis                                                          |
| `20260308000008_find_user_id_by_email.sql`                   | SQL-Funktion `find_user_id_by_email()` zum Nachschlagen der User-ID anhand einer E-Mail-Adresse                                                                                                                                                                                                                                                                       |
| `20260308000009_media_events_policies.sql`                   | Storage-Policies für Event-Bilder: INSERT/UPDATE/DELETE im `media`-Bucket unter `events/` — nur Köche des Events dürfen Bilder verwalten (via `is_event_cook()`). Erhöht Bucket-Limit von 2 MB auf 5 MB (Event-Bilder sind grösser als Profilbilder)                                                                                                                  |
| `20260308000010_enable_realtime_events.sql`                  | Aktiviert Supabase Realtime für alle 14 Event-Tabellen (`events`, `event_cooks`, `event_dates`, `event_groupconfiguration_*`, `event_meal_types`, `event_meals`, `event_menues`, `event_menue_recipes/products/materials`, `event_notes`, `event_menuplan_item_plans`) via `ALTER PUBLICATION supabase_realtime ADD TABLE`                                            |
| `20260308000011_add_recipe_variant_fks.sql`                  | FK-Constraints für Varianten-Felder in `recipes`: `variant_event_uid` → `events(id)` ON DELETE CASCADE, `original_recipe_uid` → `recipes(id)` ON DELETE SET NULL                                                                                                                                                                                                      |
| `20260308000012_create_recipe_ingredient_material_views.sql` | Views `recipe_ingredients_with_names` und `recipe_materials_with_names` — LEFT JOIN auf `products`/`materials` für aufgelöste Namen, `security_invoker = true`                                                                                                                                                                                                        |
| `20260309000001_menuplan_check_constraints.sql`              | CHECK-Constraints für nicht-negative Mengen/Faktoren auf `event_menue_recipes` (`total_portions >= 0`), `event_menue_products` (`quantity >= 0`), `event_menue_materials` (`quantity >= 0`), `event_menuplan_item_plans` (`factor >= 0`, `servings >= 0`)                                                                                                             |
| `20260309000002_save_menuplan_rpc.sql`                       | RPC-Funktion `save_menuplan(p_event_id, p_payload)` — atomarer Full-Replace-Save für alle 8 Menuplan-Tabellen in einer einzigen Transaktion. SECURITY INVOKER (RLS bleibt aktiv), Aufruf nur für `authenticated`                                                                                                                                                      |
| `20260309000003_create_event_cook_profiles_function.sql`     | SECURITY DEFINER Funktion `get_event_cook_profiles(p_event_id TEXT)`: gibt Köche eines Events mit öffentlichen Profildaten (display_name, motto, picture_src) zurück. Umgeht RLS auf `users` (nur öffentliche Felder), Zugriff geschützt via `is_event_cook()` / `is_admin()`. Löst das N+1-Problem bei Cook-Profil-Laden                                             |
| `20260313000001_create_used_recipe_lists.sql`                | UsedRecipeLists: Kopftabelle `event_used_recipe_lists`, Junction `event_used_recipe_list_menues`, RPC `get_used_recipe_list_recipes`                                                                                                                                                                                                                                  |
| `20260313000002_add_used_recipe_list_meals.sql`              | Junction-Tabelle `event_used_recipe_list_meals` für Drift-Erkennung bei verschobenen Menüs                                                                                                                                                                                                                                                                            |
| `20260313000003_fix_save_menuplan_preserve_junctions.sql`    | Fix: `save_menuplan` sichert Junction-Daten der UsedRecipeLists vor CASCADE-Delete und stellt sie nach dem Re-Insert wieder her                                                                                                                                                                                                                                       |
| `20260315000001_simplify_menuplan_audit.sql`                 | Menuplan-Audit vereinfachen: `event_menuplan_tracking`-Tabelle erstellen, Audit-Spalten und Triggers von 10 Menuplan-/Junction-Tabellen entfernen, `save_menuplan` RPC vereinfachen                                                                                                                                                                                   |
| `20260316000002_create_shopping_lists.sql`                   | Einkaufslisten: ENUM `shopping_list_edit_source`, Tabellen `event_shopping_lists` + `event_shopping_list_items`, VIEW `event_shopping_list_items_view` (aufgelöste Namen, Abteilungen, Einheiten), RLS via `is_event_cook()`                                                                                                                                          |
| `20260316000003_enable_realtime_shopping_lists.sql`          | Aktiviert Supabase Realtime für `event_shopping_lists` und `event_shopping_list_items`                                                                                                                                                                                                                                                                                |
| `20260316000006_create_material_lists.sql`                   | Materiallisten: Tabellen `event_material_lists` + `event_material_list_items` (inkl. Koch-Zuordnung via `assigned_cook_id`/`assigned_cook_name`), VIEW `event_material_list_items_view` (aufgelöste Material-Namen und Koch-Namen), RLS via `is_event_cook()`, wiederverwendet `shopping_list_edit_source` ENUM                                                       |
| `20260316000007_enable_realtime_material_lists.sql`          | Aktiviert Supabase Realtime für `event_material_lists` und `event_material_list_items`                                                                                                                                                                                                                                                                                |
| `20260317000001_create_requests.sql`                         | Anträge: ENUMs `request_status_type` + `request_type_enum`, SEQUENCE `request_number_seq`, Tabellen `requests` + `request_comments`, VIEWs `requests_view` (Autor/Assignee/Rezept aufgelöst) + `request_comments_view` (Kommentar-Autor aufgelöst), RLS: Autor sieht eigene, Community Leaders sehen alle                                                             |
| `20260317000002_create_user_role_enum.sql`                   | Gemeinsamer ENUM `user_role` (basic, communityLeader, admin): `users.roles` von `TEXT[]` auf `user_role[]` umgestellt, `users_update`-Policy und `is_admin()`/`is_community_leader()`-Funktionen angepasst                                                                                                                                                            |
| `20260318000001_create_feeds.sql`                            | Feed-System: ENUM `feed_type` (10 Werte), Tabelle `feeds` (Visibility via `user_role`), VIEW `feeds_view` (User- und Quellobjekt-Namen via JOINs aufgelöst), RLS: SELECT/INSERT alle authentifizierten, DELETE nur Community Leaders                                                                                                                                  |
| `20260318000002_fix_users_select_policy.sql`                 | Fix: SELECT-Policy auf `users` für alle authentifizierten User geöffnet (benötigt für `feeds_view` JOINs)                                                                                                                                                                                                                                                             |
| `20260319000001_drop_recipes_is_in_review.sql`               | Entfernt denormalisierte Spalte `is_in_review` aus `recipes` — Review-Status wird neu direkt aus der `requests`-Tabelle abgeleitet                                                                                                                                                                                                                                    |
| `20260319000002_create_get_platform_stats.sql`               | SECURITY DEFINER Funktion `get_platform_stats()`: gibt 18 aggregierte Plattform-KPIs (User, Rezepte, Anlässe, Durchschnitte) als `(field TEXT, value NUMERIC)` zurück. Umgeht RLS (nur Aggregate, keine Einzeldaten)                                                                                                                                                  |
| `20260320000001_create_get_user_profile_stats.sql`           | SECURITY DEFINER Funktion `get_user_profile_stats(p_auth_uid UUID)`: gibt 5 benutzerspezifische KPIs (öffentliche/private Rezepte, Events, Kommentare, gefundene Bugs) für die öffentliche Profilseite zurück                                                                                                                                                         |
| `20260320000002_admin_operations_rpc.sql`                    | RPC-Funktionen für Admin-Operationen: `merge_products()`, `merge_materials()` (FK-Referenzen aktualisieren + Quelle löschen), `convert_product_to_material()`, `convert_material_to_product()` (Entität konvertieren + Referenzen verschieben), `where_used()` (Verwendungsnachweis über alle Tabellen). Alle SECURITY DEFINER, nur für `authenticated`               |
| `20260320000003_create_cron_job_log.sql`                     | Tabelle `cron_job_log` für Cron-Job-Monitoring: speichert Ausführungshistorie (job_name, started_at, finished_at, status, duration_ms, records_processed, error_message, details). RLS + Indizes. Wird in Phase 14 von migrierten Cron Jobs befüllt                                                                                                                    |
| `20260320000004_data_integrity_checks.sql`                   | 7 SECURITY DEFINER Prüffunktionen: `check_orphaned_recipes()`, `check_orphaned_event_cooks()`, `check_events_without_dates()`, `check_unused_products()`, `check_unused_materials()`, `check_duplicate_emails()`, `check_auth_users_sync()`. Jede gibt Anomalien als JSONB-Array zurück                                                                               |
| `20260320000005_create_mail_log.sql`                         | Tabelle `mail_log` für Mail-Versand-Historie: recipients (JSONB), recipient_type, subject, body, template_name, sent_at, sent_by (UUID FK), delivery_status, error_message, details. RLS + Indizes. Wird von der `send-mail` Edge Function befüllt                                                                                                                    |

In Docker-Umgebung: Migrationen werden beim `docker compose up` **nicht** automatisch ausgeführt. Sie müssen manuell über das Supabase Studio SQL Editor (`http://localhost:8000`) oder via `psql` eingespielt werden.

---

## 2. Auth-Konfiguration (GoTrue)

Diese Einstellungen werden über Umgebungsvariablen in `docker-compose.yml` / `.env` gesteuert:

- **E-Mail-Bestätigung**: `ENABLE_EMAIL_AUTOCONFIRM=false` (Benutzer müssen E-Mail verifizieren)
- **Redirect URL**: `ADDITIONAL_REDIRECT_URLS=https://<domain>/authservicehandler`
- **SMTP**: Produktiv auf echten SMTP-Server konfigurieren (lokal: MailPit auf Port 1025)
- **E-Mail-Vorlagen**: `GOTRUE_MAILER_TEMPLATES_CONFIRMATION`, `GOTRUE_MAILER_TEMPLATES_EMAIL_CHANGE` und `GOTRUE_MAILER_TEMPLATES_RECOVERY` müssen auf HTTP-URLs zeigen (GoTrue lädt Templates nur via HTTP, nicht von Dateipfaden)
- **Site URL**: `SITE_URL` muss der Produktions-URL entsprechen

### Produktions-Checkliste Auth

- [ ] `SITE_URL` auf `https://chuchipirat.ch` setzen
- [ ] `ADDITIONAL_REDIRECT_URLS` auf `https://chuchipirat.ch/authservicehandler` setzen
- [ ] SMTP-Server konfigurieren (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`)
- [ ] `SMTP_SENDER_NAME=chuchipirat` und `SMTP_ADMIN_EMAIL` auf echte Adresse setzen
- [ ] E-Mail-Templates (confirmation, email_change, recovery) via HTTP bereitstellen (nginx oder CDN)
- [ ] `ENABLE_EMAIL_AUTOCONFIRM=false` sicherstellen

---

## 3. Edge Functions

Edge Functions liegen in `supabase/volumes/functions/` und werden vom Edge Runtime Container ausgeführt.

| Funktion                | Beschreibung                                                                                                                                                                                                                    | Benötigte Env-Vars                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `main`                  | Dispatcher/Router (required)                                                                                                                                                                                                    | `JWT_SECRET`, `VERIFY_JWT`                                                                                  |
| `notify-vestaboard`     | Vestaboard-Willkommensnachricht bei E-Mail-Verifizierung                                                                                                                                                                        | `VESTABOARD_READ_WRITE_KEY`                                                                                 |
| `sign-out-all-users`    | Meldet alle Nicht-Admin-Benutzer ab (Admin-Funktion)                                                                                                                                                                            | `SUPABASE_SERVICE_ROLE_KEY`                                                                                 |
| `notify-recipe-comment` | Sendet E-Mail an Rezeptautor wenn ein Kommentar eingefügt wird. Wird automatisch von `RecipeCommentRepository.insertComment()` als Fire-and-Forget aufgerufen. Primär über Brevo API, Fallback auf SMTP für lokale Entwicklung. | `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` (Produktion) oder `SMTP_HOST`/`SMTP_PORT` (lokale Entwicklung) |
| `notify-request`        | Sendet E-Mail-Benachrichtigungen bei Antrags-Aktionen (neuer Antrag, Kommentar, Status-Änderung)                                                                                                                                | `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` oder `SMTP_HOST`/`SMTP_PORT`                                  |
| `send-mail`             | Generische Mail-Versand-Funktion für die Admin-Mail-Konsole. Unterstützt Empfänger per E-Mail, UID oder Rolle. Protokolliert in `mail_log`-Tabelle                                                                              | `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` oder `SMTP_HOST`/`SMTP_PORT`                                  |

### Produktions-Checkliste Edge Functions

- [ ] `VESTABOARD_READ_WRITE_KEY` in `.env` setzen
- [ ] `FUNCTIONS_VERIFY_JWT` auf `true` setzen (produktiv JWT-Verifizierung aktivieren)
- [ ] `BREVO_API_KEY` in `.env` setzen (Brevo Transactional Email für `notify-recipe-comment`)
- [ ] Brevo Sender-Adresse `hallo@chuchipirat.ch` im Brevo-Konto als verifizierte Absenderadresse einrichten

---

## TODO: Brevo Transactional Email für Test/Produktion konfigurieren

Die Edge Function `notify-recipe-comment` versendet E-Mails an Rezeptautoren bei neuen Kommentaren. Lokal funktioniert der SMTP-Fallback über MailPit. Für Test und Produktion muss Brevo konfiguriert werden.

### Schritte

1. **Brevo-Konto**: Unter [app.brevo.com](https://app.brevo.com) einloggen
2. **Absenderadresse verifizieren**: `hallo@chuchipirat.ch` als autorisierte Absenderadresse einrichten (Brevo → Settings → Senders, Domains & Dedicated IPs → Senders)
3. **API Key erstellen** (falls noch keiner existiert): Brevo → Settings → SMTP & API → API Keys → Generate a new API key
4. **API Key in `.env` setzen**: `BREVO_API_KEY=xkeysib-...`
5. **Edge Function Container neu erstellen**: `docker compose up -d --force-recreate functions`
6. **Testen**: Kommentar auf ein fremdes Rezept erstellen → Autor-E-Mail muss ankommen

### Checkliste pro Umgebung

| Schritt                                       | Test | Prod |
| --------------------------------------------- | ---- | ---- |
| `BREVO_API_KEY` in `.env` gesetzt             | [ ]  | [ ]  |
| `hallo@chuchipirat.ch` als Sender verifiziert | [ ]  | [ ]  |
| Edge Function Container neu erstellt          | [ ]  | [ ]  |
| E-Mail-Versand getestet (Kommentar erstellen) | [ ]  | [ ]  |

---

## 4. Storage

### Media Bucket

Wird durch Migration `20260227000002_create_media_bucket.sql` erstellt. Enthält:

- Profilbilder unter `users/{uid}/profile/`
- RLS Policies für öffentliches Lesen und Eigentümer-Schreiben

---

## 5. Firebase Auth → Supabase Auth (User-Import)

Bevor Tabellen mit `FK → auth.users(id)` migriert werden (z.B. `requests`), müssen alle Firebase-Auth-Benutzer in Supabase Auth importiert werden. Siehe **[Firebase Auth Migration Playbook](../docs/claude/firebase-auth-migration.md)** für die vollständige Anleitung.

---

## 6. Daten-Migration (Firebase → Postgres)

Die Firebase-Daten müssen über die Admin-Migrationsseite (`/admin/migration`) migriert werden. Diese Seite ist nur für Admins zugänglich.

### Reihenfolge

1. **Users** migrieren (erstellt Zeilen in `public.users`)
2. **Profilbilder** migrieren (kopiert von Firebase Storage in Supabase Storage)
3. **Departments** migrieren (Abteilungen)
4. **Units** migrieren (Einheiten)
5. **Materials** migrieren (Material/Küchenutensilien)
6. **Products** migrieren (Produkte/Zutaten — hängt von Departments + Units ab)
7. **UnitConversionBasic** migrieren (Basis-Umrechnungen — hängt von Units ab)
8. **UnitConversionProducts** migrieren (Produkt-Umrechnungen — hängt von Products + Units ab)
9. **Recipes** migrieren (Rezepte — hängt von Users, Products, Materials ab)
10. **Events** migrieren (Event-Kopfdaten, Köche, Zeitscheiben — hängt von Users ab)
11. **GroupConfig** migrieren (Gruppenconfig: Diäten, Unverträglichkeiten, Portionen — hängt von Events ab)
12. **Menuplan** migrieren (Menupläne: Mahlzeiten, Menüs, Rezepte, Produkte, Materialien — hängt von Events, GroupConfig, Recipes, Products, Materials ab)
13. **EventPictures** migrieren (kopiert Event-Bilder von Firebase Storage nach Supabase Storage — hängt von Events ab)
14. **RecipeVariants** migrieren (Varianten-Rezepte — hängt von Events, Recipes, Users, Products, Materials ab)
15. **UsedRecipeListMeals** migrieren (Meal-Zuordnungen für Mengenberechnungs-Listen — hängt von Events, Menuplan ab)
16. **ShoppingLists** migrieren (Einkaufslisten — hängt von Events, Products, Materials, Departments, Units ab)
17. **MaterialLists** migrieren (Materiallisten — hängt von Events, Materials ab)
18. **Requests** migrieren (Anträge — hängt von Users, Recipes ab)
19. **Feeds** migrieren (Feed-Einträge — hängt von Users, Recipes, Events, Products, Materials ab; `menuplanCreated` → `eventCreated`, `recipeCreated`/`none` übersprungen)

---

## 7. Einmalige SQL-Korrekturen

SQL-Statements die einmalig auf bestehenden Umgebungen ausgeführt werden müssen (z.B. nach Bugfixes):

### displayName-Korrektur (Bug: displayName war auf E-Mail gesetzt)

```sql
UPDATE public.users
SET display_name = TRIM(first_name || ' ' || last_name)
WHERE display_name = email;
```

---

## 8. Umgebungsspezifische Werte

| Variable                    | Dev (lokal)               | Test          | Produktion               |
| --------------------------- | ------------------------- | ------------- | ------------------------ |
| `SITE_URL`                  | `http://localhost:3000`   | TBD           | `https://chuchipirat.ch` |
| `API_EXTERNAL_URL`          | `http://localhost:8000`   | TBD           | TBD                      |
| `SMTP_HOST`                 | `supabase-mail` (MailPit) | TBD           | Echter SMTP-Server       |
| `SMTP_PORT`                 | `1025`                    | TBD           | `587`                    |
| `ENABLE_EMAIL_AUTOCONFIRM`  | `false`                   | `false`       | `false`                  |
| `VESTABOARD_READ_WRITE_KEY` | `949a380f...`             | `949a380f...` | `949a380f...`            |
| `FUNCTIONS_VERIFY_JWT`      | `false`                   | `true`        | `true`                   |
| `BREVO_API_KEY`             | _(leer — SMTP-Fallback)_  | TBD           | Brevo API Key            |
| `VITE_SUPPORT_USER_ID`      | Auth-UUID des Support-Users | Auth-UUID    | Auth-UUID                |
