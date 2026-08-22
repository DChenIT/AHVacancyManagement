import { useState } from 'react';
import type { Community } from '../../hooks/useCommunities';
import { useVacancyReports } from '../../hooks/useVacancyReports';
import { createUnitRows } from '../../hooks/useUnitUpdates';
import {
  VACANCY_TYPE_OPTIONS, STATUS_CATEGORY_OPTIONS, STATUS_DETAIL_OPTIONS, RISK_LEVEL_OPTIONS,
  REPORTING_PERIOD_OPTIONS, emptyUnitRow, type UnitRowDraft,
} from '../../types';

interface Props {
  communities: Community[];
  communitiesLoading: boolean;
  onSaved: (communityId: string, reportId: string) => void;
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '6px 8px', fontSize: 14, width: '100%', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' };

// Standardized report naming so titles don't vary staff to staff: "Community - Vacancy Report - Week Of M/D/YYYY"
function formatReportTitle(communityName: string, reportDate: string): string {
  const [year, month, day] = reportDate.split('-').map(Number);
  return `${communityName} - Vacancy Report - Week Of ${month}/${day}/${year}`;
}

// Reports are always weekly now, so the field is fixed rather than user-chosen.
const WEEKLY_REPORTING_PERIOD = REPORTING_PERIOD_OPTIONS.find(o => o.label === 'Weekly')?.value ?? 100000000;

function RequiredMark() {
  return <span style={{ color: 'var(--danger)' }} aria-hidden="true"> *</span>;
}

function Field({ label, children, span, required }: { label: string; children: React.ReactNode; span?: boolean; required?: boolean }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined, minWidth: 0 }}>
      <label style={labelStyle}>{label}{required && <RequiredMark />}</label>
      {children}
    </div>
  );
}

