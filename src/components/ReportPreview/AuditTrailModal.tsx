import { useReportAuditTrail } from '../../hooks/useReportAudit';
import type { VacancyReport } from '../../hooks/useVacancyReports';

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

const ACTION_COLOR: Record<string, string> = {
  Created: 'var(--success)', Edited: 'var(--info)', Reviewed: 'var(--purple)', 'Review undone': 'var(--warning)',
};

// Who created the report and every change since, newest first. Reports submitted before the audit trail
// existed have no "Created" row, so the submitter recorded on the report itself stands in for it.
export function AuditTrailModal({ report, onClose }: { report: VacancyReport; onClose: () => void }) {
  const { entries, loading, error } = useReportAuditTrail(report.id, true);
  const hasCreatedRow = entries.some(e => e.action === 'Created');

  return (
    <div
      className="no-print"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        role="dialog"
        aria-label="Audit trail"
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 22px',
          width: '100%', maxWidth: 760, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 18 }}>🕘 Audit trail</h3>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', padding: '4px 10px', fontSize: 13, cursor: 'pointer' }}>Close</button>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>{report.title} · {report.reportDate}</div>

        {loading && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</p>}
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 14 }}>
            ⚠ Couldn't load the audit trail: {error}. If this keeps happening, ask an admin to check your security role has Read on Report Audit Entries.
          </p>
        )}

        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {entries.map(e => (
              <div key={e.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                  <span>
                    <strong style={{ color: ACTION_COLOR[e.action] ?? 'var(--text-primary)' }}>{e.action}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}> by </span>
                    <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{e.actor || 'Unknown'}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatDateTime(e.when)}</span>
                </div>
                {e.details && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{e.details}</div>
                )}
              </div>
            ))}
            {!hasCreatedRow && (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <strong style={{ color: 'var(--success)' }}>Created</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}> by </span>
                <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{report.submittedBy ?? 'Unknown'}</strong>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  Report date {report.reportDate}. The exact time wasn't recorded for this report; history is kept from when the audit trail was added.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
