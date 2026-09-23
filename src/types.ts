import {
  Cr1e9_unitupdatesescr1e9_currentstatuscategory,
  Cr1e9_unitupdatesescr1e9_currentstatusdetail,
  Cr1e9_unitupdatesescr1e9_risklevel,
  Cr1e9_unitupdatesescr1e9_vacancytype,
  Cr1e9_unitupdatesescr1e9_turnreadiness,
  Cr1e9_unitupdatesescr1e9_programtype,
  Cr1e9_unitupdatesescr1e9_amipercent,
} from './generated/models/Cr1e9_unitupdatesesModel';
import {
  Cr1e9_vacancyreportsescr1e9_reportingperiod,
  Cr1e9_vacancyreportsescr1e9_reportstatus,
} from './generated/models/Cr1e9_vacancyreportsesModel';

export function optionsFromEnum(enumObj: Record<number, string>): { value: number; label: string }[] {
  return Object.entries(enumObj).map(([value, label]) => ({ value: Number(value), label }));
}

export const VACANCY_TYPE_OPTIONS = optionsFromEnum(Cr1e9_unitupdatesescr1e9_vacancytype);

// A hopper is an approved applicant waiting on a unit, so "Next Available Unit" only makes sense on
// Hopper rows - a real vacant unit is a specific unit. Matched by label rather than number so it
// keeps working in any environment where the option got a different value.
const NEXT_AVAILABLE_UNIT_LABEL = 'Next Available Unit';
export function isNextAvailableUnit(vacancyType: number): boolean {
  return VACANCY_TYPE_OPTIONS.find(o => o.value === vacancyType)?.label === NEXT_AVAILABLE_UNIT_LABEL;
}
export function vacancyTypeOptionsFor(isHopper: boolean): { value: number; label: string }[] {
  return isHopper ? VACANCY_TYPE_OPTIONS : VACANCY_TYPE_OPTIONS.filter(o => o.label !== NEXT_AVAILABLE_UNIT_LABEL);
}
export const STATUS_CATEGORY_OPTIONS = optionsFromEnum(Cr1e9_unitupdatesescr1e9_currentstatuscategory);
// Alphabetized by label for the dropdown, per the Affordable Housing Team's request - the
// underlying option values/order in Dataverse are untouched, this only affects display order.
export const STATUS_DETAIL_OPTIONS = optionsFromEnum(Cr1e9_unitupdatesescr1e9_currentstatusdetail)
  .sort((a, b) => a.label.localeCompare(b.label));
export const RISK_LEVEL_OPTIONS = optionsFromEnum(Cr1e9_unitupdatesescr1e9_risklevel);
export const REPORTING_PERIOD_OPTIONS = optionsFromEnum(Cr1e9_vacancyreportsescr1e9_reportingperiod);
export const REPORT_STATUS_OPTIONS = optionsFromEnum(Cr1e9_vacancyreportsescr1e9_reportstatus);
export const TURN_STATUS_OPTIONS = optionsFromEnum(Cr1e9_unitupdatesescr1e9_turnreadiness);
export const PROGRAM_TYPE_OPTIONS = optionsFromEnum(Cr1e9_unitupdatesescr1e9_programtype);
export const AMI_PERCENT_OPTIONS = optionsFromEnum(Cr1e9_unitupdatesescr1e9_amipercent);

// The AMI % dropdown only applies to (and only shows for) the LIHTC program type.
export function isLihtc(programType: number | undefined): boolean {
  return PROGRAM_TYPE_OPTIONS.find(o => o.value === programType)?.label === 'LIHTC';
}

export const STATUS_CATEGORY_LABEL = Cr1e9_unitupdatesescr1e9_currentstatuscategory;
export const STATUS_DETAIL_LABEL = Cr1e9_unitupdatesescr1e9_currentstatusdetail;
export const RISK_LEVEL_LABEL = Cr1e9_unitupdatesescr1e9_risklevel;
export const VACANCY_TYPE_LABEL = Cr1e9_unitupdatesescr1e9_vacancytype;
export const TURN_STATUS_LABEL = Cr1e9_unitupdatesescr1e9_turnreadiness;

