#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# رفع مشروع باربي إلى GitHub
#
# الاستخدام:
#   1) أنشئ مستودعاً فارغاً على https://github.com/new (بدون README)
#   2) شغّل:
#        bash scripts/push-to-github.sh git@github.com:YOUR_USER/barbi-kids.git
#      أو لو تفضّل HTTPS مع Personal Access Token:
#        bash scripts/push-to-github.sh https://github.com/YOUR_USER/barbi-kids.git
#
#     لو تستخدم HTTPS سيطُلب منك المستخدم والتوكن (Settings → Developer
#     settings → Personal access tokens → Fine-grained → Contents: RW)
# ────────────────────────────────────────────────────────────
set -euo pipefail

REMOTE_URL="${1:-}"
if [ -z "$REMOTE_URL" ]; then
  echo "استخدام: bash scripts/push-to-github.sh <رابط-المستودع>"
  echo "مثال: bash scripts/push-to-github.sh git@github.com:you/barbi-kids.git"
  exit 1
fi

cd "$(dirname "$0")/.."

# تأكد أن كل التعديلات محفوظة كـ commit
if ! git diff --quiet || ! git diff --cached --quiet; then
  git add -A
  git -c user.name="Barbi Dev" -c user.email="dev@sighar.iq" commit -m "chore: تحديثات قبل الرفع" || true
fi

git branch -M main
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

echo "جاري الرفع إلى $REMOTE_URL ..."
git push -u origin main
echo "تم! المشروع الآن على GitHub."
