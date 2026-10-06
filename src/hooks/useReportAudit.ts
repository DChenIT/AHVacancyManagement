import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_reportauditsService } from '../generated/services/Cr1e9_reportauditsService';
import type { CurrentUser } from './useCurrentUser';

export type AuditAction = 'Created' | 'Edited' | 'Reviewed' | 'Review undone';

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  details?: string;
  /** ISO timestamp (the row's own Created On, set by Dataverse - not something the app can backdate). */
  when: string;
}

// useCurrentUser falls back to the placeholder "Me" when the user lookup fails - not a real name to store.
export function actorName(user: CurrentUser | null): string | undefined {
  if (!user) return undefined;
  return user.displayName !== 'Me' ? user.displayName : user.email || undefined;
}

/**
 * Records one audit row against a report. Never throws: the audit trail is a record of an action that
 * already succeeded, so a failure to write it (e.g. a role missing Create on the audit table) must not
 * make that action look like it failed.
 */
export async function logReportAudit(reportId: string, action: AuditAction, actor: string | undefined, details?: string): Promise<void> {
  try {
    const result = await Cr1e9_reportauditsService.create({
      cr1e9_name: action,
      cr1e9_action: action,
      cr1e9_actor: actor || 'Unknown',
      cr1e9_details: details ? details.slice(0, 3900) : undefined,
      'cr1e9_vacancyreport@odata.bind': `/cr1e9_vacancyreportses(${reportId})`,
    } as any);
    if (result.error) console.error('Audit log write failed', result.error);
  } catch (e) {
    console.error('Audit log write failed', e);
  }
}

export function useReportAuditTrail(reportId: string | undefined, enabled: boolean) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!reportId || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await Cr1e9_reportauditsService.getAll({
        select: ['cr1e9_reportauditid', 'cr1e9_action', 'cr1e9_actor', 'cr1e9_details', 'createdon'],
        filter: `_cr1e9_vacancyreport_value eq ${reportId}`,
        orderBy: ['createdon desc'],
      });
      if (result.error) {
        setError(result.error.message ?? 'Failed to load the audit trail');
      } else {
        setEntries((result.data ?? []).map(r => ({
          id: r.cr1e9_reportauditid,
          action: r.cr1e9_action ?? '',
          actor: r.cr1e9_actor ?? '',
          details: r.cr1e9_details || undefined,
          when: r.createdon ?? '',
        })));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [reportId, enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, loading, error };
}
