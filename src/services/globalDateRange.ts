import { useCallback, useEffect, useState } from 'react';
import { endOfDay, format, parse, parseISO, startOfDay } from 'date-fns';
import type { Lead } from '@/types';

export const GLOBAL_DATE_RANGE_KEY = 'crm_global_date_range';

/** Cross-page event so both tabs and sibling components react instantly. */
const CHANGE_EVENT = 'crm-global-date-range-change';

/** Inclusive `yyyy-MM-dd` bounds. Empty string means "open ended". */
export interface GlobalDateRange {
  from: string;
  to: string;
}

export const EMPTY_RANGE: GlobalDateRange = { from: '', to: '' };

function isDayString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function loadGlobalDateRange(): GlobalDateRange {
  try {
    const raw = localStorage.getItem(GLOBAL_DATE_RANGE_KEY);
    if (!raw) return EMPTY_RANGE;
    const parsed = JSON.parse(raw) as Partial<GlobalDateRange>;
    return {
      from: isDayString(parsed?.from) ? parsed.from : '',
      to: isDayString(parsed?.to) ? parsed.to : '',
    };
  } catch {
    return EMPTY_RANGE;
  }
}

export function saveGlobalDateRange(range: GlobalDateRange): void {
  const clean: GlobalDateRange = {
    from: isDayString(range.from) ? range.from : '',
    to: isDayString(range.to) ? range.to : '',
  };
  if (!clean.from && !clean.to) {
    localStorage.removeItem(GLOBAL_DATE_RANGE_KEY);
  } else {
    localStorage.setItem(GLOBAL_DATE_RANGE_KEY, JSON.stringify(clean));
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: clean }));
}

export function isRangeActive(range: GlobalDateRange): boolean {
  return !!range.from || !!range.to;
}

/** The date range every page shares, kept in sync across pages and browser tabs. */
export function useGlobalDateRange(): [GlobalDateRange, (next: GlobalDateRange) => void] {
  const [range, setRange] = useState<GlobalDateRange>(loadGlobalDateRange);

  useEffect(() => {
    const sync = () => setRange(loadGlobalDateRange());
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<GlobalDateRange>).detail;
      setRange(detail ?? loadGlobalDateRange());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === GLOBAL_DATE_RANGE_KEY || e.key === null) sync();
    };
    window.addEventListener(CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = useCallback((next: GlobalDateRange) => {
    saveGlobalDateRange(next);
    setRange(next);
  }, []);

  return [range, update];
}

/** Whether a lead was created inside the range. Leads with no usable date fall outside. */
export function leadInGlobalRange(lead: Lead, range: GlobalDateRange): boolean {
  if (!isRangeActive(range)) return true;
  if (!lead.createdAt) return false;

  let day: Date;
  try {
    day = startOfDay(parseISO(lead.createdAt));
  } catch {
    return false;
  }
  if (Number.isNaN(day.getTime())) return false;

  if (range.from) {
    const from = startOfDay(parse(range.from, 'yyyy-MM-dd', new Date()));
    if (day < from) return false;
  }
  if (range.to) {
    const to = endOfDay(parse(range.to, 'yyyy-MM-dd', new Date()));
    if (day > to) return false;
  }
  return true;
}

export function formatGlobalDateRange(range: GlobalDateRange): string {
  const pretty = (s: string) => format(parse(s, 'yyyy-MM-dd', new Date()), 'd MMM yyyy');
  if (range.from && range.to) return `${pretty(range.from)} – ${pretty(range.to)}`;
  if (range.from) return `From ${pretty(range.from)}`;
  if (range.to) return `Up to ${pretty(range.to)}`;
  return '';
}
