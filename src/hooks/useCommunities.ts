import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_communitiesesService } from '../generated/services/Cr1e9_communitiesesService';

export interface Community {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  hopperGoal: number;
  /** Regional Property Supervisor */
  regionalManager?: string;
  regionalManagerEmail?: string;
  /** Site Administrator, synced from the company's SharePoint property roster */
  propertyManager?: string;
  director?: string;
  directorEmail?: string;
  assetManager?: string;
  /** Regional Maintenance Supervisor */
  regionalMaintenanceSupervisor?: string;
  regionalMaintenanceSupervisorEmail?: string;
  complianceSpecialist?: string;
  complianceSpecialistEmail?: string;
  numberOfUnits?: number;
  defaultReportRecipients?: string;
}

// The four assignable team-member roles, editable from the Admin screen's people picker (backed
// by the Office 365 Users directory) as an alternative to the CSV roster import - CSV writes only
// the name field (no email available in a raw SharePoint export), the picker writes both.
export type TeamRole = 'regionalManager' | 'regionalMaintenanceSupervisor' | 'director' | 'complianceSpecialist';

const ROLE_FIELDS: Record<TeamRole, { name: string; email: string }> = {
  regionalManager: { name: 'cr1e9_regionalmanager', email: 'cr1e9_regionalmanageremail' },
  regionalMaintenanceSupervisor: { name: 'cr1e9_regionalmaintenancesupervisor', email: 'cr1e9_regionalmaintenancesupervisoremail' },
  director: { name: 'cr1e9_director', email: 'cr1e9_directoremail' },
  complianceSpecialist: { name: 'cr1e9_compliancespecialist', email: 'cr1e9_compliancespecialistemail' },
};

function mapCommunity(raw: {
  cr1e9_communitiesid: string;
  cr1e9_name: string;
  cr1e9_communitycode?: string;
  cr1e9_active?: boolean;
  cr1e9_hoppergoal?: number;
  cr1e9_regionalmanager?: string;
  cr1e9_regionalmanageremail?: string;
  cr1e9_propertymanager?: string;
  cr1e9_director?: string;
  cr1e9_directoremail?: string;
  cr1e9_assetmanager?: string;
  cr1e9_regionalmaintenancesupervisor?: string;
  cr1e9_regionalmaintenancesupervisoremail?: string;
  cr1e9_compliancespecialist?: string;
  cr1e9_compliancespecialistemail?: string;
  cr1e9_numberofunits?: number;
  cr1e9_defaultreportrecipients?: string;
}): Community {
  return {
    id: raw.cr1e9_communitiesid,
    name: raw.cr1e9_name,
    code: raw.cr1e9_communitycode || undefined,
    active: raw.cr1e9_active ?? true,
    hopperGoal: raw.cr1e9_hoppergoal ?? 0,
    regionalManager: raw.cr1e9_regionalmanager || undefined,
    regionalManagerEmail: raw.cr1e9_regionalmanageremail || undefined,
    propertyManager: raw.cr1e9_propertymanager || undefined,
    director: raw.cr1e9_director || undefined,
    directorEmail: raw.cr1e9_directoremail || undefined,
    assetManager: raw.cr1e9_assetmanager || undefined,
    regionalMaintenanceSupervisor: raw.cr1e9_regionalmaintenancesupervisor || undefined,
    regionalMaintenanceSupervisorEmail: raw.cr1e9_regionalmaintenancesupervisoremail || undefined,
    complianceSpecialist: raw.cr1e9_compliancespecialist || undefined,
    complianceSpecialistEmail: raw.cr1e9_compliancespecialistemail || undefined,
    numberOfUnits: raw.cr1e9_numberofunits ?? undefined,
    defaultReportRecipients: raw.cr1e9_defaultreportrecipients || undefined,
  };
}

export function useCommunities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await Cr1e9_communitiesesService.getAll({
        select: [
          'cr1e9_communitiesid', 'cr1e9_name', 'cr1e9_communitycode', 'cr1e9_active', 'cr1e9_hoppergoal',
          'cr1e9_regionalmanager', 'cr1e9_regionalmanageremail', 'cr1e9_propertymanager',
          'cr1e9_director', 'cr1e9_directoremail', 'cr1e9_assetmanager',
          'cr1e9_regionalmaintenancesupervisor', 'cr1e9_regionalmaintenancesupervisoremail',
          'cr1e9_compliancespecialist', 'cr1e9_compliancespecialistemail',
          'cr1e9_numberofunits', 'cr1e9_defaultreportrecipients',
        ],
        orderBy: ['cr1e9_name asc'],
      });
      if (result.error) {
        setError(result.error.message ?? 'Failed to load communities');
      } else {
        setCommunities((result.data ?? []).map(mapCommunity));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const updateCommunity = useCallback(async (id: string, changes: { hopperGoal?: number; active?: boolean; defaultReportRecipients?: string }) => {
    const result = await Cr1e9_communitiesesService.update(id, {
      cr1e9_hoppergoal: changes.hopperGoal,
      cr1e9_active: changes.active,
      cr1e9_defaultreportrecipients: changes.defaultReportRecipients,
    } as any);
    if (result.error) throw new Error(result.error.message ?? 'Failed to update community');
    await refresh();
  }, [refresh]);

  // Assigns one person to a role across any number of communities in one action (the Admin
  // screen's "add to multiple sites" people picker). Runs sequentially rather than in parallel -
  // this list is small enough (a handful of communities per assignment, not the whole portfolio)
  // that simplicity matters more than raw speed here.
  const assignTeamMember = useCallback(async (communityIds: string[], role: TeamRole, person: { displayName: string; email: string }) => {
    const fields = ROLE_FIELDS[role];
    for (const id of communityIds) {
      const result = await Cr1e9_communitiesesService.update(id, {
        [fields.name]: person.displayName,
        [fields.email]: person.email,
      } as any);
      if (result.error) throw new Error(result.error.message ?? `Failed to assign ${person.displayName} to a community`);
    }
    await refresh();
  }, [refresh]);

  return { communities, loading, error, refresh, updateCommunity, assignTeamMember };
}
