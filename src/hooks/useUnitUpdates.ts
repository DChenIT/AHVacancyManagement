import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_unitupdatesesService } from '../generated/services/Cr1e9_unitupdatesesService';
import type { UnitRowDraft } from '../types';

export interface UnitUpdate {
  id: string;
  vacancyReportId: string;
  unitNumber: string;
  vacancyType: number;
  currentApplicantName?: string;
  currentStatusCategory: number;
  currentStatusDetail?: number;
  nextStep?: string;
  nextStepDueDate?: string;
  riskLevel?: number;
  approvedHopper: boolean;
  actualVacancyDate?: string;
  expectedVacancyDate?: string;
  expectedMoveInDate?: string;
  ntvDate?: string;
  turnStatus?: number;
  subsidized?: boolean;
  comment?: string;
}

const UNIT_SELECT = [
  'cr1e9_unitupdatesid', '_cr1e9_vacancyreport_value', 'cr1e9_name', 'cr1e9_vacancytype',
  'cr1e9_currentapplicantname', 'cr1e9_currentstatuscategory', 'cr1e9_currentstatusdetail',
  'cr1e9_nextstep', 'cr1e9_nextstepduedate', 'cr1e9_risklevel', 'cr1e9_approvedhopper',
  'cr1e9_actualvacancydate', 'cr1e9_expectedvacancydate', 'cr1e9_expectedmoveindate', 'cr1e9_ntvdate',
  'cr1e9_turnreadiness', 'cr1e9_subsidized', 'cr1e9_additionalnotes',
];

function mapUnit(raw: {
  cr1e9_unitupdatesid: string;
  _cr1e9_vacancyreport_value?: string;
  cr1e9_name: string;
  cr1e9_vacancytype: number;
  cr1e9_currentapplicantname?: string;
  cr1e9_currentstatuscategory: number;
  cr1e9_currentstatusdetail?: number;
  cr1e9_nextstep?: string;
  cr1e9_nextstepduedate?: string;
  cr1e9_risklevel?: number;
  cr1e9_approvedhopper?: boolean;
  cr1e9_actualvacancydate?: string;
  cr1e9_expectedvacancydate?: string;
  cr1e9_expectedmoveindate?: string;
  cr1e9_ntvdate?: string;
  cr1e9_turnreadiness?: number;
  cr1e9_subsidized?: boolean;
  cr1e9_additionalnotes?: string;
}): UnitUpdate {
  return {
    id: raw.cr1e9_unitupdatesid,
    vacancyReportId: raw._cr1e9_vacancyreport_value ?? '',
    unitNumber: raw.cr1e9_name,
    vacancyType: raw.cr1e9_vacancytype,
    currentApplicantName: raw.cr1e9_currentapplicantname || undefined,
    currentStatusCategory: raw.cr1e9_currentstatuscategory,
    currentStatusDetail: raw.cr1e9_currentstatusdetail,
    nextStep: raw.cr1e9_nextstep || undefined,
    nextStepDueDate: raw.cr1e9_nextstepduedate ? raw.cr1e9_nextstepduedate.split('T')[0] : undefined,
    riskLevel: raw.cr1e9_risklevel,
    approvedHopper: raw.cr1e9_approvedhopper ?? false,
    actualVacancyDate: raw.cr1e9_actualvacancydate ? raw.cr1e9_actualvacancydate.split('T')[0] : undefined,
    expectedVacancyDate: raw.cr1e9_expectedvacancydate ? raw.cr1e9_expectedvacancydate.split('T')[0] : undefined,
    expectedMoveInDate: raw.cr1e9_expectedmoveindate ? raw.cr1e9_expectedmoveindate.split('T')[0] : undefined,
    ntvDate: raw.cr1e9_ntvdate ? raw.cr1e9_ntvdate.split('T')[0] : undefined,
    turnStatus: raw.cr1e9_turnreadiness,
    subsidized: raw.cr1e9_subsidized,
    comment: raw.cr1e9_additionalnotes || undefined,
  };
}

