# Supabase Environment Setup Runbook

Dieses Dokument beschreibt alle manuellen Schritte, die beim Aufsetzen einer neuen Umgebung (dev/test/prod) durchgeführt werden müssen — zusätzlich zu den automatischen SQL-Migrationen.

---

## 1. SQL-Migrationen ausführen

Die Migrationen unter `supabase/migrations/` müssen in Reihenfolge ausgeführt werden:

| Migration | Beschreibung |
|-----------|-------------|
| `20260225000001_create_users.sql` | Users-Tabelle, user_profiles View |
| `20260226000001_add_auth_uid.sql` | Auth UID, RLS Policies, Hilfsfunktionen |
| `20260226000002_drop_member_since_last_login.sql` | Alte Spalten entfernen |
| `20260227000001_collapse_picture_columns.sql` | Bild-Spalten zusammenführen |
| `20260227000002_create_media_bucket.sql` | Storage Bucket + Policies |
| `20260228000001_add_auth_uid_foreign_key.sql` | FK auf auth.users |
| `20260228000002_add_increment_logins_function.sql` | Atomare Login-Zähler-Funktion |
| `20260228000003_sync_auth_email_trigger.sql` | Trigger: E-Mail-Sync auth.users → public.users |
| `20260301000001_create_global_settings.sql` | Singleton-Tabelle für globale Einstellungen (allowSignUp, maintenanceMode) |
| `20260301000002_create_system_messages.sql` | Singleton-Tabelle für Systemmeldungen (Alert-Banner auf Startseite) |
| `20260301000003_audit_columns_uuid_fk.sql` | Audit-Spalten umbenennen (created_by, updated_at, updated_by), TEXT→UUID, FK auf auth.users(id) |
| `20260302000001_system_messages_multi_row.sql` | system_messages von Singleton auf Multi-Row umstellen (Constraint entfernen, INSERT/DELETE-Policies) |
| `20260302000002_create_revoke_sessions_function.sql` | SQL-Funktion `revoke_user_sessions()` zum Löschen von Auth-Sessions (für sign-out-all-users Edge Function) |

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

| Funktion | Beschreibung | Benötigte Env-Vars |
|----------|-------------|-------------------|
| `main` | Dispatcher/Router (required) | `JWT_SECRET`, `VERIFY_JWT` |
| `notify-vestaboard` | Vestaboard-Willkommensnachricht bei E-Mail-Verifizierung | `VESTABOARD_READ_WRITE_KEY` |
| `sign-out-all-users` | Meldet alle Nicht-Admin-Benutzer ab (Admin-Funktion) | `SUPABASE_SERVICE_ROLE_KEY` |

### Produktions-Checkliste Edge Functions

- [ ] `VESTABOARD_READ_WRITE_KEY` in `.env` setzen
- [ ] `FUNCTIONS_VERIFY_JWT` auf `true` setzen (produktiv JWT-Verifizierung aktivieren)

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
3. Weitere Entitäten (Events, Rezepte, etc.) folgen in späteren Phasen

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

| Variable | Dev (lokal) | Test | Produktion |
|----------|-------------|------|------------|
| `SITE_URL` | `http://localhost:3000` | TBD | `https://chuchipirat.ch` |
| `API_EXTERNAL_URL` | `http://localhost:8000` | TBD | TBD |
| `SMTP_HOST` | `supabase-mail` (MailPit) | TBD | Echter SMTP-Server |
| `SMTP_PORT` | `1025` | TBD | `587` |
| `ENABLE_EMAIL_AUTOCONFIRM` | `false` | `false` | `false` |
| `VESTABOARD_READ_WRITE_KEY` | `949a380f...` | `949a380f...` | `949a380f...` |
| `FUNCTIONS_VERIFY_JWT` | `false` | `true` | `true` |
