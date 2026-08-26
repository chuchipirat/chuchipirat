#!/usr/bin/env bash
#
# Hebt ein bestehendes Postgres-15-Datenverzeichnis (z.B. nach einem
# --force-recreate der db-Service) verlustfrei auf das im docker-compose
# gepinnte Postgres-17-Image. Postgres-Major-Upgrades funktionieren nicht
# in-place ueber einen simplen Image-Wechsel (siehe FATAL "database files
# are incompatible with server") -- deshalb: Daten aus dem alten Image
# dumpen, Cluster mit dem neuen Image frisch initialisieren, Projekt-
# Migrationen erneut anwenden, Daten zurueckspielen.
#
# Aufruf: aus dem Verzeichnis mit docker-compose.yml (z.B. supabase/):
#   ./utils/upgrade-pg17.sh
#
# Sicherheit: Das Original-Datenverzeichnis wird nie geloescht, nur zur
# Seite gelegt (mv). Bei jedem Fehler bricht das Skript ab (set -e).

set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$COMPOSE_DIR"

DATA_DIR="volumes/db/data"
OLD_IMAGE="supabase/postgres:15.8.1.085"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_COPY="${DATA_DIR}.pg15-backup-${TIMESTAMP}"
ORIGINAL_MOVED="${DATA_DIR}.pg15-original-${TIMESTAMP}"
DUMP_FILE="pg15-data-${TIMESTAMP}.dump"
TEMP_CONTAINER="pg17-upgrade-tmp-${TIMESTAMP}"

echo "==> Arbeitsverzeichnis: $COMPOSE_DIR"

if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  echo "Kein Datenverzeichnis unter $DATA_DIR gefunden -- nichts zu tun."
  exit 0
fi

CURRENT_VERSION="$(cat "$DATA_DIR/PG_VERSION")"
if [ "$CURRENT_VERSION" != "15" ]; then
  echo "Datenverzeichnis ist bereits Version $CURRENT_VERSION -- keine Migration noetig."
  exit 0
fi

if [ ! -f ".env" ]; then
  echo "FEHLER: .env nicht gefunden in $COMPOSE_DIR" >&2
  exit 1
fi

# .env enthaelt unquotierte Werte mit Leerzeichen (z.B. STUDIO_DEFAULT_ORGANIZATION) --
# ein simples `source .env` scheitert daran. Nur die hier benoetigten Variablen gezielt lesen.
POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' .env | head -1 | cut -d'=' -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' .env | head -1 | cut -d'=' -f2-)"
if [ -z "$POSTGRES_PASSWORD" ] || [ -z "$POSTGRES_DB" ]; then
  echo "FEHLER: POSTGRES_PASSWORD oder POSTGRES_DB nicht in .env gefunden." >&2
  exit 1
fi

DB_CONTAINER_NAME="$(docker compose config db 2>/dev/null | awk -F': ' '/container_name:/{print $2; exit}')"
if [ -z "$DB_CONTAINER_NAME" ]; then
  echo "FEHLER: container_name fuer den db-Service konnte nicht ermittelt werden." >&2
  exit 1
fi

echo "==> Schritt 1/8: db-Service stoppen (falls im Crash-Loop)"
docker compose stop db >/dev/null 2>&1 || true

echo "==> Schritt 2/8: Sicherheitskopie des PG15-Datenverzeichnisses anlegen"
echo "    $DATA_DIR -> $BACKUP_COPY"
cp -a "$DATA_DIR" "$BACKUP_COPY"

echo "==> Schritt 3/8: temporaeren Postgres-15-Container gegen die Kopie starten"
docker run -d --name "$TEMP_CONTAINER" \
  -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
  -e POSTGRES_DB="$POSTGRES_DB" \
  -v "$COMPOSE_DIR/$BACKUP_COPY:/var/lib/postgresql/data" \
  "$OLD_IMAGE" \
  postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null

cleanup_temp_container() {
  docker stop "$TEMP_CONTAINER" >/dev/null 2>&1 || true
  docker rm "$TEMP_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup_temp_container EXIT

echo "    Warte auf pg_isready..."
READY=0
for _ in $(seq 1 30); do
  if docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$TEMP_CONTAINER" pg_isready -U supabase_admin -h localhost >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [ "$READY" != "1" ]; then
  echo "FEHLER: Postgres 15 (temporaerer Container) wurde nicht bereit." >&2
  exit 1
fi

echo "==> Schritt 4/8: Migrationsstand pruefen (nur Information)"
MIGRATION_COUNT="$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$TEMP_CONTAINER" psql -U supabase_admin -d postgres -t -A \
  -c "SELECT count(*) FROM internal.schema_migrations;" 2>/dev/null || echo "?")"
