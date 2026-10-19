import { useMemo, useState } from 'react';
import type { Community } from '../../hooks/useCommunities';
import { usePriorityQueue } from '../../hooks/usePriorityQueue';
import { useAppSettings } from '../../hooks/useAppSettings';
import type { FastTrackUnit } from '../../hooks/useFastTrackUnits';
import { InfoScreen } from '../InfoScreen/InfoScreen';

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  onViewReport: (communityId: string, reportId: string) => void;
  /** Fast-Track approvals (perpetual, across all weekly reports) - only summarized here; the full lists live on the Compliance tab. */
  fastTrack: { openUnits: FastTrackUnit[]; reviewedCount: number; loading: boolean; error: string | null };
  onOpenCompliance: () => void;
}

type SortMode = 'rate' | 'age' | 'aging';

function rateColor(rate?: number): string {
  if (rate === undefined) return 'var(--text-muted)';
  if (rate >= 30) return 'var(--danger)';
  if (rate >= 15) return 'var(--warning)';
  return 'var(--success)';
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// "3 Corrections Requested, 2 Submitted to Compliance" - open cases by Status Detail, most numerous first.
function fastTrackBreakdown(units: FastTrackUnit[]): string {
  const counts = new Map<string, number>();
  for (const u of units) counts.set(u.statusDetail, (counts.get(u.statusDetail) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([detail, n]) => `${n} ${detail}`).join(', ');
}

export function PriorityQueue({ communities, communitiesLoading, onViewReport, fastTrack, onOpenCompliance }: Props) {
  const [asOfDate, setAsOfDate] = useState(todayIso);
  const today = todayIso();
  const isToday = asOfDate === today;

  const { entries, communitiesWithoutReport, loading, error } = usePriorityQueue(communities, asOfDate);
  const { portfolioVacancyGoal } = useAppSettings();
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

      {!fastTrack.loading && !fastTrack.error && (fastTrack.openUnits.length > 0 || fastTrack.reviewedCount > 0) && (
        <div style={{
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--warning)', borderRadius: 10,
          padding: '12px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
        }}>
          <span aria-hidden="true">⚡</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>Fast-Track Approvals</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            <strong style={{ color: 'var(--text-primary)' }}>{fastTrack.openUnits.length}</strong> open
            {fastTrack.openUnits.length > 0 && <> ({fastTrackBreakdown(fastTrack.openUnits)})</>}
            {' · '}<strong style={{ color: 'var(--text-primary)' }}>{fastTrack.reviewedCount}</strong> reviewed
          </span>
          <button
            onClick={onOpenCompliance}
            style={{
              marginLeft: 'auto', background: 'none', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--accent)',
              padding: '6px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}
          >Open Compliance tab →</button>
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
