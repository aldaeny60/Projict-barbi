"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, WifiOff, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "barbi_install_dismissed_v1";

/**
 * تجهيز PWA: تسجيل عامل الخدمة (عمل بدون اتصال)، دعوة تثبيت التطبيق،
 * ومؤشر بسيط عند انقطاع الشبكة.
 */
export function PwaSetup() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [offline, setOffline] = useState(false);

  /* تسجيل عامل الخدمة في الإنتاج فقط (حتى لا يعطّل التخزين تطوير محلي) */
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  /* دعوة التثبيت — تظهر مرة واحدة، وتُخفى إن ثبّت المستخدم أو رفضها */
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        /* ignore */
      }
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setShowBanner(!dismissed && !standalone);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  /* مؤشر انقطاع الشبكة */
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const dismiss = () => {
    setShowBanner(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    try {
      await prompt.userChoice;
    } catch {
      /* ignore */
    }
    setPrompt(null);
    setShowBanner(false);
  };

  return (
    <>
      <AnimatePresence>
        {offline && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed inset-x-0 top-0 z-[130] flex items-center justify-center gap-2 bg-ink px-4 py-2 text-[11px] font-black text-white"
          >
            <WifiOff size={13} className="text-butter-300" /> بدون اتصال — تتصفحين آخر نسخة محفوظة، والسلة محفوظة على جهازج
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="fixed inset-x-3 bottom-24 z-[60] md:inset-x-auto md:bottom-6 md:right-6 md:w-80"
          >
            <div className="card-bubble flex items-start gap-3 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blush-300 to-lilac-300 text-white shadow-soft">
                <Download size={19} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-black leading-snug">ثبّتي تطبيق باربي على شاشتج</p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-ink-soft">
                  يفتح أسرع، ويشتغل حتى بدون إنترنت — بدون متجر تطبيقات.
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={install}
                    className="rounded-full bg-ink px-4 py-1.5 text-[11px] font-black text-white transition-transform hover:scale-105 active:scale-95"
                  >
                    تثبيت
                  </button>
                  <button onClick={dismiss} className="rounded-full bg-ink/5 px-4 py-1.5 text-[11px] font-black text-ink-soft">
                    مو هسة
                  </button>
                </div>
              </div>
              <button onClick={dismiss} aria-label="إغلاق" className="text-ink-faint transition-colors hover:text-ink">
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
