import { useMemo, useState } from 'react';
import type { CurrentUser } from '../../hooks/useCurrentUser';
import { REVIEW_OUTCOMES, type FastTrackUnit, type ReviewOutcome } from '../../hooks/useFastTrackUnits';
import { FastTrackBadge } from '../shared/FastTrackBadge';

interface Props {
  openUnits: FastTrackUnit[];
  reviewedUnits: FastTrackUnit[];
  loading: boolean;
  error: string | null;
  markReviewed: (unitId: string, reviewerName: string, outcome: ReviewOutcome) => Promise<void>;
  unmarkReviewed: (reviewUnitId: string, reviewerName: string, wasDenied?: boolean) => Promise<void>;
  onViewReport: (communityId: string, reportId: string) => void;
  currentUser: CurrentUser | null;
}

const th: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' };
const td: React.CSSProperties = { padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 };
const controlStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 10px', fontSize: 14,
};

// Every Fast-Track approval, not just this week's: open cases wait here until someone reviews them, and
// every review is kept, so there's one standing history instead of a list that resets with each weekly report.
export function ComplianceScreen({ openUnits, reviewedUnits, loading, error, markReviewed, unmarkReviewed, onViewReport, currentUser }: Props) {
  const [tab, setTab] = useState<'open' | 'reviewed'>('open');
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const matches = (u: FastTrackUnit) =>
    !q || [u.unitNumber, u.communityName, u.applicantName ?? '', u.statusDetail, u.reviewedBy ?? ''].some(v => v.toLowerCase().includes(q));
  const shownOpen = useMemo(() => openUnits.filter(matches), [openUnits, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownReviewed = useMemo(
    () => reviewedUnits.filter(u => matches(u) && (!outcomeFilter || (u.reviewOutcome ?? 'Reviewed') === outcomeFilter)),
    [reviewedUnits, q, outcomeFilter], // eslint-disable-line react-hooks/exhaustive-deps
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

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, margin: '0 0 6px' }}>Compliance — Fast-Track Approvals</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0, marginBottom: 14 }}>
        Units already submitted to compliance, awaiting corrections, or waiting on a partner referral. Open items stay here until they're reviewed,
        and every review is kept, so this is the running history across all weekly reports. A unit comes back to Open if its status changes after a review.
      </p>

      {error && <div role="alert" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ Couldn't load approvals: {error}</div>}
      {reviewError && <div role="alert" style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 6, padding: '8px 12px', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>⚠ {reviewError}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        {tabButton('open', `Open (${openUnits.length})`)}
        {tabButton('reviewed', `Reviewed (${reviewedUnits.length})`)}
        <input
          type="text"
          placeholder="Search unit, community, applicant…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...controlStyle, minWidth: 240, marginLeft: 6 }}
        />
        {tab === 'reviewed' && (
          <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)} style={controlStyle} aria-label="Review status">
            <option value="">All review statuses</option>
            {REVIEW_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {loading && <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</span>}
      </div>

      {tab === 'open' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-surface)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 880 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                {['Unit', 'Community', 'Applicant', 'Status Detail', 'In Status Since', 'Next Step', 'Review Status'].map(h => <th key={h} style={th}>{h}</th>)}
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
                    <select
                      value=""
                      disabled={busyId === u.unitId}
                      onChange={e => { const outcome = e.target.value as ReviewOutcome; if (outcome) run(u.unitId, 'mark this reviewed', () => markReviewed(u.unitId, reviewer, outcome)); }}
                      style={{ ...controlStyle, padding: '5px 8px', fontSize: 13.5, cursor: 'pointer' }}
                      title="Choose the review outcome - moves it to the Reviewed tab"
                    >
                      <option value="">Select status…</option>
                      {REVIEW_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {shownOpen.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>
                  {loading ? 'Loading…' : openUnits.length === 0 ? 'Nothing open — everything has been reviewed.' : 'No open approvals match your search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reviewed' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-surface)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                {['Unit', 'Community', 'Applicant', 'Review Status', 'Reviewed By', 'Reviewed Date', 'Current Status', 'Last Reported', ''].map(h => <th key={h} style={th}>{h}</th>)}
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
                          onClick={() => run(u.reviewUnitId!, 'unmark this', () => unmarkReviewed(u.reviewUnitId!, reviewer, u.reviewOutcome === 'Denied'))}
                          disabled={busy}
                          title="Only the person who reviewed this can unmark it"
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '4px 10px', fontSize: 12.5, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
                        >{busy ? '…' : 'Unmark'}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {shownReviewed.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>
                  {loading ? 'Loading…' : reviewedUnits.length === 0 ? 'Nothing reviewed yet.' : 'No reviewed approvals match your search.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
