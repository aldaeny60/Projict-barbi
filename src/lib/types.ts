/** Shared DTO types between API routes and client components */

export type CategoryDTO = {
  id: number;
  slug: string;
  nameAr: string;
  section: "boys" | "girls" | "newborn";
  tint: string;
  sort: number;
};

export type ProductDTO = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  discountPct: number | null;
  images: string[];
  colors: { name: string; hex: string }[];
  sizes: string[];
  barcode: string | null;
  stock: number;
  rating: number;
  reviewsCount: number;
  soldCount: number;
  isNew: boolean;
  createdAt: string;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  section: "boys" | "girls" | "newborn";
};

export type ReviewDTO = {
  id: number;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type OrderItemDTO = {
  id: number;
  productId: number | null;
  name: string;
  image: string | null;
  price: number;
  qty: number;
  size: string | null;
  color: string | null;
};

export type OrderDTO = {
  id: number;
  code: string;
  source: "web" | "pos";
  status: string;
  customerName: string;
  phone: string;
  governorate: string | null;
  district: string | null;
  address: string | null;
  notes: string | null;
  paymentMethod: string;
  payments: { method: string; amount: number }[];
  subtotal: number;
  discountTotal: number;
  couponCode: string | null;
  deliveryFee: number;
  total: number;
  branchId: number | null;
  staffName: string | null;
  createdAt: string;
  items: OrderItemDTO[];
};

export type CouponDTO = {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  description: string | null;
  active: boolean;
  expiresAt: string | null;
};

export type DeliveryFeeDTO = {
  id: number;
  governorate: string;
  fee: number;
  eta: string;
  carrier: string;
};

export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  size: string;
  color: string;
  qty: number;
  stock: number;
};

export type ShiftDTO = {
  id: number;
  branchId: number;
  staffName: string;
  role: string;
  status: string;
  openingCash: number;
  closingCash: number | null;
  openedAt: string;
  closedAt: string | null;
};

export type BranchDTO = {
  id: number;
  name: string;
  city: string;
  phone: string | null;
  address: string | null;
};
