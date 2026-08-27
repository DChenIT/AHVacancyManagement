import { useEffect, useMemo, useState } from 'react';
import type { Community } from '../../hooks/useCommunities';
import { useVacancyReports } from '../../hooks/useVacancyReports';
import { useUnitUpdates, deleteUnitsForReport } from '../../hooks/useUnitUpdates';
import { useUnitStreaks } from '../../hooks/useUnitStreaks';
import { StatusBadge } from '../shared/StatusBadge';
import { STATUS_CATEGORY_LABEL, STATUS_CATEGORY_SORT_ORDER, REPORT_STATUS_OPTIONS, AGING_DAYS_THRESHOLD, AGING_STREAK_THRESHOLD } from '../../types';

function daysBetween(from: string, to: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / msPerDay);
}

// Prefers a real day-count (matches the ">30 days" threshold the team asked for) when the unit
// has a Vacant Since date on file; falls back to the consecutive-report streak when it doesn't,
// so the flag still works for rows where that date was never filled in.
function AgingFlag({ daysVacant, streak }: { daysVacant?: number; streak: number }) {
  const flagged = daysVacant !== undefined ? daysVacant >= AGING_DAYS_THRESHOLD : streak >= AGING_STREAK_THRESHOLD;
  const label = daysVacant !== undefined
    ? `${daysVacant} ${daysVacant === 1 ? 'day' : 'days'} vacant`
    : `${streak} ${streak === 1 ? 'report' : 'reports'} open`;
  if (!flagged) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>;
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      backgroundColor: 'var(--danger-bg)', color: 'var(--danger)',
      borderRadius: 12, padding: '3px 10px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true">🚩</span>{label} — High Risk
    </span>
  );
}

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  initialCommunityId?: string;
  initialReportId?: string;
  isAdmin?: boolean;
}

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '8px 10px', fontSize: 15, minWidth: 220,
};