/** Converts a loaded Dataverse unit back into the form's draft shape, for editing an existing report. */
export function toUnitRowDraft(unit: UnitUpdate): UnitRowDraft {
  return {
    unitId: unit.id,
    tempId: unit.id,
    unitNumber: unit.unitNumber,
    vacancyType: unit.vacancyType,
    currentApplicantName: unit.currentApplicantName ?? '',
    currentStatusCategory: unit.currentStatusCategory,
    currentStatusDetail: unit.currentStatusDetail,
    nextStep: unit.nextStep ?? '',
    nextStepDueDate: unit.nextStepDueDate ?? '',
    riskLevel: unit.riskLevel,
    actualVacancyDate: unit.actualVacancyDate ?? '',
    expectedVacancyDate: unit.expectedVacancyDate ?? '',
    expectedMoveInDate: unit.expectedMoveInDate ?? '',
    ntvDate: unit.ntvDate ?? '',
    turnStatus: unit.turnStatus,
    subsidized: unit.subsidized,
    comment: unit.comment ?? '',
  };
}

function unitRowPayload(row: UnitRowDraft) {
  return {
    cr1e9_name: row.unitNumber,
    cr1e9_vacancytype: row.vacancyType as any,
    cr1e9_currentapplicantname: row.currentApplicantName || undefined,
    cr1e9_currentstatuscategory: row.currentStatusCategory as any,
    cr1e9_currentstatusdetail: row.currentStatusDetail as any,
    cr1e9_nextstep: row.nextStep || undefined,
    cr1e9_nextstepduedate: row.nextStepDueDate || undefined,
    cr1e9_risklevel: row.riskLevel as any,
    cr1e9_actualvacancydate: row.actualVacancyDate || undefined,
    cr1e9_expectedvacancydate: row.expectedVacancyDate || undefined,
    cr1e9_expectedmoveindate: row.expectedMoveInDate || undefined,
    cr1e9_ntvdate: row.ntvDate || undefined,
    cr1e9_turnreadiness: row.turnStatus as any,
    cr1e9_subsidized: row.subsidized,
    cr1e9_additionalnotes: row.comment || undefined,
  };
}

export function useUnitUpdates(vacancyReportId?: string) {
  const [units, setUnits] = useState<UnitUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!vacancyReportId) {
      setUnits([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await Cr1e9_unitupdatesesService.getAll({
        select: UNIT_SELECT,
        filter: `_cr1e9_vacancyreport_value eq ${vacancyReportId}`,
        orderBy: ['cr1e9_name asc'],
      });
      if (result.error) {
        setError(result.error.message ?? 'Failed to load unit updates');
      } else {
        setUnits((result.data ?? []).map(mapUnit));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [vacancyReportId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { units, loading, error, refresh };
}

export async function deleteUnitsForReport(vacancyReportId: string): Promise<void> {
  const result = await Cr1e9_unitupdatesesService.getAll({
    select: ['cr1e9_unitupdatesid'],
    filter: `_cr1e9_vacancyreport_value eq ${vacancyReportId}`,
  });
  if (result.error) throw new Error(result.error.message ?? 'Failed to load units for deletion');
  for (const unit of result.data ?? []) {
    await Cr1e9_unitupdatesesService.delete(unit.cr1e9_unitupdatesid);
  }
}

export async function createUnitRows(vacancyReportId: string, rows: UnitRowDraft[]): Promise<void> {
  for (const row of rows) {
    const result = await Cr1e9_unitupdatesesService.create({
      ...unitRowPayload(row),
      'cr1e9_vacancyreport@odata.bind': `/cr1e9_vacancyreportses(${vacancyReportId})`,
    } as any);
    if (result.error) throw new Error(result.error.message ?? `Failed to create unit ${row.unitNumber}`);
  }
}

export async function updateUnitRow(unitId: string, row: UnitRowDraft): Promise<void> {
  const result = await Cr1e9_unitupdatesesService.update(unitId, unitRowPayload(row) as any);
  if (result.error) throw new Error(result.error.message ?? `Failed to update unit ${row.unitNumber}`);
}

export async function deleteUnit(unitId: string): Promise<void> {
  await Cr1e9_unitupdatesesService.delete(unitId);
}
