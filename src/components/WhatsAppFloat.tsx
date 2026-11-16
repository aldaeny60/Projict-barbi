"use client";

import { MessageCircle } from "lucide-react";
import { whatsappLink } from "@/lib/site";

/** زر واتساب عائم — يظهر بكل صفحات المتجر (لا يظهر في POS/الإدارة لأنهما بلا غلاف) */
export function WhatsAppFloat() {
  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصلي معنا على واتساب"
      title="دعم واتساب — من 9ص إلى 11م"
      className="fixed bottom-24 left-4 z-40 grid size-12 place-items-center rounded-full bg-minty-500 text-white shadow-pop ring-4 ring-white/70 transition-transform hover:scale-110 active:scale-95 md:bottom-6 md:left-6"
    >
      <MessageCircle size={21} />
    </a>
  );
}
