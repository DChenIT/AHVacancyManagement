import { useMemo, useState } from 'react';
import type { CurrentUser } from '../../hooks/useCurrentUser';
import { REVIEW_OUTCOMES, reviewChangedStatus, type FastTrackUnit, type ReviewOutcome } from '../../hooks/useFastTrackUnits';
import { FastTrackBadge } from '../shared/FastTrackBadge';

interface Props {
  openUnits: FastTrackUnit[];
  reviewedUnits: FastTrackUnit[];
  loading: boolean;
  error: string | null;
  markReviewed: (unitId: string, reviewerName: string, outcome: ReviewOutcome) => Promise<void>;
  unmarkReviewed: (reviewUnitId: string, reviewerName: string, restoreStatus?: boolean) => Promise<void>;
  onViewReport: (communityId: string, reportId: string) => void;
  currentUser: CurrentUser | null;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 };
const controlStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 10px', fontSize: 14,
};

type SortKey = 'unit' | 'community' | 'applicant' | 'status' | 'since' | 'decision' | 'reviewedBy' | 'reviewedOn' | 'lastReported';
interface Sort { key: SortKey; dir: 1 | -1 }

const SORT_VALUE: Record<SortKey, (u: FastTrackUnit) => string> = {
  unit: u => u.unitNumber,
  community: u => u.communityName,
  applicant: u => u.applicantName ?? '',
  status: u => u.statusDetail,
  since: u => u.statusSince ?? '',
  decision: u => u.reviewOutcome ?? '',
  reviewedBy: u => u.reviewedBy ?? '',
  reviewedOn: u => u.reviewedDate ?? '',
  lastReported: u => u.reportDate,
};

// numeric: true so unit "1107" sorts after "404", not before it. Blanks always go last.
function sortUnits(list: FastTrackUnit[], sort: Sort | null): FastTrackUnit[] {
  if (!sort) return list;
  const value = SORT_VALUE[sort.key];
  return [...list].sort((a, b) => {
    const va = value(a), vb = value(b);
    if (!va || !vb) return !va && !vb ? 0 : !va ? 1 : -1;
    return va.localeCompare(vb, undefined, { numeric: true, sensitivity: 'base' }) * sort.dir;
  });
}

