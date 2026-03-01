/**
 * Yerel zaman dilimi tarih yardımcıları.
 * Kullanıcının bulunduğu yere göre çalışır: İsveç'te İsveç saati, Türkiye'de Türkiye saati.
 * Tarayıcıda Date getter'ları (getFullYear, getMonth, getDate, getDay) zaten cihazın yerel saatine göredir.
 * Tüm "bugün", "bu hafta", "bu ay" hesapları bu dosyadan yapılır; böylece tek noktada tutarlı davranış sağlanır.
 */

/**
 * Verilen anda "bugün"ü yerel saat diliminde YYYY-MM-DD olarak döner.
 * @param date Referans an (genelde new Date()); yerel saatteki gün kullanılır.
 */
export function getLocalTodayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Verilen anda "bu ay"ı yerel saat diliminde YYYY-MM olarak döner.
 */
export function getLocalMonthString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Hafta: Pazartesi 00:00 – Pazar 23:59 (hafta bitişi Pazar).
 * Verilen anın yerel saatine göre o haftanın başlangıç ve bitiş tarihlerini YYYY-MM-DD döner.
 */
export function getLocalWeekRange(date: Date): { start: string; end: string } {
  const dayOfWeek = date.getDay(); // 0=Pazar, 1=Pazartesi, ..., 6=Cumartesi
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(date);
  monday.setDate(monday.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return {
    start: getLocalTodayString(monday),
    end: getLocalTodayString(sunday),
  };
}

/**
 * Yerel "bugün" için tarih karşılaştırma fonksiyonu.
 * jobDate YYYY-MM-DD string; yerel bugünle eşleşiyorsa true.
 */
export function isLocalToday(jobDate: string, now: Date): boolean {
  return jobDate === getLocalTodayString(now);
}

/**
 * Yerel "bu hafta" (Pazartesi–Pazar) için karşılaştırma.
 */
export function isLocalThisWeek(jobDate: string, now: Date): boolean {
  const { start, end } = getLocalWeekRange(now);
  return jobDate >= start && jobDate <= end;
}

/**
 * Yerel "bu ay" için karşılaştırma.
 */
export function isLocalThisMonth(jobDate: string, now: Date): boolean {
  return jobDate.slice(0, 7) === getLocalMonthString(now);
}
