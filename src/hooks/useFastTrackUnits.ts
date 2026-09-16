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
  unitId: string;
  communityId: string;
  communityName: string;
  unitNumber: string;
  applicantName?: string;
  statusDetail: string;
  nextStep?: string;
  nextStepDueDate?: string;
  reportId: string;
  reportDate: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedDate?: string;
}

export function useFastTrackUnits(communities: Community[], asOfDate?: string) {
  const [units, setUnits] = useState<FastTrackUnit[]>([]);
  const [reviewedUnits, setReviewedUnits] = useState<FastTrackUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (communities.length === 0) {
      setUnits([]);
      setReviewedUnits([]);
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

      // Newest-first order means the first report we see per community (at or before asOfDate,
      // if given) is the one that was "latest" as of that date.
      const latestByCommunity = new Map<string, { id: string; date: string }>();
      for (const r of reportsResult.data ?? []) {
        const cid = r._cr1e9_community_value;
        if (!cid || latestByCommunity.has(cid)) continue;
        const date = r.cr1e9_reportdate ? r.cr1e9_reportdate.split('T')[0] : '';
        if (asOfDate && date > asOfDate) continue;
        latestByCommunity.set(cid, { id: r.cr1e9_vacancyreportsid, date });
      }
      const communityByReportId = new Map<string, { communityId: string; date: string }>();
      for (const [cid, latest] of latestByCommunity) {
        communityByReportId.set(latest.id, { communityId: cid, date: latest.date });
      }

      const unitsResult = await Cr1e9_unitupdatesesService.getAll({
        select: [
          'cr1e9_unitupdatesid', '_cr1e9_vacancyreport_value', 'cr1e9_name', 'cr1e9_currentapplicantname',
          'cr1e9_currentstatusdetail', 'cr1e9_nextstep', 'cr1e9_nextstepduedate', 'cr1e9_fasttrackreviewed',
          'cr1e9_fasttrackreviewedby', 'cr1e9_fasttrackrevieweddate',
        ],
      });
      if (unitsResult.error) throw new Error(unitsResult.error.message ?? 'Failed to load units');

      const communityById = new Map(communities.map(c => [c.id, c]));
      const active: FastTrackUnit[] = [];
      const reviewed: FastTrackUnit[] = [];
      for (const u of unitsResult.data ?? []) {
        const rid = u._cr1e9_vacancyreport_value;
        const info = rid ? communityByReportId.get(rid) : undefined;
        if (!info) continue; // not the community's latest report - out of scope for this callout
        const detailLabel = STATUS_DETAIL_LABEL[u.cr1e9_currentstatusdetail as keyof typeof STATUS_DETAIL_LABEL];
        if (!detailLabel || !FAST_TRACK_DETAILS.has(detailLabel)) continue;
        const community = communityById.get(info.communityId);
        if (!community) continue;

        const entry: FastTrackUnit = {
          unitId: u.cr1e9_unitupdatesid,
          communityId: info.communityId,
          communityName: community.name,
          unitNumber: u.cr1e9_name,
          applicantName: u.cr1e9_currentapplicantname || undefined,
          statusDetail: detailLabel,
          nextStep: u.cr1e9_nextstep || undefined,
          nextStepDueDate: u.cr1e9_nextstepduedate ? u.cr1e9_nextstepduedate.split('T')[0] : undefined,
          reportId: rid!,
          reportDate: info.date,
          reviewed: !!u.cr1e9_fasttrackreviewed,
          reviewedBy: u.cr1e9_fasttrackreviewedby || undefined,
          reviewedDate: u.cr1e9_fasttrackrevieweddate ? u.cr1e9_fasttrackrevieweddate.split('T')[0] : undefined,
        };
        (entry.reviewed ? reviewed : active).push(entry);
      }
      // Corrections Requested is blocking on the applicant/staff and needs active follow-up;
      // Submitted to Compliance is just waiting on the reviewer - so corrections sort first.
      const rank = (d: string) => (d === 'Corrections Requested' ? 0 : 1);
      active.sort((a, b) => rank(a.statusDetail) - rank(b.statusDetail));
      reviewed.sort((a, b) => (b.reviewedDate ?? '').localeCompare(a.reviewedDate ?? ''));
      setUnits(active);
      setReviewedUnits(reviewed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [communities, asOfDate]);

  useEffect(() => { refresh(); }, [refresh]);

  const markReviewed = useCallback(async (unitId: string, reviewerName: string) => {
    const result = await Cr1e9_unitupdatesesService.update(unitId, {
      cr1e9_fasttrackreviewed: true,
      cr1e9_fasttrackreviewedby: reviewerName,
      cr1e9_fasttrackrevieweddate: new Date().toISOString().split('T')[0],
    } as any);
    if (result.error) throw new Error(result.error.message ?? 'Failed to mark reviewed');
    await refresh();
  }, [refresh]);

  // Only meant to be called after the caller has confirmed reviewedBy matches the signed-in
  // user - this is a UI-level courtesy (same trust model as the rest of the app's name-based
  // checks like "Show only my communities"), not a Dataverse-enforced security boundary.
  const unmarkReviewed = useCallback(async (unitId: string) => {
    // Explicit null (not undefined) - Dataverse only clears a field when the property is
    // actually present in the PATCH body with a null value; an omitted key leaves it unchanged.
    const result = await Cr1e9_unitupdatesesService.update(unitId, {
      cr1e9_fasttrackreviewed: false,
      cr1e9_fasttrackreviewedby: null,
      cr1e9_fasttrackrevieweddate: null,
    } as any);
    if (result.error) throw new Error(result.error.message ?? 'Failed to unmark reviewed');
    await refresh();
  }, [refresh]);

  return { units, reviewedUnits, loading, error, refresh, markReviewed, unmarkReviewed };
}
