import { useMemo, useState } from 'react';
import type { Community } from '../../hooks/useCommunities';
import { usePriorityQueue } from '../../hooks/usePriorityQueue';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useFastTrackUnits } from '../../hooks/useFastTrackUnits';

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  onViewReport: (communityId: string, reportId: string) => void;
}

type SortMode = 'rate' | 'age' | 'aging';

function rateColor(rate?: number): string {
  if (rate === undefined) return 'var(--text-muted)';
  if (rate >= 30) return 'var(--danger)';
  if (rate >= 15) return 'var(--warning)';
  return 'var(--success)';
}

function FastTrackBadge({ detail }: { detail: string }) {
  const isCorrections = detail === 'Corrections Requested';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      backgroundColor: isCorrections ? 'var(--warning-bg)' : 'var(--info-bg)',
      color: isCorrections ? 'var(--warning)' : 'var(--info)',
      borderRadius: 12, padding: '3px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true">{isCorrections ? '⚠' : '📄'}</span>{detail}
    </span>
  );
}

export function PriorityQueue({ communities, communitiesLoading, onViewReport }: Props) {
  const { entries, communitiesWithoutReport, loading, error } = usePriorityQueue(communities);
  const { portfolioVacancyGoal } = useAppSettings();
  const { units: fastTrackUnits, loading: fastTrackLoading, error: fastTrackError } = useFastTrackUnits(communities);
  const [sortMode, setSortMode] = useState<SortMode>('rate');

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
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, marginTop: 0, marginBottom: 6 }}>Priority Queue</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 0, marginBottom: 16 }}>
        Ranked using each community's most recent report.
      </p>

      {!fastTrackLoading && !fastTrackError && fastTrackUnits.length > 0 && (
        <div style={{
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--warning)', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span aria-hidden="true">⚡</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 700 }}>Fast-Track Approvals</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>
            Units already submitted to compliance or awaiting corrections — these are expected to fill fastest, so they're called out first.
          </p>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 680 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {['Unit', 'Community', 'Applicant', 'Status Detail', 'Next Step'].map(h => (
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  {['#', 'Community', 'Vacancy Rate', 'Open / Total Units', 'Avg Days Vacant', 'Longest Vacant', 'Aging 30+ Days', 'Latest Report'].map(h => (
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
              <> {communitiesWithoutReport} {communitiesWithoutReport === 1 ? 'community has' : 'communities have'} no vacancy report yet and {communitiesWithoutReport === 1 ? "isn't" : "aren't"} included above.</>
            )}
          </p>
        </>
      )}
    </div>
  );
}
