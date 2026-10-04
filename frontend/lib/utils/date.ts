/**
 * Date and Time utilities for Indian Standard Time (IST, UTC+5:30).
 *
 * Ensures accurate representation of order creation, update, and delivery timestamps,
 * preventing naive UTC strings from being misinterpreted as local machine time.
 */

export function parseDateAsUTC(dateInput: string | number | Date | null | undefined): Date | null {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return null;
  }

  if (dateInput instanceof Date) {
    return Number.isNaN(dateInput.getTime()) ? null : dateInput;
  }

  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  let str = String(dateInput).trim();
  if (!str) return null;

  // If naive ISO string like "2026-10-04T15:51:23" (missing Z or offset), treat as UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(str)) {
    str += 'Z';
  }

  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export interface FormatDateTimeOptions extends Intl.DateTimeFormatOptions {
  includeTime?: boolean;
}

/**
 * Formats a date/timestamp in Indian Standard Time (IST, UTC+5:30).
 * Defaults to: "4 Oct 2026, 9:21 pm"
 */
export function formatISTDateTime(
  dateInput: string | number | Date | null | undefined,
  options?: FormatDateTimeOptions
): string {
  if (!dateInput) return '';

  const date = parseDateAsUTC(dateInput);
  if (!date) {
    return typeof dateInput === 'string' ? dateInput : '';
  }

  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: options?.dateStyle ?? 'medium',
    timeStyle: options?.includeTime === false ? undefined : (options?.timeStyle ?? 'short'),
    ...options,
  });
}

/**
 * Formats date portion only in Indian Standard Time (IST, UTC+5:30).
 * Defaults to: "4 Oct 2026"
 */
export function formatISTDate(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';

  const date = parseDateAsUTC(dateInput);
  if (!date) {
    return typeof dateInput === 'string' ? dateInput : '';
  }

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: options?.dateStyle ?? 'medium',
    ...options,
  });
}

/**
 * Formats time portion only in Indian Standard Time (IST, UTC+5:30).
 * Defaults to: "9:21 pm"
 */
export function formatISTTime(
  dateInput: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';

  const date = parseDateAsUTC(dateInput);
  if (!date) return '';

  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    timeStyle: options?.timeStyle ?? 'short',
    ...options,
  });
}
