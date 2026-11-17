#!/usr/bin/env bash
# نسخة احتياطية مضغوطة من قاعدة باربي مع تشذيب النسخ القديمة.
# الاستخدام:  DATABASE_URL=postgres://... ./scripts/backup.sh [مجلد-الوجهة]
# الافتراضي: ./backups — ويحفظ آخر 14 نسخة فقط.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL مطلوب}"
DEST="${1:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$DEST/barbi-$STAMP.sql.gz"

mkdir -p "$DEST"
echo "→ نسخ احتياطي إلى $FILE"
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" | gzip -9 > "$FILE"

# اختبار سلامة الملف: gzip -t يفشل إذا كان الملف تالفاً
gzip -t "$FILE"
SIZE="$(du -h "$FILE" | cut -f1)"
echo "✓ تم ($SIZE)"

# تشذيب: احتفظ بآخر 14 نسخة
ls -1t "$DEST"/barbi-*.sql.gz 2>/dev/null | tail -n +15 | while read -r old; do
  echo "× حذف نسخة قديمة: $old"
  rm -f "$old"
done

echo "للتحقق من نسخة:  zcat \"$FILE\" | head -n 20"
echo "للاستعادة:        gunzip -c \"$FILE\" | psql \"\$DATABASE_URL\""
