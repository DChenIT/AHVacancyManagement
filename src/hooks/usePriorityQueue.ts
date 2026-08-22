import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_vacancyreportsesService } from '../generated/services/Cr1e9_vacancyreportsesService';
import { Cr1e9_unitupdatesesService } from '../generated/services/Cr1e9_unitupdatesesService';
import { STATUS_CATEGORY_LABEL, AGING_STREAK_THRESHOLD } from '../types';
import type { Community } from './useCommunities';

// How many of a community's most recent reports to walk back through when checking whether a
// unit has been open across consecutive reports. Bounded so one long-lived community's history
// doesn't blow up the streak walk.
const AGING_LOOKBACK_REPORTS = 8;

export interface PriorityEntry {
  community: Community;
  reportId: string;
  reportTitle: string;
  reportDate: string;
  openVacancyCount: number;
  vacancyRate?: number;
  /** Average days vacant among open units that have an Actual Vacancy Date recorded. Undefined if none do. */
  avgDaysVacant?: number;
  /** Longest-open unit among those with an Actual Vacancy Date recorded. */
  maxDaysVacant?: number;
  /** Open units in this report missing an Actual Vacancy Date, so they're excluded from the aging figures above. */
  unitsMissingVacancyDate: number;
  /** Units in the latest report that have been open for AGING_STREAK_THRESHOLD+ consecutive reports. */
  agingFlaggedCount: number;
}

function daysBetween(from: string, to: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / msPerDay);
}

export function usePriorityQueue(communities: Community[]) {
  const [entries, setEntries] = useState<PriorityEntry[]>([]);
  const [communitiesWithoutReport, setCommunitiesWithoutReport] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (communities.length === 0) { setEntries([]); return; }
    setLoading(true);
    setError(null);
    try {
      const reportsResult = await Cr1e9_vacancyreportsesService.getAll({
        select: ['cr1e9_vacancyreportsid', '_cr1e9_community_value', 'cr1e9_name', 'cr1e9_reportdate'],
        orderBy: ['cr1e9_reportdate desc'],
      });
      if (reportsResult.error) throw new Error(reportsResult.error.message ?? 'Failed to load reports');

      // Newest-first order means the first report we see per community is its latest.
      const latestByCommunity = new Map<string, { id: string; title: string; date: string }>();
      for (const r of reportsResult.data ?? []) {
        const cid = r._cr1e9_community_value;
        if (!cid || latestByCommunity.has(cid)) continue;
        latestByCommunity.set(cid, {
          id: r.cr1e9_vacancyreportsid,
          title: r.cr1e9_name,
          date: r.cr1e9_reportdate ? r.cr1e9_reportdate.split('T')[0] : '',
        });
      }

      const relevantReportIds = new Set([...latestByCommunity.values()].map(v => v.id));

      // Newest-first per community too, since reportsResult was already ordered by date desc -
      // used below to walk backward through a community's report history for streak checks.
      const reportsByCommunity = new Map<string, { id: string }[]>();
      for (const r of reportsResult.data ?? []) {
        const cid = r._cr1e9_community_value;
        if (!cid) continue;
        const list = reportsByCommunity.get(cid) ?? [];
        list.push({ id: r.cr1e9_vacancyreportsid });
        reportsByCommunity.set(cid, list);
      }

      const unitsResult = await Cr1e9_unitupdatesesService.getAll({
        select: ['_cr1e9_vacancyreport_value', 'cr1e9_name', 'cr1e9_currentstatuscategory', 'cr1e9_actualvacancydate'],
      });
      if (unitsResult.error) throw new Error(unitsResult.error.message ?? 'Failed to load units');

      const openUnitsByReport = new Map<string, { actualVacancyDate?: string }[]>();
      // Open unit numbers per report, across ALL reports (not just latest) - needed to walk
      // backward and check consecutive-report streaks for the aging flag.
      const openUnitNamesByReport = new Map<string, Set<string>>();
      for (const u of unitsResult.data ?? []) {
        const rid = u._cr1e9_vacancyreport_value;
        if (!rid) continue;
        const cat = STATUS_CATEGORY_LABEL[u.cr1e9_currentstatuscategory as keyof typeof STATUS_CATEGORY_LABEL];
        if (cat === 'Approved') continue;
        if (relevantReportIds.has(rid)) {
          const list = openUnitsByReport.get(rid) ?? [];
          list.push({ actualVacancyDate: u.cr1e9_actualvacancydate ? u.cr1e9_actualvacancydate.split('T')[0] : undefined });
          openUnitsByReport.set(rid, list);
        }
        const nameKey = u.cr1e9_name?.trim().toLowerCase();
        if (nameKey) {
          if (!openUnitNamesByReport.has(rid)) openUnitNamesByReport.set(rid, new Set());
          openUnitNamesByReport.get(rid)!.add(nameKey);
        }
      }

      const result: PriorityEntry[] = [];
      let noReportCount = 0;
      for (const community of communities) {
        const latest = latestByCommunity.get(community.id);
        if (!latest) { noReportCount++; continue; }
        const openUnits = openUnitsByReport.get(latest.id) ?? [];
        const openVacancyCount = openUnits.length;
        const vacancyRate = community.numberOfUnits ? (openVacancyCount / community.numberOfUnits) * 100 : undefined;

        const ages = openUnits
          .filter(u => u.actualVacancyDate)
          .map(u => Math.max(0, daysBetween(u.actualVacancyDate!, latest.date)));
        const avgDaysVacant = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : undefined;
        const maxDaysVacant = ages.length ? Math.max(...ages) : undefined;
        const unitsMissingVacancyDate = openUnits.length - ages.length;

        const communityReports = (reportsByCommunity.get(community.id) ?? []).slice(0, AGING_LOOKBACK_REPORTS);
        const latestOpenNames = openUnitNamesByReport.get(latest.id) ?? new Set<string>();
        let agingFlaggedCount = 0;
        for (const unitKey of latestOpenNames) {
          let streak = 0;
          for (const r of communityReports) {
            if (openUnitNamesByReport.get(r.id)?.has(unitKey)) streak++;
            else break;
          }
          if (streak >= AGING_STREAK_THRESHOLD) agingFlaggedCount++;
        }

        result.push({
          community, reportId: latest.id, reportTitle: latest.title, reportDate: latest.date,
          openVacancyCount, vacancyRate, avgDaysVacant, maxDaysVacant, unitsMissingVacancyDate, agingFlaggedCount,
        });
      }
      result.sort((a, b) => (b.vacancyRate ?? -1) - (a.vacancyRate ?? -1));
      setEntries(result);
      setCommunitiesWithoutReport(noReportCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [communities]);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, communitiesWithoutReport, loading, error, refresh };
}
