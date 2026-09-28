import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_vacancyreportsesService } from '../generated/services/Cr1e9_vacancyreportsesService';

// Most recent Monday (local time), as a YYYY-MM-DD string - the start of the current reporting
// week. Comparing ISO date strings works fine since they sort the same as the dates they represent.
function currentWeekStartIso(): string {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  // Build the string from local fields, not toISOString() (which converts to UTC and can land
  // on the wrong day depending on timezone).
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${monday.getFullYear()}-${mm}-${dd}`;
}

// Portfolio-wide: latest report date per community, for the red/green completion indicator and
// the "Submitted / Not submitted" slicer. A community is "submitted" as long as its latest report
// falls within the current reporting week (Monday-Sunday); the indicator resets for everyone at
// once at the start of each Monday, rather than rolling per-community 7 days after their report.
// A "Nothing to Report" submission is still a real cr1e9_vacancyreports row (see
// VacancyReportEntry.tsx), so it counts as reported here with no special-casing needed.
export function useReportCompleteness() {
  const [latestDateByCommunity, setLatestDateByCommunity] = useState<Map<string, string>>(new Map());
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
      const map = new Map<string, string>();
      for (const r of result.data ?? []) {
        const cid = r._cr1e9_community_value;
        if (!cid || map.has(cid)) continue; // newest-first, so the first hit per community is its latest
        map.set(cid, r.cr1e9_reportdate ? r.cr1e9_reportdate.split('T')[0] : '');
      }
      setLatestDateByCommunity(map);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Identity only changes when the underlying data does, so it's safe as a useMemo dependency.
  const isUpToDate = useCallback((communityId: string): boolean => {
    const date = latestDateByCommunity.get(communityId);
    if (!date) return false;
    return date >= currentWeekStartIso();
  }, [latestDateByCommunity]);

  return { isUpToDate, loading, refresh };
}
