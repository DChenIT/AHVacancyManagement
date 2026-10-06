import {
  VACANCY_TYPE_OPTIONS, STATUS_CATEGORY_OPTIONS, STATUS_DETAIL_LABEL, TURN_STATUS_OPTIONS, PROGRAM_TYPE_OPTIONS,
  AMI_PERCENT_OPTIONS, REFERRAL_PARTNER_OPTIONS, type UnitRowDraft,
} from './types';

type Opts = { value: number; label: string }[];
const optionLabel = (opts: Opts) => (v: unknown) => opts.find(o => o.value === v)?.label;

interface FieldSpec {
  key: keyof UnitRowDraft;
  label: string;
  /** Turns a stored value into text; defaults to the value itself. */
  show?: (v: unknown) => string | undefined;
}

// Risk is derived from Vacant Since, so it's left out - a change to the date already says it.
const FIELDS: FieldSpec[] = [
  { key: 'unitNumber', label: 'Unit #' },
  { key: 'isHopper', label: 'Hopper', show: v => (v ? 'Yes' : 'No') },
  { key: 'vacancyType', label: 'Vacancy Type', show: optionLabel(VACANCY_TYPE_OPTIONS) },
  { key: 'currentApplicantName', label: 'Applicant' },
  { key: 'programType', label: 'Program Type', show: optionLabel(PROGRAM_TYPE_OPTIONS) },
  { key: 'amiPercent', label: 'AMI %', show: optionLabel(AMI_PERCENT_OPTIONS) },
  { key: 'currentStatusCategory', label: 'Status Category', show: optionLabel(STATUS_CATEGORY_OPTIONS) },
  { key: 'statusCategoryDate', label: 'Status Category Date' },
  { key: 'currentStatusDetail', label: 'Status Detail', show: v => STATUS_DETAIL_LABEL[v as keyof typeof STATUS_DETAIL_LABEL] },
  { key: 'referralPartner', label: 'Referral Partner', show: optionLabel(REFERRAL_PARTNER_OPTIONS) },
  { key: 'statusDetailDate', label: 'Status Detail Date' },
  { key: 'nextStep', label: 'Next Step' },
  { key: 'nextStepDueDate', label: 'Next Step Due' },
  { key: 'actualVacancyDate', label: 'Vacant Since' },
  { key: 'ntvDate', label: 'NTV Date' },
  { key: 'expectedVacancyDate', label: 'Expected Move-Out' },
  { key: 'expectedMoveInDate', label: 'Expected Move-In' },
  { key: 'turnStatus', label: 'Turn Status', show: optionLabel(TURN_STATUS_OPTIONS) },
  { key: 'staleDate', label: 'Stale Date' },
];

const MAX_VALUE_LENGTH = 80;

function text(spec: FieldSpec, row: UnitRowDraft): string {
  const raw = row[spec.key];
  const shown = spec.show ? spec.show(raw) : raw === undefined || raw === null ? '' : String(raw);
  const value = (shown ?? '').trim();
  if (!value) return '(blank)';
  return value.length > MAX_VALUE_LENGTH ? `${value.slice(0, MAX_VALUE_LENGTH)}…` : value;
}

const unitName = (row: UnitRowDraft) => `Unit ${row.unitNumber.trim() || '?'}`;

export interface ReportSnapshot {
  rows: UnitRowDraft[];
  notes: string;
  nothingToReport: boolean;
}

/** One human-readable line per change between the report as loaded and as saved. Empty means nothing changed. */
export function describeReportEdit(before: ReportSnapshot, after: ReportSnapshot): string[] {
  const lines: string[] = [];
  const beforeById = new Map(before.rows.filter(r => r.unitId).map(r => [r.unitId!, r]));
  const keptIds = new Set<string>();

  for (const row of after.rows) {
    const old = row.unitId ? beforeById.get(row.unitId) : undefined;
    if (!old) {
      lines.push(`Added ${unitName(row)}`);
      continue;
    }
    keptIds.add(old.unitId!);
    const changes = FIELDS
      .map(spec => ({ spec, from: text(spec, old), to: text(spec, row) }))
      .filter(c => c.from !== c.to)
      .map(c => `${c.spec.label}: ${c.from} → ${c.to}`);
    if (changes.length) lines.push(`${unitName(row)} — ${changes.join('; ')}`);
  }
  for (const row of before.rows) {
    if (row.unitId && !keptIds.has(row.unitId)) lines.push(`Removed ${unitName(row)}`);
  }

  if (before.notes.trim() !== after.notes.trim()) lines.push('Notes changed');
  if (before.nothingToReport !== after.nothingToReport) {
    lines.push(`Nothing to Report: ${before.nothingToReport ? 'Yes' : 'No'} → ${after.nothingToReport ? 'Yes' : 'No'}`);
  }
  return lines;
}
