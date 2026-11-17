/** حالة الدفع كما تُخزَّن على الطلب — تُستخدم في الواجهة والإدارة */
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: "غير مدفوع",
  pending: "بانتظار تأكيد الدفع",
  paid: "مدفوع إلكترونياً",
  failed: "فشل الدفع",
};
