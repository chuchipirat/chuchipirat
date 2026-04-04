# Supabase Environment Setup Runbook

Dieses Dokument beschreibt alle manuellen Schritte, die beim Aufsetzen einer neuen Umgebung (dev/test/prod) durchgeführt werden müssen — zusätzlich zu den automatischen SQL-Migrationen.

---

## 1. SQL-Migrationen ausführen

Die Migrationen unter `supabase/migrations/` müssen in Reihenfolge ausgeführt werden:

### Baseline-Dateien

Die 7 Baseline-Dateien unter `supabase/migrations/` definieren das komplette Schema:

| Migration                             | Beschreibung                                                   |
| ------------------------------------- | -------------------------------------------------------------- |
| `20260401000001_extensions_enums.sql` | Extensions (pg_trgm, pg_net, pg_cron), ENUMs, Sequences        |
| `20260401000002_tables.sql`           | Alle Tabellen mit FKs, Constraints, RLS enabled                |
| `20260401000003_functions.sql`        | Alle Funktionen (Trigger, RLS-Helfer, API, Admin, RPC)         |
| `20260401000004_views.sql`            | Alle Views (security_invoker)                                  |
| `20260401000005_triggers.sql`         | Alle Triggers                                                  |
| `20260401000006_rls_policies.sql`     | Alle RLS Policies                                              |
| `20260401000007_grants_indexes.sql`   | Grants, Default Privileges, Indizes, Storage Bucket + Policies |

### Neue Migrationen nach Baseline

Änderungen nach dem Baseline gehen in individuelle, timestamped Migrationsdateien (z.B. `20260405000001_add_foo_column.sql`). Jede Datei ist eigenständig (Tabellenänderungen + zugehörige RLS + Grants + Indizes). Namensschema: `YYYYMMDDNNNNNN_beschreibender_name.sql`.

### Docker-Umgebung

Migrationen werden beim `docker compose up` **nicht** automatisch ausgeführt. Sie müssen manuell über das Supabase Studio SQL Editor (`http://localhost:8000`) oder via `psql` eingespielt werden.

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

| Funktion                    | Beschreibung                                                                                                                                                                                                                    | Benötigte Env-Vars                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `main`                      | Dispatcher/Router (required)                                                                                                                                                                                                    | `JWT_SECRET`, `VERIFY_JWT`                                                                                  |
| `notify-vestaboard`         | Vestaboard-Willkommensnachricht bei E-Mail-Verifizierung                                                                                                                                                                        | `VESTABOARD_READ_WRITE_KEY`                                                                                 |
| `sign-out-all-users`        | Meldet alle Nicht-Admin-Benutzer ab (Admin-Funktion)                                                                                                                                                                            | `SUPABASE_SERVICE_ROLE_KEY`                                                                                 |
| `notify-recipe-comment`     | Sendet E-Mail an Rezeptautor wenn ein Kommentar eingefügt wird. Wird automatisch von `RecipeCommentRepository.insertComment()` als Fire-and-Forget aufgerufen. Primär über Brevo API, Fallback auf SMTP für lokale Entwicklung. | `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` (Produktion) oder `SMTP_HOST`/`SMTP_PORT` (lokale Entwicklung) |
| `notify-request`            | Sendet E-Mail-Benachrichtigungen bei Antrags-Aktionen (neuer Antrag, Kommentar, Status-Änderung)                                                                                                                                | `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` oder `SMTP_HOST`/`SMTP_PORT`                                   |
| `send-mail`                 | Generische Mail-Versand-Funktion für die Admin-Mail-Konsole. Unterstützt Empfänger per E-Mail, UID oder Rolle. Protokolliert in `mail_log`-Tabelle                                                                              | `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` oder `SMTP_HOST`/`SMTP_PORT`                                   |
| `send-welcome-email`        | Willkommens-E-Mail bei neuer Registrierung. Wird automatisch via Postgres-Trigger (pg_net) bei User-INSERT ausgelöst                                                                                                            | `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `BREVO_API_KEY` oder `SMTP_HOST`/`SMTP_PORT`                        |
| `cron-daily-digest`         | Tägliche Aktivitäts-Zusammenfassung für Community Leaders (02:15 UTC). Aggregiert Feeds + offene Anträge                                                                                                                        | `SUPABASE_SERVICE_ROLE_KEY`, `SENTRY_DSN`, `BREVO_API_KEY` oder `SMTP_HOST`/`SMTP_PORT`                     |
| `cron-support-user-cleanup` | Tägliches Entfernen des Support-Users aus beendeten Events (02:30 UTC)                                                                                                                                                          | `SUPABASE_SERVICE_ROLE_KEY`, `SUPPORT_USER_ID`, `SENTRY_DSN`                                                |
| `cron-event-review-email`   | Tägliche Feedback-E-Mail an Köche von gestern beendeten Events (01:00 UTC)                                                                                                                                                      | `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `SENTRY_DSN`, `BREVO_API_KEY` oder `SMTP_HOST`/`SMTP_PORT`          |

### Cron-Job-Konfiguration (pg_cron + pg_net)

Die Cron-Jobs werden via `pg_cron` in der Datenbank registriert und rufen Edge Functions über `pg_net.http_post()` auf. Dazu müssen folgende Postgres-Einstellungen gesetzt werden:

```sql
ALTER SYSTEM SET app.supabase_url = 'http://kong:8000';       -- Docker-interne URL
ALTER SYSTEM SET app.service_role_key = 'eyJ...';             -- Service Role JWT
SELECT pg_reload_conf();
```

### Produktions-Checkliste Edge Functions

