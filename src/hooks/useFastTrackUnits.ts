import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_vacancyreportsesService } from '../generated/services/Cr1e9_vacancyreportsesService';
import { Cr1e9_unitupdatesesService } from '../generated/services/Cr1e9_unitupdatesesService';
import { Cr1e9_unitupdatesescr1e9_fasttrackreviewoutcome as OUTCOME_ENUM } from '../generated/models/Cr1e9_unitupdatesesModel';
import { STATUS_DETAIL_LABEL, REFERRAL_PARTNER_OPTIONS } from '../types';
import type { Community } from './useCommunities';
import { logReportAudit } from './useReportAudit';
import { getAllPages } from './getAllPages';

// Status details that mean a unit's application is already in motion toward approval - called
// out separately from the community ranking table since these are expected to fill fastest and
// warrant a quick follow-up (chase the compliance reviewer, resolve the correction) rather than
// being buried in a per-community report. Requested by the Affordable Housing Team.
const FAST_TRACK_DETAILS = new Set(['Submitted to Compliance', 'Corrections Requested', 'Referral Pending']);

export const REVIEW_OUTCOMES = ['Approved', 'Corrections Requested', 'Denied'] as const;
export type ReviewOutcome = typeof REVIEW_OUTCOMES[number];
const OUTCOME_CODE = Object.fromEntries(
  Object.entries(OUTCOME_ENUM).map(([code, label]) => [label, Number(code)]),
) as Record<ReviewOutcome, number>;

const DETAIL_CODE = Object.fromEntries(
  Object.entries(STATUS_DETAIL_LABEL).map(([code, label]) => [label, Number(code)]),
) as Record<string, number>;

/**
 * One approval case: the same unit and applicant followed across every weekly report. Each week's report
 * has its own unit row, so the case is identified by community + unit # + applicant, and what's shown is
 * that case's newest row. Reviews are remembered across weeks (see `buildApprovals`).
 */
export interface FastTrackUnit {
  /** The newest row for this case - where a new review gets written. */
  unitId: string;
  communityId: string;
  communityName: string;
  unitNumber: string;
  applicantName?: string;
  /** Status Detail on the newest row (what the unit is in right now). */
  statusDetail: string;
  referralPartner?: string;
  nextStep?: string;
  nextStepDueDate?: string;
  /** When the newest row says it entered this Status Detail. */
  statusSince?: string;
  /** The report the newest row belongs to, and its date. */
  reportId: string;
  reportDate: string;
  /** Review that applies to this case (the most recent one). Absent when it has never been reviewed. */
  reviewed: boolean;
  /** The row the review is stored on - may be an earlier week's row; this is what Unmark clears. */
  reviewUnitId?: string;
  reviewedBy?: string;
  reviewedDate?: string;
  reviewOutcome?: ReviewOutcome; // absent on units reviewed before outcomes existed
}

