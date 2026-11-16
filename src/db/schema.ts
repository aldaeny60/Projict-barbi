import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  jsonb,
  timestamp,
  boolean,
  numeric,
  index,
} from "drizzle-orm/pg-core";

/* ───────────────────────── catalog ───────────────────────── */

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  nameAr: varchar("name_ar", { length: 140 }).notNull(),
  section: varchar("section", { length: 16 }).notNull(), // boys | girls | newborn
  tint: varchar("tint", { length: 24 }).notNull().default("blush"),
  sort: integer("sort").notNull().default(0),
});

export type CategoryRow = typeof categories.$inferSelect;

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull().unique(),
    name: varchar("name", { length: 220 }).notNull(),
    description: text("description").notNull(),
    price: integer("price").notNull(), // IQD
    compareAtPrice: integer("compare_at_price"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    colors: jsonb("colors").$type<{ name: string; hex: string }[]>().notNull().default([]),
    sizes: jsonb("sizes").$type<string[]>().notNull().default([]),
    categoryId: integer("category_id")
      .references(() => categories.id, { onDelete: "cascade" })
      .notNull(),
    barcode: varchar("barcode", { length: 32 }).unique(),
    stock: integer("stock").notNull().default(0),
    rating: numeric("rating", { precision: 2, scale: 1 }).notNull().default("4.5"),
    reviewsCount: integer("reviews_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    isNew: boolean("is_new").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_name_idx").on(t.name),
  ]
);

export type ProductRow = typeof products.$inferSelect;

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  author: varchar("author", { length: 120 }).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReviewRow = typeof reviews.$inferSelect;

/* ───────────────────────── customers ───────────────────────── */

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 140 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomerRow = typeof customers.$inferSelect;

/* ───────────────────────── orders ───────────────────────── */

export const ORDER_STATUSES = [
  "pending", // قيد التأكيد
  "processing", // قيد التجهيز
  "shipped", // تم الشحن
  "out_for_delivery", // قيد التوصيل
  "delivered", // تم التسليم
  "cancelled", // ملغي
  "returned", // مرتجع
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderPayment = { method: string; amount: number };

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    source: varchar("source", { length: 8 }).notNull().default("web"), // web | pos
    status: varchar("status", { length: 24 }).notNull().default("pending"),
    customerName: varchar("customer_name", { length: 140 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    governorate: varchar("governorate", { length: 60 }),
    district: varchar("district", { length: 120 }),
    address: text("address"),
    notes: text("notes"),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("cod"),
    payments: jsonb("payments").$type<OrderPayment[]>().notNull().default([]),
    subtotal: integer("subtotal").notNull(),
    discountTotal: integer("discount_total").notNull().default(0),
    couponCode: varchar("coupon_code", { length: 40 }),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    total: integer("total").notNull(),
    branchId: integer("branch_id"),
    shiftId: integer("shift_id"),
    staffName: varchar("staff_name", { length: 140 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_created_idx").on(t.createdAt), index("orders_phone_idx").on(t.phone)]
);

export type OrderRow = typeof orders.$inferSelect;

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    productId: integer("product_id"),
    name: varchar("name", { length: 220 }).notNull(),
    image: varchar("image", { length: 600 }),
    price: integer("price").notNull(),
    qty: integer("qty").notNull(),
    size: varchar("size", { length: 40 }),
    color: varchar("color", { length: 60 }),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)]
);

export type OrderItemRow = typeof orderItems.$inferSelect;

/* ───────────────────────── marketing / delivery ───────────────────────── */

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  type: varchar("type", { length: 12 }).notNull(), // percent | fixed
  value: integer("value").notNull(),
  minSubtotal: integer("min_subtotal").notNull().default(0),
  description: varchar("description", { length: 220 }),
  active: boolean("active").notNull().default(true),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export type CouponRow = typeof coupons.$inferSelect;

export const deliveryFees = pgTable("delivery_fees", {
  id: serial("id").primaryKey(),
  governorate: varchar("governorate", { length: 60 }).notNull().unique(),
  fee: integer("fee").notNull(),
  eta: varchar("eta", { length: 60 }).notNull(),
  carrier: varchar("carrier", { length: 60 }).notNull(),
});

export type DeliveryFeeRow = typeof deliveryFees.$inferSelect;

/* ───────────────────────── POS ───────────────────────── */

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  city: varchar("city", { length: 60 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address: varchar("address", { length: 220 }),
});

export type BranchRow = typeof branches.$inferSelect;

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .notNull(),
  staffName: varchar("staff_name", { length: 140 }).notNull(),
  role: varchar("role", { length: 24 }).notNull().default("cashier"), // cashier | supervisor | manager
  status: varchar("status", { length: 12 }).notNull().default("open"), // open | closed
  openingCash: integer("opening_cash").notNull().default(0),
  closingCash: integer("closing_cash"),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export type ShiftRow = typeof shifts.$inferSelect;
