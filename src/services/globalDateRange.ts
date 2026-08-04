import { useCallback, useEffect, useRef, useState } from 'react';
import { endOfDay, format, parse, parseISO, startOfDay } from 'date-fns';
import type { Lead } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { useDemoLeads } from '@/src/services/leadsService';

/** Local cache only — Supabase is the source of truth so every user sees the same range. */
export const GLOBAL_DATE_RANGE_KEY = 'crm_global_date_range';

const TABLE = 'crm_app_settings';
const SETTING_ID = 'global_date_range';

/** Same-tab notification; other tabs and users arrive via storage + realtime. */
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

function normalize(raw: unknown): GlobalDateRange {
  const r = (raw ?? {}) as Partial<GlobalDateRange>;
  return {
    from: isDayString(r.from) ? r.from : '',
    to: isDayString(r.to) ? r.to : '',
  };
}

export function sameRange(a: GlobalDateRange, b: GlobalDateRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** Cached value for this browser, used for instant paint before Supabase answers. */
export function loadCachedDateRange(): GlobalDateRange {
  try {
    const raw = localStorage.getItem(GLOBAL_DATE_RANGE_KEY);
    if (!raw) return EMPTY_RANGE;
    return normalize(JSON.parse(raw));
  } catch {
    return EMPTY_RANGE;
  }
}

function cacheDateRange(range: GlobalDateRange): void {
  try {
    if (!range.from && !range.to) localStorage.removeItem(GLOBAL_DATE_RANGE_KEY);
    else localStorage.setItem(GLOBAL_DATE_RANGE_KEY, JSON.stringify(range));
  } catch {
    /* private mode — Supabase still has it */
  }
}

function isMissingSettingsTableError(error: {
  message?: string;
  code?: string;
  details?: string;
}): boolean {
  const code = String(error?.code ?? '');
  const blob = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return (
    code === 'PGRST205'
    || code === '42P01'
    || blob.includes('schema cache')
    || blob.includes('could not find the table')
    || (blob.includes('relation') && blob.includes('does not exist'))
  );
}

/** Read the range every user shares. Falls back to this browser's cache when offline. */
export async function fetchGlobalDateRange(): Promise<GlobalDateRange> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('id', SETTING_ID)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTableError(error)) {
      console.warn(
        '[CRM] crm_app_settings missing; date range stays local. Run supabase-crm-app-settings.sql.',
        error.message
      );
    } else {
      console.warn('[CRM] Failed to load shared date range:', error.message);
    }
    return loadCachedDateRange();
  }

  const range = normalize(data?.value);
  cacheDateRange(range);
  return range;
}

/** Save the range for everyone. */
export async function persistGlobalDateRange(range: GlobalDateRange): Promise<void> {
  const clean = normalize(range);
  cacheDateRange(clean);

  const { error } = await supabase.from(TABLE).upsert(
    { id: SETTING_ID, value: clean, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );

  if (error) {
    if (isMissingSettingsTableError(error)) {
      throw new Error(
        'Shared settings table missing — run supabase-crm-app-settings.sql in Supabase.'
      );
    }
    throw new Error(error.message);
  }
}

export function isRangeActive(range: GlobalDateRange): boolean {
  return !!range.from || !!range.to;
}

export interface GlobalDateRangeState {
  range: GlobalDateRange;
  /** True until the shared value has been read once. */
  loading: boolean;
  /** Resolves false when the save failed, so callers can surface a toast. */
  setRange: (next: GlobalDateRange) => Promise<boolean>;
  error: string | null;
}

/**
 * The date range every page and every user shares. Reads from Supabase, keeps a
 * local cache for instant paint, and live-updates when another user changes it.
 */
export function useGlobalDateRange(): GlobalDateRangeState {
  const demo = useDemoLeads();
  const [range, setRangeState] = useState<GlobalDateRange>(loadCachedDateRange);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(range);
  latest.current = range;

  const applyLocal = useCallback((next: GlobalDateRange) => {
    if (sameRange(latest.current, next)) return;
    latest.current = next;
    setRangeState(next);
  }, []);

  useEffect(() => {
    if (demo) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void fetchGlobalDateRange().then(remote => {
      if (cancelled) return;
      applyLocal(remote);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [demo, applyLocal]);

  // Another user changed it.
  useEffect(() => {
    if (demo) return;
    const channel = supabase
      .channel('crm-global-date-range')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: TABLE, filter: `id=eq.${SETTING_ID}` },
        payload => {
          const next = normalize((payload.new as { value?: unknown } | null)?.value);
          cacheDateRange(next);
          applyLocal(next);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [demo, applyLocal]);

  // Another page or tab in this browser changed it.
  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<GlobalDateRange>).detail;
      applyLocal(detail ?? loadCachedDateRange());
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === GLOBAL_DATE_RANGE_KEY || e.key === null) applyLocal(loadCachedDateRange());
    };
    window.addEventListener(CHANGE_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, [applyLocal]);

  const setRange = useCallback(
    async (next: GlobalDateRange): Promise<boolean> => {
      const clean = normalize(next);
      const previous = latest.current;
      applyLocal(clean);
      cacheDateRange(clean);
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: clean }));
      setError(null);

      if (demo) return true;

      try {
        await persistGlobalDateRange(clean);
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Could not share the date range';
        setError(message);
        applyLocal(previous); // don't pretend everyone sees a range that never saved
        cacheDateRange(previous);
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: previous }));
        return false;
      }
    },
    [demo, applyLocal]
  );

  return { range, loading, setRange, error };
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
