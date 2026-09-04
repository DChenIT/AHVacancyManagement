import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_vacancyreportsesService } from '../generated/services/Cr1e9_vacancyreportsesService';

const ROLLING_WINDOW_DAYS = 7;
const ROLLING_WINDOW_MS = ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000;

// Portfolio-wide: latest report date per community, for the Dashboard's red/green completion
// indicator. A "Nothing to Report" submission is still a real cr1e9_vacancyreports row (see
// VacancyReportEntry.tsx), so it counts as reported here with no special-casing needed.
export function useReportCompleteness() {
  const [latestDateByCommunity, setLatestDateByCommunity] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
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

  function isUpToDate(communityId: string): boolean {
    const date = latestDateByCommunity.get(communityId);
    if (!date) return false;
    return Date.now() - new Date(date).getTime() <= ROLLING_WINDOW_MS;
  }

  return { isUpToDate, loading, refresh };
}
