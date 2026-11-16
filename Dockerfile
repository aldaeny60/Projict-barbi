# باربي — صورة إنتاج: Next.js + PostgreSQL عبر DATABASE_URL (يُمرَّر وقت التشغيل)
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# البناء لا يتصل بالقاعدة (الصفحات الديناميكية تُبنى عند الطلب)، فيكفي رابط وهمي هنا.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

ENV NODE_ENV=production
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "start"]
