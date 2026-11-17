#!/usr/bin/env bash
# استعادة نسخة احتياطية من ملف .sql.gz الذي ينتجه scripts/backup.sh
#
#   CONFIRM_RESTORE=yes DATABASE_URL=postgres://... ./scripts/restore.sh backups/barbi-20260101T000000Z.sql.gz
#
# تحذير: الاستعادة تُعيد إنشاء الجداول وتستبدل بياناتها. اطلب نسخة احتياطية
# جديدة قبل التنفيذ، ولا تستخدمها على قاعدة فيها بيانات لا تريد فقدانها.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL مطلوب}"
: "${1:?مرّر مسار ملف النسخة .sql.gz}"
FILE="$1"

if [ ! -f "$FILE" ]; then
  echo "✗ الملف غير موجود: $FILE" >&2
  exit 1
fi

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "✗ للتنفيذ أعد الأمر مع CONFIRM_RESTORE=yes — العملية تستبدل بيانات القاعدة." >&2
  exit 1
fi

echo "→ التحقق من سلامة الملف"
gzip -t "$FILE"

echo "→ استعادة إلى قاعدة الهدف"
gunzip -c "$FILE" | psql "$DATABASE_URL" --single-transaction --set ON_ERROR_STOP=1

echo "✓ تمت الاستعادة من $FILE"
echo "تحقّق سريع:"
psql "$DATABASE_URL" -c "select count(*) as products from products;" \
                     -c "select count(*) as orders from orders;"
