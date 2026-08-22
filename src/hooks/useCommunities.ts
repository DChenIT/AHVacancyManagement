import { useCallback, useEffect, useState } from 'react';
import { Cr1e9_communitiesesService } from '../generated/services/Cr1e9_communitiesesService';

export interface Community {
  id: string;
  name: string;
  code?: string;
  active: boolean;
  hopperGoal: number;
  /** Regional Property Supervisor, synced from the company's SharePoint property roster */
  regionalManager?: string;
  /** Site Administrator, synced from the company's SharePoint property roster */
  propertyManager?: string;
  director?: string;
  assetManager?: string;
  numberOfUnits?: number;
  defaultReportRecipients?: string;
}

function mapCommunity(raw: {
  cr1e9_communitiesid: string;
  cr1e9_name: string;
  cr1e9_communitycode?: string;
  cr1e9_active?: boolean;
  cr1e9_hoppergoal?: number;
  cr1e9_regionalmanager?: string;
  cr1e9_propertymanager?: string;
  cr1e9_director?: string;
  cr1e9_assetmanager?: string;
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
    propertyManager: raw.cr1e9_propertymanager || undefined,
    director: raw.cr1e9_director || undefined,
    assetManager: raw.cr1e9_assetmanager || undefined,
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
        select: ['cr1e9_communitiesid', 'cr1e9_name', 'cr1e9_communitycode', 'cr1e9_active', 'cr1e9_hoppergoal', 'cr1e9_regionalmanager', 'cr1e9_propertymanager', 'cr1e9_director', 'cr1e9_assetmanager', 'cr1e9_numberofunits', 'cr1e9_defaultreportrecipients'],
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

  return { communities, loading, error, refresh, updateCommunity };
}