FILE_COUNT="$(ls migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')"
echo "    internal.schema_migrations: $MIGRATION_COUNT angewendet, $FILE_COUNT Dateien im Repo"

echo "==> Schritt 5/8: Nur Daten dumpen (--data-only, kein Schema/Rollen)"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$TEMP_CONTAINER" pg_dump -U supabase_admin -d postgres \
  --data-only --disable-triggers -Fc -f "/tmp/${DUMP_FILE}"
docker cp "$TEMP_CONTAINER:/tmp/${DUMP_FILE}" "./${DUMP_FILE}"

DUMP_SIZE="$(du -h "./${DUMP_FILE}" | cut -f1)"
echo "    Dump gespeichert: ${DUMP_FILE} (${DUMP_SIZE})"
if [ ! -s "./${DUMP_FILE}" ]; then
  echo "FEHLER: Dump ist leer -- Abbruch, Original bleibt unangetastet." >&2
  exit 1
fi

cleanup_temp_container
trap - EXIT

echo "==> Schritt 6/8: Original-Datenverzeichnis beiseite legen (nicht loeschen)"
echo "    $DATA_DIR -> $ORIGINAL_MOVED"
mv "$DATA_DIR" "$ORIGINAL_MOVED"

echo "==> Schritt 7/8: frischen Postgres-17-Cluster starten"
docker compose up -d db

echo "    Warte auf 'healthy'..."
HEALTHY=0
for _ in $(seq 1 60); do
  STATUS="$(docker inspect --format='{{.State.Health.Status}}' "$DB_CONTAINER_NAME" 2>/dev/null || echo "starting")"
  if [ "$STATUS" = "healthy" ]; then
    HEALTHY=1
    break
  fi
  sleep 2
done
if [ "$HEALTHY" != "1" ]; then
  echo "FEHLER: neuer db-Container wurde nicht healthy. Original liegt unter $ORIGINAL_MOVED." >&2
  exit 1
fi

echo "==> Schritt 8/8: Projekt-Migrationen anwenden und Daten zurueckspielen"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER_NAME" psql -U supabase_admin -d postgres -c "
  CREATE SCHEMA IF NOT EXISTS internal;
  CREATE TABLE IF NOT EXISTS internal.schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );"

for f in $(ls migrations/*.sql | sort); do
  fname="$(basename "$f")"
  already="$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER_NAME" psql -U supabase_admin -d postgres -t -A \
    -c "SELECT 1 FROM internal.schema_migrations WHERE filename = '$fname';")"
  if [ "$already" = "1" ]; then
    echo "    Ueberspringe (bereits angewendet): $fname"
    continue
  fi
  echo "    Wende an: $fname"
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER_NAME" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 < "$f"
  docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER_NAME" psql -U supabase_admin -d postgres -c \
    "INSERT INTO internal.schema_migrations (filename) VALUES ('$fname');"
done

echo "    Spiele Daten zurueck..."
docker cp "./${DUMP_FILE}" "$DB_CONTAINER_NAME:/tmp/${DUMP_FILE}"
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" "$DB_CONTAINER_NAME" pg_restore -U supabase_admin -d postgres \
  --data-only --disable-triggers --no-owner "/tmp/${DUMP_FILE}"
docker exec "$DB_CONTAINER_NAME" rm -f "/tmp/${DUMP_FILE}"

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" -i "$DB_CONTAINER_NAME" psql -U supabase_admin -d postgres -c \
  "NOTIFY pgrst, 'reload schema';"

echo ""
echo "==> Fertig. Postgres 17 laeuft mit den zurueckgespielten Daten."
echo "    PG15-Kopie (Dump-Quelle):  $COMPOSE_DIR/$BACKUP_COPY"
echo "    PG15-Original (verschoben): $COMPOSE_DIR/$ORIGINAL_MOVED"
echo "    Dump-Datei: $COMPOSE_DIR/${DUMP_FILE}"
echo ""
echo "Bitte zuerst pruefen (Zeilenzahlen, App im Browser testen), dann"
echo "manuell aufraeumen: rm -rf \"$BACKUP_COPY\" \"$ORIGINAL_MOVED\" \"${DUMP_FILE}\""
