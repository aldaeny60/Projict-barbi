# باربي — صورة Next.js
# الإنتاج: مرّر DATABASE_URL إلى PostgreSQL خارجي (docker compose يفعل ذلك).
# بلا DATABASE_URL: تعمل الحاوية في «وضع عرض» بقاعدة مؤقتة داخلية تُبذر تلقائياً.
FROM node:22-alpine

WORKDIR /app

# قاعدة البيانات المؤقتة لوضع العرض (تُستخدم فقط عند غياب DATABASE_URL)
RUN apk add --no-cache postgresql postgresql-client su-exec

COPY package.json ./
RUN npm install

COPY . .

# البناء لا يتصل بالقاعدة (الصفحات الديناميكية تُبنى عند الطلب)، فيكفي رابط وهمي هنا.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

ENV NODE_ENV=production
EXPOSE 3000

RUN chmod +x docker-entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
