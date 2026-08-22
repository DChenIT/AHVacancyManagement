import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_vacancyreportsesService } from '../generated/services/Cr1e9_vacancyreportsesService';
import { Cr1e9_unitupdatesesService } from '../generated/services/Cr1e9_unitupdatesesService';
import { STATUS_DETAIL_LABEL } from '../types';
import type { Community } from './useCommunities';

// Status details that mean a unit's application is already in motion toward approval - called
// out separately from the community ranking table since these are expected to fill fastest and
// warrant a quick follow-up (chase the compliance reviewer, resolve the correction) rather than
// being buried in a per-community report. Requested by the Affordable Housing Team.
const FAST_TRACK_DETAILS = new Set(['Submitted to Compliance', 'Corrections Requested']);

export interface FastTrackUnit {
  communityId: string;
  communityName: string;
  unitNumber: string;
  applicantName?: string;
  statusDetail: string;
  nextStep?: string;
  nextStepDueDate?: string;
  reportId: string;
  reportDate: string;
}

export function useFastTrackUnits(communities: Community[]) {
  const [units, setUnits] = useState<FastTrackUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (communities.length === 0) {
      setUnits([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const reportsResult = await Cr1e9_vacancyreportsesService.getAll({
        select: ['cr1e9_vacancyreportsid', '_cr1e9_community_value', 'cr1e9_reportdate'],
        orderBy: ['cr1e9_reportdate desc'],
      });
      if (reportsResult.error) throw new Error(reportsResult.error.message ?? 'Failed to load reports');

      // Newest-first order means the first report we see per community is its latest.
      const latestByCommunity = new Map<string, { id: string; date: string }>();
      for (const r of reportsResult.data ?? []) {
        const cid = r._cr1e9_community_value;
        if (!cid || latestByCommunity.has(cid)) continue;
        latestByCommunity.set(cid, { id: r.cr1e9_vacancyreportsid, date: r.cr1e9_reportdate ? r.cr1e9_reportdate.split('T')[0] : '' });
      }
      const communityByReportId = new Map<string, { communityId: string; date: string }>();
      for (const [cid, latest] of latestByCommunity) {
        communityByReportId.set(latest.id, { communityId: cid, date: latest.date });
      }

      const unitsResult = await Cr1e9_unitupdatesesService.getAll({
        select: [
          '_cr1e9_vacancyreport_value', 'cr1e9_name', 'cr1e9_currentapplicantname',
          'cr1e9_currentstatusdetail', 'cr1e9_nextstep', 'cr1e9_nextstepduedate',
        ],
      });
      if (unitsResult.error) throw new Error(unitsResult.error.message ?? 'Failed to load units');

      const communityById = new Map(communities.map(c => [c.id, c]));
      const result: FastTrackUnit[] = [];
      for (const u of unitsResult.data ?? []) {
        const rid = u._cr1e9_vacancyreport_value;
        const info = rid ? communityByReportId.get(rid) : undefined;
        if (!info) continue; // not the community's latest report - out of scope for this callout
        const detailLabel = STATUS_DETAIL_LABEL[u.cr1e9_currentstatusdetail as keyof typeof STATUS_DETAIL_LABEL];
        if (!detailLabel || !FAST_TRACK_DETAILS.has(detailLabel)) continue;
        const community = communityById.get(info.communityId);
        if (!community) continue;

        result.push({
          communityId: info.communityId,
          communityName: community.name,
          unitNumber: u.cr1e9_name,
          applicantName: u.cr1e9_currentapplicantname || undefined,
          statusDetail: detailLabel,
          nextStep: u.cr1e9_nextstep || undefined,
          nextStepDueDate: u.cr1e9_nextstepduedate ? u.cr1e9_nextstepduedate.split('T')[0] : undefined,
          reportId: rid!,
          reportDate: info.date,
        });
      }
      // Corrections Requested is blocking on the applicant/staff and needs active follow-up;
      // Submitted to Compliance is just waiting on the reviewer - so corrections sort first.
      result.sort((a, b) => {
        const rank = (d: string) => (d === 'Corrections Requested' ? 0 : 1);
        return rank(a.statusDetail) - rank(b.statusDetail);
      });
      setUnits(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [communities]);

  useEffect(() => { refresh(); }, [refresh]);

  return { units, loading, error, refresh };
}
