import type { Community } from '../../hooks/useCommunities';

export type SubmissionFilter = 'all' | 'submitted' | 'missing';

type RoleKey = 'rps' | 'rms' | 'director' | 'compliance' | 'assetManager';

export interface GlobalFilters extends Record<RoleKey, string> {
  submission: SubmissionFilter;
}

export const EMPTY_FILTERS: GlobalFilters = {
  rps: '', rms: '', director: '', compliance: '', assetManager: '', submission: 'all',
};

const ROLE_SLICERS: { key: RoleKey; label: string; field: (c: Community) => string | undefined }[] = [
  { key: 'rps', label: 'RPS', field: c => c.regionalManager },
  { key: 'rms', label: 'RMS', field: c => c.regionalMaintenanceSupervisor },
  { key: 'director', label: 'Director', field: c => c.director },
  { key: 'compliance', label: 'Compliance', field: c => c.complianceSpecialist },
  { key: 'assetManager', label: 'Asset Manager', field: c => c.assetManager },
];

export function applyRoleFilters(communities: Community[], filters: GlobalFilters): Community[] {
  return communities.filter(c => ROLE_SLICERS.every(s => !filters[s.key] || s.field(c) === filters[s.key]));
}

function hasActiveFilters(f: GlobalFilters): boolean {
  return f.submission !== 'all' || ROLE_SLICERS.some(s => !!f[s.key]);
}

function distinctNames(communities: Community[], field: (c: Community) => string | undefined): string[] {
  const seen = new Set<string>();
  for (const c of communities) {
    const v = field(c);
    if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

interface Props {
  allCommunities: Community[];
  /** Communities after the role slicers but before the submission slicer - what the counts are measured against. */
  roleScoped: Community[];
  shownCount: number;
  isUpToDate: (communityId: string) => boolean;
  completenessLoading: boolean;
  filters: GlobalFilters;
  onChange: (filters: GlobalFilters) => void;
}

const selectStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '5px 8px', fontSize: 13, maxWidth: 190,
};

export function GlobalFilterBar({ allCommunities, roleScoped, shownCount, isUpToDate, completenessLoading, filters, onChange }: Props) {
  const submittedCount = roleScoped.filter(c => isUpToDate(c.id)).length;
  const missingCount = roleScoped.length - submittedCount;

  const segment = (value: SubmissionFilter, label: string, count: number | null, tone?: 'warn' | 'ok') => {
    const active = filters.submission === value;
    const toneColor = tone === 'warn' ? 'var(--warning)' : tone === 'ok' ? 'var(--success)' : 'var(--accent)';
    return (
      <button
        key={value}
        onClick={() => onChange({ ...filters, submission: value })}
        style={{
          background: active ? 'var(--bg-subtle)' : 'none',
          border: active ? `1px solid ${toneColor}` : '1px solid var(--border)',
          color: active ? toneColor : 'var(--text-secondary)',
          borderRadius: 6, padding: '5px 10px', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer',
        }}
      >{label}{count !== null && ` (${completenessLoading && value !== 'all' ? '…' : count})`}</button>
    );
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '8px 16px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, flexShrink: 0,
    }}>
      {ROLE_SLICERS.map(s => (
        <select
          key={s.key}
          style={selectStyle}
          value={filters[s.key]}
          aria-label={s.label}
          onChange={e => onChange({ ...filters, [s.key]: e.target.value })}
        >
          <option value="">{s.label}: All</option>
          {distinctNames(allCommunities, s.field).map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      ))}

      <span style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'var(--border)', margin: '0 4px' }} aria-hidden="true" />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Report submission status">
        {segment('all', 'All', roleScoped.length)}
        {segment('submitted', '✅ Submitted', submittedCount, 'ok')}
        {segment('missing', '⚠️ Not submitted', missingCount, 'warn')}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Showing {shownCount} of {allCommunities.length}</span>
        {hasActiveFilters(filters) && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >Clear filters</button>
        )}
      </div>
    </div>
  );
}
