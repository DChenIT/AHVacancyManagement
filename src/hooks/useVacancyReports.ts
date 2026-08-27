import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_vacancyreportsesService } from '../generated/services/Cr1e9_vacancyreportsesService';

export interface VacancyReport {
  id: string;
  communityId: string;
  title: string;
  reportDate: string;
  reportingPeriod?: number;
  reportStatus: number;
  notes?: string;
}

function mapReport(raw: {
  cr1e9_vacancyreportsid: string;
  _cr1e9_community_value?: string;
  cr1e9_name: string;
  cr1e9_reportdate: string;
  cr1e9_reportingperiod?: number;
  cr1e9_reportstatus: number;
  cr1e9_additionalnotes?: string;
}): VacancyReport {
  return {
    id: raw.cr1e9_vacancyreportsid,
    communityId: raw._cr1e9_community_value ?? '',
    title: raw.cr1e9_name,
    reportDate: raw.cr1e9_reportdate ? raw.cr1e9_reportdate.split('T')[0] : '',
    reportingPeriod: raw.cr1e9_reportingperiod,
    reportStatus: raw.cr1e9_reportstatus,
    notes: raw.cr1e9_additionalnotes || undefined,
  };
}

const REPORT_SELECT = ['cr1e9_vacancyreportsid', '_cr1e9_community_value', 'cr1e9_name', 'cr1e9_reportdate', 'cr1e9_reportingperiod', 'cr1e9_reportstatus', 'cr1e9_additionalnotes'];

export function useVacancyReports(communityId?: string) {
  const [reports, setReports] = useState<VacancyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!communityId) {
      setReports([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await Cr1e9_vacancyreportsesService.getAll({
        select: REPORT_SELECT,
        filter: `_cr1e9_community_value eq ${communityId}`,
        orderBy: ['cr1e9_reportdate desc'],
      });
      if (result.error) {
        setError(result.error.message ?? 'Failed to load vacancy reports');
      } else {
        setReports((result.data ?? []).map(mapReport));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { refresh(); }, [refresh]);

  const createReport = useCallback(async (input: {
    communityId: string;
    title: string;
    reportDate: string;
    reportingPeriod: number;
    notes?: string;
  }): Promise<string> => {
    const result = await Cr1e9_vacancyreportsesService.create({
      cr1e9_name: input.title,
      cr1e9_reportdate: input.reportDate,
      cr1e9_reportingperiod: input.reportingPeriod as any,
      cr1e9_reportstatus: 100000000 as any, // Draft
      cr1e9_additionalnotes: input.notes || undefined,
      'cr1e9_community@odata.bind': `/cr1e9_communitieses(${input.communityId})`,
    } as any);
    if (result.error || !result.data) throw new Error(result.error?.message ?? 'Failed to create vacancy report');
    return result.data.cr1e9_vacancyreportsid;
  }, []);

  const deleteReport = useCallback(async (reportId: string): Promise<void> => {
    await Cr1e9_vacancyreportsesService.delete(reportId);
    await refresh();
  }, [refresh]);

  // Only notes are editable on an existing report - Community/Report Date/Title are fixed once
  // created (changing them would really mean "a different report"), see VacancyReportEntry's
  // edit mode.
  const updateReportNotes = useCallback(async (reportId: string, notes: string): Promise<void> => {
    const result = await Cr1e9_vacancyreportsesService.update(reportId, { cr1e9_additionalnotes: notes || undefined } as any);
    if (result.error) throw new Error(result.error.message ?? 'Failed to update report notes');
  }, []);

  return { reports, loading, error, refresh, createReport, deleteReport, updateReportNotes };
}