interface Row {
  unitId: string;
  reportId: string;
  reportDate: string;
  communityId: string;
  unitNumber: string;
  applicant: string;
  detail: string;
  referralPartner?: string;
  nextStep?: string;
  nextStepDueDate?: string;
  statusSince?: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedDate?: string;
  reviewOutcome?: ReviewOutcome;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const dateOnly = (v?: string | null) => (v ? v.split('T')[0] : undefined);

/**
 * Splits every unit row into approval cases and works out which are open and which have a review on record.
 *
 * - Open: the case's newest row is on its community's latest report, is in a fast-track status, and has not
 *   been reviewed *for that status*. A review stays attached to a case from week to week (new weekly rows
 *   don't reset it), but a change of Status Detail after a review - e.g. Corrections Requested then
 *   resubmitted - is a new round and opens it again.
 * - Reviewed: every case that has ever been reviewed, whatever it has become since. A case can be in both
 *   lists at once when a later round is open; the Reviewed row's Current Status makes that clear.
 */
function buildApprovals(rows: Row[], latestReportByCommunity: Map<string, string>, communityName: (id: string) => string | undefined) {
  const cases = new Map<string, Row[]>();
  for (const r of rows) {
    const key = `${r.communityId}|${norm(r.unitNumber)}|${norm(r.applicant)}`;
    const list = cases.get(key);
    if (list) list.push(r); else cases.set(key, [r]);
  }

  const open: FastTrackUnit[] = [];
  const reviewed: FastTrackUnit[] = [];
  for (const list of cases.values()) {
    list.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
    const newest = list[0];
    const name = communityName(newest.communityId);
    if (!name) continue;

    const reviews = list.filter(r => r.reviewed)
      .sort((a, b) => (b.reviewedDate ?? '').localeCompare(a.reviewedDate ?? '') || b.reportDate.localeCompare(a.reportDate));
    const latestReview = reviews[0];

    const toUnit = (withReview: boolean): FastTrackUnit => ({
      unitId: newest.unitId,
      communityId: newest.communityId,
      communityName: name,
      unitNumber: newest.unitNumber,
      applicantName: newest.applicant || undefined,
      statusDetail: newest.detail,
      referralPartner: newest.referralPartner,
      nextStep: newest.nextStep,
      nextStepDueDate: newest.nextStepDueDate,
      statusSince: newest.statusSince,
      reportId: newest.reportId,
      reportDate: newest.reportDate,
      reviewed: withReview,
      ...(withReview && latestReview ? {
        reviewUnitId: latestReview.unitId,
        reviewedBy: latestReview.reviewedBy,
        reviewedDate: latestReview.reviewedDate,
        reviewOutcome: latestReview.reviewOutcome,
      } : {}),
    });

    const reviewedForCurrentStatus = !!latestReview && latestReview.detail === newest.detail;
    if (FAST_TRACK_DETAILS.has(newest.detail) && latestReportByCommunity.get(newest.communityId) === newest.reportId && !reviewedForCurrentStatus) {
      open.push(toUnit(false));
    }
    if (latestReview) reviewed.push(toUnit(true));
  }

  // Corrections Requested and Referral Pending are blocking on the applicant/staff/partner and need active
  // follow-up; Submitted to Compliance is just waiting on the reviewer - so those two sort first, and
  // within each the longest-sitting goes first.
  const rank = (d: string) => (d === 'Corrections Requested' || d === 'Referral Pending' ? 0 : 1);
  open.sort((a, b) => rank(a.statusDetail) - rank(b.statusDetail) || (a.statusSince ?? a.reportDate).localeCompare(b.statusSince ?? b.reportDate));
  reviewed.sort((a, b) => (b.reviewedDate ?? '').localeCompare(a.reviewedDate ?? ''));
  return { open, reviewed };
}

/**
 * Perpetual Fast-Track approvals: all open cases and every reviewed case, across all weekly reports.
 * `enabled` lets the app hold off the (portfolio-wide) load until someone opens a tab that needs it.
 */
export function useFastTrackUnits(communities: Community[], enabled = true) {
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
      const reportsResult = await getAllPages(opts => Cr1e9_vacancyreportsesService.getAll(opts), {
        select: ['cr1e9_vacancyreportsid', '_cr1e9_community_value', 'cr1e9_reportdate'],
        orderBy: ['cr1e9_reportdate desc'],
      });
      if (reportsResult.error) throw new Error(reportsResult.error.message ?? 'Failed to load reports');

      // Newest-first order means the first report we see per community is its latest.
      const reportInfo = new Map<string, { communityId: string; date: string }>();
      const latestReportByCommunity = new Map<string, string>();
      for (const r of reportsResult.data ?? []) {
        const cid = r._cr1e9_community_value;
        if (!cid) continue;
        reportInfo.set(r.cr1e9_vacancyreportsid, { communityId: cid, date: dateOnly(r.cr1e9_reportdate) ?? '' });
        if (!latestReportByCommunity.has(cid)) latestReportByCommunity.set(cid, r.cr1e9_vacancyreportsid);
      }

      const unitsResult = await getAllPages(opts => Cr1e9_unitupdatesesService.getAll(opts), {
        select: [
          'cr1e9_unitupdatesid', '_cr1e9_vacancyreport_value', 'cr1e9_name', 'cr1e9_currentapplicantname',
          'cr1e9_currentstatusdetail', 'cr1e9_statusdetaildate', 'cr1e9_referralpartner', 'cr1e9_nextstep', 'cr1e9_nextstepduedate',
          'cr1e9_fasttrackreviewed', 'cr1e9_fasttrackreviewedby', 'cr1e9_fasttrackrevieweddate', 'cr1e9_fasttrackreviewoutcome',
          'cr1e9_approvedhopper',
        ],
      });
      if (unitsResult.error) throw new Error(unitsResult.error.message ?? 'Failed to load units');

      const rows: Row[] = [];
      for (const u of unitsResult.data ?? []) {
        const rid = u._cr1e9_vacancyreport_value;
        const info = rid ? reportInfo.get(rid) : undefined;
        if (!rid || !info) continue;
        if (u.cr1e9_approvedhopper) continue; // hopper files aren't vacancies to chase, so they don't belong in this list
        const detail = STATUS_DETAIL_LABEL[u.cr1e9_currentstatusdetail as keyof typeof STATUS_DETAIL_LABEL];
        if (!detail) continue;
        rows.push({
          unitId: u.cr1e9_unitupdatesid,
          reportId: rid,
          reportDate: info.date,
          communityId: info.communityId,
          unitNumber: u.cr1e9_name,
          applicant: u.cr1e9_currentapplicantname ?? '',
          detail,
          referralPartner: REFERRAL_PARTNER_OPTIONS.find(o => o.value === (u as any).cr1e9_referralpartner)?.label,
          nextStep: u.cr1e9_nextstep || undefined,
          nextStepDueDate: dateOnly(u.cr1e9_nextstepduedate),
          statusSince: dateOnly((u as any).cr1e9_statusdetaildate),
          reviewed: !!u.cr1e9_fasttrackreviewed,
          reviewedBy: u.cr1e9_fasttrackreviewedby || undefined,
          reviewedDate: dateOnly(u.cr1e9_fasttrackrevieweddate),
          reviewOutcome: (OUTCOME_ENUM as Record<number, string>)[(u as any).cr1e9_fasttrackreviewoutcome] as ReviewOutcome | undefined,
        });
      }

      const communityById = new Map(communities.map(c => [c.id, c.name]));
      const { open, reviewed } = buildApprovals(rows, latestReportByCommunity, id => communityById.get(id));
      setUnits(open);
      setReviewedUnits(reviewed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [communities]);

  useEffect(() => { if (enabled) refresh(); }, [refresh, enabled]);

  const markReviewed = useCallback(async (unitId: string, reviewerName: string, outcome: ReviewOutcome) => {
    const today = new Date().toISOString().split('T')[0];
    const result = await Cr1e9_unitupdatesesService.update(unitId, {
      cr1e9_fasttrackreviewed: true,
      cr1e9_fasttrackreviewoutcome: OUTCOME_CODE[outcome],
      cr1e9_fasttrackreviewedby: reviewerName,
      cr1e9_fasttrackrevieweddate: today,
      // Denied is a final status, so the unit's own status detail follows it.
      ...(outcome === 'Denied' ? { cr1e9_currentstatusdetail: DETAIL_CODE.Denied, cr1e9_statusdetaildate: today } : {}),
    } as any);
    if (result.error) throw new Error(result.error.message ?? 'Failed to mark reviewed');
    const unit = units.find(u => u.unitId === unitId);
    if (unit) {
      await logReportAudit(unit.reportId, 'Reviewed', reviewerName,
        `Unit ${unit.unitNumber} — marked ${outcome}${outcome === 'Denied' ? ' (Status Detail set to Denied)' : ''}`);
    }
    await refresh();
  }, [refresh, units]);

  // Only meant to be called after the caller has confirmed reviewedBy matches the signed-in
  // user - this is a UI-level courtesy (same trust model as the rest of the app's name-based
  // checks like "Show only my communities"), not a Dataverse-enforced security boundary.
  // `reviewUnitId` is the row the review is stored on, which can be an earlier week's row.
  const unmarkReviewed = useCallback(async (reviewUnitId: string, reviewerName: string, wasDenied = false) => {
    // Explicit null (not undefined) - Dataverse only clears a field when the property is
    // actually present in the PATCH body with a null value; an omitted key leaves it unchanged.
    const result = await Cr1e9_unitupdatesesService.update(reviewUnitId, {
      cr1e9_fasttrackreviewed: false,
      cr1e9_fasttrackreviewoutcome: null,
      cr1e9_fasttrackreviewedby: null,
      cr1e9_fasttrackrevieweddate: null,
      // Undoing a denial puts the unit back in the queue it came from (we don't keep the prior detail,
      // so it returns as Submitted to Compliance).
      ...(wasDenied ? { cr1e9_currentstatusdetail: DETAIL_CODE['Submitted to Compliance'], cr1e9_statusdetaildate: new Date().toISOString().split('T')[0] } : {}),
    } as any);
    if (result.error) throw new Error(result.error.message ?? 'Failed to unmark reviewed');
    const unit = reviewedUnits.find(u => u.reviewUnitId === reviewUnitId);
    if (unit) {
      await logReportAudit(unit.reportId, 'Review undone', reviewerName,
        `Unit ${unit.unitNumber} — review removed${wasDenied ? ' (Status Detail returned to Submitted to Compliance)' : ''}`);
    }
    await refresh();
  }, [refresh, reviewedUnits]);

  return { units, reviewedUnits, loading, error, refresh, markReviewed, unmarkReviewed };
}
