import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatNumberByLocale } from '../utils/formatLocale';
import type { Locale } from '../i18n/I18nContext';
import type { PayrollReportData } from './payrollReportService';

/** Convert text to ASCII for PDF so Turkish/dotted letters display correctly in default font. */
export function toAsciiForPdf(text: string): string {
  const map: Record<string, string> = {
    'ı': 'i', 'İ': 'I', 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
    'ş': 's', 'Ş': 'S', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C',
    'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'å': 'a', 'æ': 'ae',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'ù': 'u', 'ú': 'u', 'û': 'u', 'ñ': 'n', 'ÿ': 'y',
  };
  return String(text).replace(/[\u0080-\u024f]/g, (ch) => map[ch] ?? ch);
}

/** Cached logo data for PDF watermark during export session (URL -> { dataUrl, width, height }). */
const logoWatermarkCache = new Map<string, { dataUrl: string; width: number; height: number }>();

export type LogoWatermarkInfo = { dataUrl: string; width: number; height: number };

/**
 * Fetch company logo and convert to image data URL + dimensions for jsPDF.
 * SVG is rendered to canvas and exported as PNG (jsPDF does not support SVG).
 * Result is cached per URL for the export session.
 */
export async function getLogoForPdfWatermark(
  logoUrl: string
): Promise<LogoWatermarkInfo | null> {
  const cached = logoWatermarkCache.get(logoUrl);
  if (cached) return cached;

  try {
    const res = await fetch(logoUrl, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const isSvg = blob.type === 'image/svg+xml' || logoUrl.toLowerCase().endsWith('.svg');

    let raw: LogoWatermarkInfo;
    if (isSvg) {
      const text = await blob.text();
      const result = await svgToPngDataUrl(text);
      if (!result) return null;
      raw = { dataUrl: result.dataUrl, width: result.width, height: result.height };
    } else {
      const dataUrl = await blobToDataUrl(blob);
      const dims = await getImageDimensions(dataUrl);
      if (!dims) return null;
      raw = { dataUrl, width: dims.width, height: dims.height };
    }
    const info = await bakeWatermarkOpacity(raw);
    if (!info) return null;
    logoWatermarkCache.set(logoUrl, info);
    return info;
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function svgToPngDataUrl(svgText: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const w = img.naturalWidth || 400;
        const h = img.naturalHeight || 400;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        URL.revokeObjectURL(url);
        resolve({ dataUrl, width: w, height: h });
      } catch {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/** Watermark opacity baked into image (0.04–0.07). No setGState — avoids PDF viewer z-order issues. */
const WATERMARK_OPACITY = 0.05;
/** Logo uses ~80–90% of page (smaller dimension), centered. */
const WATERMARK_SIZE_RATIO = 0.85;

/**
 * Pre-blend logo at low opacity into a PNG. Baked opacity ensures the watermark is drawn on top of content (via didDrawPage) but remains subtle and never harms readability; no setGState.
 */
function bakeWatermarkOpacity(logo: LogoWatermarkInfo): Promise<LogoWatermarkInfo | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = logo.width;
        canvas.height = logo.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.globalAlpha = WATERMARK_OPACITY;
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 1;
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, width: logo.width, height: logo.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = logo.dataUrl;
  });
}

/**
 * Draw full-page centered watermark (baked opacity). Used in didDrawPage so it appears on every page on top of content but stays subtle.
 */
function drawWatermarkFullPage(
  doc: jsPDF,
  logo: LogoWatermarkInfo,
  pageWidth: number,
  pageHeight: number
): void {
  try {
    const maxDim = WATERMARK_SIZE_RATIO * Math.min(pageWidth, pageHeight);
    const scale = Math.min(maxDim / logo.width, maxDim / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2;
    doc.addImage(logo.dataUrl, 'PNG', x, y, w, h);
  } catch {
    // Skip watermark if addImage fails
  }
}

export type PayrollReportTranslations = {
  title: string;
  companyName: string;
  payrollPeriod: string;
  exportDate: string;
  totalApprovedJobs: string;
  totalAmount: string;
  totalWorkValue: string;
  teamEarnings: string;
  companyShare: string;
  completionDate: string;
  projectId: string;
  teamCode: string;
  workItemName: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  signatureProjectManager: string;
  signatureCompanyManager: string;
  noApprovedJobsInPeriod: string;
  footerGeneratedBy: string;
  footerPageNumber: string;
};

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function periodLabelForLocale(startDateStr: string, months: string[]): string {
  const [y, m] = startDateStr.split('-');
  const month = parseInt(m!, 10);
  return `${months[month - 1]} ${y}`;
}

export function getPeriodLabelForTitle(startDateStr: string, locale: string): string {
  const map: Record<string, string[]> = {
    en: MONTHS_EN,
    tr: MONTHS_TR,
    es: MONTHS_ES,
    fr: MONTHS_FR,
    de: MONTHS_DE,
  };
  const months = map[locale] ?? MONTHS_EN;
  return periodLabelForLocale(startDateStr, months);
}

/** File name: CompanyName_Payroll_YYYY-MM.xlsx */
export function getPayrollReportFileName(
  reportType: 'company' | 'team',
  companyName: string,
  teamCode: string | undefined,
  periodStart: string,
  format: 'xlsx' | 'pdf'
): string {
  const [y, m] = periodStart.split('-');
  const suffix = `${y}-${m}.${format}`;
  const safeName = (s: string) => s.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  if (reportType === 'team' && teamCode) {
    return `Team_${safeName(teamCode)}_Payroll_${suffix}`;
  }
  return `${safeName(companyName)}_Payroll_${suffix}`;
}

export function exportPayrollReportToExcel(
  data: PayrollReportData,
  tr: PayrollReportTranslations,
  locale: Locale = 'en'
): void {
  const periodRange = `${data.period.start} – ${data.period.end}`;
  const fmt = (n: number) => formatNumberByLocale(n, locale);
  const isTeam = data.reportType === 'team';

  const rows: (string | number)[][] = [
    [tr.title],
    [],
    [tr.companyName, data.companyName],
    [tr.payrollPeriod, periodRange],
    ...(isTeam && data.teamCode ? [[tr.teamCode, data.teamCode]] : []),
    [tr.exportDate, data.exportDate],
    [],
    [tr.totalApprovedJobs, data.totals.approvedJobsCount],
    ...(isTeam
      ? [[tr.teamEarnings, fmt(data.totals.teamEarnings)]]
      : [
          [tr.totalAmount, fmt(data.totals.totalAmount)],
          [tr.totalWorkValue, fmt(data.totals.totalAmount)],
          [tr.teamEarnings, fmt(data.totals.teamEarnings)],
          [tr.companyShare, fmt(data.totals.companyShare)],
        ]),
    [],
  ];

  const tableHeaders = isTeam
    ? [tr.completionDate, tr.projectId, tr.teamCode, tr.workItemName, tr.quantity, tr.unitPrice, tr.lineTotal, tr.teamEarnings]
    : [tr.completionDate, tr.projectId, tr.teamCode, tr.workItemName, tr.quantity, tr.unitPrice, tr.lineTotal, tr.teamEarnings, tr.companyShare];
  rows.push(tableHeaders);

  if (data.isEmpty) {
    rows.push(isTeam ? [tr.noApprovedJobsInPeriod, '', '', '', '', '', '', ''] : [tr.noApprovedJobsInPeriod, '', '', '', '', '', '', '', '']);
  } else {
    for (const j of data.jobs) {
      if (isTeam) {
        rows.push([j.completionDate, j.projectId, j.teamCode, j.workItemName, j.quantity, fmt(j.unitPrice), fmt(j.lineTotal), fmt(j.teamEarnings)]);
      } else {
        rows.push([j.completionDate, j.projectId, j.teamCode, j.workItemName, j.quantity, fmt(j.unitPrice), fmt(j.lineTotal), fmt(j.teamEarnings), fmt(j.companyShare)]);
      }
    }
  }

  rows.push([]);
  rows.push([]);
  rows.push([tr.signatureProjectManager]);
  rows.push([tr.signatureCompanyManager]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, data.reportType === 'company' ? 'Company Payroll' : 'Team Payroll');
  const fileName = getPayrollReportFileName(
    data.reportType,
    data.companyName,
    data.teamCode,
    data.period.start,
    'xlsx'
  );
  XLSX.writeFile(wb, fileName);
}

function buildPdfDoc(
  data: PayrollReportData,
  tr: PayrollReportTranslations,
  options: { logoInfo: LogoWatermarkInfo | null; locale: Locale }
): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const { logoInfo, locale } = options;
  const fmt = (n: number) => formatNumberByLocale(n, locale);
  const fmtQty = (n: number) => formatNumberByLocale(n, locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const pdf = (s: string) => toAsciiForPdf(s);

  const periodRange = `${data.period.start} – ${data.period.end}`;
  let y = 20;

  doc.setFontSize(14);
  doc.text(pdf(tr.title), 14, y);
  y += 12;

  doc.setFontSize(10);
  doc.text(pdf(`${tr.companyName}: ${data.companyName}`), 14, y);
  y += 6;
  doc.text(pdf(`${tr.payrollPeriod}: ${periodRange}`), 14, y);
  y += 6;
  if (data.reportType === 'team' && data.teamCode) {
    doc.text(pdf(`${tr.teamCode}: ${data.teamCode}`), 14, y);
    y += 6;
  }
  doc.text(pdf(`${tr.exportDate}: ${data.exportDate}`), 14, y);
  y += 10;

  const isTeam = data.reportType === 'team';
  doc.text(pdf(`${tr.totalApprovedJobs}: ${data.totals.approvedJobsCount}`), 14, y);
  y += 6;
  if (isTeam) {
    doc.text(pdf(`${tr.teamEarnings}: ${fmt(data.totals.teamEarnings)}`), 14, y);
    y += 12;
  } else {
    doc.text(pdf(`${tr.totalAmount}: ${fmt(data.totals.totalAmount)}`), 14, y);
    y += 6;
    doc.text(pdf(`${tr.totalWorkValue}: ${fmt(data.totals.totalAmount)}`), 14, y);
    y += 6;
    doc.text(pdf(`${tr.teamEarnings}: ${fmt(data.totals.teamEarnings)}`), 14, y);
    y += 6;
    doc.text(pdf(`${tr.companyShare}: ${fmt(data.totals.companyShare)}`), 14, y);
    y += 12;
  }

  const tableHeaders = (isTeam
    ? [tr.completionDate, tr.projectId, tr.teamCode, tr.workItemName, tr.quantity, tr.unitPrice, tr.lineTotal, tr.teamEarnings]
    : [tr.completionDate, tr.projectId, tr.teamCode, tr.workItemName, tr.quantity, tr.unitPrice, tr.lineTotal, tr.teamEarnings, tr.companyShare]
  ).map(pdf);
  const tableRows = data.isEmpty
    ? [isTeam ? [pdf(tr.noApprovedJobsInPeriod), '', '', '', '', '', '', ''] : [pdf(tr.noApprovedJobsInPeriod), '', '', '', '', '', '', '', '']]
    : data.jobs.map((j) =>
        isTeam
          ? [pdf(j.completionDate), pdf(j.projectId), pdf(j.teamCode), pdf(j.workItemName), fmtQty(j.quantity), fmt(j.unitPrice), fmt(j.lineTotal), fmt(j.teamEarnings)]
          : [pdf(j.completionDate), pdf(j.projectId), pdf(j.teamCode), pdf(j.workItemName), fmtQty(j.quantity), fmt(j.unitPrice), fmt(j.lineTotal), fmt(j.teamEarnings), fmt(j.companyShare)]
      );

  autoTable(doc, {
    head: [tableHeaders],
    body: tableRows,
    startY: y,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [220, 220, 220], fontSize: 7 },
    didDrawPage: logoInfo
      ? (data) => {
          data.doc.setPage(data.pageNumber);
          drawWatermarkFullPage(data.doc as jsPDF, logoInfo, pageWidth, pageHeight);
        }
      : undefined,
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  const tableFinalY = lastTable?.finalY ?? y;
  const signatureY = tableFinalY + 15;
  doc.text(pdf(tr.signatureProjectManager), 14, signatureY);
  doc.text(pdf(tr.signatureCompanyManager), 14, signatureY + 8);

  const totalPages = doc.getNumberOfPages();
  const footerY = pageHeight - 18;
  const fontSize = 8;
  const gray = 119;
  const lightGray = 170;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(fontSize);
    doc.setTextColor(lightGray, lightGray, lightGray);
    doc.text(pdf(tr.footerGeneratedBy), pageWidth / 2, footerY, { align: 'center' });
    doc.setTextColor(gray, gray, gray);
    const pageText = tr.footerPageNumber.replace(/\{current\}/g, String(p)).replace(/\{total\}/g, String(totalPages));
    doc.text(pdf(pageText), pageWidth - 14, footerY, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
  return doc;
}

/**
 * Export payroll report to PDF. If data.logo_url is set, fetches the logo and draws it
 * as a low-opacity watermark on every page (behind content). On any error (e.g. logo/watermark), falls back to PDF without watermark.
 * Uses locale for currency/number format in the PDF.
 */
export async function exportPayrollReportToPdf(
  data: PayrollReportData,
  tr: PayrollReportTranslations,
  locale: Locale = 'en'
): Promise<void> {
  let logoInfo: LogoWatermarkInfo | null = null;
  if (data.logo_url) {
    try {
      logoInfo = await getLogoForPdfWatermark(data.logo_url);
    } catch {
      logoInfo = null;
    }
  }

  let doc: jsPDF;
  try {
    doc = buildPdfDoc(data, tr, { logoInfo, locale });
  } catch {
    doc = buildPdfDoc(data, tr, { logoInfo: null, locale });
  }

  const fileName = getPayrollReportFileName(
    data.reportType,
    data.companyName,
    data.teamCode,
    data.period.start,
    'pdf'
  );
  doc.save(fileName);
}
