import "dotenv/config";
import type { Config } from "drizzle-kit";

/* config مشروع باربي — يقرأ رابط القاعدة من البيئة (لا أسرار مكتوبة بالمستودع) */
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL غير موجود — انسخ .env.example إلى .env وعبّئ رابط PostgreSQL ثم أعد الأمر."
  );
}

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
