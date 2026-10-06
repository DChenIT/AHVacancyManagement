import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_vacancyreportsesService } from '../generated/services/Cr1e9_vacancyreportsesService';

function isoFromLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  // Built from local fields, not toISOString() (which converts to UTC and can land on the wrong day).
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function localTodayIso(): string {
  return isoFromLocal(new Date());
}

// The Monday on or before the given YYYY-MM-DD date, as YYYY-MM-DD - the start of that date's
// reporting week. ISO date strings sort the same as the dates they represent, so they compare directly.
function weekStartIso(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const daysSinceMonday = (new Date(y, m - 1, d).getDay() + 6) % 7; // Sunday -> 6, Monday -> 0
  return isoFromLocal(new Date(y, m - 1, d - daysSinceMonday));
}

// Portfolio-wide: latest report date per community, for the red/green completion indicator and
// the "Submitted / Not submitted" slicer. A community is "submitted" as long as its latest report
// falls within the reporting week (Monday-Sunday) of the as-of date (today by default); the indicator
// resets for everyone at once at the start of each Monday, rather than rolling per-community 7 days after their report.
// A "Nothing to Report" submission is still a real cr1e9_vacancyreports row (see
// VacancyReportEntry.tsx), so it counts as reported here with no special-casing needed.
export function useReportCompleteness(asOfDate: string = localTodayIso()) {
  // Every report date per community, newest first - the as-of date can move back to an earlier week.
  const [datesByCommunity, setDatesByCommunity] = useState<Map<string, string[]>>(new Map());
  // Only true until the first load finishes - later refreshes are silent so the UI doesn't flicker
  // back to a loading state every time the data is re-checked.
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await Cr1e9_vacancyreportsesService.getAll({
        select: ['_cr1e9_community_value', 'cr1e9_reportdate'],
        orderBy: ['cr1e9_reportdate desc'],
      });
      if (result.error) return;
      const map = new Map<string, string[]>();
      for (const r of result.data ?? []) {
        const cid = r._cr1e9_community_value;
        if (!cid || !r.cr1e9_reportdate) continue;
        const list = map.get(cid) ?? [];
        list.push(r.cr1e9_reportdate.split('T')[0]); // newest-first from the query
        map.set(cid, list);
      }
      setDatesByCommunity(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Identity only changes when the underlying data does, so it's safe as a useMemo dependency.
  const isUpToDate = useCallback((communityId: string): boolean => {
    // Submitted = a report dated within the as-of date's Monday-Sunday week, on or before that date.
    const latestAsOf = datesByCommunity.get(communityId)?.find(d => d <= asOfDate);
    return !!latestAsOf && latestAsOf >= weekStartIso(asOfDate);
  }, [datesByCommunity, asOfDate]);

  return { isUpToDate, loading, refresh };
}