export function VacancyReportEntry({ communities, communitiesLoading, onSaved }: Props) {
  const [communityId, setCommunityId] = useState('');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<UnitRowDraft[]>([emptyUnitRow()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { createReport } = useVacancyReports(communityId || undefined);
  const selectedCommunity = communities.find(c => c.id === communityId);
  const generatedTitle = selectedCommunity && reportDate ? formatReportTitle(selectedCommunity.name, reportDate) : '';

  function updateRow(tempId: string, patch: Partial<UnitRowDraft>) {
    setRows(prev => prev.map(r => r.tempId === tempId ? { ...r, ...patch } : r));
  }

  function addRow() {
    setRows(prev => [...prev, emptyUnitRow()]);
  }

  function removeRow(tempId: string) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.tempId !== tempId) : prev);
  }

  const canSave = !!communityId && !!reportDate && rows.some(r => r.unitNumber.trim());

  async function handleSave() {
    if (!canSave || !selectedCommunity) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const validRows = rows.filter(r => r.unitNumber.trim());
      const reportId = await createReport({ communityId, title: generatedTitle, reportDate, reportingPeriod: WEEKLY_REPORTING_PERIOD, notes: notes.trim() || undefined });
      await createUnitRows(reportId, validRows);
      setSaveSuccess(true);
      setRows([emptyUnitRow()]);
      setNotes('');
      onSaved(communityId, reportId);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, marginTop: 0, marginBottom: 16 }}>New Vacancy Report</h2>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ minWidth: 200 }}>
          <label style={labelStyle}>Community<RequiredMark /></label>
          <select style={inputStyle} value={communityId} onChange={e => setCommunityId(e.target.value)}>
            <option value="">{communitiesLoading ? 'Loading…' : 'Select…'}</option>
            {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={labelStyle}>Report Date<RequiredMark /></label>
          <input type="date" style={inputStyle} value={reportDate} onChange={e => setReportDate(e.target.value)} />
        </div>
        <div style={{ minWidth: 260, flex: 1 }}>
          <label style={labelStyle}>Report Title</label>
          <div style={{ ...inputStyle, color: generatedTitle ? 'var(--text-primary)' : 'var(--text-muted)', backgroundColor: 'var(--bg-subtle)' }}>
            {generatedTitle || 'Select a community and date…'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((row, i) => (
          <div key={row.tempId} style={{
            border: '1px solid var(--border)', borderRadius: 10, backgroundColor: 'var(--bg-surface)', padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>Unit {i + 1}</span>
              <button onClick={() => removeRow(row.tempId)} disabled={rows.length === 1} style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--danger)',
                padding: '4px 10px', fontSize: 13, opacity: rows.length === 1 ? 0.4 : 1,
              }}>Remove</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              <Field label="Unit #" required>
                <input style={inputStyle} value={row.unitNumber} onChange={e => updateRow(row.tempId, { unitNumber: e.target.value })} placeholder="Unit #" />
              </Field>
              <Field label="Vacancy Type" required>
                <select style={inputStyle} value={row.vacancyType} onChange={e => updateRow(row.tempId, { vacancyType: Number(e.target.value) })}>
                  {VACANCY_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Vacant Since">
                <input type="date" style={inputStyle} value={row.actualVacancyDate} onChange={e => updateRow(row.tempId, { actualVacancyDate: e.target.value })} />
              </Field>
              <Field label="Expected Move-Out">
                <input type="date" style={inputStyle} value={row.expectedVacancyDate} onChange={e => updateRow(row.tempId, { expectedVacancyDate: e.target.value })} />
              </Field>

              <Field label="Applicant">
                <input style={inputStyle} value={row.currentApplicantName} onChange={e => updateRow(row.tempId, { currentApplicantName: e.target.value })} placeholder="Applicant name" />
              </Field>
              <Field label="Subsidized?">
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={row.subsidized ?? false}
                    onChange={e => updateRow(row.tempId, { subsidized: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                </div>
              </Field>
              <Field label="Expected Move-In">
                <input type="date" style={inputStyle} value={row.expectedMoveInDate} onChange={e => updateRow(row.tempId, { expectedMoveInDate: e.target.value })} />
              </Field>
              <Field label="Risk">
                <select style={inputStyle} value={row.riskLevel ?? ''} onChange={e => updateRow(row.tempId, { riskLevel: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">—</option>
                  {RISK_LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>

              <Field label="Status Category" required>
                <select style={inputStyle} value={row.currentStatusCategory} onChange={e => updateRow(row.tempId, { currentStatusCategory: Number(e.target.value) })}>
                  {STATUS_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Status Detail">
                <select style={inputStyle} value={row.currentStatusDetail ?? ''} onChange={e => updateRow(row.tempId, { currentStatusDetail: e.target.value ? Number(e.target.value) : undefined })}>
                  <option value="">—</option>
                  {STATUS_DETAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Next Step Due">
                <input type="date" style={inputStyle} value={row.nextStepDueDate} onChange={e => updateRow(row.tempId, { nextStepDueDate: e.target.value })} />
              </Field>

              <Field label="Next Step" span>
                <input style={inputStyle} value={row.nextStep} onChange={e => updateRow(row.tempId, { nextStep: e.target.value })} placeholder="Next step" />
              </Field>
              <Field label="Comment" span>
                <input style={inputStyle} value={row.comment} onChange={e => updateRow(row.tempId, { comment: e.target.value })} placeholder="Comment" />
              </Field>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, maxWidth: 640 }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Anything else leadership should know about this community this period…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button onClick={addRow} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)',
          padding: '8px 14px', fontSize: 14,
        }}>+ Add Unit</button>

        <button onClick={handleSave} disabled={!canSave || saving} style={{
          backgroundColor: 'var(--accent)', color: 'var(--accent-fg)', border: 'none', borderRadius: 6,
          padding: '8px 18px', fontSize: 14, fontWeight: 600, opacity: (!canSave || saving) ? 0.6 : 1,
        }}>{saving ? 'Saving…' : 'Save Report'}</button>

        {saveError && <span style={{ color: 'var(--danger)', fontSize: 14 }}>⚠ {saveError}</span>}
        {saveSuccess && !saveError && <span style={{ color: 'var(--success)', fontSize: 14 }}>✓ Saved</span>}
      </div>
    </div>
  );
}
