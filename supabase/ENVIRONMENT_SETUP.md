# Supabase Environment Setup Runbook

Dieses Dokument beschreibt alle manuellen Schritte, die beim Aufsetzen einer neuen Umgebung (dev/test/prod) durchgeführt werden müssen — zusätzlich zu den automatischen SQL-Migrationen.

---

## 1. SQL-Migrationen ausführen

Die Migrationen unter `supabase/migrations/` müssen in Reihenfolge ausgeführt werden:

| Migration                                            | Beschreibung                                                                                                                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260225000001_create_users.sql`                    | Users-Tabelle, user_profiles View                                                                                                                                 |
| `20260226000001_add_auth_uid.sql`                    | Auth UID, RLS Policies, Hilfsfunktionen                                                                                                                           |
| `20260226000002_drop_member_since_last_login.sql`    | Alte Spalten entfernen                                                                                                                                            |
| `20260306000002_add_no_found_bugs_to_users.sql`      | Anzahl gefunden Bugs Spalte hinzufügen                                                                                                                            |
| `20260227000001_collapse_picture_columns.sql`        | Bild-Spalten zusammenführen                                                                                                                                       |
| `20260227000002_create_media_bucket.sql`             | Storage Bucket + Policies                                                                                                                                         |
| `20260228000001_add_auth_uid_foreign_key.sql`        | FK auf auth.users                                                                                                                                                 |
| `20260228000002_add_increment_logins_function.sql`   | Atomare Login-Zähler-Funktion                                                                                                                                     |
| `20260228000003_sync_auth_email_trigger.sql`         | Trigger: E-Mail-Sync auth.users → public.users                                                                                                                    |
| `20260301000001_create_global_settings.sql`          | Singleton-Tabelle für globale Einstellungen (allowSignUp, maintenanceMode)                                                                                        |
| `20260301000002_create_system_messages.sql`          | Singleton-Tabelle für Systemmeldungen (Alert-Banner auf Startseite)                                                                                               |
| `20260301000003_audit_columns_uuid_fk.sql`           | Audit-Spalten umbenennen (created_by, updated_at, updated_by), TEXT→UUID, FK auf auth.users(id)                                                                   |
| `20260302000001_system_messages_multi_row.sql`       | system_messages von Singleton auf Multi-Row umstellen (Constraint entfernen, INSERT/DELETE-Policies)                                                              |
| `20260302000002_create_revoke_sessions_function.sql` | SQL-Funktion `revoke_user_sessions()` zum Löschen von Auth-Sessions (für sign-out-all-users Edge Function)                                                        |
| `20260303000001_create_departments.sql`              | Stammdaten-Tabelle für Abteilungen (z.B. Gemüse, Milchprodukte)                                                                                                   |
| `20260303000002_create_units.sql`                    | Stammdaten-Tabelle für Einheiten (z.B. kg, Stück, dl)                                                                                                             |
| `20260303000003_create_materials.sql`                | Stammdaten-Tabelle für Material (z.B. Küchenutensilien)                                                                                                           |
| `20260303000004_create_products.sql`                 | Stammdaten-Tabelle für Produkte (Zutaten mit Abteilung/Einheit)                                                                                                   |
| `20260303000005_create_unit_conversion_basic.sql`    | Basis-Umrechnungen zwischen Einheiten                                                                                                                             |
| `20260303000006_create_unit_conversion_products.sql` | Produktspezifische Umrechnungen zwischen Einheiten                                                                                                                |
| `20260303000007_tighten_media_users_policies.sql`    | RLS-Policies für media bucket und users-Tabelle verschärft                                                                                                        |
| `20260304000001_create_recipes.sql`                  | Rezept-Tabellen: recipes, recipe_ingredients, recipe_preparation_steps, recipe_materials, recipe_ratings, recipe_comments (inkl. Trigger für Bewertungs-Aggregat) |
| `20260306000001_fix_recipes_rls.sql`                 | RLS-Policies für alle Rezept-Tabellen angepasst: SELECT für alle authentifizierten Benutzer geöffnet; UPDATE/DELETE auf `is_community_leader()` erweitert (statt nur `is_admin()`) |
| `20260307000001_add_no_comments_to_recipes.sql`      | `no_comments`-Spalte auf `recipes` + SECURITY DEFINER Trigger `update_recipe_no_comments()` (hält Zähler bei INSERT/DELETE auf `recipe_comments` aktuell)         |
| `20260307000002_get_comment_author_profiles.sql`     | SECURITY DEFINER Funktion `get_comment_author_profiles(uids UUID[])`: gibt `auth_uid`, `display_name`, `picture_src` für eine Liste von Auth-UUIDs zurück, umgeht RLS auf `public.users` und exponiert nur öffentliche Profilfelder |
| `20260307000003_fix_users_link_auth_policy.sql`      | Sicherheits-Fix: `users_link_auth`-Policy um `roles`-Vergleich in `WITH CHECK` erweitert — verhindert Privilege Escalation über die Auth-Linking-Policy während `auth_uid IS NULL` |

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

### Produktions-Checkliste Edge Functions

- [ ] `VESTABOARD_READ_WRITE_KEY` in `.env` setzen
- [ ] `FUNCTIONS_VERIFY_JWT` auf `true` setzen (produktiv JWT-Verifizierung aktivieren)
- [ ] `BREVO_API_KEY` in `.env` setzen (Brevo Transactional Email für `notify-recipe-comment`)
- [ ] Brevo Sender-Adresse `hallo@chuchipirat.ch` im Brevo-Konto als verifizierte Absenderadresse einrichten

---

## 4. Storage

### Media Bucket

Wird durch Migration `20260227000002_create_media_bucket.sql` erstellt. Enthält:

- Profilbilder unter `users/{uid}/profile/`
- RLS Policies für öffentliches Lesen und Eigentümer-Schreiben

---

## 5. Daten-Migration (Firebase → Postgres)

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
9. Weitere Entitäten (Events, Rezepte, etc.) folgen in späteren Phasen

---

## 6. Einmalige SQL-Korrekturen

SQL-Statements die einmalig auf bestehenden Umgebungen ausgeführt werden müssen (z.B. nach Bugfixes):

### displayName-Korrektur (Bug: displayName war auf E-Mail gesetzt)

```sql
UPDATE public.users
SET display_name = TRIM(first_name || ' ' || last_name)
WHERE display_name = email;
```

---

## 7. Umgebungsspezifische Werte

| Variable                    | Dev (lokal)               | Test          | Produktion               |
| --------------------------- | ------------------------- | ------------- | ------------------------ |
| `SITE_URL`                  | `http://localhost:3000`   | TBD           | `https://chuchipirat.ch` |
| `API_EXTERNAL_URL`          | `http://localhost:8000`   | TBD           | TBD                      |
| `SMTP_HOST`                 | `supabase-mail` (MailPit) | TBD           | Echter SMTP-Server       |
| `SMTP_PORT`                 | `1025`                    | TBD           | `587`                    |
| `ENABLE_EMAIL_AUTOCONFIRM`  | `false`                   | `false`       | `false`                  |
| `VESTABOARD_READ_WRITE_KEY` | `949a380f...`             | `949a380f...` | `949a380f...`            |
| `FUNCTIONS_VERIFY_JWT`      | `false`                   | `true`        | `true`                   |