// Every Fast-Track approval, not just this week's: open cases wait here until someone reviews them, and
// every review is kept, so there's one standing history instead of a list that resets with each weekly report.
export function ComplianceScreen({ openUnits, reviewedUnits, loading, error, markReviewed, unmarkReviewed, onViewReport, currentUser }: Props) {
  const [tab, setTab] = useState<'open' | 'reviewed'>('open');
  const [unitFilter, setUnitFilter] = useState('');
  const [applicantFilter, setApplicantFilter] = useState('');
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  // Separate sort per tab; null = the default order (Open: priority, Reviewed: most recent review first).
  const [openSort, setOpenSort] = useState<Sort | null>(null);
  const [reviewedSort, setReviewedSort] = useState<Sort | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const unitQ = unitFilter.trim().toLowerCase();
  const applicantQ = applicantFilter.trim().toLowerCase();
  const q = search.trim().toLowerCase();
  const filtersActive = !!(unitQ || applicantQ || q || (tab === 'reviewed' && decisionFilter));
  const matches = (u: FastTrackUnit) =>
    (!unitQ || u.unitNumber.toLowerCase().includes(unitQ))
    && (!applicantQ || (u.applicantName ?? '').toLowerCase().includes(applicantQ))
    && (!q || [u.communityName, u.statusDetail, u.reviewedBy ?? '', u.referralPartner ?? ''].some(v => v.toLowerCase().includes(q)));

  const shownOpen = useMemo(
    () => sortUnits(openUnits.filter(matches), openSort),
    [openUnits, unitQ, applicantQ, q, openSort], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const shownReviewed = useMemo(
    () => sortUnits(reviewedUnits.filter(u => matches(u) && (!decisionFilter || (u.reviewOutcome ?? 'Reviewed') === decisionFilter)), reviewedSort),
    [reviewedUnits, unitQ, applicantQ, q, decisionFilter, reviewedSort], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // A failed save used to be silent (the control just did nothing), which made a permissions
  // problem look like a broken button - surface it instead.
  function describeError(action: string, e: unknown): string {
    console.error(`${action} failed`, e);
    const raw = e instanceof Error ? e.message : String(e);
    const permission = /privilege|prv[A-Z]|forbidden|403/i.test(raw);
    const short = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
    return permission
      ? `Couldn't ${action}: you don't have permission to update this unit. Ask an admin to check your security role.`
      : `Couldn't ${action}: ${short}`;
  }

  async function run(id: string, action: string, fn: () => Promise<void>) {
    setBusyId(id);
    setReviewError(null);
    try {
      await fn();
    } catch (e) {
      setReviewError(describeError(action, e));
    } finally {
      setBusyId(null);
    }
  }

  const reviewer = currentUser?.displayName || 'Unknown';
  function canUnmark(reviewedBy: string | undefined): boolean {
    if (!reviewedBy || !currentUser?.displayName) return false;
    return reviewedBy.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase();
  }

  // Click a header to sort ascending, again for descending, a third time to go back to the default order.
  function SortHeader({ label, sortKey, sort, setSort }: { label: string; sortKey?: SortKey; sort: Sort | null; setSort: (s: Sort | null) => void }) {
    if (!sortKey) return <th style={th}>{label}</th>;
    const active = sort?.key === sortKey;
    const next = (): Sort | null => (!active ? { key: sortKey, dir: 1 } : sort!.dir === 1 ? { key: sortKey, dir: -1 } : null);
    return (
      <th style={th} aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button
          onClick={() => setSort(next())}
          title={`Sort by ${label}`}
          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: active ? 'var(--accent)' : 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >{label}<span aria-hidden="true" style={{ fontSize: 10, opacity: active ? 1 : 0.35 }}>{active ? (sort!.dir === 1 ? '▲' : '▼') : '↕'}</span></button>
      </th>
    );
  }

  const tabButton = (id: 'open' | 'reviewed', label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        background: tab === id ? 'var(--bg-subtle)' : 'none',
        border: tab === id ? '1px solid var(--accent)' : '1px solid var(--border)',
        color: tab === id ? 'var(--accent)' : 'var(--text-secondary)',
        borderRadius: 6, padding: '6px 14px', fontSize: 14, fontWeight: tab === id ? 600 : 400, cursor: 'pointer',
      }}
    >{label}</button>
  );

  const decisionSelect = (u: FastTrackUnit) => (
    <select
      value=""
      disabled={busyId === u.unitId}
      onChange={e => { const outcome = e.target.value as ReviewOutcome; if (outcome) run(u.unitId, 'record this decision', () => markReviewed(u.unitId, reviewer, outcome)); }}
      style={{ ...controlStyle, padding: '5px 8px', fontSize: 13.5, cursor: 'pointer' }}
      title="Record Compliance's decision"
    >
      <option value="">{u.awaitingCorrections ? 'Update decision…' : 'Select decision…'}</option>
      {REVIEW_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, margin: '0 0 6px' }}>Compliance — Fast-Track Approvals</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0, marginBottom: 14 }}>
        Files submitted or resubmitted to Compliance, awaiting corrections, or waiting on a partner referral. Open items stay here until Compliance records a
        decision; a <strong>Conditional</strong> decision stays open until the site resubmits. Every decision is kept, so this is the running history across all weekly reports.
      </p>

      {error && <div role="alert" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ Couldn't load approvals: {error}</div>}
      {reviewError && <div role="alert" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ {reviewError}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {tabButton('open', `Open (${openUnits.length})`)}
        {tabButton('reviewed', `Reviewed (${reviewedUnits.length})`)}
        <span style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'var(--border)', margin: '0 4px' }} aria-hidden="true" />
        <input type="text" placeholder="Unit #" aria-label="Filter by unit number" value={unitFilter} onChange={e => setUnitFilter(e.target.value)} style={{ ...controlStyle, width: 100 }} />
        <input type="text" placeholder="Applicant name" aria-label="Filter by applicant" value={applicantFilter} onChange={e => setApplicantFilter(e.target.value)} style={{ ...controlStyle, width: 170 }} />
        <input type="text" placeholder="Community, status, reviewer…" aria-label="Search" value={search} onChange={e => setSearch(e.target.value)} style={{ ...controlStyle, width: 210 }} />
        {tab === 'reviewed' && (
          <select value={decisionFilter} onChange={e => setDecisionFilter(e.target.value)} style={controlStyle} aria-label="Compliance decision">
            <option value="">All decisions</option>
            {REVIEW_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {filtersActive && (
          <button
            onClick={() => { setUnitFilter(''); setApplicantFilter(''); setSearch(''); setDecisionFilter(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >Clear filters</button>
        )}
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</span>}
      </div>

      {tab === 'open' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-surface)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 960 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <SortHeader label="Unit" sortKey="unit" sort={openSort} setSort={setOpenSort} />
                <SortHeader label="Community" sortKey="community" sort={openSort} setSort={setOpenSort} />
                <SortHeader label="Applicant" sortKey="applicant" sort={openSort} setSort={setOpenSort} />
                <SortHeader label="Site's Status" sortKey="status" sort={openSort} setSort={setOpenSort} />
                <SortHeader label="In Status Since" sortKey="since" sort={openSort} setSort={setOpenSort} />
                <SortHeader label="Next Step" sort={openSort} setSort={setOpenSort} />
                <SortHeader label="Compliance Decision" sort={openSort} setSort={setOpenSort} />
              </tr>
            </thead>
            <tbody>
              {shownOpen.map(u => (
                <tr key={u.unitId} onClick={() => onViewReport(u.communityId, u.reportId)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={{ ...td, color: 'var(--text-primary)' }}>{u.unitNumber}</td>
                  <td style={td}>{u.communityName}</td>
                  <td style={td}>{u.applicantName || '—'}</td>
                  <td style={{ padding: '8px 10px' }}><FastTrackBadge detail={u.statusDetail} referralPartner={u.referralPartner} /></td>
                  <td style={td}>{u.statusSince || '—'}</td>
                  <td style={td}>{u.nextStep || '—'}{u.nextStepDueDate ? ` (due ${u.nextStepDueDate})` : ''}</td>
                  <td style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
                    {u.awaitingCorrections && (
                      <div style={{ color: 'var(--warning)', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>
                        Conditional — awaiting site corrections
                        <div style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{u.reviewedBy ?? 'Unknown'} · {u.reviewedDate ?? '—'}</div>
                      </div>
                    )}
                    {decisionSelect(u)}
                  </td>
                </tr>
              ))}
              {shownOpen.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>
                  {loading ? 'Loading…' : openUnits.length === 0 ? 'Nothing open — every file has a decision.' : 'No open files match your filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reviewed' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-surface)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1020 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                <SortHeader label="Unit" sortKey="unit" sort={reviewedSort} setSort={setReviewedSort} />
                <SortHeader label="Community" sortKey="community" sort={reviewedSort} setSort={setReviewedSort} />
                <SortHeader label="Applicant" sortKey="applicant" sort={reviewedSort} setSort={setReviewedSort} />
                <SortHeader label="Compliance Decision" sortKey="decision" sort={reviewedSort} setSort={setReviewedSort} />
                <SortHeader label="Decided By" sortKey="reviewedBy" sort={reviewedSort} setSort={setReviewedSort} />
                <SortHeader label="Decided On" sortKey="reviewedOn" sort={reviewedSort} setSort={setReviewedSort} />
                <SortHeader label="Site's Current Status" sortKey="status" sort={reviewedSort} setSort={setReviewedSort} />
                <SortHeader label="Last Reported" sortKey="lastReported" sort={reviewedSort} setSort={setReviewedSort} />
                <th style={th} />
              </tr>
            </thead>
            <tbody>
              {shownReviewed.map(u => {
                const busy = busyId === u.reviewUnitId;
                return (
                  <tr key={`${u.unitId}-${u.reviewUnitId}`} onClick={() => onViewReport(u.communityId, u.reportId)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                    <td style={{ ...td, color: 'var(--text-primary)' }}>{u.unitNumber}</td>
                    <td style={td}>{u.communityName}</td>
                    <td style={td}>{u.applicantName || '—'}</td>
                    <td style={{ ...td, color: 'var(--text-primary)', fontWeight: 600 }}>{u.reviewOutcome || 'Reviewed'}</td>
                    <td style={td}>{u.reviewedBy || '—'}</td>
                    <td style={td}>{u.reviewedDate || '—'}</td>
                    <td style={{ padding: '8px 10px' }}><FastTrackBadge detail={u.statusDetail} referralPartner={u.referralPartner} /></td>
                    <td style={td}>{u.reportDate || '—'}</td>
                    <td style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
                      {u.reviewUnitId && canUnmark(u.reviewedBy) && (
                        <button
                          onClick={() => run(u.reviewUnitId!, 'undo this decision', () => unmarkReviewed(u.reviewUnitId!, reviewer, reviewChangedStatus(u.reviewOutcome)))}
                          disabled={busy}
                          title="Only the person who recorded this decision can undo it"
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '4px 10px', fontSize: 12.5, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
                        >{busy ? '…' : 'Undo'}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shownReviewed.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>
                  {loading ? 'Loading…' : reviewedUnits.length === 0 ? 'No decisions recorded yet.' : 'No decisions match your filters.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