// Report table + summary sort order (spec section 9)
export const STATUS_CATEGORY_SORT_ORDER = [
  'Approved',
  'Compliance Approved',
  'Eligibility File in Progress',
  'No Applicant',
  'Denied / Ineligible',
  'Waitlist',
  'Compliance Review',
];

// A unit vacant this many days or more gets auto-flagged as high risk in Report Preview and
// counted toward the Priority Queue's aging column - matches the ">30 days" priority logic
// Jennifer described to the Affordable Housing Team. Measured from the Vacant Since date
// staff enter (cr1e9_actualvacancydate) to the report date.
export const AGING_DAYS_THRESHOLD = 30;

// Fallback used only when a unit has no Vacant Since date on file (common for older/incomplete
// reports) - a unit open this many consecutive weekly reports in a row is flagged instead, so
// the signal still works without depending on staff remembering to fill in a date field.
export const AGING_STREAK_THRESHOLD = 3;

// Risk (auto) thresholds on the New Report form - days vacant (Vacant Since to Report Date) at
// or above each cutoff bumps the unit to that tier. Below RISK_DAYS_MEDIUM is Low.
export const RISK_DAYS_MEDIUM = 15;
export const RISK_DAYS_HIGH = 30;
export const RISK_DAYS_CRITICAL = 60;

export type StatusColor = 'success' | 'warning' | 'info' | 'danger' | 'purple' | 'muted';

export const STATUS_CATEGORY_COLOR: Record<string, StatusColor> = {
  'Approved': 'success',
  'Compliance Approved': 'warning',
  'Eligibility File in Progress': 'info',
  'Denied / Ineligible': 'danger',
  'Waitlist': 'purple',
  'No Applicant': 'muted',
  'Compliance Review': 'muted',
};

export interface UnitRowDraft {
  /** Set only when this row was loaded from an existing Dataverse record (edit mode) - present means "update", absent means "create" on save. */
  unitId?: string;
  tempId: string;
  unitNumber: string;
  vacancyType: number;
  currentApplicantName: string;
  currentStatusCategory: number;
  statusCategoryDate: string;
  currentStatusDetail?: number;
  statusDetailDate: string;
  nextStep: string;
  nextStepDueDate: string;
  riskLevel?: number;
  actualVacancyDate: string;
  expectedVacancyDate: string;
  expectedMoveInDate: string;
  ntvDate: string;
  turnStatus?: number;
  programType?: number;
  /** LIHTC AMI % choice value - only meaningful when programType is LIHTC. */
  amiPercent?: number;
  /** Marks this row as tracking an approved-applicant "hopper" rather than an open vacancy — mirrors cr1e9_approvedhopper. */
  isHopper: boolean;
  /** Only meaningful when isHopper is true — the date this hopper's file is considered stale and needs follow-up. */
  staleDate: string;
}

export function emptyUnitRow(): UnitRowDraft {
  return {
    tempId: crypto.randomUUID(),
    unitNumber: '',
    vacancyType: VACANCY_TYPE_OPTIONS[0].value,
    currentApplicantName: '',
    currentStatusCategory: STATUS_CATEGORY_OPTIONS.find(o => o.label === 'No Applicant')?.value ?? STATUS_CATEGORY_OPTIONS[0].value,
    statusCategoryDate: '',
    currentStatusDetail: undefined,
    statusDetailDate: '',
    nextStep: '',
    nextStepDueDate: '',
    riskLevel: undefined,
    actualVacancyDate: '',
    expectedVacancyDate: '',
    expectedMoveInDate: '',
    ntvDate: '',
    turnStatus: undefined,
    programType: undefined,
    amiPercent: undefined,
    isHopper: false,
    staleDate: '',
  };
}

// Fallback used only if the AppSettings row hasn't loaded yet - the real, editable
// value lives in Dataverse (cr1e9_appsettings, "Global" row) via useAppSettings.
export const PORTFOLIO_VACANCY_GOAL_DEFAULT = 130;

