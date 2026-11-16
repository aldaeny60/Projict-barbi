export const BAGHDAD_TZ = "Asia/Baghdad";

/** Format a number as Iraqi Dinar with thousand separators: 25,000 د.ع */
export function formatIQD(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} د.ع`;
}

/** Plain grouped number: 25,000 */
export function formatNum(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

const dtFmt = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
  timeZone: BAGHDAD_TZ,
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});

const dFmt = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
  timeZone: BAGHDAD_TZ,
  dateStyle: "medium",
});

const tFmt = new Intl.DateTimeFormat("ar-IQ-u-nu-latn", {
  timeZone: BAGHDAD_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: BAGHDAD_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function fmtDateTime(d: string | Date): string {
  return dtFmt.format(new Date(d));
}
export function fmtDate(d: string | Date): string {
  return dFmt.format(new Date(d));
}
export function fmtTime(d: string | Date): string {
  return tFmt.format(new Date(d));
}
/** YYYY-MM-DD in Baghdad timezone */
export function baghdadDayKey(d: string | Date): string {
  return dayKeyFmt.format(new Date(d));
}
/** Today key in Baghdad */
export function baghdadTodayKey(): string {
  return dayKeyFmt.format(new Date());
}
/** Start/end of a Baghdad day as Date objects (for DB range queries) */
export function baghdadDayRange(dayKey: string): { start: Date; end: Date } {
  const start = new Date(`${dayKey}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export const IRAQI_PHONE_RE = /^07[5-9]\d{8}$/;
export function isValidIraqiPhone(p: string): boolean {
  return IRAQI_PHONE_RE.test(p.replace(/\s/g, ""));
}

export function maskPhone(p: string): string {
  return p.length > 6 ? `${p.slice(0, 4)}•••${p.slice(-3)}` : p;
}
