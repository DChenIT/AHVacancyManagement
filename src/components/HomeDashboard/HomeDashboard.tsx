import { useEffect, useMemo, useRef, useState } from 'react';
import type { Community } from '../../hooks/useCommunities';
import type { CurrentUser } from '../../hooks/useCurrentUser';
import { useVacancyReports } from '../../hooks/useVacancyReports';
import { useUnitUpdates } from '../../hooks/useUnitUpdates';
import { useReportCompleteness } from '../../hooks/useReportCompleteness';
import { STATUS_CATEGORY_LABEL, VACANCY_TYPE_LABEL } from '../../types';

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  onViewReport: (communityId: string, reportId: string) => void;
  currentUser: CurrentUser | null;
}

type DirectoryRole = 'regionalManager' | 'regionalMaintenanceSupervisor' | 'director' | 'complianceSpecialist';
const ROLE_LABELS: Record<DirectoryRole, string> = {
  regionalManager: 'RPS', regionalMaintenanceSupervisor: 'RMS', director: 'Director', complianceSpecialist: 'Compliance Specialist',
};

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

// Matches by name only, since this is a plain-text CSV-imported field (not a SharePoint
// Person/Group lookup with an email) - case-insensitive, trimmed.
function nameMatchesUser(fieldValue: string | undefined, userDisplayName?: string): boolean {
  if (!fieldValue || !userDisplayName) return false;
  return fieldValue.trim().toLowerCase() === userDisplayName.trim().toLowerCase();
}

function distinctValues(communities: Community[], role: DirectoryRole): string[] {
  const seen = new Set<string>();
  for (const c of communities) {
    const v = c[role];
    if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

const filterSelectStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: 6, padding: '5px 6px', fontSize: 13,
};

export function HomeDashboard({ communities, communitiesLoading, onViewReport, currentUser }: Props) {
  const [communityId, setCommunityId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [showMyCommunities, setShowMyCommunities] = useState(false);
  const [roleFilters, setRoleFilters] = useState<Record<DirectoryRole, string>>({
    regionalManager: '', regionalMaintenanceSupervisor: '', director: '', complianceSpecialist: '',
  });
  const autoDefaultedRef = useRef(false);
  const selected = communities.find(c => c.id === communityId);

  const { isUpToDate } = useReportCompleteness();

  // Default "Show only my communities" on once communities have loaded, if the signed-in user
  // is actually assigned somewhere - one-time so it doesn't fight with the user unchecking it.
  useEffect(() => {
    if (autoDefaultedRef.current || communitiesLoading || communities.length === 0 || !currentUser?.displayName) return;
    autoDefaultedRef.current = true;
    const assignedSomewhere = communities.some(c =>
      nameMatchesUser(c.regionalManager, currentUser.displayName) ||
      nameMatchesUser(c.regionalMaintenanceSupervisor, currentUser.displayName) ||
      nameMatchesUser(c.director, currentUser.displayName) ||
      nameMatchesUser(c.complianceSpecialist, currentUser.displayName)
    );
    if (assignedSomewhere) setShowMyCommunities(true);
  }, [communitiesLoading, communities, currentUser]);

  const filteredCommunities = useMemo(() => {
    let list = communities;
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q));

    if (showMyCommunities && currentUser?.displayName) {
      list = list.filter(c =>
        nameMatchesUser(c.regionalManager, currentUser.displayName) ||
        nameMatchesUser(c.regionalMaintenanceSupervisor, currentUser.displayName) ||
        nameMatchesUser(c.director, currentUser.displayName) ||
        nameMatchesUser(c.complianceSpecialist, currentUser.displayName)
      );
    }
    if (roleFilters.regionalManager) list = list.filter(c => c.regionalManager === roleFilters.regionalManager);
    if (roleFilters.regionalMaintenanceSupervisor) list = list.filter(c => c.regionalMaintenanceSupervisor === roleFilters.regionalMaintenanceSupervisor);
    if (roleFilters.director) list = list.filter(c => c.director === roleFilters.director);
    if (roleFilters.complianceSpecialist) list = list.filter(c => c.complianceSpecialist === roleFilters.complianceSpecialist);

    return list;
  }, [communities, search, showMyCommunities, roleFilters, currentUser]);

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

        <div style={{ padding: '0 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={showMyCommunities} onChange={e => setShowMyCommunities(e.target.checked)} style={{ width: 14, height: 14 }} />
            Show only my communities
          </label>
          {(Object.keys(ROLE_LABELS) as DirectoryRole[]).map(role => (
            <div key={role} style={{ marginBottom: 6 }}>
              <select
                style={filterSelectStyle}
                value={roleFilters[role]}
                onChange={e => setRoleFilters(prev => ({ ...prev, [role]: e.target.value }))}
              >
                <option value="">{ROLE_LABELS[role]}: All</option>
                {distinctValues(communities, role).map(name => (
                  <option key={name} value={name}>{ROLE_LABELS[role]}: {name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 12px' }}>
          {communitiesLoading && <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 6px' }}>Loading…</div>}
          {!communitiesLoading && filteredCommunities.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '8px 6px' }}>No properties match.</div>
          )}
          {filteredCommunities.map(c => {
            const isActive = c.id === communityId;
            const upToDate = isUpToDate(c.id);
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    aria-hidden="true"
                    title={upToDate ? 'Reported within the last 7 days' : 'No report in the last 7 days'}
                    style={{ fontSize: 12, flexShrink: 0 }}
                  >
                    {upToDate ? '✅' : '⚠️'}
                  </span>
                  <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-primary)', fontSize: 14, fontWeight: isActive ? 600 : 400 }}>
                    {c.name}
                  </span>
                </div>
                {c.code && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2, marginLeft: 20 }}>{c.code}</div>}
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
                      <span>{r.title}{r.nothingToReport ? ' · Nothing to Report' : ''}</span>
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