export function ReportPreview({ communities, communitiesLoading, initialCommunityId, initialReportId, isAdmin }: Props) {
  const [communityId, setCommunityId] = useState(initialCommunityId ?? '');
  const [reportId, setReportId] = useState(initialReportId ?? '');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => { if (initialCommunityId) setCommunityId(initialCommunityId); }, [initialCommunityId]);
  useEffect(() => { if (initialReportId) setReportId(initialReportId); }, [initialReportId]);

  const community = communities.find(c => c.id === communityId);
  const { reports, loading: reportsLoading, deleteReport } = useVacancyReports(communityId || undefined);
  const report = reports.find(r => r.id === reportId) ?? reports[0];
  const { units, loading: unitsLoading } = useUnitUpdates(report?.id);
  const { streaks } = useUnitStreaks(reports, report?.id);

  async function handleDelete() {
    if (!report) return;
    if (!confirm(`Delete "${report.title}"? This also deletes all ${units.length} unit row(s) on this report. This can't be undone.`)) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteUnitsForReport(report.id);
      await deleteReport(report.id);
      setReportId('');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!reportId && reports[0]) setReportId(reports[0].id);
  }, [reports, reportId]);

  const sortedUnits = useMemo(() => {
    return [...units].sort((a, b) => {
      const catA = STATUS_CATEGORY_LABEL[a.currentStatusCategory as keyof typeof STATUS_CATEGORY_LABEL] ?? '';
      const catB = STATUS_CATEGORY_LABEL[b.currentStatusCategory as keyof typeof STATUS_CATEGORY_LABEL] ?? '';
      const orderA = STATUS_CATEGORY_SORT_ORDER.indexOf(catA);
      const orderB = STATUS_CATEGORY_SORT_ORDER.indexOf(catB);
      if (orderA !== orderB) return orderA - orderB;
      return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
    });
  }, [units]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of units) {
      const cat = STATUS_CATEGORY_LABEL[u.currentStatusCategory as keyof typeof STATUS_CATEGORY_LABEL] ?? 'Unknown';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return STATUS_CATEGORY_SORT_ORDER
      .map(cat => ({ category: cat, count: counts.get(cat) ?? 0 }))
      .filter(row => row.count > 0);
  }, [units]);

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <div className="no-print" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <select style={selectStyle} value={communityId} onChange={e => { setCommunityId(e.target.value); setReportId(''); }}>
          <option value="">{communitiesLoading ? 'Loading…' : 'Select a community…'}</option>
          {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={selectStyle} value={reportId} onChange={e => setReportId(e.target.value)} disabled={!communityId}>
          <option value="">{reportsLoading ? 'Loading…' : 'Select a report…'}</option>
          {reports.map(r => <option key={r.id} value={r.id}>{r.title} — {r.reportDate}</option>)}
        </select>
        {report && (
          <button onClick={() => window.print()} style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)',
            padding: '7px 14px', fontSize: 14,
          }}>🖨️ Print</button>
        )}
      </div>

      {!report && (
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>Select a community and a report to preview.</p>
      )}

      {report && (
        <>
          <div style={{
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '18px 20px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Vacancy Update</div>
              {isAdmin && (
                <button className="no-print" onClick={handleDelete} disabled={deleting} style={{
                  background: 'none', border: '1px solid var(--danger)', borderRadius: 6, color: 'var(--danger)',
                  padding: '5px 10px', fontSize: 13, opacity: deleting ? 0.6 : 1, flexShrink: 0,
                }}>{deleting ? 'Deleting…' : 'Delete Report'}</button>
              )}
            </div>
            {deleteError && <div style={{ color: 'var(--danger)', fontSize: 13, marginTop: 4 }}>⚠ {deleteError}</div>}
            <div style={{ color: 'var(--text-primary)', fontSize: 22, fontWeight: 700, marginTop: 4 }}>
              {community?.name}{community?.code && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 15 }}> ({community.code})</span>}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
              {report.title} · {report.reportDate} · Status: {REPORT_STATUS_OPTIONS.find(o => o.value === report.reportStatus)?.label ?? '—'}
              {unitsLoading && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>Refreshing…</span>}
            </div>
            {community?.numberOfUnits !== undefined && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
                {community.numberOfUnits} units{community.propertyManager ? ` · Site Admin: ${community.propertyManager}` : ''}{community.regionalManager ? ` · RPS: ${community.regionalManager}` : ''}
              </div>
            )}
          </div>

          <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 10 }}>Units</h3>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 24, backgroundColor: 'var(--bg-surface)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  {['Unit', 'Applicant', 'Status', 'Aging', 'Next Step / Outstanding Items'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedUnits.map(u => {
                  const category = STATUS_CATEGORY_LABEL[u.currentStatusCategory as keyof typeof STATUS_CATEGORY_LABEL] ?? 'Unknown';
                  const isOpen = category !== 'Approved';
                  const streak = streaks[u.unitNumber.trim().toLowerCase()] ?? 1;
                  const daysVacant = u.actualVacancyDate ? Math.max(0, daysBetween(u.actualVacancyDate, report.reportDate)) : undefined;
                  return (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', color: 'var(--text-primary)', fontSize: 14 }}>{u.unitNumber}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.currentApplicantName || '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <StatusBadge categoryLabel={category} />
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        {isOpen ? <AgingFlag daysVacant={daysVacant} streak={streak} /> : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 14 }}>
                        {u.nextStep || '—'}{u.nextStepDueDate ? ` (due ${u.nextStepDueDate})` : ''}
                      </td>
                    </tr>
                  );
                })}
                {sortedUnits.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>No units recorded for this report.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 10 }}>Summary by Status</h3>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, maxWidth: 400, backgroundColor: 'var(--bg-surface)' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {summary.map(row => (
                  <tr key={row.category} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', fontSize: 14 }}><StatusBadge categoryLabel={row.category} /></td>
                    <td style={{ padding: '8px 10px', fontSize: 14, textAlign: 'right', color: 'var(--text-primary)', fontWeight: 600 }}>{row.count}</td>
                  </tr>
                ))}
                {summary.length === 0 && (
                  <tr><td colSpan={2} style={{ padding: 14, color: 'var(--text-muted)', fontSize: 14 }}>No data.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {report.notes && (
            <>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginTop: 24, marginBottom: 10 }}>Additional Notes</h3>
              <div style={{
                backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'pre-wrap', maxWidth: 640,
              }}>
                {report.notes}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
