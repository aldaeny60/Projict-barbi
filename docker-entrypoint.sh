#!/bin/sh
# نقطة دخول الحاوية.
# - إذا مُرِّر DATABASE_URL: تشغيل عادي على قاعدة خارجية (إنتاج).
# - إذا لم يُمرَّر: وضع عرض تجريبي — قاعدة PostgreSQL مؤقتة داخل الحاوية،
#   تُنشأ وتُبذر عند الإقلاع وتُصفَّر مع إعادة التشغيل. لا تُستخدم بيانات حقيقية.
set -eu

if [ -n "${DATABASE_URL:-}" ]; then
  echo "→ DATABASE_URL مضبوط — تشغيل عادي"
  exec "$@"
fi

echo "→ وضع العرض التجريبي: قاعدة PostgreSQL مؤقتة داخل الحاوية"
export DEMO_MODE=1
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/barbi"
# رمز معروف ومقصود لنسخة العرض فقط (بيانات توضيحية تُصفَّر مع الحاوية)
export ADMIN_PIN="${ADMIN_PIN:-2024}"

PGDATA=/tmp/barbi-pg
mkdir -p "$PGDATA" /run/postgresql
chown -R postgres:postgres "$PGDATA" /run/postgresql

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  su-exec postgres initdb -D "$PGDATA" -U postgres --auth=trust >/tmp/initdb.log 2>&1
fi

su-exec postgres pg_ctl -D "$PGDATA" \
  -o "-c listen_addresses=127.0.0.1 -c shared_buffers=32MB -c max_connections=20 -c fsync=off" \
  -l /tmp/pg.log -w start

if ! su-exec postgres psql -h 127.0.0.1 -U postgres -lqt | cut -d'|' -f1 | grep -qw barbi; then
  su-exec postgres createdb -h 127.0.0.1 -U postgres barbi
fi

echo "→ إنشاء المخطط من schema"
npx drizzle-kit push --force

echo "→ تشغيل التطبيق"
"$@" &
APP_PID=$!

# بذر بيانات العرض بعد جاهزية الخادم (لا يفشل الحاوية إن تعذّر)
APP_URL="http://127.0.0.1:${PORT:-3000}" node scripts/boot-seed.mjs || true

wait "$APP_PID"
