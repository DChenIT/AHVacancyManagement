import { useMemo, useState } from 'react';
import type { Community } from '../../hooks/useCommunities';
import type { CurrentUser } from '../../hooks/useCurrentUser';
import { usePriorityQueue } from '../../hooks/usePriorityQueue';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useFastTrackUnits, REVIEW_OUTCOMES, type ReviewOutcome } from '../../hooks/useFastTrackUnits';
import { InfoScreen } from '../InfoScreen/InfoScreen';

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  onViewReport: (communityId: string, reportId: string) => void;
  currentUser: CurrentUser | null;
}

type SortMode = 'rate' | 'age' | 'aging';

function rateColor(rate?: number): string {
  if (rate === undefined) return 'var(--text-muted)';
  if (rate >= 30) return 'var(--danger)';
  if (rate >= 15) return 'var(--warning)';
  return 'var(--success)';
}

function FastTrackBadge({ detail }: { detail: string }) {
  const tone = detail === 'Denied'
    ? { bg: 'var(--danger-bg)', fg: 'var(--danger)', icon: '⛔' }
    : detail === 'Corrections Requested'
      ? { bg: 'var(--warning-bg)', fg: 'var(--warning)', icon: '⚠' }
      : { bg: 'var(--info-bg)', fg: 'var(--info)', icon: '📄' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      backgroundColor: tone.bg, color: tone.fg,
      borderRadius: 12, padding: '3px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true">{tone.icon}</span>{detail}
    </span>
  );
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function PriorityQueue({ communities, communitiesLoading, onViewReport, currentUser }: Props) {
  const [asOfDate, setAsOfDate] = useState(todayIso);
  const today = todayIso();
  const isToday = asOfDate === today;

  const { entries, communitiesWithoutReport, loading, error } = usePriorityQueue(communities, asOfDate);
  const { portfolioVacancyGoal } = useAppSettings();
  const {
    units: fastTrackUnits, reviewedUnits, loading: fastTrackLoading, error: fastTrackError, markReviewed, unmarkReviewed,
  } = useFastTrackUnits(communities, asOfDate);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [fastTrackTab, setFastTrackTab] = useState<'active' | 'reviewed'>('active');

  // A failed save used to be silent (the checkbox just did nothing), which made a permissions
  // problem look like a broken button - surface it instead.
  const [reviewError, setReviewError] = useState<string | null>(null);
  function describeReviewError(action: string, e: unknown): string {
    console.error(`${action} failed`, e);
    const raw = e instanceof Error ? e.message : String(e);
    const permission = /privilege|prv[A-Z]|forbidden|403/i.test(raw);
    const short = raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
    return permission
      ? `Couldn't ${action}: you don't have permission to update this unit. Ask an admin to check your security role.`
      : `Couldn't ${action}: ${short}`;
  }

  async function handleMarkReviewed(unitId: string, outcome: ReviewOutcome) {
    setReviewingId(unitId);
    setReviewError(null);
    try {
      await markReviewed(unitId, currentUser?.displayName || 'Unknown', outcome);
    } catch (e) {
      setReviewError(describeReviewError('mark this reviewed', e));
    } finally {
      setReviewingId(null);
    }
  }

  function canUnmark(reviewedBy: string | undefined): boolean {
    if (!reviewedBy || !currentUser?.displayName) return false;
    return reviewedBy.trim().toLowerCase() === currentUser.displayName.trim().toLowerCase();
  }

  async function handleUnmarkReviewed(unitId: string, wasDenied: boolean) {
    setReviewingId(unitId);
    setReviewError(null);
    try {
      await unmarkReviewed(unitId, wasDenied);
    } catch (e) {
      setReviewError(describeReviewError('unmark this', e));
    } finally {
      setReviewingId(null);
    }
  }
  const [sortMode, setSortMode] = useState<SortMode>('rate');
  const [showInfo, setShowInfo] = useState(false);

  const sortedEntries = useMemo(() => {
    const copy = [...entries];
    if (sortMode === 'age') {
      copy.sort((a, b) => (b.maxDaysVacant ?? -1) - (a.maxDaysVacant ?? -1));
    } else if (sortMode === 'aging') {
      copy.sort((a, b) => b.agingFlaggedCount - a.agingFlaggedCount);
    } else {
      copy.sort((a, b) => (b.vacancyRate ?? -1) - (a.vacancyRate ?? -1));
    }
    return copy;
  }, [entries, sortMode]);

  const totalOpenVacancies = useMemo(() => entries.reduce((sum, e) => sum + e.openVacancyCount, 0), [entries]);
  const goalGap = totalOpenVacancies - portfolioVacancyGoal;

  const sortButtonStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'var(--bg-subtle)' : 'none',
    border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: 18, margin: 0 }}>Priority Queue</h2>
        <button
          onClick={() => setShowInfo(true)}
          style={{
            background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >ℹ️ How priority is calculated</button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0, marginBottom: 12 }}>
        Ranked using each community's most recent report as of the date below.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <label style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }} htmlFor="priority-queue-as-of">As of:</label>
        <input
          id="priority-queue-as-of"
          type="date"
          value={asOfDate}
          max={today}
          onChange={e => setAsOfDate(e.target.value || today)}
          style={{
            backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '6px 10px', fontSize: 14,
          }}
        />
        {!isToday && (
          <>
            <button onClick={() => setAsOfDate(today)} style={{
              background: 'none', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--accent)',
              padding: '6px 12px', fontSize: 13, fontWeight: 600,
            }}>Jump to Today</button>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              backgroundColor: 'var(--warning-bg)', color: 'var(--warning)',
              borderRadius: 12, padding: '3px 10px', fontSize: 13, fontWeight: 600,
            }}>
              <span aria-hidden="true">🕐</span>Viewing history as of {asOfDate}
            </span>
          </>
        )}
      </div>

      {!fastTrackLoading && !fastTrackError && (fastTrackUnits.length > 0 || reviewedUnits.length > 0) && (
        <div style={{
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--warning)', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span aria-hidden="true">⚡</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>Fast-Track Approvals</span>
          </div>
          {reviewError && (
            <div role="alert" style={{
              backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 6,
              padding: '8px 12px', fontSize: 13, fontWeight: 600, margin: '6px 0 10px',
            }}>⚠ {reviewError}</div>
          )}
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0, marginBottom: 10 }}>
            Units already submitted to compliance or awaiting corrections — these are expected to fill fastest, so they're called out first.
          </p>

          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <button
              onClick={() => setFastTrackTab('active')}
              style={{
                background: fastTrackTab === 'active' ? 'var(--bg-subtle)' : 'none',
                border: fastTrackTab === 'active' ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: fastTrackTab === 'active' ? 'var(--accent)' : 'var(--text-secondary)',
                borderRadius: 6, padding: '5px 12px', fontSize: 13, fontWeight: fastTrackTab === 'active' ? 600 : 400,
              }}
            >Active ({fastTrackUnits.length})</button>
            <button
              onClick={() => setFastTrackTab('reviewed')}
              style={{
                background: fastTrackTab === 'reviewed' ? 'var(--bg-subtle)' : 'none',
                border: fastTrackTab === 'reviewed' ? '1px solid var(--accent)' : '1px solid var(--border)',
                color: fastTrackTab === 'reviewed' ? 'var(--accent)' : 'var(--text-secondary)',
                borderRadius: 6, padding: '5px 12px', fontSize: 13, fontWeight: fastTrackTab === 'reviewed' ? 600 : 400,
              }}
            >Reviewed ({reviewedUnits.length})</button>
          </div>

          {fastTrackTab === 'active' && (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    {['Unit', 'Community', 'Applicant', 'Status Detail', 'Next Step', 'Review Status'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fastTrackUnits.map((u, i) => (
                    <tr
                      key={`${u.reportId}-${u.unitNumber}-${i}`}
                      onClick={() => onViewReport(u.communityId, u.reportId)}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontSize: 14 }}>{u.unitNumber}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.communityName}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.applicantName || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <FastTrackBadge detail={u.statusDetail} />
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>
                        {u.nextStep || '—'}{u.nextStepDueDate ? ` (due ${u.nextStepDueDate})` : ''}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <select
                          value=""
                          disabled={reviewingId === u.unitId}
                          onChange={e => { if (e.target.value) handleMarkReviewed(u.unitId, e.target.value as ReviewOutcome); }}
                          style={{
                            backgroundColor: 'var(--bg-input, var(--bg-subtle))', color: 'var(--text-primary)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '5px 8px', fontSize: 13.5, cursor: 'pointer',
                          }}
                          title="Choose the review outcome - moves it to the Reviewed tab"
                        >
                          <option value="">Select status…</option>
                          {REVIEW_OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                  {fastTrackUnits.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>Nothing active — everything's been reviewed.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {fastTrackTab === 'reviewed' && (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 680 }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                    {['Unit', 'Community', 'Applicant', 'Status Detail', 'Review Status', 'Reviewed By', 'Reviewed Date', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviewedUnits.map((u, i) => (
                    <tr
                      key={`${u.reportId}-${u.unitNumber}-${i}`}
                      onClick={() => onViewReport(u.communityId, u.reportId)}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    >
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontSize: 14 }}>{u.unitNumber}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.communityName}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.applicantName || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <FastTrackBadge detail={u.statusDetail} />
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>{u.reviewOutcome || 'Reviewed'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.reviewedBy || '—'}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.reviewedDate || '—'}</td>
                      <td style={{ padding: '8px 10px' }} onClick={e => e.stopPropagation()}>
                        {canUnmark(u.reviewedBy) && (
                          <button
                            onClick={() => handleUnmarkReviewed(u.unitId, u.reviewOutcome === 'Denied')}
                            disabled={reviewingId === u.unitId}
                            title="Only the person who reviewed this can unmark it"
                            style={{
                              background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)',
                              padding: '4px 10px', fontSize: 12.5, cursor: 'pointer', opacity: reviewingId === u.unitId ? 0.6 : 1,
                            }}
                          >{reviewingId === u.unitId ? '…' : 'Unmark'}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {reviewedUnits.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>Nothing reviewed yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!loading && !error && (
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20,
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Open vacancies (portfolio)</div>
            <div style={{ color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, marginTop: 2 }}>{totalOpenVacancies}</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Quarterly goal</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 24, fontWeight: 700, marginTop: 2 }}>{portfolioVacancyGoal}</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>{goalGap > 0 ? 'Over goal' : 'Under goal'}</div>
            <div style={{ color: goalGap > 0 ? 'var(--danger)' : 'var(--success)', fontSize: 24, fontWeight: 700, marginTop: 2 }}>
              {goalGap > 0 ? `+${goalGap}` : goalGap}
            </div>
          </div>
        </div>
      )}

      {(communitiesLoading || loading) && <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)', fontSize: 15 }}>⚠ {error}</p>}

      {!loading && !error && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center', marginRight: 4 }}>Sort by:</span>
            <button style={sortButtonStyle(sortMode === 'rate')} onClick={() => setSortMode('rate')}>Vacancy rate</button>
            <button style={sortButtonStyle(sortMode === 'age')} onClick={() => setSortMode('age')}>Longest vacant</button>
            <button style={sortButtonStyle(sortMode === 'aging')} onClick={() => setSortMode('aging')}>Aging risk</button>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, backgroundColor: 'var(--bg-surface)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 860 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {['#', 'Community', 'Vacancy Rate', 'Open / Total Units', 'Avg Days Vacant', 'Longest Vacant', 'Aging 30+ Days', 'Report Shown'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((e, i) => (
                  <tr
                    key={e.community.id}
                    onClick={() => onViewReport(e.community.id, e.reportId)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 14 }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', fontSize: 14 }}>
                      <div style={{ color: 'var(--text-primary)' }}>{e.community.name}</div>
                      {e.community.code && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{e.community.code}</div>}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 16, fontWeight: 700, color: rateColor(e.vacancyRate) }}>
                      {e.vacancyRate !== undefined ? `${e.vacancyRate.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 14, color: 'var(--text-secondary)' }}>
                      {e.openVacancyCount} / {e.community.numberOfUnits ?? '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 14, color: 'var(--text-secondary)' }}>
                      {e.avgDaysVacant !== undefined ? `${Math.round(e.avgDaysVacant)} days` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 14, color: 'var(--text-secondary)' }}>
                      {e.maxDaysVacant !== undefined ? `${e.maxDaysVacant} days` : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 14 }}>
                      {e.agingFlaggedCount > 0 ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          backgroundColor: 'var(--danger-bg)', color: 'var(--danger)',
                          borderRadius: 12, padding: '3px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                        }}>
                          <span aria-hidden="true">🚩</span>{e.agingFlaggedCount}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>0</span>}
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: 14, color: 'var(--text-secondary)' }}>
                      {e.reportTitle} · {e.reportDate}
                    </td>
                  </tr>
                ))}
                {sortedEntries.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>No communities have a vacancy report yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 12 }}>
            "Avg/longest days vacant" only counts units where staff entered a Vacant Since date on the report — it'll be blank for older reports and any unit missing that field.
            "Aging 30+ Days" counts units vacant 30 or more days, using the same Vacant Since date where it's filled in — and for the rows where it isn't, falls back to counting units open on 3+ consecutive reports in a row, so a unit doesn't slip through just because that date was never entered.
            {communitiesWithoutReport > 0 && (
              <> {communitiesWithoutReport} {communitiesWithoutReport === 1 ? 'community has' : 'communities have'} no vacancy report {isToday ? 'yet' : `as of ${asOfDate}`} and {communitiesWithoutReport === 1 ? "isn't" : "aren't"} included above.</>
            )}
          </p>
        </>
      )}

      {showInfo && (
        <div
          onClick={() => setShowInfo(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-base)', borderRadius: 12, maxWidth: 820, width: '100%',
              maxHeight: '85vh', overflowY: 'auto', position: 'relative', boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            }}
          >
            <button
              onClick={() => setShowInfo(false)}
              style={{
                position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
                color: 'var(--text-secondary)', fontSize: 20, cursor: 'pointer', lineHeight: 1, zIndex: 1,
              }}
            >✕</button>
            <InfoScreen />
          </div>
        </div>
      )}
    </div>
  );
}
