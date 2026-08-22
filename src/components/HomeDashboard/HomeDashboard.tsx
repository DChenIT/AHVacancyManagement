import { useMemo, useState } from 'react';
import type { Community } from '../../hooks/useCommunities';
import { useVacancyReports } from '../../hooks/useVacancyReports';
import { useUnitUpdates } from '../../hooks/useUnitUpdates';
import { STATUS_CATEGORY_LABEL, VACANCY_TYPE_LABEL } from '../../types';

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  onViewReport: (communityId: string, reportId: string) => void;
}

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '16px 18px', minWidth: 140, flex: '1 1 140px',
    }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)', fontSize: 28, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

export function HomeDashboard({ communities, communitiesLoading, onViewReport }: Props) {
  const [communityId, setCommunityId] = useState<string>('');
  const [search, setSearch] = useState('');
  const selected = communities.find(c => c.id === communityId);

  const filteredCommunities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));
  }, [communities, search]);

  const { reports, loading: reportsLoading } = useVacancyReports(communityId || undefined);
  const latestReport = reports[0];
  const { units, loading: unitsLoading } = useUnitUpdates(latestReport?.id);

  const kpis = useMemo(() => {
    const openVacancyCount = units.filter(u => STATUS_CATEGORY_LABEL[u.currentStatusCategory as keyof typeof STATUS_CATEGORY_LABEL] !== 'Approved').length;
    const ntvCount = units.filter(u => VACANCY_TYPE_LABEL[u.vacancyType as keyof typeof VACANCY_TYPE_LABEL] === 'NTV').length;
    const activeApplicantCount = units.filter(u => !!u.currentApplicantName).length;
    const approvedHopperCount = units.filter(u => u.approvedHopper).length;
    const hopperGoal = selected?.hopperGoal ?? 0;
    const hopperGap = Math.max(hopperGoal - approvedHopperCount, 0);
    const vacancyRate = selected?.numberOfUnits ? (openVacancyCount / selected.numberOfUnits) * 100 : undefined;
    return { openVacancyCount, ntvCount, activeApplicantCount, approvedHopperCount, hopperGoal, hopperGap, vacancyRate };
  }, [units, selected]);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div style={{
        width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', minHeight: 0, backgroundColor: 'var(--bg-surface)',
      }}>
        <div style={{ padding: '14px 14px 10px' }}>
          <input
            type="text"
            placeholder="Search properties…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 14,
            }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          {communitiesLoading && <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 6px' }}>Loading…</div>}
          {!communitiesLoading && filteredCommunities.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 6px' }}>No properties match.</div>
          )}
          {filteredCommunities.map(c => {
            const isActive = c.id === communityId;
            return (
              <button
                key={c.id}
                onClick={() => setCommunityId(c.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', marginBottom: 4,
                  background: isActive ? 'var(--bg-subtle)' : 'none',
                  border: isActive ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: 8, padding: '9px 10px', cursor: 'pointer',
                }}
              >
                <div style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)', fontSize: 14, fontWeight: isActive ? 600 : 400 }}>
                  {c.name}
                </div>
                {c.code && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{c.code}</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, padding: 20, overflowY: 'auto' }}>
        {!communityId && (
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Select a property on the left to see its current vacancy snapshot.</p>
        )}

        {communityId && (
          <>
            <div style={{
              backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 18px', marginBottom: 16,
            }}>
              <div style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700 }}>{selected?.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                {selected?.code && <>Code: {selected.code}</>}{selected?.numberOfUnits ? ` · ${selected.numberOfUnits} units` : ''}
              </div>
            </div>

            {!latestReport && !reportsLoading && (
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>No vacancy reports yet for {selected?.name}. Create one from the New Report tab.</p>
            )}

            {latestReport && (
              <>
                <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
                  Showing KPIs from the most recent report: <strong style={{ color: 'var(--text-primary)' }}>{latestReport.title}</strong> ({latestReport.reportDate})
                  {unitsLoading && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>Refreshing…</span>}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                  <Tile label="Open Vacancies" value={kpis.openVacancyCount} />
                  <Tile label="NTV" value={kpis.ntvCount} />
                  <Tile label="Active Applicants" value={kpis.activeApplicantCount} />
                  <Tile label="Approved Hoppers" value={kpis.approvedHopperCount} />
                  <Tile label="Hopper Goal" value={kpis.hopperGoal} />
                  <Tile label="Hopper Gap" value={kpis.hopperGap} accent={kpis.hopperGap > 0} />
                  {kpis.vacancyRate !== undefined && <Tile label="Vacancy Rate" value={`${kpis.vacancyRate.toFixed(1)}%`} />}
                </div>

                <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 10 }}>Recent Reports</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reports.map(r => (
                    <button
                      key={r.id}
                      onClick={() => onViewReport(communityId, r.id)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                        padding: '10px 14px', textAlign: 'left', color: 'var(--text-primary)', fontSize: 15,
                      }}
                    >
                      <span>{r.title}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{r.reportDate}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
