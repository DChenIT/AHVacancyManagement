import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_unitupdatesesService } from '../generated/services/Cr1e9_unitupdatesesService';
import { STATUS_CATEGORY_LABEL } from '../types';
import type { VacancyReport } from './useVacancyReports';

// How many prior reports to pull back when checking a streak. A unit only needs to beat
// AGING_THRESHOLD (see types.ts) to be flagged, but we fetch a bit further so the exact
// streak length displayed (e.g. "5 wks") isn't artificially capped at the threshold.
const LOOKBACK_REPORTS = 8;

/**
 * For a given report within a community's report history, computes how many consecutive
 * reports (walking backward from the target report, most recent first) each currently-open
 * unit has appeared as open (non-"Approved") for. A gap or a status of "Approved" breaks the
 * streak. Keyed by trimmed/lowercased unit number since units aren't a persistent entity -
 * each weekly report creates fresh rows matched only by the unit number text.
 */
export function useUnitStreaks(reports: VacancyReport[], targetReportId?: string) {
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!targetReportId || reports.length === 0) {
      setStreaks({});
      return;
    }
    const sortedDesc = [...reports].sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    const targetIndex = sortedDesc.findIndex(r => r.id === targetReportId);
    if (targetIndex === -1) {
      setStreaks({});
      return;
    }
    const window = sortedDesc.slice(targetIndex, targetIndex + LOOKBACK_REPORTS);

    setLoading(true);
    try {
      const filter = window.map(r => `_cr1e9_vacancyreport_value eq ${r.id}`).join(' or ');
      const result = await Cr1e9_unitupdatesesService.getAll({
        select: ['_cr1e9_vacancyreport_value', 'cr1e9_name', 'cr1e9_currentstatuscategory'],
        filter,
      });
      if (result.error) {
        setStreaks({});
        return;
      }

      const openByReport = new Map<string, Set<string>>();
      for (const u of result.data ?? []) {
        const rid = u._cr1e9_vacancyreport_value;
        if (!rid) continue;
        const cat = STATUS_CATEGORY_LABEL[u.cr1e9_currentstatuscategory as keyof typeof STATUS_CATEGORY_LABEL];
        if (cat === 'Approved') continue;
        const key = u.cr1e9_name?.trim().toLowerCase();
        if (!key) continue;
        if (!openByReport.has(rid)) openByReport.set(rid, new Set());
        openByReport.get(rid)!.add(key);
      }

      const targetOpenUnits = openByReport.get(targetReportId) ?? new Set<string>();
      const next: Record<string, number> = {};
      for (const unitKey of targetOpenUnits) {
        let streak = 0;
        for (const r of window) {
          if (openByReport.get(r.id)?.has(unitKey)) streak++;
          else break;
        }
        next[unitKey] = streak;
      }
      setStreaks(next);
    } finally {
      setLoading(false);
    }
  }, [reports, targetReportId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { streaks, loading };
}
