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

function hasGranularDate(opts?: Intl.DateTimeFormatOptions): boolean {
  if (!opts) return false;
  return 'weekday' in opts || 'era' in opts || 'year' in opts || 'month' in opts || 'day' in opts;
}

function hasGranularTime(opts?: Intl.DateTimeFormatOptions): boolean {
  if (!opts) return false;
  return (
    'hour' in opts ||
    'minute' in opts ||
    'second' in opts ||
    'fractionalSecondDigits' in opts ||
    'dayPeriod' in opts ||
    'timeZoneName' in opts
  );
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

  const { includeTime, ...rawOptions } = options || {};
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    ...rawOptions,
  };

  // ECMA-402: dateStyle cannot be combined with granular date fields (weekday, era, year, month, day)
  if (!opts.dateStyle && !hasGranularDate(rawOptions)) {
    opts.dateStyle = 'medium';
  }

  // ECMA-402: timeStyle cannot be combined with granular time fields
  if (includeTime !== false && !opts.timeStyle && !hasGranularTime(rawOptions)) {
    opts.timeStyle = 'short';
  }

  try {
    return date.toLocaleString('en-IN', opts);
  } catch {
    try {
      return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch {
      return date.toISOString();
    }
  }
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

  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    ...options,
  };

  // ECMA-402: dateStyle cannot be combined with granular date fields (year, month, day, weekday, era)
  if (!opts.dateStyle && !hasGranularDate(options)) {
    opts.dateStyle = 'medium';
  }

  try {
    return date.toLocaleDateString('en-IN', opts);
  } catch {
    try {
      return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch {
      return date.toISOString().split('T')[0];
    }
  }
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

  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kolkata',
    ...options,
  };

  // ECMA-402: timeStyle cannot be combined with granular time fields
  if (!opts.timeStyle && !hasGranularTime(options)) {
    opts.timeStyle = 'short';
  }

  try {
    return date.toLocaleTimeString('en-IN', opts);
  } catch {
    try {
      return date.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    } catch {
      return '';
    }
  }
}