- [ ] `VESTABOARD_READ_WRITE_KEY` in `.env` setzen
- [ ] `FUNCTIONS_VERIFY_JWT` auf `true` setzen (produktiv JWT-Verifizierung aktivieren)
- [ ] `BREVO_API_KEY` in `.env` setzen (Brevo Transactional Email für `notify-recipe-comment`)
- [ ] Brevo Sender-Adresse `hallo@chuchipirat.ch` im Brevo-Konto als verifizierte Absenderadresse einrichten
- [ ] `APP_URL` in `.env` setzen (z.B. `https://chuchipirat.ch`) — für Welcome- und Review-E-Mails
- [ ] `SENTRY_DSN` in `.env` setzen — für Sentry Crons Monitoring der Cron-Jobs
- [ ] `SUPPORT_USER_ID` in `.env` setzen — Auth-UUID des Support-Benutzers (gleicher Wert wie `VITE_SUPPORT_USER_ID`)
- [ ] `app.supabase_url` und `app.service_role_key` in Postgres setzen — für pg_cron/pg_net Aufrufe

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

Wird durch die Baseline-Migration `20260401000007_grants_indexes.sql` erstellt. Enthält:

- Profilbilder unter `users/{uid}/profile/`
- Event-Bilder unter `events/{event_uid}/`
- 7 RLS Policies: 1× öffentliches Lesen, 3× User-Profilbilder (INSERT/UPDATE/DELETE), 3× Event-Bilder (INSERT/UPDATE/DELETE via `is_event_cook()`)

---

## 5. Firebase Auth → Supabase Auth (User-Import)

Bevor Tabellen mit `FK → auth.users(id)` migriert werden (z.B. `requests`), müssen alle Firebase-Auth-Benutzer in Supabase Auth importiert werden. Siehe **[Firebase Auth Migration Playbook](../docs/claude/firebase-auth-migration.md)** für die vollständige Anleitung.

---

## 6. Daten-Migration (Firebase → Postgres)

Die Firebase-Daten müssen über die Admin-Migrationsseite (`/admin/migration`) migriert werden. Diese Seite ist nur für Admins zugänglich.

### Reihenfolge

1. **Users** migrieren (erstellt Zeilen in `public.users`)
2. **member_id Sequenz zurücksetzen** — nach der User-Migration muss die Identity-Sequenz auf den höchsten migrierten Wert gesetzt werden, damit neue Benutzer fortlaufende Nummern erhalten:
   ```sql
   SELECT setval(pg_get_serial_sequence('public.users', 'member_id'),
                 (SELECT COALESCE(MAX(member_id), 1) FROM public.users));
   ```
3. **Profilbilder** migrieren (kopiert von Firebase Storage in Supabase Storage)
4. **Departments** migrieren (Abteilungen)
5. **Units** migrieren (Einheiten)
6. **Materials** migrieren (Material/Küchenutensilien)
7. **Products** migrieren (Produkte/Zutaten — hängt von Departments + Units ab)
8. **UnitConversionBasic** migrieren (Basis-Umrechnungen — hängt von Units ab)
9. **UnitConversionProducts** migrieren (Produkt-Umrechnungen — hängt von Products + Units ab)
10. **Recipes** migrieren (Rezepte — hängt von Users, Products, Materials ab)
11. **Events** migrieren (Event-Kopfdaten, Köche, Zeitscheiben — hängt von Users ab)
12. **GroupConfig** migrieren (Gruppenconfig: Diäten, Unverträglichkeiten, Portionen — hängt von Events ab)
13. **Menuplan** migrieren (Menupläne: Mahlzeiten, Menüs, Rezepte, Produkte, Materialien — hängt von Events, GroupConfig, Recipes, Products, Materials ab)
14. **EventPictures** migrieren (kopiert Event-Bilder von Firebase Storage nach Supabase Storage — hängt von Events ab)
15. **RecipeVariants** migrieren (Varianten-Rezepte — hängt von Events, Recipes, Users, Products, Materials ab)
16. **UsedRecipeListMeals** migrieren (Meal-Zuordnungen für Mengenberechnungs-Listen — hängt von Events, Menuplan ab)
17. **ShoppingLists** migrieren (Einkaufslisten — hängt von Events, Products, Materials, Departments, Units ab)
18. **MaterialLists** migrieren (Materiallisten — hängt von Events, Materials ab)
19. **Requests** migrieren (Anträge — hängt von Users, Recipes ab)
20. **Feeds** migrieren (Feed-Einträge — hängt von Users, Recipes, Events, Products, Materials ab; `menuplanCreated` → `eventCreated`, `recipeCreated`/`none` übersprungen)

---

## 7. Umgebungsspezifische Werte

| Variable                    | Dev (lokal)                 | Test          | Produktion               |
| --------------------------- | --------------------------- | ------------- | ------------------------ |
| `SITE_URL`                  | `http://localhost:3000`     | TBD           | `https://chuchipirat.ch` |
| `API_EXTERNAL_URL`          | `http://localhost:8000`     | TBD           | TBD                      |
| `SMTP_HOST`                 | `supabase-mail` (MailPit)   | TBD           | Echter SMTP-Server       |
| `SMTP_PORT`                 | `1025`                      | TBD           | `587`                    |
| `ENABLE_EMAIL_AUTOCONFIRM`  | `false`                     | `false`       | `false`                  |
| `VESTABOARD_READ_WRITE_KEY` | `949a380f...`               | `949a380f...` | `949a380f...`            |
| `FUNCTIONS_VERIFY_JWT`      | `false`                     | `true`        | `true`                   |
| `BREVO_API_KEY`             | _(leer — SMTP-Fallback)_    | TBD           | Brevo API Key            |
| `VITE_SUPPORT_USER_ID`      | Auth-UUID des Support-Users | Auth-UUID     | Auth-UUID                |
